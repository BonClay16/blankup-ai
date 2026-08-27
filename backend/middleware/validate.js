const Joi = require('joi');

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const schemas = {
  register: Joi.object({
    username: Joi.string().min(3).max(30).required().messages({
      'any.required': 'Username is required',
      'string.min': 'Username must be at least 3 characters',
      'string.max': 'Username must be at most 30 characters',
    }),
    password: Joi.string().min(8).required().messages({
      'any.required': 'Password is required',
      'string.min': 'Password must be at least 8 characters',
    }),
    email: Joi.string().email().allow('', null).optional().messages({
      'string.email': 'Invalid email format',
    }),
    phone: Joi.string().pattern(/^(0|\+84)\d{9,10}$/).allow('', null).optional().messages({
      'string.pattern.base': 'Invalid Vietnamese phone number',
    }),
    fullName: Joi.string().max(100).allow('', null).optional(),
  }),

  login: Joi.object({
    email: Joi.string().required().messages({
      'any.required': 'Email is required',
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required',
    }),
  }),

  comment: Joi.object({
    text: Joi.string().min(1).max(1000).required().messages({
      'any.required': 'Comment text is required',
      'string.min': 'Comment cannot be empty',
      'string.max': 'Comment must be at most 1000 characters',
    }),
  }),

  order: Joi.object({
    items: Joi.array().min(1).required().messages({
      'any.required': 'Items are required',
      'array.min': 'At least one item is required',
    }),
    address: Joi.string().min(10).required().messages({
      'any.required': 'Address is required',
      'string.min': 'Address must be at least 10 characters',
    }),
    phone: Joi.string().required().messages({
      'any.required': 'Phone number is required',
    }),
    voucher: Joi.string().allow('', null).optional(),
  }),

  otpVerify: Joi.object({
    userId: Joi.string().required(),
    type: Joi.string().valid('email', 'phone').required(),
    code: Joi.string().length(6).required().messages({
      'string.length': 'OTP code must be 6 digits',
    }),
  }),
};

// ---------------------------------------------------------------------------
// Middleware: validate request body against a Joi schema
// ---------------------------------------------------------------------------

function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const message = error.details.map(d => d.message).join('; ');
      return res.status(400).json({ success: false, error: message });
    }
    req.body = value;
    next();
  };
}

module.exports = { validateBody, schemas };
