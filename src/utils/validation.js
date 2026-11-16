import Joi from 'joi';

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


export const validateLogin = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email',
    'any.required': 'Email is required'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  })
});


export const validateUserUpdate = Joi.object({
  firstName: Joi.string(),
  lastName: Joi.string(),
  email: Joi.string().email(),
  role: Joi.string().valid('agent', 'manager', 'admin'),
  active: Joi.boolean()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});


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


export const validateInvoiceUpdate = Joi.object({
  description: Joi.string(),
  dueDate: Joi.date().greater('now'),
  items: Joi.array().items(Joi.object({
    description: Joi.string().required(),
    quantity: Joi.number().positive().required(),
    unitPrice: Joi.number().positive().required(),
    amount: Joi.number().positive().required()
  })),
  status: Joi.string().valid('cancelled'),
  cancelledReason: Joi.string().when('status', {
    is: 'cancelled',
    then: Joi.required(),
    otherwise: Joi.forbidden() 
  })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});


// Status is not editable here: it only changes through PATCH /collections/:id/status (workflow rules).
export const validateCollectionActionUpdate = Joi.object({
  notes: Joi.string(),
  result: Joi.string(),
  nextActionDate: Joi.date().greater('now').allow(null),
  duration: Joi.number().min(0).allow(null)
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

const objectId = Joi.string().hex().length(24).messages({
  'string.hex': 'Invalid identifier',
  'string.length': 'Invalid identifier'
});

export const MAX_AGENTS_PER_CLIENT = 3;

export const validateClientUpdate = validateClient
  .fork(['name', 'email', 'phone'], schema => schema.optional())
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided for update'
  });


export const validateAssignAgents = Joi.object({
  agents: Joi.array().items(objectId).unique().max(MAX_AGENTS_PER_CLIENT).required().messages({
    'array.max': `A client can have at most ${MAX_AGENTS_PER_CLIENT} assigned agents`,
    'array.unique': 'An agent can only be assigned once',
    'any.required': 'Agents list is required'
  })
});


export const validateStatusTransition = Joi.object({
  status: Joi.string().valid('planned', 'completed', 'failed', 'cancelled').required().messages({
    'any.only': 'Status must be one of: planned, completed, failed, cancelled',
    'any.required': 'Target status is required'
  }),
  result: Joi.string().allow('').max(1000),
  actionDate: Joi.date()
});


export const validateStatsQuery = Joi.object({
  from: Joi.date(),
  to: Joi.date().when('from', { is: Joi.exist(), then: Joi.date().min(Joi.ref('from')) }).messages({
    'date.min': 'End date must be after start date'
  }),
  agent: objectId,
  client: objectId
});


export const validateAuditQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  user: objectId,
  action: Joi.string().pattern(/^[a-z_.]+$/).max(50),
  entity: Joi.string().valid('User', 'Client', 'Invoice', 'CollectionAction'),
  entityId: objectId,
  from: Joi.date(),
  to: Joi.date()
});
