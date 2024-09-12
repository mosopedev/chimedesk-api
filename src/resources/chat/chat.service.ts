import logger from "@/utils/logger";
import twilio from "twilio";
import OpenAI from "openai";
import axios from "axios";
import { ObjectId } from "mongodb";
import chatModel from "./chat.model";
import { randomUUID } from "crypto";
import agentModel from "../agent/agent.model";
import server from "../../server";

class ChatService {
  private readonly openAiClient = new OpenAI({
    organization: process.env.OPENAI_ORG_ID,
    project: process.env.OPENAI_PROJECT_ID,
    apiKey: process.env.OPENAI_SECRET_KEY,
  });

  public async createChatSession(agentId: string) {
    try {
      const io = server.socketIO;
      if (!io)
        throw new Error(
          "Unable to establish socket connection. Please try again."
        );

      const sessionId = randomUUID();

      const chatSession = await chatModel.create({
        agentId,
        sessionId,
      });

      io.on("connection", (socket) => {
        logger("A user connected");
        socket.join(sessionId)

        io.to(sessionId).emit("receiveMessage", {
          sender: 'bot',
          message: "Hello there, welcome to chimedesk support. How can we help today."
        });

        socket.on("sendMessage", (message) => {
          logger("Received message:", message);
          io.emit("receiveMessage", message);
        });

        socket.on("disconnect", () => {
          logger("User disconnected");
        });
      });

      return {
        sessionId
      };
    } catch (error: any) {
      throw new Error(error || "Unable to create agent. Please try again.");
    }
  }
}

export default ChatService;
