export default interface IBilling {
  transactionType: string;
  currency: string;
  status: string;
  processingFees?: number;
  amount: number;
  description: String;
  businessId: String;
  paymentDetails: {},
  paymentIntentId: string;
}
