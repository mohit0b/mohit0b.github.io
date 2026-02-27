const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const trackingController = require('../controllers/trackingController');
const { authenticate, authorize } = require('../middleware/auth');
const { 
  updateLocationValidation,
  trackingHistoryValidation,
  shipmentIdValidation
} = require('../validators/shipmentValidators');

router.post('/update', 
  authenticate, 
  authorize('driver'), 
  updateLocationValidation, 
  asyncHandler(trackingController.updateLocation)
);

router.get('/:shipment_id', 
  authenticate, 
  shipmentIdValidation, 
  asyncHandler(trackingController.getTrackingInfo)
);

router.get('/:shipment_id/history', 
  authenticate, 
  trackingHistoryValidation, 
  asyncHandler(trackingController.getLocationHistory)
);

module.exports = router;
