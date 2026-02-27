const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const {
    updateLocation,
    getTrackingData,
    getRecommendations,
    acknowledgeRecommendation,
    completeRouteAnalysis,
    getDriverAnalytics
} = require('../controllers/smartTrackingController');

// Middleware for validation
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

// Smart location update with recommendations
router.post('/location/update', [
    body('shipment_id').isInt({ min: 1 }).withMessage('Shipment ID must be a positive integer'),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
    body('accuracy').optional().isFloat({ min: 0 }).withMessage('Accuracy must be a positive number'),
    body('speed').optional().isFloat({ min: 0, max: 200 }).withMessage('Speed must be between 0 and 200 m/s'),
    body('heading').optional().isFloat({ min: 0, max: 360 }).withMessage('Heading must be between 0 and 360 degrees')
], handleValidationErrors, updateLocation);

// Get enhanced tracking data with analysis
router.get('/tracking/:shipmentId', getTrackingData);

// Get recommendations for a shipment
router.get('/recommendations/:shipmentId', [
    body('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], handleValidationErrors, getRecommendations);

// Acknowledge a recommendation
router.put('/recommendations/:recommendationId/acknowledge', acknowledgeRecommendation);

// Complete route analysis and save to history
router.post('/route-analysis/:shipmentId', completeRouteAnalysis);

// Get driver performance analytics
router.get('/analytics/driver/:driverId', [
    body('period').optional().isInt({ min: 1, max: 365 }).withMessage('Period must be between 1 and 365 days')
], handleValidationErrors, getDriverAnalytics);

module.exports = router;
