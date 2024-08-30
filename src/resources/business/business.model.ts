import { model, Schema } from "mongoose";
import IBusiness from "./business.interface";

const BusinessModel = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    uniqueName: { type: String, required: true },
    agentPhoneNumbers: [{ type: String }],
    admin: { type: Schema.ObjectId, ref: "User", required: true },
    parsedKnowledgeBase: { type: String },
    website: { type: String },
    humanOperatorPhoneNumbers: [{ type: String }],
    email: { type: String, required: true },
    country: { type: String, required: true, enum: ['US', 'CA'] },
    PrimaryLanguage: { type: String },
    webhook: { type: String },
    allowedActions: [
      {
        action: {
          type: String,
          enum: [
            "get_order_by_id",
            "get_product_by_id",
            "get_delivery_status_by_id",
            "cancel_order_by_id",
            "create_appointment",
            "cancel_appointment",
            "reschedule_appointment",
            "answer_faq",
            "end_call"
          ],
        },
        schemaData: [
          {
            key: { type: String },
            keyDescription: { type: String },
          },
        ],
      },
    ],
    twilioAccount: {
        sid: { type: String },
        dateCreated: { type: Date },
        dateUpdated: { type: Date },
        status: { type: String },
        authToken: { type: String }
    }
  },
  {
    timestamps: true,
  }
);

export default model<IBusiness>("Business", BusinessModel);


