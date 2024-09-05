import Joi from "joi";

export const initializePayment = Joi.object({
    businessId: Joi.string().required().label('Business ID'),
    amount: Joi.number().min(5).required().label('Amount')
})
