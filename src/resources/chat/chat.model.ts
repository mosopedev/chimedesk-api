import { model, Schema, SchemaType } from "mongoose";
import IChat from "./chat.interface";

const ChatModel = new Schema(
  {
    agentId: { type: Schema.ObjectId, ref: "Agent", required: true },
    messages: [{
      message: {type: String},
      sender: { type: String },
      timestamp: { type: Date }
    }],
    sessionId: { type: String, required: true },
    customerSatisfactionRating: { type: String }
  },
  {
    timestamps: true,
  }
);

export default model<IChat>("Chat", ChatModel);
