require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const config = require('./config');
const db = require('./config/database');
const { initializeDatabase } = require('./scripts/initDb');
const { errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');
const logger = require('./utils/logger');
const SocketHandler = require('./socket');

let server;
let io;
let socketHandler;

const app = express();

app.use(helmet());

app.use(cors(config.cors));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from parent directory (frontend)
app.use(express.static(path.join(__dirname, '..')));

app.use((req, res, next) => {
  req.requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

app.use((req, res, next) => {
  logger.info('Request started', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    userAgent: req.get('user-agent')
  });
  next();
});

app.use('/api/v1', routes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    }
  });
});

app.use(errorHandler);

const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await db.close();
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error closing database connections', { error: error.message });
    }

    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);
};

const startServer = async () => {
  try {
    await db.initialize();
    await initializeDatabase();

    server = createServer(app);

    io = new Server(server, {
      cors: config.cors,
      transports: ['websocket', 'polling']
    });

    socketHandler = new SocketHandler(io);

    app.set('io', io);
    app.set('socketHandler', socketHandler);

    server.listen(config.port, () => {
      logger.info('Server started', {
        port: config.port,
        environment: config.env,
        timestamp: new Date().toISOString(),
        websocketEnabled: true
      });
    });

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, io, socketHandler };
