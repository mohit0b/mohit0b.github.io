const db = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

class TrackingLocationModel {
  static async create(locationData) {
    const { shipment_id, latitude, longitude, accuracy = null, speed = null } = locationData;

    if (!this.isValidLatitude(latitude) || !this.isValidLongitude(longitude)) {
      throw new AppError('Invalid GPS coordinates', 400, 'INVALID_COORDINATES');
    }

    const query = `
      INSERT INTO tracking_locations (
        shipment_id, latitude, longitude, accuracy, speed, recorded_at
      ) VALUES (?, ?, ?, ?, ?, NOW())
    `;

    const result = await db.query(query, [
      shipment_id,
      latitude,
      longitude,
      accuracy,
      speed
    ]);

    return {
      id: result.insertId,
      shipment_id,
      latitude,
      longitude,
      accuracy,
      speed
    };
  }

  static async getLatestByShipment(shipmentId) {
    const query = `
      SELECT *
      FROM tracking_locations
      WHERE shipment_id = ?
      ORDER BY recorded_at DESC
      LIMIT 1
    `;

    const locations = await db.query(query, [shipmentId]);
    return locations.length > 0 ? locations[0] : null;
  }

  static async getAllByShipment(shipmentId, limit = 100) {
    const query = `
      SELECT *
      FROM tracking_locations
      WHERE shipment_id = ?
      ORDER BY recorded_at DESC
      LIMIT ?
    `;

    return await db.query(query, [shipmentId, limit]);
  }

  static async getLocationHistory(shipmentId, startDate = null, endDate = null) {
    let query = `
      SELECT *
      FROM tracking_locations
      WHERE shipment_id = ?
    `;

    const params = [shipmentId];

    if (startDate) {
      query += ' AND recorded_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND recorded_at <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY recorded_at ASC';

    return await db.query(query, params);
  }

  static async getShipmentStats(shipmentId) {
    const query = `
      SELECT 
        COUNT(*) as total_updates,
        MIN(recorded_at) as first_update,
        MAX(recorded_at) as last_update,
        MIN(latitude) as min_lat,
        MAX(latitude) as max_lat,
        MIN(longitude) as min_lng,
        MAX(longitude) as max_lng
      FROM tracking_locations
      WHERE shipment_id = ?
    `;

    const results = await db.query(query, [shipmentId]);
    return results.length > 0 ? results[0] : null;
  }

  static async deleteOldLocations(daysOld = 90) {
    const query = `
      DELETE FROM tracking_locations
      WHERE recorded_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `;

    const [result] = await db.query(query, [daysOld]);
    return result.affectedRows;
  }

  static isValidLatitude(lat) {
    return typeof lat === 'number' && lat >= -90 && lat <= 90;
  }

  static isValidLongitude(lng) {
    return typeof lng === 'number' && lng >= -180 && lng <= 180;
  }

  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS tracking_locations (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        shipment_id INT NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        accuracy DECIMAL(8, 2) NULL,
        speed DECIMAL(8, 2) NULL,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
        INDEX idx_shipment_id (shipment_id),
        INDEX idx_recorded_at (recorded_at),
        INDEX idx_shipment_recorded (shipment_id, recorded_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    await db.query(query);
  }
}

module.exports = TrackingLocationModel;
