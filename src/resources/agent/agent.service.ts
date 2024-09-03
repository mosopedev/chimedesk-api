import translateError from "@/utils/mongod.helper";
import userModel from "../user/user.model";
import logger from "@/utils/logger";
import businessModel from "../business/business.model";
import BusinessService from "../business/business.service";
import twilio from "twilio";
import OpenAI from "openai";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
import IAgentResponse from "@/interfaces/agent.response.interface";
import IBusiness from "../business/business.interface";
import axios from "axios";
import UsageService from "../usage/usage.service";

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
    private readonly usageService = new UsageService

    public async acceptCall(twiml: VoiceResponse) {
        try {
            const thread = await this.openAiClient.beta.threads.create();

            logger(thread);

            twiml.say("Hello, how can i be of service today ?");

            twiml.gather({
                action: `/agent/call/analyze?bus_id=66d26f260dad2d324b7d1822&th_id=${thread.id}&ass_id=${process.env.ASSISTANT_ID}`,
                input: ["speech"],
                speechTimeout: "2",
                method: "post",
                speechModel: "experimental_conversations",
                // actionOnEmptyResult: true
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
        speechResult: string,
        actionResult?: string,
    ) {
        try {
            await this.openAiClient.beta.threads.messages.create(
                th_id,
                {
                    role: "user",
                    content: JSON.stringify({
                        businessId: bus_id,
                        customerInput: speechResult,
                        actionResult,
                    }),
                }
            );

            let runObject = await this.openAiClient.beta.threads.runs.createAndPoll(
                th_id,
                {
                    assistant_id: agent_id,
                }
            );

            logger("run object in analyzer", runObject)

            const toolCalls = runObject.required_action?.submit_tool_outputs.tool_calls;

            if (toolCalls) {
                const functionCallOutputs: any = await Promise.all(toolCalls.map(async (toolCall) => {
                    // logger(toolCall);
                    logger("Function called: ", toolCall.function.name);
                    logger("Function args ", toolCall.function.arguments)

                    const args = JSON.parse(toolCall.function.arguments);

                    if (toolCall.function.name == "getBusiness") {
                        return {
                            output: JSON.stringify(await this.businessService.getBusiness(args.id)),
                            tool_call_id: toolCall.id,
                        };
                    } else if (toolCall.function.name == "getBusinessKnowledgeBase") {
                        return {
                            output: JSON.stringify(await this.businessService.getBusinessKnowledgeBase(args.id)),
                            tool_call_id: toolCall.id,
                        };
                    }
                }));

                runObject = await this.openAiClient.beta.threads.runs.submitToolOutputsAndPoll(
                    th_id,
                    runObject.id,
                    { tool_outputs: functionCallOutputs }
                );
            }

            // logger(runObject)
            while (true) {
                if (runObject.completed_at != null) {
                    const message = (await this.openAiClient.beta.threads.messages.list(th_id)).data;

                    let lastMessage = message[0].content[0];
                    let messageText: any;
                                
                    if (lastMessage.type == 'text') {
                        messageText = lastMessage.text.value.replace(/```json|```/g, '').trim();
                    }

                    const agentResponse = JSON.parse(messageText);

                    await this.actionHandler(agentResponse, twiml, th_id, bus_id, agent_id)

                    if(runObject.usage) this.usageService.addTokenUsage(runObject.usage, bus_id, th_id)

                    break;
                }
            }

            return twiml;
        } catch (error: any) {
            logger(error);
            twiml.say("Sorry, an error has occurred. Please try again later.");
            twiml.hangup();

            throw new Error(error.message || "An error has occurred. Please try again later.");
        }
    }

    private async actionHandler(agentResponse: IAgentResponse, twiml: VoiceResponse, th_id: string, bus_id: string, ass_id: string) {
        try {
            logger(agentResponse)

            if ((agentResponse.action == null && agentResponse.isActionConfirmation == false) || (agentResponse.action != null && agentResponse.isActionConfirmation == true) || (agentResponse.action == null && agentResponse.isActionConfirmation == true)) {
                twiml.say(agentResponse.responseMessage)

                twiml.gather({
                    action: `/agent/call/analyze?bus_id=66d26f260dad2d324b7d1822&th_id=${th_id}&ass_id=${process.env.ASSISTANT_ID}`,
                    input: ["speech"],
                    speechTimeout: "2",
                    method: "post",
                    speechModel: "experimental_conversations",
                });
            } else if (agentResponse.action == 'end_call' && agentResponse.isActionConfirmation == false) {
                twiml.say(agentResponse.responseMessage)
                twiml.hangup()
            } else if (agentResponse.action == 'forward_call_to_human_agent' && agentResponse.isActionConfirmation == false) {
                twiml.say(agentResponse.responseMessage)

                const business = await this.businessService.getBusiness(bus_id)

                logger(business?.humanOperatorPhoneNumbers)

                if (!business?.humanOperatorPhoneNumbers || business.humanOperatorPhoneNumbers.length < 1) throw new Error("Unable to transfer you. No human operator phone numbers provided")

                const phoneNumber = business.humanOperatorPhoneNumbers[
                    Math.floor(Math.random() * business.humanOperatorPhoneNumbers.length)
                ];

                const dial = twiml.dial()
                dial.number(phoneNumber)

            } else if (agentResponse.action != null && agentResponse.isActionConfirmation == false) {
                twiml.say(agentResponse.responseMessage)
                
                const business: IBusiness = await this.businessService.getBusinessAction(bus_id, agentResponse.action)

                if (!business.allowedActions) throw new Error("Invalid action")

                const response = await axios({
                    method: 'POST',
                    url: business.webhook,
                    data: {
                        action: agentResponse.action,
                        schemaData: agentResponse.schemaData
                    }
                })

                logger(response.data)

                twiml.pause({
                    length: 5
                })

                const userMessage = await this.openAiClient.beta.threads.messages.create(
                    th_id,
                    {
                        role: "user",
                        content: JSON.stringify({
                            businessId: bus_id,
                            customerInput: "",
                            actionResult: response.data,
                        }),
                    }
                );

                logger("action result message ", userMessage);

                twiml.say("Please hold. I am confirming the status of your request.")

                let runObject = await this.openAiClient.beta.threads.runs.createAndPoll(
                    th_id,
                    {
                        assistant_id: ass_id,
                    }
                );

                logger("action result run ", runObject);

                twiml.redirect(`/agent/call/responder?bus_id=66d26f260dad2d324b7d1822&th_id=${th_id}&ass_id=${process.env.ASSISTANT_ID}&run_id=${runObject.id}`)

                logger("After redirect!!!")
                const toolCalls = runObject.required_action?.submit_tool_outputs.tool_calls;

                if (toolCalls) {
                    const functionCallOutputs: any = await Promise.all(toolCalls.map(async (toolCall) => {
                        // logger(toolCall);
                        logger("Function called: ", toolCall.function.name);

                        const args = JSON.parse(toolCall.function.arguments);

                        if (toolCall.function.name == "getBusiness") {
                            return {
                                output: JSON.stringify(await this.businessService.getBusiness(args.id)),
                                tool_call_id: toolCall.id,
                            };
                        } else if (toolCall.function.name == "getBusinessKnowledgeBase") {
                            return {
                                output: JSON.stringify(await this.businessService.getBusinessKnowledgeBase(args.id)),
                                tool_call_id: toolCall.id,
                            };
                        }
                    }));

                    runObject = await this.openAiClient.beta.threads.runs.submitToolOutputsAndPoll(
                        th_id,
                        runObject.id,
                        { tool_outputs: functionCallOutputs }
                    );

                    if(runObject.usage) this.usageService.addTokenUsage(runObject.usage, bus_id, th_id)
                }

            } else {
                logger("agent response in else block", agentResponse)

            }

        } catch (error: any) {
            logger(error);
            twiml.say("Sorry, an error has occurred. Please try again later.");
            twiml.hangup();

            throw new Error(error.message || "An error has occurred. Please try again later.");
        }
    }

    public async actionResponder(twiml: VoiceResponse, th_id: string, bus_id: string, ass_id: string, run_id: string) {
        try {
            logger('inside action responder!!!')
            const run = await this.openAiClient.beta.threads.runs.retrieve(th_id, run_id)

            while (true) {
                if (run.completed_at != null) {
                    const message = (await this.openAiClient.beta.threads.messages.list(th_id)).data;

                    let lastMessage = message[0].content[0];
                    let messageText: any;

                    if (lastMessage.type == 'text') {
                        messageText = lastMessage.text.value.replace(/```json|```/g, '').trim();
                    }

                    const agentResponse = JSON.parse(messageText);

                    twiml.say(agentResponse.responseMessage)

                    twiml.gather({
                        action: `/agent/call/analyze?bus_id=66d26f260dad2d324b7d1822&th_id=${th_id}&ass_id=${process.env.ASSISTANT_ID}`,
                        input: ["speech"],
                        speechTimeout: "2",
                        method: "post",
                        speechModel: "experimental_conversations",
                    });

                    break;
                }
            }
            return twiml
        } catch (error: any) {

        }
    }

}

export default AgentService;
