import translateError from "@/utils/mongod.helper";
import userModel from "../user/user.model";
import IUser from "../user/user.interface";
import * as token from "@/utils/token";
import logger from "@/utils/logger";
import businessModel from "../business/business.model";
import IBusiness from "../business/business.interface";
import bcrypt from "bcrypt";
import generateOtp from "@/utils/otp";
import moment from "moment";
import twilio from "twilio";
import { v4 as uuid } from "uuid";
import { randomUUID } from "crypto";
import { ObjectId } from "mongodb";
import UsageService from "../usage/usage.service";
import billingModel from "./billing.model";
import IBilling from "./billing.interface";
import Stripe from "stripe";
import agentModel from "../agent/agent.model";

class BillingService {
  private readonly usageService = new UsageService();
  private readonly stripe = new Stripe(`${process.env.STRIPE_SECRET_KEY}`);

  public async getBusinessBalance(
    businessId: string,
    userId: string
  ): Promise<{ balance: number; currency: string }> {
    try {
      const business = await businessModel.findById(businessId).select("admin");

      if (!business) throw new Error("Business not found");

      if (business.admin.toString() !== userId)
        throw new Error("Action unauthorized.");

      const totalUsage = await this.usageService.getTotalBusinessUsage(
        businessId
      );

      const transactions = await billingModel.aggregate([
        {
          $match: {
            businessId: new ObjectId(businessId),
            status: "success",
          },
        },
        {
          $group: {
            _id: {
              currency: "$currency",
            },
            credit: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$transactionType", "credit"],
                  },
                  "$amount",
                  0,
                ],
              },
            },
            debit: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$transactionType", "debit"],
                  },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            currency: "$_id.currency",
            balance: { $subtract: ["$credit", "$debit"] },
          },
        },
      ]);

      logger(totalUsage, transactions);


      //TODO: call agent usage will be included when calls ship 
      const balance = (transactions[0]?.balance || 0) - (totalUsage.tokenUsage || 0);

      return {
        balance: balance / 100, // convert to dollars
        currency: transactions[0]?.currency || 'USD',
      };
    } catch (error: any) {
      logger(error);
      throw new Error("Unable to retrieve business balance.");
    }
  }

  public async createPaymentIntent(
    businessId: string,
    userId: string,
    amount: number
  ) {
    try {
      const business = await businessModel.findById(businessId).select("admin");

      logger(business);

      if (!business) throw new Error("Business not found");

      if (business.admin.toString() !== userId)
        throw new Error("Action unauthorized.");

      const user = await userModel
        .findById(userId)
        .select("email stripeCustomer");

      const paymentIntent = await this.stripe.paymentIntents.create({
        customer: `${user?.stripeCustomer.id}`,
        amount: amount * 100, // amount in cents
        currency: "USD",
        setup_future_usage: "on_session",
        automatic_payment_methods: {
          enabled: true,
        },
      });

      const billing = await billingModel.create({
        transactionType: "credit",
        currency: "USD",
        status: "pending",
        amount: amount * 100,
        description: "Fund Balance",
        businessId,
        paymentDetails: paymentIntent,
        paymentIntentId: paymentIntent.id,
      });

      return {
        clientSecret: paymentIntent.client_secret,
      };
    } catch (error: any) {
      throw new Error(
        error || "Unable to initialize payment. Please try again."
      );
    }
  }

  public async debitMonthlyPhoneBill() {
    try {
      const agents = await agentModel
        .find({}, { _id: 1, agentPhoneNumbers: 1, businessId: 1 })
        .lean();

      if (agents.length === 0)
        throw new Error("No businesses found. Exiting.");

      agents.forEach(async (agent) => {
        if (agent.agentPhoneNumbers) {
          const monthlyPhoneFees = agent.agentPhoneNumbers.map(
            (phoneNumber) => ({
              businessId: agent.businessId,
              agentId: agent._id,
              transactionType: "debit",
              currency: phoneNumber.priceUnit,
              status: "success",
              amount: Number(phoneNumber.currentPrice) * 100,
              description: `${phoneNumber.phoneNumber} monthly fee`,
            })
          );

          await billingModel.insertMany(monthlyPhoneFees, { ordered: false });
        }
      });
    } catch (error: any) {
      throw new Error(error || "Debit monthly phone bill job failed.");
    }
  }

  public async updatePaymentIntent(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case "payment_intent.succeeded":
          {
            const payment = await billingModel.findOneAndUpdate(
              { paymentIntentId: event.data.object.id },
              { status: "success" },
              { new: true }
            );

            if (!payment) throw new Error("Unable to update payment.");
          }
          break;
        case "payment_intent.canceled":
          {
            const payment = await billingModel.findOneAndUpdate(
              { paymentIntentId: event.data.object.id },
              { status: "canceled" },
              { new: true }
            );

            if (!payment) throw new Error("Unable to update payment.");
          }
          break;
        case "payment_intent.payment_failed":
          {
            const payment = await billingModel.findOneAndUpdate(
              { paymentIntentId: event.data.object.id },
              { status: "failed" },
              { new: true }
            );

            if (!payment) throw new Error("Unable to update payment.");
          }
          break;
        default:
          break;
      }
    } catch (error: any) {
      throw new Error(error || "Unable to update payment");
    }
  }
}

export default BillingService;
