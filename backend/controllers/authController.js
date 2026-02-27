const jwt = require('jsonwebtoken');
const UserModel = require('../models/User');
const config = require('../config');
const { AppError } = require('../middleware/errorHandler');

const generateToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    algorithm: config.jwt.algorithm
  });
};

const register = async (req, res) => {
  const { name, email, password, role = 'driver', organizationId } = req.body;

  if (!['admin', 'driver'].includes(role)) {
    throw new AppError('Invalid role. Must be admin or driver', 400, 'INVALID_ROLE');
  }

  const user = await UserModel.create({
    name,
    email,
    password,
    role,
    organizationId
  });

  const token = generateToken(user);

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId
      },
      token
    }
  });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Email and password are required', 400, 'MISSING_CREDENTIALS');
  }

  const user = await UserModel.findByEmail(email);
  if (!user) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  const isValidPassword = await UserModel.validatePassword(password, user.password_hash);
  if (!isValidPassword) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.is_active) {
    throw new AppError('Account is deactivated', 403, 'ACCOUNT_DEACTIVATED');
  }

  await UserModel.updateLastLogin(user.id);

  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organization_id
  });

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        lastLoginAt: user.last_login_at
      },
      token
    }
  });
};

const getProfile = async (req, res) => {
  const user = await UserModel.findById(req.user.id);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    }
  });
};

module.exports = {
  register,
  login,
  getProfile
};
