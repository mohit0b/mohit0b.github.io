/**
 * Driver Dashboard Logic
 */

let assignedShipments = [];
let activeShipment = null;
let map = null;
let currentMarker = null;
let gpsWatchId = null;
let isGPSTracking = false;
let lastLocation = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }

    // Load user info
    const user = getCurrentUser();
    if (user) {
        document.getElementById('userName').textContent = user.name || user.email;
        document.getElementById('userRole').textContent = user.role;
    }

    // Initialize socket
    initSocket();
    
    // Setup socket listeners
    onStatusUpdate(handleStatusUpdate);
    onRiskAlert(handleRiskAlert);

    // Initialize map
    initMap();

    // Load assigned shipments
    await loadShipments();

    // Check for geolocation support
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        document.getElementById('toggleGPS').disabled = true;
    }
});

// Initialize Leaflet Map
function initMap() {
    map = L.map('map').setView([20.5937, 78.9629], 5);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
}

// Load assigned shipments
async function loadShipments() {
    try {
        const data = await getAssignedShipments();
        assignedShipments = data.data || [];
        renderShipments(assignedShipments);
        
        // Check for active in_transit shipment
        activeShipment = assignedShipments.find(s => s.status === 'in_transit');
        updateActiveShipmentUI();
    } catch (error) {
        console.error('Failed to load shipments:', error);
    }
}

// Refresh shipments
async function refreshShipments() {
    const btn = document.querySelector('.btn-primary.btn-sm');
    btn.textContent = 'Loading...';
    await loadShipments();
    btn.textContent = '🔄 Refresh';
}

// Render shipments table
function renderShipments(shipments) {
    const tbody = document.getElementById('shipmentsTableBody');
    tbody.innerHTML = '';

    if (shipments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px;">No assigned shipments</td></tr>';
        return;
    }

    shipments.forEach(shipment => {
        const row = document.createElement('tr');
        
        const statusBadge = getStatusBadge(shipment.status);
        
        let actions = '';
        if (shipment.status === 'pending') {
            actions = `<button class="btn btn-sm btn-primary" onclick="startShipment(${shipment.id})">Start</button>`;
        } else if (shipment.status === 'in_transit') {
            actions = `<button class="btn btn-sm btn-success" onclick="confirmDelivery()">Deliver</button>`;
        } else {
            actions = `<span class="badge badge-delivered">Completed</span>`;
        }
        
        row.innerHTML = `
            <td>#${shipment.id}</td>
            <td>${shipment.origin || 'N/A'}</td>
            <td>${shipment.destination || 'N/A'}</td>
            <td>${statusBadge}</td>
            <td>${actions}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Get status badge HTML
function getStatusBadge(status) {
    const badges = {
        pending: '<span class="badge badge-pending">⏳ Pending</span>',
        in_transit: '<span class="badge badge-in_transit">🚛 In Transit</span>',
        delivered: '<span class="badge badge-delivered">✅ Delivered</span>'
    };
    return badges[status] || status;
}

// Update active shipment UI
function updateActiveShipmentUI() {
    const card = document.getElementById('activeShipmentCard');
    const details = document.getElementById('activeShipmentDetails');
    
    if (activeShipment) {
        card.style.display = 'block';
        
        details.innerHTML = `
            <div class="detail-row">
                <span class="detail-label">Shipment ID</span>
                <span class="detail-value">#${activeShipment.id}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">From</span>
                <span class="detail-value">${activeShipment.origin || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">To</span>
                <span class="detail-value">${activeShipment.destination || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Started</span>
                <span class="detail-value">${formatDate(activeShipment.started_at)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Expected Delivery</span>
                <span class="detail-value">${formatDate(activeShipment.expected_delivery)}</span>
            </div>
        `;
        
        // Join socket room for updates
        joinShipmentRoom(activeShipment.id);
    } else {
        card.style.display = 'none';
    }
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
}

// Toggle GPS tracking
function toggleGPS() {
    const btn = document.getElementById('toggleGPS');
    const statusText = document.getElementById('gpsStatusText');
    
    if (isGPSTracking) {
        // Stop tracking
        stopGPSTracking();
        btn.textContent = 'Start GPS Tracking';
        statusText.textContent = 'Not tracking';
        isGPSTracking = false;
    } else {
        // Start tracking
        startGPSTracking();
        btn.textContent = 'Stop GPS Tracking';
        statusText.textContent = 'Tracking active';
        isGPSTracking = true;
    }
}

// Start GPS tracking
function startGPSTracking() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported');
        return;
    }
    
    console.log('Starting GPS tracking with fresh location...');
    
    // Show active GPS indicator
    document.getElementById('gpsStatus').className = 'gps-status active';
    document.getElementById('gpsText').textContent = 'GPS: Active';
    
    // Force fresh location by clearing cache first
    navigator.geolocation.clearWatch(gpsWatchId);
    
    // Start watching position with strict settings for fresh data
    gpsWatchId = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        handlePositionError,
        {
            enableHighAccuracy: true,
            timeout: 5000,        // Shorter timeout
            maximumAge: 0        // Force fresh location, no cache
        }
    );
    
    // Also get immediate fresh position
    navigator.geolocation.getCurrentPosition(
        (position) => {
            console.log('Got fresh position:', position.coords);
            handlePositionUpdate(position);
        },
        handlePositionError,
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0        // Force fresh location
        }
    );
}

// Stop GPS tracking
function stopGPSTracking() {
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }
    
    document.getElementById('gpsStatus').className = 'gps-status';
    document.getElementById('gpsText').textContent = 'GPS: Inactive';
}

// Handle position update
async function handlePositionUpdate(position) {
    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    
    console.log('GPS Position Update:', {
        latitude,
        longitude,
        accuracy,
        timestamp: new Date().toISOString()
    });
    
    // Validate coordinates (basic check for India bounds)
    if (latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98) {
        console.warn('Coordinates seem outside India:', { latitude, longitude });
        console.warn('This might be cached/IP-based location. Try these steps:');
        console.warn('1. Enable device GPS/location services');
        console.warn('2. Allow high-precision location in browser');
        console.warn('3. Try on mobile device with GPS enabled');
        console.warn('4. Move to location with better GPS signal');
        
        // Show warning to user but still update display
        document.getElementById('gpsStatusText').textContent = 'Warning: Location outside India - Using cached location';
    } else {
        document.getElementById('gpsStatusText').textContent = 'Tracking active';
    }
    
    // Update display
    document.getElementById('gpsLat').textContent = latitude.toFixed(6);
    document.getElementById('gpsLng').textContent = longitude.toFixed(6);
    document.getElementById('gpsAccuracy').textContent = accuracy ? Math.round(accuracy) : '-';
    document.getElementById('gpsSpeed').textContent = speed ? (speed * 3.6).toFixed(1) : '-';
    document.getElementById('gpsLastUpdate').textContent = new Date().toLocaleTimeString();
    
    // Update map marker
    updateMapMarker(latitude, longitude);
    
    // Send to server if we have an active shipment
    if (activeShipment) {
        try {
            await updateLocation(activeShipment.id, {
                latitude,
                longitude,
                accuracy: accuracy || null,
                speed: speed ? speed * 3.6 : null, // Convert m/s to km/h
                heading: heading || null
            });
            
            lastLocation = { latitude, longitude };
            console.log('Location updated for shipment', activeShipment.id);
        } catch (error) {
            console.error('Failed to update location:', error);
        }
    }
}

// Handle position error
function handlePositionError(error) {
    console.error('GPS Error:', error);
    
    let message = 'Could not get location';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = 'Location permission denied. Please allow location access in your browser settings.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Location information unavailable. Please check your GPS/location services.';
            break;
        case error.TIMEOUT:
            message = 'Location request timed out. Please try again.';
            break;
    }
    
    console.error('GPS Error Details:', { code: error.code, message: error.message });
    document.getElementById('gpsStatusText').textContent = 'Error: ' + message;
    
    // Also show user-friendly alert
    alert(message + '\n\nTips:\n1. Allow location access when prompted\n2. Enable GPS/location services on your device\n3. Try refreshing the page and clicking Start GPS again');
}

// Manual location input for testing
let useManualLocation = false;
let manualLocation = null;
let simulationMode = false;
let simulationInterval = null;
let currentSimulatedPosition = null;

// Indian cities for simulation
const indianLocations = [
    { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
    { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
    { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
    { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
    { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
    { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 }
];

function setManualLocation() {
    const latInput = document.getElementById('manualLat').value;
    const lngInput = document.getElementById('manualLng').value;
    
    if (!latInput || !lngInput) {
        alert('Please enter both latitude and longitude');
        return;
    }
    
    const latitude = parseFloat(latInput);
    const longitude = parseFloat(lngInput);
    
    // Validate Indian coordinates
    if (latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98) {
        alert('Coordinates appear to be outside India. Please enter valid Indian coordinates.\n\nExamples:\n- Delhi: 28.6139, 77.2090\n- Mumbai: 19.0760, 72.8777\n- Bangalore: 12.9716, 77.5946');
        return;
    }
    
    useManualLocation = true;
    simulationMode = false;
    manualLocation = { latitude, longitude };
    currentSimulatedPosition = { ...manualLocation };
    
    // Stop GPS tracking if active
    if (isGPSTracking) {
        stopGPSTracking();
    }
    
    // Update display
    document.getElementById('gpsStatusText').textContent = 'Manual location active';
    document.getElementById('gpsStatus').className = 'gps-status active';
    document.getElementById('gpsText').textContent = 'GPS: Manual';
    
    // Process as position update
    handlePositionUpdate({
        coords: {
            latitude,
            longitude,
            accuracy: 10,
            speed: null,
            heading: null
        }
    });
    
    console.log('Manual location set:', { latitude, longitude });
    alert(`Manual location set: ${latitude}, ${longitude}\n\nClick "Simulate Movement" to start live tracking simulation.`);
}

function startSimulation() {
    if (!currentSimulatedPosition) {
        alert('Please set a manual location first, then click "Simulate Movement"');
        return;
    }
    
    simulationMode = true;
    useManualLocation = true;
    
    // Stop any existing simulation
    if (simulationInterval) {
        clearInterval(simulationInterval);
    }
    
    document.getElementById('gpsStatusText').textContent = 'Simulation: Moving';
    document.getElementById('gpsText').textContent = 'GPS: Simulated';
    
    // Simulate movement - small random changes every 3 seconds
    simulationInterval = setInterval(() => {
        // Add small random movement (simulate driving)
        const latChange = (Math.random() - 0.5) * 0.001; // ~100m change
        const lngChange = (Math.random() - 0.5) * 0.001;
        
        currentSimulatedPosition.latitude += latChange;
        currentSimulatedPosition.longitude += lngChange;
        
        // Calculate simulated speed (km/h)
        const speed = Math.random() * 30 + 20; // 20-50 km/h
        
        handlePositionUpdate({
            coords: {
                latitude: currentSimulatedPosition.latitude,
                longitude: currentSimulatedPosition.longitude,
                accuracy: 5 + Math.random() * 5, // 5-10m accuracy
                speed: speed / 3.6, // Convert to m/s
                heading: Math.random() * 360
            }
        });
        
        console.log('Simulated movement:', {
            lat: currentSimulatedPosition.latitude,
            lng: currentSimulatedPosition.longitude,
            speed: speed.toFixed(1) + ' km/h'
        });
    }, 3000); // Update every 3 seconds
    
    console.log('Simulation started - updating every 3 seconds');
    alert('Simulation started! Location will update automatically every 3 seconds to simulate movement.');
}

function stopSimulation() {
    simulationMode = false;
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
    document.getElementById('gpsStatusText').textContent = 'Simulation stopped';
    console.log('Simulation stopped');
}

function useCurrentLocation() {
    useManualLocation = false;
    simulationMode = false;
    manualLocation = null;
    stopSimulation();
    document.getElementById('gpsStatusText').textContent = 'Using GPS location';
    
    // Start GPS tracking
    if (!isGPSTracking) {
        toggleGPS();
    }
}

// Modify handlePositionUpdate to check for manual location
const originalHandlePositionUpdate = handlePositionUpdate;
handlePositionUpdate = async function(position) {
    if (useManualLocation && manualLocation) {
        // Override with manual location
        position = {
            coords: {
                ...position.coords,
                latitude: manualLocation.latitude,
                longitude: manualLocation.longitude
            }
        };
    }
    return originalHandlePositionUpdate(position);
};

// Update map marker
function updateMapMarker(lat, lng) {
    const position = [lat, lng];
    
    if (currentMarker) {
        currentMarker.setLatLng(position);
    } else {
        // Create custom icon for current location
        const customIcon = L.divIcon({
            html: '<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            className: 'current-location-marker'
        });
        
        currentMarker = L.marker(position, { icon: customIcon })
            .addTo(map)
            .bindPopup('Current Location');
    }
    
    map.setView(position, 15);
}

// Start a shipment
async function startShipment(shipmentId) {
    if (!confirm('Are you ready to start this shipment?')) return;
    
    try {
        const result = await startShipment(shipmentId);
        
        // Refresh shipments
        await loadShipments();
        
        // Start GPS tracking if not already active
        if (!isGPSTracking) {
            toggleGPS();
        }
        
        alert('Shipment started! GPS tracking is now active.');
        
    } catch (error) {
        console.error('Failed to start shipment:', error);
        alert(error.message || 'Failed to start shipment');
    }
}

// Open delivery confirmation modal
function confirmDelivery() {
    if (!activeShipment) {
        alert('No active shipment');
        return;
    }
    
    document.getElementById('confirmShipmentId').textContent = '#' + activeShipment.id;
    document.getElementById('deliveryNotes').value = '';
    document.getElementById('recipientName').value = '';
    document.getElementById('deliveryModal').style.display = 'block';
}

// Close delivery modal
function closeDeliveryModal() {
    document.getElementById('deliveryModal').style.display = 'none';
}

// Submit delivery confirmation
async function submitDeliveryConfirmation() {
    if (!activeShipment) return;
    
    const notes = document.getElementById('deliveryNotes').value;
    const recipient = document.getElementById('recipientName').value;
    
    try {
        const deliveryData = {
            delivery_notes: notes,
            recipient_name: recipient,
            delivered_at: new Date().toISOString()
        };
        
        await confirmDelivery(activeShipment.id, deliveryData);
        
        // Close modal
        closeDeliveryModal();
        
        // Stop GPS tracking
        if (isGPSTracking) {
            toggleGPS();
        }
        
        // Leave shipment room
        leaveShipmentRoom(activeShipment.id);
        
        // Refresh
        await loadShipments();
        
        alert('Delivery confirmed!');
        
    } catch (error) {
        console.error('Failed to confirm delivery:', error);
        alert(error.message || 'Failed to confirm delivery');
    }
}

// Open issue report modal
function reportIssue() {
    if (!activeShipment) {
        alert('No active shipment');
        return;
    }
    
    document.getElementById('issueType').value = 'delay';
    document.getElementById('issueDescription').value = '';
    document.getElementById('issueModal').style.display = 'block';
}

// Close issue modal
function closeIssueModal() {
    document.getElementById('issueModal').style.display = 'none';
}

// Submit issue report
async function submitIssueReport() {
    if (!activeShipment) return;
    
    const issueType = document.getElementById('issueType').value;
    const description = document.getElementById('issueDescription').value;
    
    if (!description.trim()) {
        alert('Please describe the issue');
        return;
    }
    
    try {
        const response = await fetch(`http://localhost:5000/api/v1/shipments/${activeShipment.id}/report-issue`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                issue_type: issueType,
                description: description,
                reported_at: new Date().toISOString(),
                location: lastLocation
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to report issue');
        }
        
        closeIssueModal();
        alert('Issue reported. Admin has been notified.');
        
    } catch (error) {
        console.error('Failed to report issue:', error);
        alert(error.message || 'Failed to report issue');
    }
}

// Socket event handlers
function handleStatusUpdate(data) {
    console.log('Status update:', data);
    
    // Refresh shipments to get latest status
    loadShipments();
}

function handleRiskAlert(data) {
    console.log('Risk alert:', data);
    
    if (activeShipment && activeShipment.id === data.shipment_id) {
        alert(`⚠️ Risk Alert: ${data.message || 'High risk detected'}\nFactors: ${data.factors?.join(', ') || 'N/A'}`);
    }
}

// Close modals on outside click
window.onclick = function(event) {
    const deliveryModal = document.getElementById('deliveryModal');
    const issueModal = document.getElementById('issueModal');
    
    if (event.target === deliveryModal) {
        deliveryModal.style.display = 'none';
    }
    if (event.target === issueModal) {
        issueModal.style.display = 'none';
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (isGPSTracking) {
        stopGPSTracking();
    }
    disconnectSocket();
});
