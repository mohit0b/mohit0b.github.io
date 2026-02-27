const UserModel = require('../models/User');
const { AppError } = require('../middleware/errorHandler');

const getAllUsers = async (req, res) => {
  const users = await UserModel.findAll();
  
  res.status(200).json({
    success: true,
    data: users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id,
      created_at: user.created_at
    }))
  });
};

const getUserById = async (req, res) => {
  const { id } = req.params;
  const user = await UserModel.findById(parseInt(id));
  
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }
  
  res.status(200).json({
    success: true,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id,
      created_at: user.created_at
    }
  });
};

const getDrivers = async (req, res) => {
  const drivers = await UserModel.findByRole('driver');
  
  res.status(200).json({
    success: true,
    data: drivers.map(driver => ({
      id: driver.id,
      name: driver.name,
      email: driver.email,
      role: driver.role,
      organization_id: driver.organization_id,
      created_at: driver.created_at
    }))
  });
};

module.exports = {
  getAllUsers,
  getUserById,
  getDrivers
};
