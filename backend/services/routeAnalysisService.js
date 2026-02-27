/**
 * LinkNode Route Analysis Service
 * Advanced route performance and optimization analysis
 */

class RouteAnalysisService {
    constructor() {
        this.performanceMetrics = {
            EXCELLENT: { min: 0, max: 15 },    // km/h over limit
            GOOD: { min: 15, max: 30 },
            AVERAGE: { min: 30, max: 45 },
            POOR: { min: 45, max: Infinity }
        };
    }

    /**
     * Analyze complete route performance
     */
    async analyzeRoutePerformance(shipmentId, trackingData) {
        try {
            if (!trackingData || trackingData.length < 2) {
                return null;
            }

            const analysis = {
                shipment_id: shipmentId,
                total_distance: this.calculateTotalDistance(trackingData),
                total_time: this.calculateTotalTime(trackingData),
                average_speed: 0,
                max_speed: this.getMaxSpeed(trackingData),
                idle_time: this.calculateIdleTime(trackingData),
                route_efficiency: 0,
                performance_grade: 'AVERAGE',
                recommendations: []
            };

            analysis.average_speed = (analysis.total_distance / analysis.total_time) * 3.6; // km/h
            analysis.route_efficiency = this.calculateRouteEfficiency(trackingData);
            analysis.performance_grade = this.getPerformanceGrade(analysis.average_speed);
            analysis.recommendations = this.generateRouteRecommendations(analysis);

            return analysis;
        } catch (error) {
            console.error('Error analyzing route performance:', error);
            return null;
        }
    }

    /**
     * Calculate total distance traveled
     */
    calculateTotalDistance(trackingData) {
        let totalDistance = 0;
        
        for (let i = 1; i < trackingData.length; i++) {
            const prev = trackingData[i - 1];
            const curr = trackingData[i];
            
            totalDistance += this.haversineDistance(
                prev.latitude, prev.longitude,
                curr.latitude, curr.longitude
            );
        }
        
        return totalDistance;
    }

    /**
     * Calculate total time duration
     */
    calculateTotalTime(trackingData) {
        if (trackingData.length < 2) return 0;
        
        const startTime = new Date(trackingData[0].timestamp);
        const endTime = new Date(trackingData[trackingData.length - 1].timestamp);
        
        return (endTime - startTime) / 1000; // seconds
    }

    /**
     * Get maximum speed achieved
     */
    getMaxSpeed(trackingData) {
        const speeds = trackingData.map(t => t.speed || 0);
        return Math.max(...speeds);
    }

    /**
     * Calculate total idle time
     */
    calculateIdleTime(trackingData) {
        let idleTime = 0;
        const idleThreshold = 2; // 2 m/s considered idle
        
        for (let i = 1; i < trackingData.length; i++) {
            const curr = trackingData[i];
            const prev = trackingData[i - 1];
            
            if (curr.speed <= idleThreshold) {
                const timeDiff = (new Date(curr.timestamp) - new Date(prev.timestamp)) / 1000;
                idleTime += timeDiff;
            }
        }
        
        return idleTime;
    }

    /**
     * Calculate route efficiency (directness of path)
     */
    calculateRouteEfficiency(trackingData) {
        if (trackingData.length < 2) return 0;
        
        const start = trackingData[0];
        const end = trackingData[trackingData.length - 1];
        
        // Direct distance
        const directDistance = this.haversineDistance(
            start.latitude, start.longitude,
            end.latitude, end.longitude
        );
        
        // Actual distance traveled
        const actualDistance = this.calculateTotalDistance(trackingData);
        
        // Efficiency ratio (closer to 1 is better)
        return directDistance / actualDistance;
    }

    /**
     * Get performance grade based on average speed
     */
    getPerformanceGrade(averageSpeed) {
        for (const [grade, range] of Object.entries(this.performanceMetrics)) {
            if (averageSpeed >= range.min && averageSpeed < range.max) {
                return grade;
            }
        }
        return 'POOR';
    }

    /**
     * Generate route-specific recommendations
     */
    generateRouteRecommendations(analysis) {
        const recommendations = [];
        
        // Speed recommendations
        if (analysis.average_speed < 20) {
            recommendations.push({
                type: 'speed_optimization',
                message: 'Average speed is very low. Check for route obstacles or traffic patterns.',
                priority: 'high'
            });
        }

        // Efficiency recommendations
        if (analysis.route_efficiency < 0.7) {
            recommendations.push({
                type: 'route_optimization',
                message: 'Route efficiency is low. Consider more direct routes.',
                priority: 'medium'
            });
        }

        // Idle time recommendations
        if (analysis.idle_time > 600) { // 10 minutes
            recommendations.push({
                type: 'idle_reduction',
                message: `Excessive idle time (${Math.round(analysis.idle_time/60)} minutes). Optimize stops.`,
                priority: 'medium'
            });
        }

        return recommendations;
    }

    /**
     * Compare route with historical performance
     */
    async compareWithHistorical(shipmentId, currentAnalysis) {
        try {
            const db = require('../config/database');
            
            const query = `
                SELECT 
                    AVG(total_distance) as avg_distance,
                    AVG(total_time) as avg_time,
                    AVG(average_speed) as avg_speed,
                    COUNT(*) as route_count
                FROM route_history 
                WHERE shipment_id != ?
                ORDER BY created_at DESC
                LIMIT 20
            `;
            
            const [rows] = await db.execute(query, [shipmentId]);
            
            if (rows.length > 0) {
                const historical = rows[0];
                
                return {
                    current: currentAnalysis,
                    historical: historical,
                    comparison: {
                        distance_vs_avg: ((currentAnalysis.total_distance - historical.avg_distance) / historical.avg_distance) * 100,
                        time_vs_avg: ((currentAnalysis.total_time - historical.avg_time) / historical.avg_time) * 100,
                        speed_vs_avg: ((currentAnalysis.average_speed - historical.avg_speed) / historical.avg_speed) * 100
                    }
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error comparing with historical data:', error);
            return null;
        }
    }

    /**
     * Detect route anomalies
     */
    detectAnomalies(trackingData) {
        const anomalies = [];
        
        // Speed spikes
        const speedAnomalies = this.detectSpeedAnomalies(trackingData);
        anomalies.push(...speedAnomalies);
        
        // GPS jumps
        const locationAnomalies = this.detectLocationAnomalies(trackingData);
        anomalies.push(...locationAnomalies);
        
        // Time gaps
        const timeAnomalies = this.detectTimeAnomalies(trackingData);
        anomalies.push(...timeAnomalies);
        
        return anomalies;
    }

    /**
     * Detect unusual speed patterns
     */
    detectSpeedAnomalies(trackingData) {
        const anomalies = [];
        const speeds = trackingData.map(t => t.speed || 0);
        
        for (let i = 1; i < speeds.length; i++) {
            const speedChange = Math.abs(speeds[i] - speeds[i-1]);
            
            if (speedChange > 20) { // Sudden speed change > 20 m/s
                anomalies.push({
                    type: 'speed_spike',
                    index: i,
                    value: speeds[i],
                    previous_value: speeds[i-1],
                    change: speedChange,
                    timestamp: trackingData[i].timestamp
                });
            }
        }
        
        return anomalies;
    }

    /**
     * Detect GPS location jumps
     */
    detectLocationAnomalies(trackingData) {
        const anomalies = [];
        
        for (let i = 2; i < trackingData.length; i++) {
            const distance = this.haversineDistance(
                trackingData[i-2].latitude, trackingData[i-2].longitude,
                trackingData[i].latitude, trackingData[i].longitude
            );
            
            const timeDiff = (new Date(trackingData[i].timestamp) - new Date(trackingData[i-2].timestamp)) / 1000;
            const impliedSpeed = distance / timeDiff;
            
            if (impliedSpeed > 50) { // Impossibly fast movement
                anomalies.push({
                    type: 'gps_jump',
                    index: i,
                    distance: distance,
                    implied_speed: impliedSpeed,
                    timestamp: trackingData[i].timestamp
                });
            }
        }
        
        return anomalies;
    }

    /**
     * Detect time gaps in tracking data
     */
    detectTimeAnomalies(trackingData) {
        const anomalies = [];
        
        for (let i = 1; i < trackingData.length; i++) {
            const timeDiff = (new Date(trackingData[i].timestamp) - new Date(trackingData[i-1].timestamp)) / 1000;
            
            if (timeDiff > 300) { // Gap > 5 minutes
                anomalies.push({
                    type: 'time_gap',
                    index: i,
                    gap_duration: timeDiff,
                    timestamp: trackingData[i].timestamp
                });
            }
        }
        
        return anomalies;
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

module.exports = RouteAnalysisService;
