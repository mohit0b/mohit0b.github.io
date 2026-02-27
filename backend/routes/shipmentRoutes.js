const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const shipmentController = require('../controllers/shipmentController');
const { authenticate, authorize } = require('../middleware/auth');
const { 
  createShipmentValidation, 
  queryValidation,
  shipmentIdValidation,
  trackingNumberValidation,
  confirmDeliveryValidation
} = require('../validators/shipmentValidators');

router.post('/', 
  authenticate, 
  authorize('admin'), 
  createShipmentValidation, 
  asyncHandler(shipmentController.createShipment)
);

router.get('/', 
  authenticate, 
  queryValidation, 
  asyncHandler(shipmentController.getShipments)
);

router.get('/tracking/:tracking_number', 
  authenticate, 
  trackingNumberValidation, 
  asyncHandler(shipmentController.getShipmentByTrackingNumber)
);

router.post('/:id/confirm-delivery', 
  authenticate, 
  authorize('driver'), 
  confirmDeliveryValidation, 
  asyncHandler(shipmentController.confirmDelivery)
);

router.get('/assigned', 
  authenticate, 
  authorize('driver'), 
  asyncHandler(shipmentController.getAssignedShipments)
);

// Demo endpoint - create test shipment for current driver
router.post('/demo', 
  authenticate, 
  authorize('driver'), 
  asyncHandler(shipmentController.createDemoShipment)
);

router.get('/:id', 
  authenticate, 
  shipmentIdValidation, 
  asyncHandler(shipmentController.getShipment)
);

module.exports = router;
