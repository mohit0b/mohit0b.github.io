/**
 * LinkNode Admin Dashboard - Live Tracking
 * Real-time driver and shipment monitoring
 */

// State management
let drivers = new Map();
let shipments = new Map();
let driverMarkers = new Map();
let shipmentMarkers = new Map();
let pathPolylines = new Map();
let selectedDriverId = null;
let activeTab = 'drivers';

// DOM Elements
const elements = {
    driversList: document.getElementById('driversList'),
    shipmentsList: document.getElementById('shipmentsList'),
    activeDrivers: document.getElementById('activeDrivers'),
    activeShipments: document.getElementById('activeShipments'),
    pendingDeliveries: document.getElementById('pendingDeliveries'),
    driverPanel: document.getElementById('driverPanel'),
    panelDriverName: document.getElementById('panelDriverName'),
    panelDriverEmail: document.getElementById('panelDriverEmail'),
    panelDriverStatus: document.getElementById('panelDriverStatus'),
    panelShipmentId: document.getElementById('panelShipmentId'),
    panelDestination: document.getElementById('panelDestination'),
    panelSpeed: document.getElementById('panelSpeed'),
    panelLastUpdate: document.getElementById('panelLastUpdate'),
    pathHistory: document.getElementById('pathHistory'),
    toastContainer: document.getElementById('toastContainer')
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }

    // Verify admin role
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') {
        showToast('Access denied. Admin account required.', 'error');
        logout();
        return;
    }

    // Initialize
    initMap();
    initSocket();
    socketClient.connect();
    await loadInitialData();
    
    showToast('Admin dashboard loaded. Live tracking active.', 'success');
});

// Initialize Leaflet Map
let adminMap;
function initMap() {
    adminMap = L.map('adminMap', {
        zoomControl: false
    }).setView([20.5937, 78.9629], 5);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    }).addTo(adminMap);
    
    // Add zoom control at top right
    L.control.zoom({
        position: 'topright'
    }).addTo(adminMap);
}

// Load initial data
async function loadInitialData() {
    try {
        // Load all shipments
        const shipmentsResponse = await getShipments();
        const shipmentsData = shipmentsResponse.data || shipmentsResponse || [];
        
        // Ensure shipmentsData is an array
        const shipmentsArray = Array.isArray(shipmentsData) ? shipmentsData : [];
        
        shipmentsArray.forEach(shipment => {
            shipments.set(shipment.id, shipment);
        });
        
        // Load all users (drivers)
        const usersResponse = await fetch(`${API_BASE_URL}/users`, {
            headers: getHeaders()
        }).then(r => r.json());
        
        const driversData = usersResponse.data || [];
        driversData.forEach(driver => {
            if (driver.role === 'driver') {
                drivers.set(driver.id, {
                    ...driver,
                    isOnline: false,
                    currentLocation: null,
                    currentShipment: null,
                    speed: 0,
                    lastUpdate: null
                });
            }
        });
        
        updateStats();
        renderDrivers();
        renderShipments();
        
    } catch (error) {
        console.error('Failed to load initial data:', error);
        showToast('Failed to load data', 'error');
    }
}

// Initialize Socket.io for real-time updates
function initSocket() {
    // Use socketClient from socket.js module
    if (typeof socketClient !== 'undefined') {
        socketClient.on('connect', () => {
            console.log('Admin socket connected');
            showToast('Connected to live tracking', 'success');
        });
        
        // Listen for driver location updates
        socketClient.on('location_update', (data) => {
            handleLocationUpdate(data);
        });
        
        // Listen for driver status changes
        socketClient.on('driver_status', (data) => {
            handleDriverStatusUpdate(data);
        });
        
        // Listen for shipment status updates
        socketClient.on('shipment_status', (data) => {
            handleShipmentStatusUpdate(data);
        });
        
        socketClient.on('disconnect', () => {
            console.log('Socket disconnected');
            showToast('Disconnected from live tracking', 'warning');
        });
    } else {
        console.error('Socket client not loaded');
    }
}

// Handle live location update
function handleLocationUpdate(data) {
    const driverId = data.driver_id || data.user_id;
    if (!driverId) return;
    
    const driver = drivers.get(driverId);
    if (!driver) return;
    
    // Update driver data
    driver.currentLocation = {
        lat: data.latitude,
        lng: data.longitude
    };
    driver.speed = data.speed ? (data.speed * 3.6).toFixed(1) : 0; // m/s to km/h
    driver.lastUpdate = new Date().toLocaleTimeString();
    driver.isOnline = true;
    
    // Update marker on map
    updateDriverMarker(driverId, driver.currentLocation);
    
    // Update path polyline
    updateDriverPath(driverId, driver.currentLocation);
    
    // Update driver card if visible
    updateDriverCard(driverId);
    
    // Update panel if this driver is selected
    if (selectedDriverId === driverId) {
        updateDriverPanel(driver);
    }
    
    // Update stats
    updateStats();
}

// Handle driver status update
function handleDriverStatusUpdate(data) {
    const driver = drivers.get(data.driver_id);
    if (!driver) return;
    
    driver.isOnline = data.status === 'online';
    driver.currentShipment = data.shipment_id || null;
    
    updateDriverCard(data.driver_id);
    updateStats();
}

// Handle shipment status update
function handleShipmentStatusUpdate(data) {
    const shipment = shipments.get(data.shipment_id);
    if (!shipment) return;
    
    shipment.status = data.status;
    shipment.updated_at = new Date().toISOString();
    
    renderShipments();
    updateStats();
    
    showToast(`Shipment #${data.shipment_id} is now ${data.status}`, 'info');
}

// Update driver marker on map
function updateDriverMarker(driverId, location) {
    let marker = driverMarkers.get(driverId);
    
    const driver = drivers.get(driverId);
    const isActive = driver && driver.isOnline;
    
    const icon = L.divIcon({
        html: `
            <div style="
                background: ${isActive ? '#10b981' : '#f59e0b'}; 
                width: 36px; 
                height: 36px; 
                border-radius: 50%; 
                border: 3px solid white; 
                box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
            ">🚛</div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        className: 'driver-marker'
    });
    
    if (marker) {
        marker.setLatLng([location.lat, location.lng]);
    } else {
        marker = L.marker([location.lat, location.lng], { icon })
            .addTo(adminMap)
            .bindPopup(createDriverPopup(driverId));
        
        marker.on('click', () => selectDriver(driverId));
        driverMarkers.set(driverId, marker);
    }
}

// Create driver popup content
function createDriverPopup(driverId) {
    const driver = drivers.get(driverId);
    if (!driver) return 'Driver';
    
    return `
        <div style="text-align: center;">
            <strong>${driver.name || 'Driver #' + driverId}</strong><br>
            <small>${driver.isOnline ? '🟢 Online' : '🟡 Idle'}</small><br>
            <small>Speed: ${driver.speed || 0} km/h</small>
        </div>
    `;
}

// Update driver path polyline
function updateDriverPath(driverId, location) {
    let polyline = pathPolylines.get(driverId);
    let path = polyline ? polyline.getLatLngs() : [];
    
    path.push([location.lat, location.lng]);
    
    // Keep only last 50 points to avoid performance issues
    if (path.length > 50) {
        path = path.slice(-50);
    }
    
    if (polyline) {
        polyline.setLatLngs(path);
    } else {
        polyline = L.polyline(path, {
            color: '#3b82f6',
            weight: 3,
            opacity: 0.7,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(adminMap);
        
        pathPolylines.set(driverId, polyline);
    }
}

// Render drivers list
function renderDrivers() {
    const driversArray = Array.from(drivers.values());
    
    if (driversArray.length === 0) {
        elements.driversList.innerHTML = '<div class="empty-state">No drivers found</div>';
        return;
    }
    
    elements.driversList.innerHTML = driversArray.map(driver => `
        <div class="driver-card ${selectedDriverId === driver.id ? 'active' : ''}" 
             onclick="selectDriver(${driver.id})"
             data-driver-id="${driver.id}">
            <div class="driver-card-header">
                <div class="driver-avatar">🚛</div>
                <div class="driver-info">
                    <h4>${driver.name || 'Driver #' + driver.id}</h4>
                    <p>${driver.email || ''}</p>
                    <div class="driver-status">
                        <span class="status-dot ${driver.isOnline ? '' : 'offline'}"></span>
                        <span>${driver.isOnline ? 'Active' : 'Offline'}</span>
                    </div>
                </div>
            </div>
            <div class="driver-stats">
                <div class="driver-stat">
                    <span class="driver-stat-value">${driver.speed || 0}</span>
                    <span class="driver-stat-label">km/h</span>
                </div>
                <div class="driver-stat">
                    <span class="driver-stat-value">${driver.currentShipment ? '#' + driver.currentShipment : '-'}</span>
                    <span class="driver-stat-label">Shipment</span>
                </div>
                <div class="driver-stat">
                    <span class="driver-stat-value">${driver.lastUpdate || '--:--'}</span>
                    <span class="driver-stat-label">Updated</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Render shipments list
function renderShipments() {
    const shipmentsArray = Array.from(shipments.values());
    const filterValue = document.getElementById('statusFilter')?.value || 'all';
    
    const filtered = filterValue === 'all' 
        ? shipmentsArray 
        : shipmentsArray.filter(s => s.status === filterValue);
    
    if (filtered.length === 0) {
        elements.shipmentsList.innerHTML = '<div class="empty-state">No shipments found</div>';
        return;
    }
    
    elements.shipmentsList.innerHTML = filtered.map(shipment => `
        <div class="shipment-card" onclick="focusShipment(${shipment.id})">
            <div class="shipment-header">
                <span class="shipment-id">#${shipment.id}</span>
                <span class="status-badge ${shipment.status}">${formatStatus(shipment.status)}</span>
            </div>
            <div class="shipment-route">
                <span>📍 ${shipment.origin_address || 'Unknown'}</span>
                <span>→</span>
                <span>🏁 ${shipment.destination_address || 'Unknown'}</span>
            </div>
            <div style="margin-top: 8px; font-size: 0.75rem; color: #6b7280;">
                Driver: ${getDriverName(shipment.driver_id)}
            </div>
        </div>
    `).join('');
}

// Select driver
function selectDriver(driverId) {
    selectedDriverId = driverId;
    
    // Update UI
    document.querySelectorAll('.driver-card').forEach(card => {
        card.classList.remove('active');
    });
    const card = document.querySelector(`[data-driver-id="${driverId}"]`);
    if (card) card.classList.add('active');
    
    const driver = drivers.get(driverId);
    if (!driver) return;
    
    // Show panel
    showDriverPanel(driver);
    
    // Center map on driver
    if (driver.currentLocation) {
        adminMap.setView([driver.currentLocation.lat, driver.currentLocation.lng], 15);
    }
}

// Show driver panel
function showDriverPanel(driver) {
    elements.driverPanel.style.display = 'flex';
    updateDriverPanel(driver);
}

// Update driver panel
function updateDriverPanel(driver) {
    elements.panelDriverName.textContent = driver.name || 'Driver #' + driver.id;
    elements.panelDriverEmail.textContent = driver.email || '';
    elements.panelDriverStatus.textContent = driver.isOnline ? 'Online' : 'Offline';
    elements.panelDriverStatus.className = `status-badge ${driver.isOnline ? 'in_transit' : 'pending'}`;
    
    elements.panelSpeed.textContent = driver.speed || 0;
    elements.panelLastUpdate.textContent = driver.lastUpdate || '--';
    
    // Update shipment info
    if (driver.currentShipment) {
        const shipment = shipments.get(driver.currentShipment);
        elements.panelShipmentId.textContent = '#' + driver.currentShipment;
        elements.panelDestination.textContent = shipment?.destination_address || 'Unknown';
    } else {
        elements.panelShipmentId.textContent = '-';
        elements.panelDestination.textContent = 'No active shipment';
    }
    
    // Update path history
    const polyline = pathPolylines.get(driver.id);
    if (polyline) {
        const path = polyline.getLatLngs();
        elements.pathHistory.innerHTML = path.slice(-5).map((point, i) => `
            <div class="path-point">
                ${i + 1}. ${point[0].toFixed(4)}, ${point[1].toFixed(4)}
            </div>
        `).join('');
    }
}

// Close driver panel
function closeDriverPanel() {
    elements.driverPanel.style.display = 'none';
    selectedDriverId = null;
    
    document.querySelectorAll('.driver-card').forEach(card => {
        card.classList.remove('active');
    });
}

// Focus on shipment
function focusShipment(shipmentId) {
    const shipment = shipments.get(shipmentId);
    if (!shipment) return;
    
    // Find driver assigned to this shipment
    const driver = Array.from(drivers.values()).find(d => d.currentShipment === shipmentId);
    
    if (driver && driver.currentLocation) {
        adminMap.setView([driver.currentLocation.lat, driver.currentLocation.lng], 15);
        selectDriver(driver.id);
    } else if (shipment.current_latitude && shipment.current_longitude) {
        adminMap.setView([shipment.current_latitude, shipment.current_longitude], 15);
    }
}

// Update stats
function updateStats() {
    const driversArray = Array.from(drivers.values());
    const shipmentsArray = Array.from(shipments.values());
    
    elements.activeDrivers.textContent = driversArray.filter(d => d.isOnline).length;
    elements.activeShipments.textContent = shipmentsArray.filter(s => s.status === 'in_transit').length;
    elements.pendingDeliveries.textContent = shipmentsArray.filter(s => s.status === 'pending').length;
}

// Update individual driver card
function updateDriverCard(driverId) {
    // Re-render all drivers for simplicity
    renderDrivers();
}

// Filter drivers
function filterDrivers() {
    const searchTerm = document.getElementById('driverSearch').value.toLowerCase();
    const cards = document.querySelectorAll('.driver-card');
    
    cards.forEach(card => {
        const driverId = card.getAttribute('data-driver-id');
        const driver = drivers.get(parseInt(driverId));
        
        if (!driver) return;
        
        const text = `${driver.name} ${driver.email}`.toLowerCase();
        card.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
}

// Filter shipments
function filterShipments() {
    renderShipments();
}

// Switch tabs
function switchTab(tab) {
    activeTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tab + 'Tab').classList.add('active');
}

// Refresh all data
async function refreshData() {
    showToast('Refreshing data...', 'info');
    await loadInitialData();
    showToast('Data refreshed', 'success');
}

// Helper functions
function formatStatus(status) {
    const statusMap = {
        'pending': 'Pending',
        'in_transit': 'In Transit',
        'delivered': 'Delivered',
        'cancelled': 'Cancelled'
    };
    return statusMap[status] || status;
}

function getDriverName(driverId) {
    const driver = drivers.get(driverId);
    return driver ? (driver.name || 'Driver #' + driverId) : 'Unknown';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✅' : 
                 type === 'error' ? '❌' : 
                 type === 'warning' ? '⚠️' : 'ℹ️';
    
    toast.textContent = `${icon} ${message}`;
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}
