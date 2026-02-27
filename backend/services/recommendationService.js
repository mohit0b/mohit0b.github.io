/**
 * LinkNode Recommendation Engine
 * Intelligent logistics recommendation system
 */

const { getShipmentById } = require('../controllers/shipmentController');
const { getTrackingData } = require('../controllers/trackingController');

class RecommendationService {
    constructor() {
        this.recommendationTypes = {
            ROUTE_DEVIATION: 'route_change',
            DELAY_ALERT: 'delay_alert',
            RISK_ALERT: 'risk_alert',
            PERFORMANCE: 'performance',
            GPS_WARNING: 'gps_warning',
            IDLE_ALERT: 'idle_alert'
        };
        
        this.severityLevels = {
            LOW: 'low',
            MEDIUM: 'medium',
            HIGH: 'high'
        };
    }

    /**
     * Analyze real-time tracking data and generate recommendations
     */
    async analyzeTrackingData(shipmentId, locationData) {
        try {
            const shipment = await getShipmentById(shipmentId);
            const trackingHistory = await getTrackingData(shipmentId);
            
            const recommendations = [];
            
            // 1. Check route deviation
            const routeDeviation = await this.analyzeRouteDeviation(shipment, locationData, trackingHistory);
            if (routeDeviation) recommendations.push(routeDeviation);
            
            // 2. Check delay probability
            const delayAnalysis = await this.analyzeDelayProbability(shipment, trackingHistory);
            if (delayAnalysis) recommendations.push(delayAnalysis);
            
            // 3. Check speed patterns
            const speedAnalysis = await this.analyzeSpeedPatterns(locationData, trackingHistory);
            if (speedAnalysis) recommendations.push(speedAnalysis);
            
            // 4. Check idle time
            const idleAnalysis = await this.analyzeIdleTime(locationData, trackingHistory);
            if (idleAnalysis) recommendations.push(idleAnalysis);
            
            // 5. Check GPS accuracy
            const gpsAnalysis = await this.analyzeGPSAccuracy(locationData);
            if (gpsAnalysis) recommendations.push(gpsAnalysis);
            
            return recommendations;
        } catch (error) {
            console.error('Error in recommendation analysis:', error);
            return [];
        }
    }

    /**
     * Analyze route deviation from optimal path
     */
    async analyzeRouteDeviation(shipment, currentLocation, trackingHistory) {
        if (!shipment || !currentLocation || trackingHistory.length < 2) {
            return null;
        }

        // Calculate expected route (straight line from start to destination)
        const startLocation = trackingHistory[0];
        const deviation = this.calculateDeviation(
            startLocation, 
            shipment.destination_address, 
            currentLocation
        );

        if (deviation > 1000) { // 1km deviation threshold
            return {
                type: this.recommendationTypes.ROUTE_DEVIATION,
                message: `Driver has deviated ${Math.round(deviation/1000)}km from optimal route. Consider route correction.`,
                severity: deviation > 5000 ? this.severityLevels.HIGH : this.severityLevels.MEDIUM,
                data: {
                    deviation_meters: deviation,
                    current_location: currentLocation,
                    suggested_action: 'redirect_driver'
                }
            };
        }

        return null;
    }

    /**
     * Analyze probability of shipment delay
     */
    async analyzeDelayProbability(shipment, trackingHistory) {
        if (!shipment || trackingHistory.length < 5) {
            return null;
        }

        const eta = await this.calculateDynamicETA(shipment, trackingHistory);
        const plannedETA = new Date(shipment.planned_delivery_time);
        const delayMinutes = (eta - plannedETA) / (1000 * 60);

        if (delayMinutes > 30) { // 30 minute delay threshold
            return {
                type: this.recommendationTypes.DELAY_ALERT,
                message: `Shipment expected to be ${Math.round(delayMinutes)} minutes late. Consider notifying customer.`,
                severity: delayMinutes > 60 ? this.severityLevels.HIGH : this.severityLevels.MEDIUM,
                data: {
                    delay_minutes: Math.round(delayMinutes),
                    current_eta: eta,
                    planned_eta: plannedETA
                }
            };
        }

        return null;
    }

    /**
     * Analyze driver speed patterns
     */
    async analyzeSpeedPatterns(currentLocation, trackingHistory) {
        if (trackingHistory.length < 10) {
            return null;
        }

        const recentSpeeds = trackingHistory.slice(-10).map(t => t.speed).filter(s => s > 0);
        const avgSpeed = recentSpeeds.reduce((a, b) => a + b, 0) / recentSpeeds.length;
        const currentSpeed = currentLocation.speed || 0;

        // Check for unusual speed patterns
        if (currentSpeed < avgSpeed * 0.3 && currentSpeed > 0) {
            return {
                type: this.recommendationTypes.PERFORMANCE,
                message: `Driver speed significantly below average. Check for traffic or obstacles.`,
                severity: this.severityLevels.LOW,
                data: {
                    current_speed: currentSpeed,
                    average_speed: avgSpeed,
                    speed_ratio: currentSpeed / avgSpeed
                }
            };
        }

        return null;
    }

    /**
     * Analyze idle time detection
     */
    async analyzeIdleTime(currentLocation, trackingHistory) {
        if (trackingHistory.length < 5) {
            return null;
        }

        // Check last 10 minutes of tracking data
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentTracking = trackingHistory.filter(t => 
            new Date(t.timestamp) > tenMinutesAgo
        );

        const hasMovement = recentTracking.some(t => t.speed > 5);
        
        if (!hasMovement && recentTracking.length > 0) {
            return {
                type: this.recommendationTypes.IDLE_ALERT,
                message: 'Driver has been idle for 10+ minutes. Check for issues.',
                severity: this.severityLevels.MEDIUM,
                data: {
                    idle_duration_minutes: 10,
                    last_moving_time: new Date(recentTracking[0].timestamp)
                }
            };
        }

        return null;
    }

    /**
     * Analyze GPS accuracy
     */
    async analyzeGPSAccuracy(locationData) {
        const accuracy = locationData.accuracy || 0;

        if (accuracy > 1000) { // Poor GPS accuracy threshold
            return {
                type: this.recommendationTypes.GPS_WARNING,
                message: `GPS accuracy is poor (${Math.round(accuracy)}m). Location may be unreliable.`,
                severity: accuracy > 5000 ? this.severityLevels.HIGH : this.severityLevels.MEDIUM,
                data: {
                    accuracy_meters: accuracy,
                    recommendation: 'wait_for_better_signal'
                }
            };
        }

        return null;
    }

    /**
     * Calculate deviation from optimal route
     */
    calculateDeviation(start, destination, current) {
        // Simplified deviation calculation (straight-line distance)
        const destLat = parseFloat(destination.latitude || destination.lat);
        const destLng = parseFloat(destination.longitude || destination.lng);
        
        const distanceToDest = this.haversineDistance(
            current.latitude, current.longitude,
            destLat, destLng
        );
        
        const totalDistance = this.haversineDistance(
            start.latitude, start.longitude,
            destLat, destLng
        );
        
        return Math.abs(totalDistance - distanceToDest);
    }

    /**
     * Calculate dynamic ETA based on current conditions
     */
    async calculateDynamicETA(shipment, trackingHistory) {
        if (!shipment || trackingHistory.length < 5) {
            return new Date(Date.now() + 2 * 60 * 60 * 1000); // Default 2 hours
        }

        const recentSpeeds = trackingHistory.slice(-10).map(t => t.speed).filter(s => s > 0);
        const avgSpeed = recentSpeeds.reduce((a, b) => a + b, 0) / recentSpeeds.length;
        
        const currentLocation = trackingHistory[trackingHistory.length - 1];
        const destLat = parseFloat(shipment.destination_latitude || shipment.destination_lat);
        const destLng = parseFloat(shipment.destination_longitude || shipment.destination_lng);
        
        const remainingDistance = this.haversineDistance(
            currentLocation.latitude, currentLocation.longitude,
            destLat, destLng
        );
        
        const estimatedTime = remainingDistance / (avgSpeed || 10); // Fallback 10 m/s
        const eta = new Date(Date.now() + estimatedTime * 1000);
        
        return eta;
    }

    /**
     * Haversine distance calculation
     */
    haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    /**
     * Save recommendation to database
     */
    async saveRecommendation(shipmentId, recommendation) {
        try {
            const db = require('../config/database');
            const query = `
                INSERT INTO recommended_actions 
                (shipment_id, recommendation_type, message, severity, created_at)
                VALUES (?, ?, ?, ?, NOW())
            `;
            
            await db.execute(query, [
                shipmentId,
                recommendation.type,
                recommendation.message,
                recommendation.severity
            ]);
            
            return true;
        } catch (error) {
            console.error('Error saving recommendation:', error);
            return false;
        }
    }

    /**
     * Get recommendations for shipment
     */
    async getRecommendations(shipmentId, limit = 10) {
        try {
            const db = require('../config/database');
            const query = `
                SELECT * FROM recommended_actions 
                WHERE shipment_id = ? 
                ORDER BY created_at DESC 
                LIMIT ?
            `;
            
            const [rows] = await db.execute(query, [shipmentId, limit]);
            return rows;
        } catch (error) {
            console.error('Error getting recommendations:', error);
            return [];
        }
    }

    /**
     * Acknowledge recommendation
     */
    async acknowledgeRecommendation(recommendationId) {
        try {
            const db = require('../config/database');
            const query = `
                UPDATE recommended_actions 
                SET acknowledged = TRUE 
                WHERE id = ?
            `;
            
            await db.execute(query, [recommendationId]);
            return true;
        } catch (error) {
            console.error('Error acknowledging recommendation:', error);
            return false;
        }
    }
}

module.exports = RecommendationService;
