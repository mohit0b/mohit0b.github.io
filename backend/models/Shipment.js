const db = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

class ShipmentModel {
  static generateTrackingNumber() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `LN${timestamp.toUpperCase()}${random.toUpperCase()}`;
  }

  static async create(shipmentData) {
    const { 
      origin_address, 
      destination_address, 
      driver_id, 
      organization_id = null,
      estimated_delivery = null,
      notes = null
    } = shipmentData;

    const tracking_number = this.generateTrackingNumber();

    const query = `
      INSERT INTO shipments (
        tracking_number, origin_address, destination_address, 
        driver_id, organization_id, status, estimated_delivery, 
        notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NOW(), NOW())
    `;

    const result = await db.query(query, [
      tracking_number,
      origin_address,
      destination_address,
      driver_id,
      organization_id,
      estimated_delivery,
      notes
    ]);

    return {
      id: result.insertId,
      tracking_number,
      origin_address,
      destination_address,
      driver_id,
      organization_id,
      status: 'pending',
      estimated_delivery,
      notes
    };
  }

  static async findById(id, userRole = null, userId = null) {
    let query = `
      SELECT s.*, 
             u.name as driver_name, 
             u.email as driver_email
      FROM shipments s
      LEFT JOIN users u ON s.driver_id = u.id
      WHERE s.id = ?
    `;

    if (userRole === 'driver') {
      query += ' AND s.driver_id = ?';
    }

    query += ' LIMIT 1';

    const params = userRole === 'driver' ? [id, userId] : [id];
    const shipments = await db.query(query, params);
    return shipments.length > 0 ? shipments[0] : null;
  }

  static async findByTrackingNumber(trackingNumber, userRole = null, userId = null) {
    let query = `
      SELECT s.*, 
             u.name as driver_name, 
             u.email as driver_email
      FROM shipments s
      LEFT JOIN users u ON s.driver_id = u.id
      WHERE s.tracking_number = ?
    `;

    if (userRole === 'driver') {
      query += ' AND s.driver_id = ?';
    }

    query += ' LIMIT 1';

    const params = userRole === 'driver' ? [trackingNumber, userId] : [trackingNumber];
    const shipments = await db.query(query, params);
    return shipments.length > 0 ? shipments[0] : null;
  }

  static async findAll(userRole = null, userId = null, organizationId = null) {
    let query = `
      SELECT s.*, 
             u.name as driver_name, 
             u.email as driver_email
      FROM shipments s
      LEFT JOIN users u ON s.driver_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (userRole === 'driver') {
      query += ' AND s.driver_id = ?';
      params.push(userId);
    }

    if (organizationId) {
      query += ' AND s.organization_id = ?';
      params.push(organizationId);
    }

    query += ' ORDER BY s.created_at DESC';

    return await db.query(query, params);
  }

  static async findByDriverId(driverId) {
    const query = `
      SELECT s.*, 
             u.name as driver_name, 
             u.email as driver_email
      FROM shipments s
      LEFT JOIN users u ON s.driver_id = u.id
      WHERE s.driver_id = ?
      ORDER BY s.created_at DESC
    `;

    return await db.query(query, [driverId]);
  }

  static async updateStatus(shipmentId, status) {
    const query = `
      UPDATE shipments 
      SET status = ?, updated_at = NOW()
      WHERE id = ?
    `;

    const [result] = await db.query(query, [status, shipmentId]);
    return result.affectedRows > 0;
  }

  static async updateTimestamp(shipmentId) {
    const query = `
      UPDATE shipments 
      SET updated_at = NOW()
      WHERE id = ?
    `;

    await db.query(query, [shipmentId]);
  }

  static async confirmDelivery(shipmentId, driverId, deliveryData) {
    const { delivery_notes = null, proof_of_delivery_url = null } = deliveryData;

    const shipment = await this.findById(shipmentId);
    if (!shipment) {
      throw new AppError('Shipment not found', 404, 'SHIPMENT_NOT_FOUND');
    }

    if (shipment.driver_id !== driverId) {
      throw new AppError('You can only confirm delivery for your assigned shipments', 403, 'SHIPMENT_ACCESS_DENIED');
    }

    if (shipment.status === 'delivered') {
      throw new AppError('Shipment already delivered', 400, 'ALREADY_DELIVERED');
    }

    if (shipment.status !== 'in_transit') {
      throw new AppError('Shipment must be in transit before confirming delivery', 400, 'INVALID_STATUS');
    }

    const query = `
      UPDATE shipments 
      SET status = 'delivered',
          delivered_at = NOW(),
          delivery_notes = ?,
          proof_of_delivery_url = ?,
          updated_at = NOW()
      WHERE id = ?
    `;

    const result = await db.query(query, [delivery_notes, proof_of_delivery_url, shipmentId]);
    
    if (result.affectedRows === 0) {
      throw new AppError('Failed to confirm delivery', 500, 'DELIVERY_CONFIRMATION_FAILED');
    }

    return await this.findById(shipmentId);
  }

  static async getFirstTrackingUpdate(shipmentId) {
    const query = `
      SELECT recorded_at
      FROM tracking_locations
      WHERE shipment_id = ?
      ORDER BY recorded_at ASC
      LIMIT 1
    `;

    const results = await db.query(query, [shipmentId]);
    const rows = Array.isArray(results) ? results : [results];
    return rows.length > 0 ? rows[0] : null;
  }

  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS shipments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tracking_number VARCHAR(20) UNIQUE NOT NULL,
        origin_address TEXT NOT NULL,
        destination_address TEXT NOT NULL,
        driver_id INT NOT NULL,
        organization_id INT NULL,
        status ENUM('pending', 'in_transit', 'delivered', 'cancelled') DEFAULT 'pending',
        estimated_delivery TIMESTAMP NULL,
        delivered_at TIMESTAMP NULL,
        delivery_notes TEXT NULL,
        proof_of_delivery_url VARCHAR(255) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE RESTRICT,
        FOREIGN KEY (organization_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_tracking_number (tracking_number),
        INDEX idx_driver_id (driver_id),
        INDEX idx_status (status),
        INDEX idx_organization_id (organization_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    await db.query(query);
  }
}

module.exports = ShipmentModel;
