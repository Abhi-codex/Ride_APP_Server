import Joi from 'joi';
import { BadRequestError } from '../errors/index.js';

export const validationSchemas = {
  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'Password is required'
    })
  }),

  bedUpdate: Joi.object({
    bedDetails: Joi.object({
      icu: Joi.object({
        total: Joi.number().integer().min(0).max(1000).required(),
        available: Joi.number().integer().min(0).required()
      }).required(),
      general: Joi.object({
        total: Joi.number().integer().min(0).max(5000).required(),
        available: Joi.number().integer().min(0).required()
      }).required(),
      emergency: Joi.object({
        total: Joi.number().integer().min(0).max(500).required(),
        available: Joi.number().integer().min(0).required()
      }).required()
    }).required(),
    totalBeds: Joi.number().integer().min(0).max(10000),
    availableBeds: Joi.number().integer().min(0)
  }).custom((value, helpers) => {
    // Validate available beds don't exceed total beds
    const { bedDetails } = value;
    
    if (bedDetails.icu.available > bedDetails.icu.total) {
      return helpers.error('bed.available.exceeds.total', { type: 'ICU' });
    }
    if (bedDetails.general.available > bedDetails.general.total) {
      return helpers.error('bed.available.exceeds.total', { type: 'General' });
    }
    if (bedDetails.emergency.available > bedDetails.emergency.total) {
      return helpers.error('bed.available.exceeds.total', { type: 'Emergency' });
    }

    return value;
  }).messages({
    'bed.available.exceeds.total': '{{#type}} available beds cannot exceed total beds'
  }),

  locationUpdate: Joi.object({
    latitude: Joi.number().min(-90).max(90).required().messages({
      'number.min': 'Latitude must be between -90 and 90',
      'number.max': 'Latitude must be between -90 and 90',
      'any.required': 'Latitude is required'
    }),
    longitude: Joi.number().min(-180).max(180).required().messages({
      'number.min': 'Longitude must be between -180 and 180',
      'number.max': 'Longitude must be between -180 and 180',
      'any.required': 'Longitude is required'
    }),
    address: Joi.string().max(500).optional(),
    timestamp: Joi.date().optional()
  }),

  createStaff: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required().messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }),
    phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]{10,15}$/).required().messages({
      'string.pattern.base': 'Please provide a valid phone number'
    }),
    hospitalId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
      'string.pattern.base': 'Invalid hospital ID format'
    }),
    role: Joi.string().valid('admin', 'manager', 'coordinator', 'staff').default('staff'),
    department: Joi.string().valid('emergency', 'administration', 'operations', 'logistics').default('emergency'),
    permissions: Joi.object({
      viewDashboard: Joi.boolean().default(true),
      manageDrivers: Joi.boolean().default(false),
      viewRides: Joi.boolean().default(true),
      manageHospitalInfo: Joi.boolean().default(false),
      viewAnalytics: Joi.boolean().default(true)
    }).default({})
  })
};

/**
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} property - Request property to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
export const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req[property], {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        throw new BadRequestError(`Validation error: ${errorMessages.join(', ')}`);
      }

      req[property] = value;
      next();
    } catch (err) {
      next(err);
    }
  };
};

export const sanitizeInput = (req, res, next) => {
  try {
    // Remove any potential MongoDB operators from request body
    const sanitizeObject = (obj) => {
      if (obj && typeof obj === 'object') {
        for (const key in obj) {
          if (key.startsWith('$')) {
            delete obj[key];
          } else if (typeof obj[key] === 'object') {
            sanitizeObject(obj[key]);
          } else if (typeof obj[key] === 'string') {
            obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
          }
        }
      }
    };

    sanitizeObject(req.body);
    sanitizeObject(req.query);
    sanitizeObject(req.params);

    next();
  } catch (error) {
    next(error);
  }
};

export default { validationSchemas, validateRequest, sanitizeInput };
