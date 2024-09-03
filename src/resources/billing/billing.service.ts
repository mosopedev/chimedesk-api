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

class BillingService {
  private readonly usageService = new UsageService();

  public async getBusinessBalance(businessId: string):Promise<{balance: number, currency: string}> {
    try {
      const totalUsage = await this.usageService.getTotalBusinessUsage(
        businessId
      );

      const transactions = await billingModel.aggregate([
        {
          $match: {
            businessId: new ObjectId(businessId),
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

      const balance =
        transactions[0].balance -
        (totalUsage.callUsage + totalUsage.tokenUsage[0]?.total || 0);


      return {
        balance,
        currency: transactions[0].currency
      };
    } catch (error: any) {
        logger(error)
      throw new Error("Unable to retrieve business balance.");
    }
  }

  public async creditBalance(businessId: string) {
    try {
        
    } catch (error: any) {
        
    }
  }

  public async debitMonthlyPhoneBill() {
    try {
      const businesses = await businessModel
        .find({}, { _id: 1, agentPhoneNumbers: 1 })
        .lean();

      logger(businesses);
      if (businesses.length === 0)
        throw new Error("No businesses found. Exiting.");

      businesses.forEach(async (business) => {
        if (business.agentPhoneNumbers) {
          const monthlyPhoneFees = business.agentPhoneNumbers.map(
            (phoneNumber) => ({
              businessId: business._id,
              transactionType: "debit",
              currency: phoneNumber.priceUnit,
              status: "success",
              amount: phoneNumber.currentPrice,
              description: `${phoneNumber.phoneNumber} monthly fee`,
            })
          );

          await billingModel.insertMany(monthlyPhoneFees, { ordered: false });
        }
      });
    } catch (error: any) {
        throw new Error(error || 'Debit monthly phone bill job failed.')
    }
  }
}

export default BillingService;
