import Joi from 'joi';

// User registration validation
export const validateRegister = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters',
    'any.required': 'Password is required'
  }),
  firstName: Joi.string().required().messages({
    'any.required': 'First name is required'
  }),
  lastName: Joi.string().required().messages({
    'any.required': 'Last name is required'
  }),
  role: Joi.string().valid('agent', 'manager', 'admin').default('agent')
});

// User login validation
export const validateLogin = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email',
    'any.required': 'Email is required'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  })
});

// User update validation
export const validateUserUpdate = Joi.object({
  firstName: Joi.string(),
  lastName: Joi.string(),
  email: Joi.string().email(),
  role: Joi.string().valid('agent', 'manager', 'admin'),
  active: Joi.boolean()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});