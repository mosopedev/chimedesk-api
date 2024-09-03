import IController from "@/interfaces/controller.interface";
import logger from "@/utils/logger";
import { Router, Request, NextFunction, Response } from "express";
import OpenAI from "openai";

import twilio from "twilio";
import Voice from "twilio/lib/rest/Voice";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
import AgentService from "./agent.service";
import HttpException from "../../exceptions/http.exception";

class AgentController implements IController {
    public readonly path = "/agent";
    public readonly router = Router();
    private readonly agentService = new AgentService;
    private readonly openAiClient = new OpenAI({
        organization: process.env.OPENAI_ORG_ID,
        project: process.env.OPENAI_PROJECT_ID,
        apiKey: process.env.OPENAI_SECRET_KEY,
    });
    private readonly client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
    );

    constructor() {
        this.initializeEndpoints();
    }

    private initializeEndpoints(): void {
        this.router.post(`${this.path}/call/accept`, this.acceptPhoneCall);
        this.router.post(`${this.path}/call/analyze`, this.analyzeIntent);
        this.router.post(`${this.path}/call/responder`, this.actionResponder)
    }

    private acceptPhoneCall = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const twiml = new VoiceResponse();

            const updatedTwiml = await this.agentService.acceptCall(twiml)

            res.type("text/xml");
            res.send(updatedTwiml.toString());
        } catch (error: any) {            
            logger(error);
            return next(new HttpException(400, error.message));
        }
    };

    private analyzeIntent = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { SpeechResult } = req.body;
            logger(SpeechResult);

            const twiml = new VoiceResponse();

            let { th_id, bus_id, ass_id }: any = req.query;

            const updatedTwiml = await this.agentService.analyzeIntent(twiml, th_id, bus_id, ass_id, SpeechResult)

            res.type("text/xml");
            res.send(updatedTwiml.toString());
        } catch (error: any) {
            logger(error);
            return next(new HttpException(400, error.message));
        }
    };

    private actionResponder = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {

            // gets the last message and responds to user, and gather after to redirect to analayzer

            const twiml = new VoiceResponse();

            let { th_id, bus_id, ass_id, run_id }: any = req.query;
            const updatedTwiml = await this.agentService.actionResponder(twiml, th_id, bus_id, ass_id, run_id)
           
            res.type("text/xml");
            res.send(updatedTwiml?.toString());
        } catch (error: any) { 
            logger(error);
            return next(new HttpException(400, error.message));
        }
    };
}

export default AgentController;
