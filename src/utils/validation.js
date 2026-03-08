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

// Client validation
export const validateClient = Joi.object({
  name: Joi.string().required().min(2).max(100).messages({
    'string.min': 'Client name must be at least 2 characters',
    'any.required': 'Client name is required'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email',
    'any.required': 'Email is required'
  }),
  phone: Joi.string().required().min(8).max(20).messages({
    'any.required': 'Phone number is required'
  }),
  address: Joi.object({
    street: Joi.string().allow(''),
    city: Joi.string().allow(''),
    postalCode: Joi.string().allow(''),
    country: Joi.string().allow('')
  }),
  company: Joi.string().allow(''),
  taxId: Joi.string().allow(''),
  notes: Joi.string().allow('')
});

// Invoice validation
export const validateInvoice = Joi.object({
  invoiceNumber: Joi.string().required().uppercase().messages({
    'any.required': 'Invoice number is required'
  }),
  client: Joi.string().required().messages({
    'any.required': 'Client ID is required'
  }),
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Amount must be positive',
    'any.required': 'Amount is required'
  }),
  dueDate: Joi.date().greater('now').required().messages({
    'date.greater': 'Due date must be in the future',
    'any.required': 'Due date is required'
  }),
  issueDate: Joi.date().default(Date.now),
  description: Joi.string().allow(''),
  items: Joi.array().items(Joi.object({
    description: Joi.string().required(),
    quantity: Joi.number().positive().required(),
    unitPrice: Joi.number().positive().required(),
    amount: Joi.number().positive().required()
  }))
});

// Payment validation
export const validatePayment = Joi.object({
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Payment amount must be positive',
    'any.required': 'Payment amount is required'
  }),
  paymentMethod: Joi.string().valid('cash', 'bank_transfer', 'check', 'credit_card', 'other').required().messages({
    'any.only': 'Payment method must be one of: cash, bank_transfer, check, credit_card, other',
    'any.required': 'Payment method is required'
  }),
  paymentDate: Joi.date().default(Date.now),
  reference: Joi.string().allow(''),
  notes: Joi.string().allow('')
});

// Collection action validation
export const validateCollectionAction = Joi.object({
  invoice: Joi.string().required().messages({
    'any.required': 'Invoice ID is required'
  }),
  actionType: Joi.string().valid('phone_call', 'email', 'meeting', 'reminder_letter', 'legal_notice', 'visit').required().messages({
    'any.only': 'Invalid action type',
    'any.required': 'Action type is required'
  }),
  actionDate: Joi.date().default(Date.now),
  notes: Joi.string().allow(''),
  result: Joi.string().allow(''),
  nextActionDate: Joi.date().greater('now').allow(null),
  contactPerson: Joi.string().allow(''),
  contactEmail: Joi.string().email().allow(''),
  contactPhone: Joi.string().allow(''),
  duration: Joi.number().min(0).allow(null),
  legalReference: Joi.string().allow(''),
  legalDocument: Joi.string().allow('')
});

// FIXED: Invoice update validation (partial updates)
export const validateInvoiceUpdate = Joi.object({
  description: Joi.string(),
  dueDate: Joi.date().greater('now'),
  items: Joi.array().items(Joi.object({
    description: Joi.string().required(),
    quantity: Joi.number().positive().required(),
    unitPrice: Joi.number().positive().required(),
    amount: Joi.number().positive().required()
  })),
  status: Joi.string().valid('cancelled'), // Simplified - just allow 'cancelled' status
  cancelledReason: Joi.string().when('status', {
    is: 'cancelled',
    then: Joi.required(),
    otherwise: Joi.forbidden() // Don't allow cancelledReason if status is not cancelled
  })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// Fixed: Collection action update validation
export const validateCollectionActionUpdate = Joi.object({
  status: Joi.string().valid('planned', 'completed', 'cancelled', 'failed'),
  notes: Joi.string(),
  result: Joi.string(),
  nextActionDate: Joi.date().greater('now').allow(null),
  duration: Joi.number().min(0).allow(null)
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});