const { validate } = require('../middleware/validator');

const registerSchema = {
  body: {
    name: {
      required: true,
      type: 'string',
      minLength: 2,
      maxLength: 100
    },
    email: {
      required: true,
      type: 'string',
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    password: {
      required: true,
      type: 'string',
      minLength: 8,
      maxLength: 128
    },
    role: {
      required: false,
      type: 'string',
      enum: ['admin', 'driver']
    },
    organizationId: {
      required: false,
      type: 'number',
      min: 1
    }
  }
};

const loginSchema = {
  body: {
    email: {
      required: true,
      type: 'string',
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    password: {
      required: true,
      type: 'string'
    }
  }
};

module.exports = {
  registerValidation: validate(registerSchema),
  loginValidation: validate(loginSchema)
};
