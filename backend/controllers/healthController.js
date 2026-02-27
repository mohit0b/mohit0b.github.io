const db = require('../config/database');
const os = require('os');

const getHealth = async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'linknode-tracking-engine',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  };

  try {
    await db.query('SELECT 1');
    health.database = 'connected';
  } catch (error) {
    health.database = 'disconnected';
    health.status = 'degraded';
  }

  health.system = {
    platform: process.platform,
    nodeVersion: process.version,
    memory: {
      total: Math.round(os.totalmem() / 1024 / 1024) + 'MB',
      free: Math.round(os.freemem() / 1024 / 1024) + 'MB',
      used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024) + 'MB'
    },
    cpuLoad: os.loadavg()
  };

  const statusCode = health.status === 'healthy' ? 200 : 503;

  res.status(statusCode).json({
    success: health.status !== 'degraded',
    data: health
  });
};

const getReadiness = async (req, res) => {
  try {
    await db.query('SELECT 1');

    res.status(200).json({
      success: true,
      data: {
        ready: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: {
        code: 'NOT_READY',
        message: 'Service not ready'
      }
    });
  }
};

const getLiveness = (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      alive: true,
      timestamp: new Date().toISOString()
    }
  });
};

module.exports = {
  getHealth,
  getReadiness,
  getLiveness
};
