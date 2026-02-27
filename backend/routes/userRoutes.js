const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

// Get all users (admin only)
router.get('/', 
  authenticate, 
  authorize('admin'), 
  asyncHandler(userController.getAllUsers)
);

// Get user by ID
router.get('/:id', 
  authenticate, 
  authorize('admin'), 
  asyncHandler(userController.getUserById)
);

// Get drivers (for tracking)
router.get('/drivers', 
  authenticate, 
  authorize('admin'), 
  asyncHandler(userController.getDrivers)
);

module.exports = router;
