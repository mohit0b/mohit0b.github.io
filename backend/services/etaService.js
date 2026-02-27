/**
 * LinkNode ETA Service
 * Dynamic ETA calculation and prediction
 */

class ETAService {
    constructor() {
        this.defaultSpeed = 10; // m/s (36 km/h)
        this.trafficFactors = {
            RUSH_HOUR: 1.5,
            NORMAL: 1.0,
            NIGHT: 0.8
        };
    }

    /**
     * Calculate dynamic ETA based on multiple factors
     */
    async calculateETA(shipment, currentLocation, trackingHistory) {
        try {
            if (!shipment || !currentLocation) {
                return new Date(Date.now() + 2 * 60 * 60 * 1000); // Default 2 hours
            }

            // 1. Calculate remaining distance
            const remainingDistance = this.calculateRemainingDistance(
                currentLocation, 
                shipment
            );

            // 2. Analyze current speed patterns
            const avgSpeed = this.analyzeCurrentSpeed(trackingHistory);
            
            // 3. Apply traffic factors
            const trafficFactor = this.getTrafficFactor();
            
            // 4. Consider historical data
            const historicalFactor = await this.getHistoricalFactor(shipment);
            
            // 5. Calculate adjusted speed
            const adjustedSpeed = avgSpeed * trafficFactor * historicalFactor;
            
            // 6. Calculate ETA
            const estimatedTime = remainingDistance / (adjustedSpeed || this.defaultSpeed);
            const eta = new Date(Date.now() + estimatedTime * 1000);
            
            return {
                eta,
                remaining_distance: remainingDistance,
                estimated_speed: adjustedSpeed,
                confidence: this.calculateConfidence(trackingHistory.length)
            };
        } catch (error) {
            console.error('Error calculating ETA:', error);
            return {
                eta: new Date(Date.now() + 2 * 60 * 60 * 1000),
                confidence: 'low'
            };
        }
    }

    /**
     * Calculate remaining distance to destination
     */
    calculateRemainingDistance(currentLocation, shipment) {
        const destLat = parseFloat(
            shipment.destination_latitude || 
            shipment.destination_lat || 
            shipment.destination?.latitude
        );
        const destLng = parseFloat(
            shipment.destination_longitude || 
            shipment.destination_lng || 
            shipment.destination?.longitude
        );

        return this.haversineDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            destLat,
            destLng
        );
    }

    /**
     * Analyze current speed from tracking history
     */
    analyzeCurrentSpeed(trackingHistory) {
        if (!trackingHistory || trackingHistory.length < 3) {
            return this.defaultSpeed;
        }

        // Get last 10 data points
        const recentData = trackingHistory.slice(-10);
        const validSpeeds = recentData
            .map(t => t.speed)
            .filter(s => s > 0 && s < 50); // Filter invalid speeds

        if (validSpeeds.length === 0) {
            return this.defaultSpeed;
        }

        // Calculate weighted average (more recent = more weight)
        let weightedSum = 0;
        let totalWeight = 0;
        
        validSpeeds.forEach((speed, index) => {
            const weight = (index + 1) / validSpeeds.length;
            weightedSum += speed * weight;
            totalWeight += weight;
        });

        return weightedSum / totalWeight;
    }

    /**
     * Get traffic factor based on time of day
     */
    getTrafficFactor() {
        const hour = new Date().getHours();
        
        if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
            return this.trafficFactors.RUSH_HOUR;
        } else if (hour >= 22 || hour <= 5) {
            return this.trafficFactors.NIGHT;
        } else {
            return this.trafficFactors.NORMAL;
        }
    }

    /**
     * Get historical performance factor for similar routes
     */
    async getHistoricalFactor(shipment) {
        try {
            const db = require('../config/database');
            
            // Query historical route performance
            const query = `
                SELECT AVG(
                    (total_distance / total_time) * 3600
                ) as avg_speed
                FROM route_history 
                WHERE destination_address = ?
                AND total_time > 0
                ORDER BY created_at DESC
                LIMIT 10
            `;
            
            const [rows] = await db.execute(query, [shipment.destination_address]);
            
            if (rows.length > 0 && rows[0].avg_speed) {
                const historicalSpeed = rows[0].avg_speed;
                return historicalSpeed / this.defaultSpeed;
            }
            
            return 1.0; // No historical data
        } catch (error) {
            console.error('Error getting historical factor:', error);
            return 1.0;
        }
    }

    /**
     * Calculate confidence level based on data quality
     */
    calculateConfidence(dataPoints) {
        if (dataPoints >= 20) return 'high';
        if (dataPoints >= 10) return 'medium';
        return 'low';
    }

    /**
     * Save route history for future predictions
     */
    async saveRouteHistory(shipmentId, routeData) {
        try {
            const db = require('../config/database');
            
            const query = `
                INSERT INTO route_history 
                (shipment_id, total_distance, total_time, average_speed, delay_minutes)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            await db.execute(query, [
                shipmentId,
                routeData.total_distance,
                routeData.total_time,
                routeData.average_speed,
                routeData.delay_minutes
            ]);
            
            return true;
        } catch (error) {
            console.error('Error saving route history:', error);
            return false;
        }
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
}

module.exports = ETAService;
