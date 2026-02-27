const jwt = require('jsonwebtoken');
const config = require('../config');
const ShipmentModel = require('../models/Shipment');
const logger = require('../utils/logger');

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map();
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, config.jwt.secret);

        socket.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          organizationId: decoded.organizationId
        };

        logger.info('Socket authenticated', {
          socketId: socket.id,
          userId: socket.user.id,
          role: socket.user.role
        });

        next();
      } catch (error) {
        logger.error('Socket authentication failed', {
          socketId: socket.id,
          error: error.message
        });
        next(new Error('Authentication failed'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  handleConnection(socket) {
    const user = socket.user;
    
    this.connectedUsers.set(socket.id, {
      userId: user.id,
      role: user.role,
      organizationId: user.organizationId,
      connectedAt: new Date()
    });

    logger.info('User connected via socket', {
      socketId: socket.id,
      userId: user.id,
      role: user.role,
      totalConnections: this.connectedUsers.size
    });

    socket.on('join_shipment', async (data) => {
      await this.handleJoinShipment(socket, data);
    });

    socket.on('leave_shipment', async (data) => {
      await this.handleLeaveShipment(socket, data);
    });

    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    socket.on('error', (error) => {
      logger.error('Socket error', {
        socketId: socket.id,
        userId: user.id,
        error: error.message
      });
    });
  }

  async handleJoinShipment(socket, data) {
    try {
      const { shipment_id } = data;
      const user = socket.user;

      if (!shipment_id || typeof shipment_id !== 'number') {
        socket.emit('error', { message: 'Invalid shipment_id' });
        return;
      }

      const shipment = await ShipmentModel.findById(
        shipment_id,
        user.role,
        user.id
      );

      if (!shipment) {
        socket.emit('error', { message: 'Shipment not found' });
        return;
      }

      if (user.role === 'admin' && user.organizationId && 
          shipment.organization_id && shipment.organization_id !== user.organizationId) {
        socket.emit('error', { message: 'Access denied to this shipment' });
        return;
      }

      const roomName = `shipment_${shipment_id}`;
      await socket.join(roomName);

      socket.emit('joined_shipment', { 
        shipment_id,
        message: 'Successfully joined shipment room'
      });

      logger.info('User joined shipment room', {
        socketId: socket.id,
        userId: user.id,
        role: user.role,
        shipment_id,
        room: roomName
      });

    } catch (error) {
      logger.error('Error joining shipment room', {
        socketId: socket.id,
        userId: socket.user.id,
        shipment_id: data.shipment_id,
        error: error.message
      });

      socket.emit('error', { message: 'Failed to join shipment' });
    }
  }

  async handleLeaveShipment(socket, data) {
    try {
      const { shipment_id } = data;
      const user = socket.user;

      if (!shipment_id || typeof shipment_id !== 'number') {
        socket.emit('error', { message: 'Invalid shipment_id' });
        return;
      }

      const roomName = `shipment_${shipment_id}`;
      await socket.leave(roomName);

      socket.emit('left_shipment', { 
        shipment_id,
        message: 'Successfully left shipment room'
      });

      logger.info('User left shipment room', {
        socketId: socket.id,
        userId: user.id,
        role: user.role,
        shipment_id,
        room: roomName
      });

    } catch (error) {
      logger.error('Error leaving shipment room', {
        socketId: socket.id,
        userId: socket.user.id,
        shipment_id: data.shipment_id,
        error: error.message
      });

      socket.emit('error', { message: 'Failed to leave shipment' });
    }
  }

  handleDisconnection(socket) {
    const userInfo = this.connectedUsers.get(socket.id);
    
    if (userInfo) {
      this.connectedUsers.delete(socket.id);

      logger.info('User disconnected from socket', {
        socketId: socket.id,
        userId: userInfo.userId,
        role: userInfo.role,
        connectionDuration: Date.now() - userInfo.connectedAt.getTime(),
        totalConnections: this.connectedUsers.size
      });
    }
  }

  emitLocationUpdate(shipmentId, locationData) {
    const roomName = `shipment_${shipmentId}`;
    
    this.io.to(roomName).emit('location_update', {
      shipment_id: shipmentId,
      ...locationData
    });

    logger.debug('Location update emitted', {
      shipmentId,
      room: roomName,
      latitude: locationData.latitude,
      longitude: locationData.longitude
    });
  }

  emitShipmentDelivered(shipmentId, deliveryData) {
    const roomName = `shipment_${shipmentId}`;
    
    this.io.to(roomName).emit('shipment_delivered', {
      shipment_id: shipmentId,
      ...deliveryData
    });

    logger.info('Shipment delivered event emitted', {
      shipmentId,
      room: roomName
    });
  }

  emitShipmentStatusUpdate(shipmentId, status) {
    const roomName = `shipment_${shipmentId}`;
    
    this.io.to(roomName).emit('shipment_status_update', {
      shipment_id: shipmentId,
      status,
      updated_at: new Date().toISOString()
    });

    logger.info('Shipment status update emitted', {
      shipmentId,
      room: roomName,
      status
    });
  }

  getConnectionStats() {
    return {
      totalConnections: this.connectedUsers.size,
      connectedUsers: Array.from(this.connectedUsers.values()).map(user => ({
        userId: user.userId,
        role: user.role,
        connectedAt: user.connectedAt
      }))
    };
  }
}

module.exports = SocketHandler;
