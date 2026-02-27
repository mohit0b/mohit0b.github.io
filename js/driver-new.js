/**
 * LinkNode Driver Dashboard - Production Version
 * Real-world driver-friendly tracking interface
 */

// State management
let currentShipment = null;
let isTracking = false;
let gpsWatchId = null;
let driverMap = null;
let currentMarker = null;
let pathPolyline = null;
let pathCoordinates = [];
let locationQueue = [];
let lastPosition = null;
let totalDistance = 0;
let isOnline = navigator.onLine;

// DOM Elements
const elements = {
    shipmentSelection: document.getElementById('shipmentSelection'),
    activeTrip: document.getElementById('activeTrip'),
    shipmentsList: document.getElementById('shipmentsList'),
    noShipments: document.getElementById('noShipments'),
    tripShipmentId: document.getElementById('tripShipmentId'),
    tripStatus: document.getElementById('tripStatus'),
    trackingIndicator: document.getElementById('trackingIndicator'),
    destinationAddress: document.getElementById('destinationAddress'),
    currentSpeed: document.getElementById('currentSpeed'),
    gpsAccuracy: document.getElementById('gpsAccuracy'),
    distanceCovered: document.getElementById('distanceCovered'),
    gpsWaiting: document.getElementById('gpsWaiting'),
    offlineIndicator: document.getElementById('offlineIndicator'),
    connectionStatus: document.getElementById('connectionStatus'),
    endTripBtn: document.getElementById('endTripBtn'),
    confirmDeliveryBtn: document.getElementById('confirmDeliveryBtn'),
    deliveryModal: document.getElementById('deliveryModal'),
    deliveryNotes: document.getElementById('deliveryNotes'),
    toastContainer: document.getElementById('toastContainer')
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }

    // Load user info
    const user = getCurrentUser();
    if (!user || user.role !== 'driver') {
        showToast('Access denied. Driver account required.', 'error');
        logout();
        return;
    }

    // Initialize
    initMap();
    initSocket();
    setupEventListeners();
    await loadShipments();
    
    // Check online status
    updateOnlineStatus();
    
    showToast('Welcome! Select a shipment to start.', 'success');
});

// Setup event listeners
function setupEventListeners() {
    // Online/offline detection
    window.addEventListener('online', () => {
        isOnline = true;
        updateOnlineStatus();
        processLocationQueue();
        showToast('Back online', 'success');
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        updateOnlineStatus();
        showToast('Offline - Updates will be queued', 'warning');
    });
    
    // Visibility change (app background/foreground)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && isTracking) {
            // Resume tracking if app comes to foreground
            console.log('App resumed - tracking active');
        }
    });
}

// Initialize Leaflet Map
function initMap() {
    driverMap = L.map('driverMap', {
        zoomControl: false,
        attributionControl: true
    }).setView([20.5937, 78.9629], 5);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    }).addTo(driverMap);
    
    // Add zoom control at bottom right
    L.control.zoom({
        position: 'bottomright'
    }).addTo(driverMap);
}

// Load assigned shipments
async function loadShipments() {
    try {
        const response = await getAssignedShipments();
        const shipments = response.data || [];
        
        if (shipments.length === 0) {
            elements.shipmentsList.style.display = 'none';
            elements.noShipments.style.display = 'block';
            return;
        }
        
        elements.shipmentsList.style.display = 'flex';
        elements.noShipments.style.display = 'none';
        
        renderShipments(shipments);
    } catch (error) {
        console.error('Failed to load shipments:', error);
        showToast('Failed to load shipments', 'error');
    }
}

// Render shipment cards
function renderShipments(shipments) {
    elements.shipmentsList.innerHTML = shipments.map(shipment => `
        <div class="shipment-card ${currentShipment?.id === shipment.id ? 'selected' : ''}" 
             onclick="selectShipment(${shipment.id})" 
             data-id="${shipment.id}">
            <div class="shipment-card-header">
                <span class="shipment-id">#${shipment.id}</span>
                <span class="status-badge ${shipment.status}">${formatStatus(shipment.status)}</span>
            </div>
            <div class="shipment-route">
                <span class="route-dot origin"></span>
                <div class="route-line">
                    <span class="route-arrow">→</span>
                </div>
                <span class="route-dot destination"></span>
            </div>
            <div class="shipment-address">
                <strong>To:</strong> ${shipment.destination_address || 'Unknown destination'}
            </div>
            ${shipment.status === 'pending' || shipment.status === 'in_transit' ? `
                <button class="btn btn-primary start-trip-btn" onclick="event.stopPropagation(); startTrip(${shipment.id})">
                    🚀 Start Trip
                </button>
            ` : ''}
        </div>
    `).join('');
}

// Select shipment
function selectShipment(shipmentId) {
    const cards = document.querySelectorAll('.shipment-card');
    cards.forEach(card => card.classList.remove('selected'));
    
    const selected = document.querySelector(`[data-id="${shipmentId}"]`);
    if (selected) selected.classList.add('selected');
}

// Start trip
async function startTrip(shipmentId) {
    try {
        // Get shipment details
        const response = await getShipmentById(shipmentId);
        currentShipment = response.data?.shipment || response.data;
        
        if (!currentShipment) {
            showToast('Shipment not found', 'error');
            return;
        }
        
        // Update UI
        showActiveTripView();
        
        // Start GPS tracking
        startGPSTracking();
        
        // Update shipment status to in_transit if pending
        if (currentShipment.status === 'pending') {
            await updateShipmentStatus(shipmentId, 'in_transit');
            currentShipment.status = 'in_transit';
        }
        
        // Join socket room for live updates
        joinShipmentRoom(shipmentId);
        
        showToast('Trip started! GPS tracking active.', 'success');
        
    } catch (error) {
        console.error('Failed to start trip:', error);
        showToast('Failed to start trip', 'error');
    }
}

// Show active trip view
function showActiveTripView() {
    elements.shipmentSelection.classList.remove('active');
    elements.activeTrip.classList.add('active');
    
    // Update trip info
    elements.tripShipmentId.textContent = `#${currentShipment.id}`;
    elements.tripStatus.textContent = formatStatus(currentShipment.status);
    elements.tripStatus.className = `status-badge ${currentShipment.status}`;
    elements.destinationAddress.textContent = currentShipment.destination_address || 'Unknown';
    
    // Reset stats
    elements.currentSpeed.textContent = '0';
    elements.gpsAccuracy.textContent = '--';
    elements.distanceCovered.textContent = '0.0';
    
    // Show tracking indicator
    elements.trackingIndicator.classList.remove('hidden');
    
    // Center map on current location or shipment
    if (currentShipment.current_latitude && currentShipment.current_longitude) {
        const position = [currentShipment.current_latitude, currentShipment.current_longitude];
        driverMap.setView(position, 15);
        updateMarker(position);
        pathCoordinates = [position];
    }
}

// Start GPS tracking
function startGPSTracking() {
    if (!navigator.geolocation) {
        showToast('GPS not supported on this device', 'error');
        return;
    }
    
    isTracking = true;
    elements.gpsWaiting.style.display = 'flex';
    
    // Clear any existing watch
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
    }
    
    // Start watching position
    gpsWatchId = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        handlePositionError,
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
    
    // Get initial position immediately
    navigator.geolocation.getCurrentPosition(
        (position) => {
            elements.gpsWaiting.style.display = 'none';
            handlePositionUpdate(position);
        },
        handlePositionError,
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Handle GPS position update
async function handlePositionUpdate(position) {
    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    
    // Hide waiting indicator
    elements.gpsWaiting.style.display = 'none';
    
    // Calculate distance if we have a previous position
    if (lastPosition) {
        const distance = calculateDistance(
            lastPosition.latitude, lastPosition.longitude,
            latitude, longitude
        );
        totalDistance += distance;
    }
    
    // Update last position
    lastPosition = { latitude, longitude };
    
    // Update path
    const newPosition = [latitude, longitude];
    pathCoordinates.push(newPosition);
    
    // Update UI
    elements.currentSpeed.textContent = speed ? (speed * 3.6).toFixed(0) : '0';
    elements.gpsAccuracy.textContent = accuracy ? Math.round(accuracy) : '--';
    elements.distanceCovered.textContent = (totalDistance / 1000).toFixed(1);
    
    // Update map
    updateMap(newPosition);
    
    // Send to server
    if (currentShipment) {
        const locationData = {
            latitude,
            longitude,
            accuracy: accuracy || null,
            speed: speed || null,
            heading: heading || null,
            timestamp: new Date().toISOString()
        };
        
        // Debug logging
        console.log('GPS Update - Shipment:', currentShipment?.id, 'Location:', locationData);
        
        if (!currentShipment || !currentShipment.id) {
            console.warn('No active shipment, skipping location update');
            return;
        }
        
        await sendLocationUpdate(currentShipment.id, locationData);
    }
}

// Handle GPS error
function handlePositionError(error) {
    elements.gpsWaiting.style.display = 'none';
    
    let message = 'GPS Error';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = 'Please allow location access';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'GPS signal not available';
            break;
        case error.TIMEOUT:
            message = 'GPS request timed out';
            break;
    }
    
    showToast(message, 'error');
    console.error('GPS Error:', error);
}

// Update map with new position
function updateMap(position) {
    // Center map on position
    driverMap.panTo(position);
    
    // Update or create marker
    updateMarker(position);
    
    // Update polyline
    if (pathPolyline) {
        driverMap.removeLayer(pathPolyline);
    }
    
    if (pathCoordinates.length > 1) {
        pathPolyline = L.polyline(pathCoordinates, {
            color: '#3b82f6',
            weight: 4,
            opacity: 0.8,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(driverMap);
    }
}

// Update marker position
function updateMarker(position) {
    if (currentMarker) {
        currentMarker.setLatLng(position);
    } else {
        const icon = L.divIcon({
            html: '<div style="background: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            className: 'driver-marker'
        });
        
        currentMarker = L.marker(position, { icon }).addTo(driverMap);
    }
}

// Send location update (with offline queue)
async function sendLocationUpdate(shipmentId, locationData) {
    if (!isOnline) {
        // Queue for later
        locationQueue.push({ shipmentId, locationData });
        elements.offlineIndicator.style.display = 'flex';
        return;
    }
    
    try {
        await updateLocation(shipmentId, locationData);
        elements.offlineIndicator.style.display = 'none';
        
        // Emit via socket for real-time updates
        if (typeof socketClient !== 'undefined' && socketClient.socket) {
            socketClient.socket.emit('location_update', {
                shipment_id: shipmentId,
                ...locationData
            });
        }
    } catch (error) {
        console.error('Failed to send location:', error);
        // Queue for retry
        locationQueue.push({ shipmentId, locationData });
    }
}

// Process queued locations when back online
async function processLocationQueue() {
    if (locationQueue.length === 0) return;
    
    elements.offlineIndicator.style.display = 'none';
    showToast(`Sending ${locationQueue.length} queued updates...`, 'info');
    
    const queue = [...locationQueue];
    locationQueue = [];
    
    for (const item of queue) {
        try {
            await updateLocation(item.shipmentId, item.locationData);
        } catch (error) {
            // Re-queue if failed
            locationQueue.push(item);
        }
    }
    
    if (locationQueue.length === 0) {
        showToast('All updates sent', 'success');
    } else {
        showToast(`${locationQueue.length} updates still queued`, 'warning');
    }
}

// End trip
function endTrip() {
    if (!isTracking) return;
    
    if (confirm('Are you sure you want to end this trip?')) {
        stopGPSTracking();
        
        // Keep marker and polyline visible
        showToast('Trip ended. Location tracking stopped.', 'info');
        
        // Hide tracking indicator
        elements.trackingIndicator.classList.add('hidden');
    }
}

// Confirm delivery
function confirmDelivery() {
    elements.deliveryModal.style.display = 'flex';
}

// Close delivery modal
function closeDeliveryModal() {
    elements.deliveryModal.style.display = 'none';
    elements.deliveryNotes.value = '';
}

// Submit delivery confirmation
async function submitDeliveryConfirmation() {
    if (!currentShipment) return;
    
    try {
        const notes = elements.deliveryNotes.value;
        
        await confirmDeliveryAPI(currentShipment.id, {
            delivery_notes: notes,
            delivered_at: new Date().toISOString()
        });
        
        // Stop GPS tracking
        stopGPSTracking();
        
        // Update UI
        elements.trackingIndicator.classList.add('hidden');
        elements.endTripBtn.disabled = true;
        elements.confirmDeliveryBtn.disabled = true;
        
        // Change marker to green
        if (currentMarker) {
            const icon = L.divIcon({
                html: '<div style="background: #10b981; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10],
                className: 'driver-marker delivered'
            });
            currentMarker.setIcon(icon);
        }
        
        closeDeliveryModal();
        showToast('Delivery confirmed!', 'success');
        
        // Refresh shipments after delay
        setTimeout(() => {
            location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('Failed to confirm delivery:', error);
        showToast('Failed to confirm delivery', 'error');
    }
}

// Stop GPS tracking
function stopGPSTracking() {
    isTracking = false;
    
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }
}

// Update online status UI
function updateOnlineStatus() {
    if (isOnline) {
        elements.connectionStatus.classList.remove('offline');
        elements.offlineIndicator.style.display = 'none';
    } else {
        elements.connectionStatus.classList.add('offline');
    }
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
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

// Format status for display
function formatStatus(status) {
    const statusMap = {
        'pending': 'Pending',
        'in_transit': 'In Transit',
        'delivered': 'Delivered',
        'cancelled': 'Cancelled'
    };
    return statusMap[status] || status;
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✅' : 
                 type === 'error' ? '❌' : 
                 type === 'warning' ? '⚠️' : 'ℹ️';
    
    toast.innerHTML = `${icon} ${message}`;
    elements.toastContainer.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Refresh shipments
async function refreshShipments() {
    showToast('Refreshing shipments...', 'info');
    await loadShipments();
}

// Socket event handlers
function initSocket() {
    // Use socketClient from socket.js module
    if (typeof socketClient !== 'undefined') {
        socketClient.on('connect', () => {
            console.log('Socket connected');
        });
        
        socketClient.on('status_update', (data) => {
            if (currentShipment && data.shipment_id === currentShipment.id) {
                showToast(`Status updated: ${formatStatus(data.status)}`, 'info');
            }
        });
        
        socketClient.on('disconnect', () => {
            console.log('Socket disconnected');
        });
    }
}

// API wrapper for confirm delivery
async function confirmDeliveryAPI(shipmentId, data) {
    const response = await fetch(`${API_BASE_URL}/shipments/${shipmentId}/confirm-delivery`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        throw new Error('Failed to confirm delivery');
    }
    
    return await response.json();
}

// Update shipment status
async function updateShipmentStatus(shipmentId, status) {
    // This would typically be an API call
    // For now, we'll emit via socket
    socket.emit('status_change', {
        shipment_id: shipmentId,
        status: status
    });
}
