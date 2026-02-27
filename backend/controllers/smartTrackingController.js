/**
 * Enhanced Tracking Controller with Smart Recommendations
 * Integrates real-time tracking with intelligent recommendation system
 */

const { pool } = require('../config/database');
const RecommendationService = require('../services/recommendationService');
const ETAService = require('../services/etaService');
const RouteAnalysisService = require('../services/routeAnalysisService');

// Initialize services
const recommendationService = new RecommendationService();
const etaService = new ETAService();
const routeAnalysisService = new RouteAnalysisService();

/**
 * Update location with smart analysis
 */
async function updateLocation(req, res) {
    try {
        const { shipment_id, latitude, longitude, accuracy, speed, heading, timestamp } = req.body;
        
        // Validate input
        if (!shipment_id || !latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: shipment_id, latitude, longitude'
            });
        }

        // Get shipment details
        const [shipmentRows] = await pool.execute(
            'SELECT * FROM shipments WHERE id = ?',
            [shipment_id]
        );
        
        if (shipmentRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Shipment not found'
            });
        }

        const shipment = shipmentRows[0];
        
        // Save location to database
        const [result] = await pool.execute(
            `INSERT INTO tracking_locations 
            (shipment_id, latitude, longitude, accuracy, speed, heading, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [shipment_id, latitude, longitude, accuracy, speed, heading || timestamp]
        );

        // Get recent tracking history for analysis
        const [trackingHistory] = await pool.execute(
            `SELECT * FROM tracking_locations 
            WHERE shipment_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 20`,
            [shipment_id]
        );

        // 1. Generate smart recommendations
        const recommendations = await recommendationService.analyzeTrackingData(
            shipment_id, 
            { latitude, longitude, accuracy, speed, heading, timestamp }
        );

        // 2. Calculate dynamic ETA
        const etaData = await etaService.calculateETA(
            shipment,
            { latitude, longitude },
            trackingHistory
        );

        // 3. Update shipment with new ETA and risk score
        await pool.execute(
            `UPDATE shipments 
            SET current_latitude = ?, current_longitude = ?, 
            predicted_eta = ?, eta_confidence = ?, risk_score = ?
            WHERE id = ?`,
            [
                latitude, longitude,
                etaData.eta,
                etaData.confidence,
                calculateRiskScore(recommendations),
                shipment_id
            ]
        );

        // 4. Save recommendations to database
        for (const recommendation of recommendations) {
            await recommendationService.saveRecommendation(shipment_id, recommendation);
        }

        // 5. Emit real-time updates
        const io = req.app.get('io');
        if (io) {
            // Location update to admin dashboard
            io.emit('location_update', {
                shipment_id,
                driver_id: shipment.driver_id,
                latitude,
                longitude,
                accuracy,
                speed,
                heading,
                timestamp,
                eta: etaData.eta,
                confidence: etaData.confidence
            });

            // Emit recommendation alerts
            if (recommendations.length > 0) {
                io.emit('recommendation_alert', {
                    shipment_id,
                    driver_id: shipment.driver_id,
                    recommendations,
                    timestamp: new Date().toISOString()
                });
            }
        }

        res.json({
            success: true,
            data: {
                location_id: result.insertId,
                eta: etaData.eta,
                confidence: etaData.confidence,
                recommendations,
                risk_score: calculateRiskScore(recommendations)
            }
        });

    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

/**
 * Get tracking data with analysis
 */
async function getTrackingData(req, res) {
    try {
        const { shipmentId } = req.params;
        
        // Get basic tracking data
        const [trackingRows] = await pool.execute(
            `SELECT * FROM tracking_locations 
            WHERE shipment_id = ? 
            ORDER BY timestamp DESC`,
            [shipmentId]
        );

        // Get recommendations
        const recommendations = await recommendationService.getRecommendations(shipmentId);

        // Get route analysis if route is complete
        const routeAnalysis = await routeAnalysisService.analyzeRoutePerformance(
            shipmentId, 
            trackingRows
        );

        // Get ETA prediction
        const [shipmentRows] = await pool.execute(
            'SELECT * FROM shipments WHERE id = ?',
            [shipmentId]
        );
        
        let etaPrediction = null;
        if (shipmentRows.length > 0 && trackingRows.length > 0) {
            etaPrediction = await etaService.calculateETA(
                shipmentRows[0],
                trackingRows[trackingRows.length - 1],
                trackingRows
            );
        }

        res.json({
            success: true,
            data: {
                tracking_data: trackingRows,
                recommendations,
                route_analysis: routeAnalysis,
                eta_prediction: etaPrediction
            }
        });

    } catch (error) {
        console.error('Error getting tracking data:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

/**
 * Get active recommendations
 */
async function getRecommendations(req, res) {
    try {
        const { shipmentId } = req.params;
        const { limit = 10 } = req.query;
        
        const recommendations = await recommendationService.getRecommendations(
            shipmentId, 
            parseInt(limit)
        );

        res.json({
            success: true,
            data: recommendations
        });

    } catch (error) {
        console.error('Error getting recommendations:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

/**
 * Acknowledge recommendation
 */
async function acknowledgeRecommendation(req, res) {
    try {
        const { recommendationId } = req.params;
        
        const success = await recommendationService.acknowledgeRecommendation(
            parseInt(recommendationId)
        );

        if (success) {
            res.json({
                success: true,
                message: 'Recommendation acknowledged'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Recommendation not found'
            });
        }

    } catch (error) {
        console.error('Error acknowledging recommendation:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

/**
 * Complete route analysis and save to history
 */
async function completeRouteAnalysis(req, res) {
    try {
        const { shipmentId } = req.params;
        
        // Get all tracking data for this shipment
        const [trackingRows] = await pool.execute(
            `SELECT * FROM tracking_locations 
            WHERE shipment_id = ? 
            ORDER BY timestamp ASC`,
            [shipmentId]
        );

        if (trackingRows.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient tracking data for analysis'
            });
        }

        // Perform comprehensive route analysis
        const routeAnalysis = await routeAnalysisService.analyzeRoutePerformance(
            shipmentId, 
            trackingRows
        );

        if (!routeAnalysis) {
            return res.status(500).json({
                success: false,
                message: 'Failed to analyze route'
            });
        }

        // Save to route history
        await etaService.saveRouteHistory(shipmentId, {
            total_distance: routeAnalysis.total_distance,
            total_time: routeAnalysis.total_time,
            average_speed: routeAnalysis.average_speed,
            delay_minutes: routeAnalysis.delay_minutes
        });

        // Update driver performance metrics
        await updateDriverPerformance(shipmentId, routeAnalysis);

        res.json({
            success: true,
            data: routeAnalysis
        });

    } catch (error) {
        console.error('Error completing route analysis:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

/**
 * Get driver performance analytics
 */
async function getDriverAnalytics(req, res) {
    try {
        const { driverId } = req.params;
        const { period = '7' } = req.query; // days
        
        const [performanceData] = await pool.execute(
            `SELECT * FROM driver_performance 
            WHERE driver_id = ? 
            AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            ORDER BY date DESC`,
            [driverId, parseInt(period)]
        );

        // Get route analysis comparison
        const [comparisonData] = await pool.execute(
            `SELECT 
                AVG(average_speed) as avg_speed,
                AVG(route_efficiency) as avg_efficiency,
                COUNT(*) as total_routes
            FROM route_history rh
            JOIN shipments s ON rh.shipment_id = s.id
            WHERE s.driver_id = ?
            AND rh.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
            [driverId, parseInt(period)]
        );

        res.json({
            success: true,
            data: {
                performance_metrics: performanceData,
                comparison: comparisonData[0] || {},
                period_days: parseInt(period)
            }
        });

    } catch (error) {
        console.error('Error getting driver analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

/**
 * Calculate risk score based on recommendations
 */
function calculateRiskScore(recommendations) {
    if (!recommendations || recommendations.length === 0) {
        return 0;
    }

    let riskScore = 0;
    
    recommendations.forEach(rec => {
        switch (rec.severity) {
            case 'high':
                riskScore += 30;
                break;
            case 'medium':
                riskScore += 15;
                break;
            case 'low':
                riskScore += 5;
                break;
        }
    });

    return Math.min(riskScore, 100); // Cap at 100
}

/**
 * Update driver performance metrics
 */
async function updateDriverPerformance(shipmentId, routeAnalysis) {
    try {
        // Get driver ID from shipment
        const [shipmentRows] = await pool.execute(
            'SELECT driver_id FROM shipments WHERE id = ?',
            [shipmentId]
        );

        if (shipmentRows.length === 0) return;

        const driverId = shipmentRows[0].driver_id;
        const today = new Date().toISOString().split('T')[0];

        // Update or insert daily performance
        await pool.execute(
            `INSERT INTO driver_performance 
            (driver_id, date, total_shipments, completed_shipments, 
             total_distance, average_speed, route_efficiency_score, 
             max_speed, idle_time)
            VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            total_shipments = VALUES(total_shipments) + 1,
            completed_shipments = VALUES(completed_shipments) + 1,
            total_distance = VALUES(total_distance) + total_distance,
            average_speed = (VALUES(average_speed) + average_speed) / 2,
            route_efficiency_score = (VALUES(route_efficiency_score) + route_efficiency_score) / 2,
            max_speed = GREATEST(VALUES(max_speed), max_speed),
            idle_time = VALUES(idle_time) + idle_time`,
            [
                driverId, today,
                routeAnalysis.total_distance / 1000, // Convert to km
                routeAnalysis.average_speed,
                routeAnalysis.route_efficiency * 100, // Convert to percentage
                routeAnalysis.max_speed,
                routeAnalysis.idle_time
            ]
        );

    } catch (error) {
        console.error('Error updating driver performance:', error);
    }
}

module.exports = {
    updateLocation,
    getTrackingData,
    getRecommendations,
    acknowledgeRecommendation,
    completeRouteAnalysis,
    getDriverAnalytics
};
