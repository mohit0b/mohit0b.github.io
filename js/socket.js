/**
 * LinkNode Socket.io Client Module
 * Real-time updates and live tracking
 */

const SOCKET_URL = 'https://your-ngrok-url-here.ngrok.io'; // Replace with your ngrok URL

class SocketClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.listeners = {};
    }

    // Initialize socket connection
    connect() {
        const token = localStorage.getItem('jwt');
        
        if (!token) {
            console.error('No JWT token found');
            return false;
        }

        this.socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000
        });

        this.setupEventHandlers();
        return true;
    }

    // Setup default event handlers
    setupEventHandlers() {
        if (!this.socket) return;

        // Connection established
        this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket.id);
            this.connected = true;
            this.reconnectAttempts = 0;
            
            // Show connection status
            this.updateConnectionStatus(true);
            
            // Trigger connect callback if registered
            if (this.listeners['connect']) {
                this.listeners['connect'].forEach(cb => cb());
            }
        });

        // Connection error
        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error.message);
            this.reconnectAttempts++;
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error('Max reconnection attempts reached');
                this.socket.disconnect();
            }
        });

        // Disconnected
        this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            this.connected = false;
            this.updateConnectionStatus(false);
            
            if (this.listeners['disconnect']) {
                this.listeners['disconnect'].forEach(cb => cb(reason));
            }
        });

        // Location updates
        this.socket.on('location_update', (data) => {
            console.log('Live location update:', data);
            if (this.listeners['location_update']) {
                this.listeners['location_update'].forEach(cb => cb(data));
            }
        });

        // Shipment delivered
        this.socket.on('shipment_delivered', (data) => {
            console.log('Shipment delivered:', data);
            if (this.listeners['shipment_delivered']) {
                this.listeners['shipment_delivered'].forEach(cb => cb(data));
            }
        });

        // Status updates
        this.socket.on('status_update', (data) => {
            console.log('Status update:', data);
            if (this.listeners['status_update']) {
                this.listeners['status_update'].forEach(cb => cb(data));
            }
        });

        // Risk alert
        this.socket.on('risk_alert', (data) => {
            console.log('Risk alert:', data);
            if (this.listeners['risk_alert']) {
                this.listeners['risk_alert'].forEach(cb => cb(data));
            }
        });

        // Recovery triggered
        this.socket.on('recovery_triggered', (data) => {
            console.log('Recovery triggered:', data);
            if (this.listeners['recovery_triggered']) {
                this.listeners['recovery_triggered'].forEach(cb => cb(data));
            }
        });

        // New shipment created
        this.socket.on('new_shipment', (data) => {
            console.log('New shipment:', data);
            if (this.listeners['new_shipment']) {
                this.listeners['new_shipment'].forEach(cb => cb(data));
            }
        });
    }

    // Update UI connection status
    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
            statusEl.className = connected ? 'connected' : 'disconnected';
            statusEl.textContent = connected ? '● Live' : '○ Offline';
        }
    }

    // Join a shipment room for real-time updates
    joinShipment(shipmentId) {
        if (!this.connected || !this.socket) {
            console.error('Socket not connected');
            return false;
        }

        this.socket.emit('join_shipment', { shipment_id: shipmentId });
        console.log('Joined shipment room:', shipmentId);
        return true;
    }

    // Leave a shipment room
    leaveShipment(shipmentId) {
        if (!this.connected || !this.socket) return false;

        this.socket.emit('leave_shipment', { shipment_id: shipmentId });
        console.log('Left shipment room:', shipmentId);
        return true;
    }

    // Subscribe to events
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    // Unsubscribe from events
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    // Disconnect socket
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
        }
    }

    // Check connection status
    isConnected() {
        return this.connected && this.socket && this.socket.connected;
    }

    // Emit custom event
    emit(event, data) {
        if (!this.connected || !this.socket) {
            console.error('Socket not connected');
            return false;
        }

        this.socket.emit(event, data);
        return true;
    }
}

// Create global socket client instance
const socketClient = new SocketClient();

// Helper functions for common operations

function initSocket() {
    return socketClient.connect();
}

function joinShipmentRoom(shipmentId) {
    return socketClient.joinShipment(shipmentId);
}

function leaveShipmentRoom(shipmentId) {
    return socketClient.leaveShipment(shipmentId);
}

function onLocationUpdate(callback) {
    socketClient.on('location_update', callback);
}

function onShipmentDelivered(callback) {
    socketClient.on('shipment_delivered', callback);
}

function onStatusUpdate(callback) {
    socketClient.on('status_update', callback);
}

function onRiskAlert(callback) {
    socketClient.on('risk_alert', callback);
}

function onRecoveryTriggered(callback) {
    socketClient.on('recovery_triggered', callback);
}

function onRecommendationAlert(callback) {
    socketClient.on('recommendation_alert', callback);
}

function emitRecommendationAcknowledgment(shipmentId, recommendationType) {
    socketClient.socket.emit('recommendation_acknowledged', {
        shipment_id: shipmentId,
        recommendation_type: recommendationType,
        timestamp: new Date().toISOString()
    });
}

function disconnectSocket() {
    socketClient.disconnect();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SocketClient,
        socketClient,
        initSocket,
        joinShipmentRoom,
        leaveShipmentRoom,
        onLocationUpdate,
        onShipmentDelivered,
        onStatusUpdate,
        onRiskAlert,
        onRecoveryTriggered,
        disconnectSocket
    };
}
