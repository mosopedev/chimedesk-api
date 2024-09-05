import { model, Schema, SchemaType } from "mongoose";
import IAgent from "./agent.interface";

const AgentModel = new Schema(
  {
    agentName: { type: String, required: true, trim: true },
    agentType: {
      type: String,
      enum: ["chat", "call", "email"],
      required: true,
    },
    agentPhoneNumbers: [
      {
        phoneNumber: { type: String },
        country: { type: String },
        isoCountry: { type: String },
        numberType: { type: String },
        basePrice: { type: Number },
        currentPrice: { type: Number },
        priceUnit: { type: String },
      },
    ],
    agentWebhook: { type: String },
    agentPersona: { type: String, default: "Caring and Humorous" },
    allowedActions: [
      {
        action: {
          type: String,
        },
        schemaData: [
          {
            key: { type: String },
            keyDescription: { type: String },
          },
        ],
      },
    ],
    agentPrimaryLanguage: { type: String },
    businessId: { type: String }
  },
  {
    timestamps: true,
  }
);

export default model<IAgent>("Agent", AgentModel);
