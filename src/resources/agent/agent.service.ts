import translateError from "@/utils/mongod.helper";
import userModel from "../user/user.model";
import logger from "@/utils/logger";
import businessModel from "../business/business.model";
import BusinessService from "../business/business.service";
import twilio from "twilio";
import OpenAI from "openai";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
import { RunSubmitToolOutputsParamsStream } from "openai/lib/AssistantStream";
import { RunSubmitToolOutputsAndPollParams } from "openai/resources/beta/threads/runs/runs";

const getBusiness = async (id: string) => {
    try {
        logger("get business called!!! ");
        const business = await new BusinessService().getBusiness(id);

        return business;
    } catch (error: any) {
        throw new Error();
    }
};

class AgentService {
    private readonly openAiClient = new OpenAI({
        organization: process.env.OPENAI_ORG_ID,
        project: process.env.OPENAI_PROJECT_ID,
        apiKey: process.env.OPENAI_SECRET_KEY,
    });
    private readonly twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
    );
    private readonly businessService = new BusinessService();

    public async getBusiness(id: string) {
        try {
            logger("get business called!!! ");
            const business = await this.businessService.getBusiness(id);

            if(!business) throw new Error("Business not found")

            return business;
        } catch (error: any) {
            throw new Error();
        }
    }

    public async getBusinessKnowledgeBase(id: string) {
        try {
            const business = await this.businessService.getBusinessKnowledgeBase(id);
            if(!business) throw new Error("Business not found")
            return business;
        } catch (error: any) {
            throw new Error();
        }
    }

    public async acceptCall(twiml: VoiceResponse) {
        try {
            const thread = await this.openAiClient.beta.threads.create();

            logger(thread);

            twiml.say("Hello, how can i be of service today ?");

            twiml.gather({
                action: `/support/call/analyze?bus_id=66d0fe088997741dcf774bec&th_id=${thread.id}&ass_id=${process.env.ASSISTANT_ID}`,
                input: ["speech"],
                speechTimeout: "2",
                method: "post",
                speechModel: "experimental_conversations",
            });

            return twiml;
        } catch (error: any) {
            logger(error);
            twiml.say("Sorry an error has occurred, Please try again later");
            twiml.hangup();

            throw new Error(error || "an error has occurred, Please try again later");
        }
    }

    public async analyzeIntent(
        twiml: VoiceResponse,
        th_id: string,
        bus_id: string,
        agent_id: string,
        speechResult: string
    ) {
        try {
            const userMessage = await this.openAiClient.beta.threads.messages.create(
                th_id,
                {
                    role: "user",
                    content: JSON.stringify({
                        businessId: bus_id,
                        customerInput: speechResult,
                    }),
                }
            );
            logger(userMessage);
    
            const runObject = await this.openAiClient.beta.threads.runs.createAndPoll(
                th_id,
                {
                    assistant_id: agent_id,
                }
            );
    
            const toolCalls = runObject.required_action?.submit_tool_outputs.tool_calls;
    
            if (toolCalls) {
                const functionCallOutputs: any = await Promise.all(toolCalls.map(async (toolCall) => {
                    logger(toolCall);
                    logger(toolCall.function.name);
    
                    const args = JSON.parse(toolCall.function.arguments);
    
                    if (toolCall.function.name == "getBusiness") {
                        return {
                            output: JSON.stringify(await this.getBusiness(args.id)),
                            tool_call_id: toolCall.id,
                        };
                    } else if (toolCall.function.name == "getBusinessKnowledgeBase") {
                        return {
                            output: JSON.stringify(await this.getBusinessKnowledgeBase(args.id)),
                            tool_call_id: toolCall.id,
                        };
                    }
                }));
    
                const run = await this.openAiClient.beta.threads.runs.submitToolOutputsAndPoll(
                    th_id,
                    runObject.id,
                    { tool_outputs: functionCallOutputs }
                );
            }
    
            const message = (await this.openAiClient.beta.threads.messages.list(th_id)).data;
    
            logger(message);
    
            let lastMessage = message[0].content[0];
            let messageText: any;
    
            if (lastMessage.type == 'text') {
                messageText = lastMessage.text.value.replace(/```json|```/g, '').trim();
            }
    
            logger(messageText);
    
            const agentResponse = JSON.parse(messageText);
    
            logger(agentResponse);
    
            twiml.say(agentResponse.responseMessage);
    
            const runSteps = await this.openAiClient.beta.threads.runs.steps.list(
                th_id,
                runObject.id
            );
            logger(runSteps);
    
            twiml.gather({
                action: `/support/call/analyze?bus_id=66d0fe088997741dcf774bec&th_id=${th_id}&ass_id=${process.env.ASSISTANT_ID}`,
                input: ["speech"],
                speechTimeout: "2",
                method: "post",
                speechModel: "experimental_conversations",
            });
    
            return twiml;
        } catch (error: any) {
            logger(error);
            twiml.say("Sorry, an error has occurred. Please try again later.");
            twiml.hangup();
    
            throw new Error(error.message || "An error has occurred. Please try again later.");
        }
    }
    
}

export default AgentService;
