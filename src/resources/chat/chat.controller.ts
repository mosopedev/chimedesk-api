import IController from "@/interfaces/controller.interface";
import logger from "@/utils/logger";
import { Router, Request, NextFunction, Response } from "express";
import OpenAI from "openai";
import * as validation from "../agent/agent.validation";
import AgentService from "../agent/agent.service";
import HttpException from "../../exceptions/http.exception";
import successResponse from "@/utils/success";
import validationMiddleware from "@/middlewares/validation.middleware";
import authenticatedMiddleware from "@/middlewares/authenticate.middleware";
import ChatService from "../chat/chat.service";
import { verifyAgentApiKey } from "@/middlewares/agent.auth.middleware";

class ChatController implements IController {
  public readonly path = "/agent";
  public readonly router = Router();
  private readonly chatService = new ChatService();

  constructor() {
    this.initializeEndpoints();
  }

  private initializeEndpoints(): void {
    this.router.post(`${this.path}/chat/session`, verifyAgentApiKey, this.createChatSession)
  }

  private createChatSession = async (
    req: Request | any,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      logger(req.agent)
      const response = await this.chatService.createChatSession(req.agent)

      successResponse(201, "Chat session created", res, response)
    } catch (error: any) {
      logger(error);
      return next(new HttpException(400, error.message));
    }
  }

}

export default ChatController;
