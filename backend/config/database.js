const mysql = require('mysql2/promise');
const config = require('./index');

class DatabasePool {
  constructor() {
    this.pool = null;
  }

  async initialize() {
    try {
      this.pool = mysql.createPool({
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        user: config.database.user,
        password: config.database.password,
        connectionLimit: config.database.connectionLimit,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        waitForConnections: true,
        queueLimit: 0
      });

      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();

      console.log('Database pool initialized successfully');
      return true;
    } catch (error) {
      console.error('Database initialization failed:', error.message);
      throw error;
    }
  }

  async query(sql, params) {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    const [results] = await this.pool.execute(sql, params);
    return results;
  }

  async transaction(callback) {
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();

    try {
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  getPool() {
    return this.pool;
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

module.exports = new DatabasePool();
