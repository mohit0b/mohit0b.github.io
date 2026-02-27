const express = require('express');
const router = express.Router();

const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const shipmentRoutes = require('./shipmentRoutes');
const trackingRoutes = require('./trackingRoutes');

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/shipments', shipmentRoutes);
router.use('/tracking', trackingRoutes);

module.exports = router;
