import translateError from "@/utils/mongod.helper";
import userModel from "../user/user.model";
import IUser from "../user/user.interface";
import * as token from "@/utils/token";
import logger from "@/utils/logger";
import businessModel from "./business.model";
import IBusiness from "./business.interface";
import bcrypt from "bcrypt";
import generateOtp from "@/utils/otp";
import moment from "moment";
import twilio from "twilio";
import { v4 as uuid } from "uuid";
import { randomUUID } from "crypto";
import { ObjectId } from "mongodb";

class BusinessService {
  private readonly twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  public async createBusiness(data: IBusiness, userId: string) {
    try {
      const { name, email, website, country, primaryLanguage } = data;
      const uniqueName = `${name}~${randomUUID()}`;

      // const businessAccount = await this.twilioClient.api.accounts.create({
      //     friendlyName: uniqueName,
      // });

      // const twilioAccount = {
      //     sid: businessAccount.sid,
      //     dateCreated: businessAccount.dateCreated,
      //     dateUpdated: businessAccount.dateUpdated,
      //     status: businessAccount.status,
      //     authToken: businessAccount.authToken,
      // };

      // logger(businessAccount);

      const business = await businessModel.create({
        name,
        uniqueName,
        email,
        website,
        country,
        primaryLanguage,
        admin: userId,
        // twilioAccount,
        allowedActions: [
          {
            action: "answer_faq",
          },
          { action: "end_call" },
        ],
      });

      if (!business)
        throw new Error("Failed to create business. Please try again.");

      return business;
    } catch (error: any) {
      throw new Error(error || "Failed to create business. Please try again.");
    }
  }

  public async getBusiness(id: string): Promise<IBusiness | undefined> {
    try {
      const business: IBusiness | null = await businessModel
        .findById(id)
        .select(
          "name uniqueName website humanOperatorPhoneNumbers email country allowedActions webhook"
        );

      if (!business) throw new Error("Business not found.");

      return business;
    } catch (error: any) {
      throw new Error(
        error || "Failed to retrieve business. Please try again."
      );
    }
  }

  public async getBusinessKnowledgeBase(
    id: string
  ): Promise<IBusiness | undefined> {
    try {
      const business: IBusiness | null = await businessModel
        .findById(id)
        .select("parsedKnowledgeBase");

      if (!business) throw new Error("Business not found.");

      return business;
    } catch (error: any) {
      throw new Error(
        error || "Failed to retrieve business. Please try again."
      );
    }
  }

  public async getAvailablePhoneNumbers(country: string) {
    try {
      const availableNumbers = await this.twilioClient
        .availablePhoneNumbers(country)
        .local.list();
      const price = await this.twilioClient.pricing.v1.phoneNumbers
        .countries(country)
        .fetch();
      logger(availableNumbers);

      const response = {
        availableNumbers,
        price,
      };

      return response;
    } catch (error: any) {
      throw new Error(
        error || "Unable to retrieve available phone numbers. Please try again."
      );
    }
  }

  public async buyPhoneNumber(
    number: string,
    country: string,
    businessId: string
  ): Promise<void> {
    try {
      const business = await businessModel.findById(businessId);

      if (!business) throw new Error("Business not found.");

      const subTwilioClient = twilio(
        business.twilioAccount.sid,
        business.twilioAccount.authToken
      );

      // const purchasedNumber = await subTwilioClient.incomingPhoneNumbers.create(
      //     {
      //         phoneNumber: number,
      //         voiceUrl:
      //             "https://jawfish-needed-safely.ngrok-free.app/support/call/accept",
      //         voiceMethod: "POST",
      //         friendlyName: business.name,
      //     }
      // );

      const price = await this.twilioClient.pricing.v1.phoneNumbers
        .countries(country)
        .fetch();
      logger(price);

      const updatedBusiness = await businessModel.findByIdAndUpdate(
        businessId,
        {
          $push: {
            agentPhoneNumbers: {
              phoneNumber: number,
              country: price.country,
              isoCountry: price.isoCountry,
              numberType: "local",
              basePrice: price.phoneNumberPrices[0].basePrice || 1.15,
              currentPrice: price.phoneNumberPrices[0].currentPrice || 1.15,
              priceUnit: price.priceUnit,
            },
          },
        },
        { new: true }
      );

      logger(updatedBusiness?.agentPhoneNumbers);

      // logger(purchasedNumber);
    } catch (error: any) {
      // logger(error)
      throw new Error(
        error || "Unable to purchase phone number. Please try again."
      );
    }
  }

  public async parseKnowledgeBase(parsedContent: string, businessId: string) {
    try {
      const business = await businessModel.findById(businessId);

      if (!business) throw new Error("Business not found.");

      const updatedBusiness = await businessModel.findByIdAndUpdate(
        businessId,
        {
          parsedKnowledgeBase: parsedContent,
        }
      );

      if (!updatedBusiness)
        throw new Error("Failed to upload knowledge base, please try again.");
    } catch (error: any) {
      throw new Error(
        error || "Unable to upload knowledge base. Please try again."
      );
    }
  }

  public async addAction(
    actionData: {
      action: string;
      schemaData: {
        key: string;
        keyDescription: string;
      }[];
    },
    businessId: string
  ) {
    try {
      const business = await businessModel.findById(businessId);

      if (!business) throw new Error("Business not found.");

      const updatedBusiness = await businessModel.findByIdAndUpdate(
        businessId,
        {
          $push: {
            allowedActions: {
              action: actionData.action,
              schemaData: actionData.schemaData,
            },
          },
        },
        { new: true }
      );

      if (!updatedBusiness)
        throw new Error("Unable to setup agent actions, please try again.");

      logger(updatedBusiness);
    } catch (error: any) {
      logger(error);
      throw new Error(
        error || "Unable to setup agent actions, please try again."
      );
    }
  }

  public async removeAction(businessId: string, actionId: string) {
    try {
      const business = await businessModel.findById(businessId);

      if (!business) throw new Error("Business not found.");

      const updatedBusiness = await businessModel.findOneAndUpdate(
        { _id: new ObjectId(businessId) },
        { $pull: { allowedActions: { _id: new ObjectId(actionId) } } },
        { new: true }
      );

      if (!updatedBusiness)
        throw new Error("Unable to remove agent actions, please try again.");
    } catch (error: any) {
      throw new Error(
        error || "Unable to remove agent actions, please try again."
      );
    }
  }

  public async getBusinessActions(businessId: string) {
    try {
      const actions = await businessModel
        .findById(businessId)
        .select("allowedActions");

      if (!actions) throw new Error("Business not found.");

      return actions;
    } catch (error: any) {
      throw new Error(
        error || "Unable to retrieve agent actions, please try again."
      );
    }
  }

  public async getBusinessAction(businessId: string, actionKeyword: string) {
    try {
      const action = await businessModel.findOne(
        {
          _id: new ObjectId(businessId),
          "allowedActions.action": actionKeyword,
        },
        { "allowedActions.$": 1, webhook: 1 }
      );

      if (!action) throw new Error("action not found.");

      logger(action);

      return action;
    } catch (error: any) {
      throw new Error(
        error || "Unable to retrieve agent action, please try again."
      );
    }
  }

  public async configureBusiness(
    businessId: string,
    humanOperatorPhoneNumbers: string[],
    webhook: string
  ): Promise<IBusiness> {
    try {
      const updatedBusiness = await businessModel.findOneAndUpdate(
        {
          _id: new ObjectId(businessId),
        },
        {
          humanOperatorPhoneNumbers,
          webhook,
        },
        { new: true }
      );

      if (!updatedBusiness)
        throw new Error("Unable to update business. Please try again.");

      return updatedBusiness;
    } catch (error: any) {
      throw new Error(error || "Unable to update business. please try again.");
    }
  }
}

export default BusinessService;
