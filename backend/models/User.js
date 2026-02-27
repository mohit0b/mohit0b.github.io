const db = require('../config/database');
const bcrypt = require('bcrypt');
const { AppError } = require('../middleware/errorHandler');

class UserModel {
  static async create(userData) {
    const { name, email, password, role = 'driver', organizationId = null } = userData;

    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const query = `
      INSERT INTO users (name, email, password_hash, role, organization_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const result = await db.query(query, [name, email, hashedPassword, role, organizationId]);

    return {
      id: result.insertId,
      name,
      email,
      role,
      organizationId
    };
  }

  static async findByEmail(email) {
    const query = `
      SELECT id, name, email, password_hash, role, organization_id, is_active, created_at, updated_at
      FROM users
      WHERE email = ?
      LIMIT 1
    `;

    const results = await db.query(query, [email]);
    const users = Array.isArray(results) ? results : [results];
    return users.length > 0 ? users[0] : null;
  }

  static async findById(id) {
    const query = `
      SELECT id, name, email, role, organization_id, created_at, updated_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `;

    const results = await db.query(query, [id]);
    // Handle both array and object returns from db.query
    const users = Array.isArray(results) ? results : [results];
    return users.length > 0 ? users[0] : null;
  }

  static async findAll() {
    const query = `
      SELECT id, name, email, role, organization_id, is_active, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `;

    const results = await db.query(query);
    return Array.isArray(results) ? results : [results];
  }

  static async findByRole(role) {
    const query = `
      SELECT id, name, email, role, organization_id, is_active, created_at, updated_at
      FROM users
      WHERE role = ?
      ORDER BY created_at DESC
    `;

    const results = await db.query(query, [role]);
    return Array.isArray(results) ? results : [results];
  }

  static async validatePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async updateLastLogin(userId) {
    const query = `
      UPDATE users
      SET last_login_at = NOW()
      WHERE id = ?
    `;

    await db.query(query, [userId]);
  }

  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'driver') NOT NULL DEFAULT 'driver',
        organization_id INT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        last_login_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_role (role),
        INDEX idx_organization (organization_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    await db.query(query);
  }
}

module.exports = UserModel;
