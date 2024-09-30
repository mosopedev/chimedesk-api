import logger from "@/utils/logger";
import twilio from "twilio";
import OpenAI from "openai";
import axios from "axios";
import { ObjectId } from "mongodb";
import chatModel from "./chat.model";
import { randomUUID } from "crypto";
import agentModel from "../agent/agent.model";
import server from "../../server";
import { Socket } from "socket.io";
import IAgent from "../agent/agent.interface";
import { Agent } from "http";
import businessModel from "../business/business.model";
import BusinessService from "../business/business.service";
import IAgentResponse from "@/interfaces/agent.response.interface";
import AgentService from "../agent/agent.service";
import UsageService from "../usage/usage.service";


export const setupSocketListeners = (io: any) => {
  logger('called')
  const chatService = new ChatService()

  io?.on("connection", async (socket: Socket) => {
    let session = '';
    // Now you can manage sessions for each connected client
    socket.on("joinSession", async (sessionId: any) => {
      logger('join session called')
      logger(sessionId)
      session = sessionId;
      await socket.join(sessionId);

      io.to(sessionId).emit("serverMessage", {
        sender: 'bot',
        message: "Hello there, welcome to chimedesk support. How can we help today."
      });
    });

    socket.on("clientMessage", async (data: any) => {
      logger("Received message:", data);

      const intentObject = await chatService.intentAnalyzer(data.message, data.business, data.agent, data.thread)
      logger('agent intent', intentObject)
      await chatService.actionHandler(intentObject, data.business, data.agent, data.thread, io, session)

      // io.to(session).emit("serverMessage", {
      //   sender: 'bot',
      //   message: `bot response for msg: ${data.message}`
      // });
    });

    socket.on("disconnect", () => {
      logger("User disconnected");
    });
  });

};
class ChatService {
  private readonly openAiClient = new OpenAI({
    organization: process.env.OPENAI_ORG_ID,
    project: process.env.OPENAI_PROJECT_ID,
    apiKey: process.env.OPENAI_SECRET_KEY,
  });
  private readonly businessService = new BusinessService();
  private readonly usageService = new UsageService();
  private readonly agentService = new AgentService();

  public async createChatSession(agentId: string) {
    try {
      const io = server.socketIO;

      const agent: IAgent | null = await agentModel.findById(agentId)

      if (!agent) throw new Error("Invalid agent credentials. Please ensure the correct agent ID is used.")

      if (!io)
        throw new Error(
          "Unable to establish socket connection. Please try again."
        );

      const sessionId = randomUUID();

      const chatSession = await chatModel.create({
        agentId,
        sessionId,
      });

      const thread = await this.openAiClient.beta.threads.create();

      return {
        sessionId,
        businessId: agent.businessId,
        threadId: thread.id
      };
    } catch (error: any) {
      logger(error)
      throw new Error(error || "Unable to create agent. Please try again.");
    }
  }

  public async intentAnalyzer(message: string, businessId: string, agentId: string, threadId: string, actionResult?: string) {
    try {

      await this.openAiClient.beta.threads.messages.create(threadId, {
        role: "user",
        content: JSON.stringify({
          businessId: businessId,
          agentId: agentId,
          customerInput: message,
          actionResult,
        }),
      });

      let runObject = await this.openAiClient.beta.threads.runs.createAndPoll(
        threadId,
        {
          assistant_id: `${process.env.ASSISTANT_ID}`,
        }
      );

      const toolCalls =
        runObject.required_action?.submit_tool_outputs.tool_calls;

      if (toolCalls) {
        const functionCallOutputs: any = await Promise.all(
          toolCalls.map(async (toolCall) => {
            // logger(toolCall);
            logger("Function called: ", toolCall.function.name);
            logger("Function args ", toolCall.function.arguments);

            const args = JSON.parse(toolCall.function.arguments);

            if (toolCall.function.name == "getBusiness") {
              return {
                output: JSON.stringify(
                  await this.businessService.getBusinessAndAgent(
                    args.id,
                    args.agentId
                  )
                ),
                tool_call_id: toolCall.id,
              };
            } else if (toolCall.function.name == "getBusinessKnowledgeBase") {
              return {
                output: JSON.stringify(
                  await this.businessService.getBusinessKnowledgeBase(args.id)
                ),
                tool_call_id: toolCall.id,
              };
            }
          })
        );

        runObject =
          await this.openAiClient.beta.threads.runs.submitToolOutputsAndPoll(
            threadId,
            runObject.id,
            { tool_outputs: functionCallOutputs }
          );
      }

      while (true) {
        if (runObject.completed_at != null) {
          const message = (
            await this.openAiClient.beta.threads.messages.list(threadId)
          ).data;

          let lastMessage = message[0].content[0];
          let messageText: any;

          if (lastMessage.type == "text") {
            messageText = lastMessage.text.value
              .replace(/```json|```/g, "")
              .trim();
          }

          const agentResponse = JSON.parse(messageText);
          return agentResponse
        }
      }

    } catch (error: any) {

    }
  }

  public async actionHandler(
    agentResponse: IAgentResponse,
    businessId: string,
    agentId: string,
    threadId: string,
    io: Socket,
    sessionId: string
  ) {
    try {
      logger(agentResponse);

      if (
        (agentResponse.action == null &&
          agentResponse.isActionConfirmation == false) ||
        (agentResponse.action != null &&
          agentResponse.isActionConfirmation == true) ||
        (agentResponse.action == null &&
          agentResponse.isActionConfirmation == true)
      ) {
        io.to(sessionId).emit("serverMessage", {
          sender: 'bot',
          message: agentResponse.responseMessage
        });

      } else if (
        agentResponse.action != null &&
        agentResponse.isActionConfirmation == false
      ) {

        io.to(sessionId).emit("serverMessage", {
          sender: 'bot',
          message: agentResponse.responseMessage,
          actionCompleted: false
        });

        const agent: IAgent = await this.agentService.getAgentAction(
          agentId,
          agentResponse.action
        );

        if (!agent.allowedActions) throw new Error("Invalid action");

        const response = await axios({
          method: "POST",
          url: agent.agentWebhook,
          data: {
            action: agentResponse.action,
            schemaData: agentResponse.schemaData,
          },
        });

        logger(response.data);

        const userMessage =
          await this.openAiClient.beta.threads.messages.create(threadId, {
            role: "user",
            content: JSON.stringify({
              businessId: businessId,
              customerInput: "",
              actionResult: response.data,
            }),
          });

        logger("action result message ", userMessage);

        let runObject = await this.openAiClient.beta.threads.runs.createAndPoll(
          threadId,
          {
            assistant_id: `${process.env.ASSISTANT_ID}`,
          }
        );

        const toolCalls =
          runObject.required_action?.submit_tool_outputs.tool_calls;

        if (toolCalls) {
          const functionCallOutputs: any = await Promise.all(
            toolCalls.map(async (toolCall) => {
              // logger(toolCall);
              logger("Function called: ", toolCall.function.name);

              const args = JSON.parse(toolCall.function.arguments);

              if (toolCall.function.name == "getBusiness") {
                return {
                  output: JSON.stringify(
                    await this.businessService.getBusinessAndAgent(
                      args.id,
                      args.agentId
                    )
                  ),
                  tool_call_id: toolCall.id,
                };
              } else if (toolCall.function.name == "getBusinessKnowledgeBase") {
                return {
                  output: JSON.stringify(
                    await this.businessService.getBusinessKnowledgeBase(args.id)
                  ),
                  tool_call_id: toolCall.id,
                };
              }
            })
          );

          runObject =
            await this.openAiClient.beta.threads.runs.submitToolOutputsAndPoll(
              threadId,
              runObject.id,
              { tool_outputs: functionCallOutputs }
            );
        }

        while (true) {
          if (runObject.completed_at != null) {
            const message = (
              await this.openAiClient.beta.threads.messages.list(threadId)
            ).data;
  
            let lastMessage = message[0].content[0];
            let messageText: any;
  
            if (lastMessage.type == "text") {
              messageText = lastMessage.text.value
                .replace(/```json|```/g, "")
                .trim();
            }
  
            const agentResponse = JSON.parse(messageText);
            
            io.to(sessionId).emit("serverMessage", {
              sender: 'bot',
              message: agentResponse.responseMessage,
              actionCompleted: true
            });
  
            if (runObject.usage)
              this.usageService.addTokenUsage(
                runObject.usage,
                businessId,
                threadId,
                agentId
              );
  
            break;
          }
        }

      } else {
        logger("agent response in else block", agentResponse);
      }
    } catch (error: any) {
      logger(error);

      throw new Error(
        error.message || "An error has occurred. Please try again later."
      );
    }
  }
}

export default ChatService;
