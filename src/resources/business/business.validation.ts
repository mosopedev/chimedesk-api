import Joi from "joi";

export const createBusiness = Joi.object({
    name: Joi.string().required().label('Business Name'),
    website: Joi.string().label('Website'),
    email: Joi.string().email().required().label('Business Email'),
    country: Joi.string().required().label('Country'),
    primaryLanguage: Joi.string().required().label('Primary Language'),
})

export const buyPhoneNumber = Joi.object({
    businessId: Joi.string().required().label('Business ID'),
    phoneNumber: Joi.string().required().label('Phone Number'),
})

export const addAgentAction = Joi.object({
    businessId: Joi.string().required().label('Business ID'),
    actionData: Joi.object({
        action: Joi.string().required(),
        schemaData: Joi.array().items(
            Joi.object({
                key: Joi.string().required(),
                keyDescription: Joi.string().required()
            })
        )
    }).required()
})


export const removeAction = Joi.object({
    businessId: Joi.string().required().label('Business ID'),
    actionId: Joi.string().required().label('Action ID'),
})