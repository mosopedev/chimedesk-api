import Joi from "joi";

export const createBusiness = Joi.object({
    name: Joi.string().required().label('Business Name'),
    website: Joi.string().label('Website'),
    email: Joi.string().email().required().label('Business Email'),
    country: Joi.string().required().label('Country'),
    primaryLanguage: Joi.string().required().label('Primary Language'),
})
