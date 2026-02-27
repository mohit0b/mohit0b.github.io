-- LinkNode Smart Logistics Database Migration
-- Add recommendation and route analysis tables

-- Recommended Actions Table
CREATE TABLE IF NOT EXISTS recommended_actions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shipment_id INT NOT NULL,
    recommendation_type ENUM(
        'route_change',
        'delay_alert', 
        'risk_alert', 
        'performance',
        'gps_warning',
        'idle_alert'
    ) NOT NULL,
    message TEXT NOT NULL,
    severity ENUM('low', 'medium', 'high') NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP NULL,
    
    FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
    INDEX idx_shipment_recommendations (shipment_id, created_at),
    INDEX idx_severity (severity),
    INDEX idx_acknowledged (acknowledged)
);

-- Route History Table
CREATE TABLE IF NOT EXISTS route_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shipment_id INT NOT NULL,
    total_distance DECIMAL(10, 2) NOT NULL, -- in meters
    total_time INT NOT NULL, -- in seconds
    average_speed DECIMAL(5, 2) NOT NULL, -- in km/h
    delay_minutes INT DEFAULT 0,
    route_efficiency DECIMAL(3, 2) DEFAULT 0.00, -- 0.00 to 1.00
    performance_grade ENUM('EXCELLENT', 'GOOD', 'AVERAGE', 'POOR') DEFAULT 'AVERAGE',
    max_speed DECIMAL(5, 2) DEFAULT 0, -- in km/h
    idle_time INT DEFAULT 0, -- in seconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
    INDEX idx_shipment_history (shipment_id, created_at),
    INDEX idx_performance (performance_grade),
    INDEX idx_created_date (DATE(created_at))
);

-- Route Anomalies Table (for tracking unusual patterns)
CREATE TABLE IF NOT EXISTS route_anomalies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shipment_id INT NOT NULL,
    anomaly_type ENUM(
        'speed_spike',
        'gps_jump', 
        'time_gap',
        'signal_loss'
    ) NOT NULL,
    severity ENUM('low', 'medium', 'high') NOT NULL,
    description TEXT,
    anomaly_data JSON, -- Store detailed anomaly information
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    
    FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
    INDEX idx_shipment_anomalies (shipment_id, detected_at),
    INDEX idx_anomaly_type (anomaly_type),
    INDEX idx_resolved (resolved)
);

-- Driver Performance Metrics Table
CREATE TABLE IF NOT EXISTS driver_performance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    driver_id INT NOT NULL,
    date DATE NOT NULL,
    total_shipments INT DEFAULT 0,
    completed_shipments INT DEFAULT 0,
    total_distance DECIMAL(10, 2) DEFAULT 0, -- in km
    average_speed DECIMAL(5, 2) DEFAULT 0, -- in km/h
    on_time_delivery_rate DECIMAL(5, 2) DEFAULT 0, -- percentage
    average_delay_minutes DECIMAL(5, 2) DEFAULT 0,
    idle_time_percentage DECIMAL(5, 2) DEFAULT 0, -- percentage
    route_efficiency_score DECIMAL(5, 2) DEFAULT 0, -- 0-100
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_driver_date (driver_id, date),
    INDEX idx_driver_performance (driver_id, date)
);

-- Smart ETA Predictions Table
CREATE TABLE IF NOT EXISTS eta_predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shipment_id INT NOT NULL,
    predicted_eta TIMESTAMP NOT NULL,
    confidence_level ENUM('low', 'medium', 'high') NOT NULL,
    remaining_distance DECIMAL(10, 2) NOT NULL, -- in meters
    estimated_speed DECIMAL(5, 2) NOT NULL, -- in km/h
    traffic_factor DECIMAL(3, 2) DEFAULT 1.00,
    historical_factor DECIMAL(3, 2) DEFAULT 1.00,
    prediction_method ENUM('real_time', 'historical', 'hybrid') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
    INDEX idx_shipment_eta (shipment_id, created_at),
    INDEX idx_predicted_eta (predicted_eta)
);

-- Add new columns to existing shipments table for smart features
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS predicted_eta TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS eta_confidence ENUM('low', 'medium', 'high') DEFAULT 'low',
ADD COLUMN IF NOT EXISTS route_efficiency DECIMAL(3, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS risk_score DECIMAL(3, 2) DEFAULT 0.00, -- 0-100
ADD COLUMN IF NOT EXISTS smart_recommendations_enabled BOOLEAN DEFAULT TRUE;

-- Add new columns to existing users table for driver performance
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS performance_score DECIMAL(5, 2) DEFAULT 0.00, -- 0-100
ADD COLUMN IF NOT EXISTS total_deliveries INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS on_time_rate DECIMAL(5, 2) DEFAULT 0.00, -- percentage
ADD COLUMN IF NOT EXISTS average_route_efficiency DECIMAL(5, 2) DEFAULT 0.00;

-- Create view for active recommendations
CREATE OR REPLACE VIEW active_recommendations AS
SELECT 
    ra.*,
    s.destination_address,
    u.name as driver_name,
    u.email as driver_email
FROM recommended_actions ra
JOIN shipments s ON ra.shipment_id = s.id
LEFT JOIN users u ON s.driver_id = u.id
WHERE ra.acknowledged = FALSE
AND ra.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
ORDER BY ra.severity DESC, ra.created_at DESC;

-- Create view for driver performance summary
CREATE OR REPLACE VIEW driver_performance_summary AS
SELECT 
    u.id as driver_id,
    u.name,
    u.email,
    COALESCE(dp.total_shipments, 0) as today_shipments,
    COALESCE(dp.completed_shipments, 0) as today_completed,
    COALESCE(dp.on_time_delivery_rate, 0) as on_time_rate,
    COALESCE(dp.average_speed, 0) as avg_speed,
    COALESCE(dp.route_efficiency_score, 0) as efficiency_score,
    u.performance_score as overall_score
FROM users u
LEFT JOIN driver_performance dp ON u.id = dp.driver_id 
AND dp.date = CURDATE()
WHERE u.role = 'driver';
