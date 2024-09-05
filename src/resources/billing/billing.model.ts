import { model, Schema } from "mongoose";
import IBilling from "./billing.interface";

const BillingModel = new Schema(
  {
    transactionType: {
      type: String,
      trim: true,
      enum: ['credit', 'debit'],
      required: true
    },
    currency: { type: String, enum: ['USD'], required: true },
    status: {
      type: String,
      trim: true,
      default: 'pending',
      enum: ['pending', 'success', 'failed', 'canceled'],
      required: true
    },
    processingFees: { type: Number, default: 0 },
    amount: {
      type: Number,
      required: true
    },
    description: { type: String, required: true },
    businessId: { type: Schema.ObjectId, ref: 'Business', required: true },
    paymentDetails: { type: Object },
    paymentIntentId: { type: String }
  },
  {
    timestamps: true,
  }
);

export default model<IBilling>("Billing", BillingModel);


