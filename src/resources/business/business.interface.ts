export default interface IBusiness {
    name: string;
    uniqueName: string;
    agentPhoneNumbers?: string[];
    admin: string;
    parsedKnowledgeBase?: string;
    website?: string;
    humanOperatorPhoneNumbers?: string[];
    email: string;
    country: string;
    primaryLanguage: string;
    webhook?: string;
    allowedActions?: Array<{
      action: string;
      schemaData: Array<{
        key: string;
        keyDescription: string;
      }>;
    }>;
    twilioAccount: {
        sid: string;
        dateCreated: Date;
        dateUpdated: Date;
        status: string;
        authToken: string
    };
  }
  