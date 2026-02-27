const db = require('../config/database');
const UserModel = require('../models/User');
const ShipmentModel = require('../models/Shipment');
const TrackingLocationModel = require('../models/TrackingLocation');

const initializeDatabase = async () => {
  try {
    await UserModel.createTable();
    await ShipmentModel.createTable();
    await TrackingLocationModel.createTable();
    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    throw error;
  }
};

module.exports = { initializeDatabase };
