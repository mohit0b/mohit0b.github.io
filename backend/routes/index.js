const express = require('express');
const router = express.Router();

const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const shipmentRoutes = require('./shipmentRoutes');
const trackingRoutes = require('./trackingRoutes');
const smartTrackingRoutes = require('./smartTrackingRoutes');

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/shipments', shipmentRoutes);
router.use('/tracking', trackingRoutes);
router.use('/smart', smartTrackingRoutes); // New smart tracking endpoints

module.exports = router;
