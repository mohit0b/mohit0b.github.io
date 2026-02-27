const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const healthController = require('../controllers/healthController');

router.get('/health', asyncHandler(healthController.getHealth));
router.get('/ready', asyncHandler(healthController.getReadiness));
router.get('/live', asyncHandler(healthController.getLiveness));

module.exports = router;
