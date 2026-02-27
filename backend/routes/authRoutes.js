const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { registerValidation, loginValidation } = require('../validators/authValidators');

router.post('/register', registerValidation, asyncHandler(authController.register));
router.post('/login', loginValidation, asyncHandler(authController.login));
router.get('/profile', authenticate, asyncHandler(authController.getProfile));

module.exports = router;
