const { AppError } = require('./errorHandler');

const validate = (schema) => {
  return (req, res, next) => {
    const errors = [];

    if (schema.body) {
      const bodyErrors = validateObject(req.body, schema.body, 'body');
      errors.push(...bodyErrors);
    }

    if (schema.params) {
      const paramErrors = validateObject(req.params, schema.params, 'params');
      errors.push(...paramErrors);
    }

    if (schema.query) {
      const queryErrors = validateObject(req.query, schema.query, 'query');
      errors.push(...queryErrors);
    }

    if (errors.length > 0) {
      return next(new AppError(
        `Validation failed: ${errors.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      ));
    }

    next();
  };
};

const validateObject = (data, schema, location) => {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${location}.${field} is required`);
      continue;
    }

    if (value !== undefined && value !== null) {
      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push(`${location}.${field} must be a string`);
      }
      if (rules.type === 'number' && (typeof value !== 'number' || isNaN(value))) {
        errors.push(`${location}.${field} must be a number`);
      }
      if (rules.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`${location}.${field} must be a boolean`);
      }
      if (rules.type === 'array' && !Array.isArray(value)) {
        errors.push(`${location}.${field} must be an array`);
      }

      if (rules.minLength && String(value).length < rules.minLength) {
        errors.push(`${location}.${field} must be at least ${rules.minLength} characters`);
      }

      if (rules.maxLength && String(value).length > rules.maxLength) {
        errors.push(`${location}.${field} must be at most ${rules.maxLength} characters`);
      }

      if (rules.pattern && !rules.pattern.test(String(value))) {
        errors.push(`${location}.${field} format is invalid`);
      }

      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${location}.${field} must be one of: ${rules.enum.join(', ')}`);
      }

      if (rules.min !== undefined && Number(value) < rules.min) {
        errors.push(`${location}.${field} must be at least ${rules.min}`);
      }

      if (rules.max !== undefined && Number(value) > rules.max) {
        errors.push(`${location}.${field} must be at most ${rules.max}`);
      }
    }
  }

  return errors;
};

module.exports = {
  validate
};
