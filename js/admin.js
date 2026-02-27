/**
 * Admin Dashboard Logic
 */

let allShipments = [];
let map = null;
let markers = {};
let polylines = {};
let selectedShipmentId = null;

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
    onLocationUpdate(handleLocationUpdate);
    onShipmentDelivered(handleDeliveryConfirmation);
    onStatusUpdate(handleStatusUpdate);
    onRiskAlert(handleRiskAlert);

    // Initialize map
    initMap();

    // Load shipments
    await loadShipments();

    // Update stats
    updateStats();
});

// Initialize Leaflet Map
function initMap() {
    map = L.map('map').setView([20.5937, 78.9629], 5);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
}

// Load all shipments
async function loadShipments() {
    try {
        const data = await getShipments();
        allShipments = data.data || [];
        renderShipments(allShipments);
        updateMapOptions();
    } catch (error) {
        console.error('Failed to load shipments:', error);
    }
}

// Refresh shipments
async function refreshShipments() {
    const btn = document.querySelector('.btn-primary');
    btn.textContent = 'Loading...';
    await loadShipments();
    updateStats();
    btn.textContent = '🔄 Refresh';
}

// Render shipments table
function renderShipments(shipments) {
    const tbody = document.getElementById('shipmentsTableBody');
    tbody.innerHTML = '';

    shipments.forEach(shipment => {
        const row = document.createElement('tr');
        
        const statusBadge = getStatusBadge(shipment.status);
        const riskBadge = getRiskBadge(shipment.risk_level || 'low');
        
        row.innerHTML = `
            <td>#${shipment.id}</td>
            <td>${shipment.origin || 'N/A'}</td>
            <td>${shipment.destination || 'N/A'}</td>
            <td>${statusBadge}</td>
            <td>${shipment.driver_name || 'Unassigned'}</td>
            <td>${riskBadge}</td>
            <td>${formatDate(shipment.updated_at)}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewShipment(${shipment.id})">View</button>
                ${shipment.status === 'in_transit' ? `
                    <button class="btn btn-sm" onclick="trackShipment(${shipment.id})">Track</button>
                ` : ''}
            </td>
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

// Get risk badge HTML
function getRiskBadge(risk) {
    const badges = {
        low: '<span class="badge badge-low">🟢 Low</span>',
        medium: '<span class="badge badge-medium">🟡 Medium</span>',
        high: '<span class="badge badge-high">🔴 High</span>'
    };
    return badges[risk] || badges.low;
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
}

// Filter shipments
function filterShipments() {
    const statusFilter = document.getElementById('statusFilter').value;
    const riskFilter = document.getElementById('riskFilter').value;
    
    let filtered = allShipments;
    
    if (statusFilter) {
        filtered = filtered.filter(s => s.status === statusFilter);
    }
    
    if (riskFilter) {
        filtered = filtered.filter(s => (s.risk_level || 'low') === riskFilter);
    }
    
    renderShipments(filtered);
}

// Search shipments
function searchShipments() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    
    const filtered = allShipments.filter(s => 
        s.id.toString().includes(search) ||
        (s.origin && s.origin.toLowerCase().includes(search)) ||
        (s.destination && s.destination.toLowerCase().includes(search))
    );
    
    renderShipments(filtered);
}

// Update stats
function updateStats() {
    document.getElementById('totalShipments').textContent = allShipments.length;
    document.getElementById('inTransitCount').textContent = 
        allShipments.filter(s => s.status === 'in_transit').length;
    document.getElementById('deliveredCount').textContent = 
        allShipments.filter(s => s.status === 'delivered').length;
    document.getElementById('highRiskCount').textContent = 
        allShipments.filter(s => s.risk_level === 'high').length;
}

// Update map dropdown options
function updateMapOptions() {
    const select = document.getElementById('mapShipmentSelect');
    select.innerHTML = '<option value="">Select shipment to track</option>';
    
    allShipments.filter(s => s.status === 'in_transit').forEach(shipment => {
        const option = document.createElement('option');
        option.value = shipment.id;
        option.textContent = `#${shipment.id}: ${shipment.origin} → ${shipment.destination}`;
        select.appendChild(option);
    });
}

// View shipment details
async function viewShipment(shipmentId) {
    try {
        const shipmentData = await getShipmentById(shipmentId);
        const historyData = await getShipmentHistory(shipmentId);
        const trackingData = await getTrackingData(shipmentId);
        
        const shipment = shipmentData.data;
        const history = historyData.data || [];
        const tracking = trackingData.data;
        
        const modal = document.getElementById('shipmentModal');
        const content = document.getElementById('shipmentDetailContent');
        
        content.innerHTML = `
            <div class="shipment-detail">
                <div class="detail-section">
                    <h3>Shipment Information</h3>
                    <div class="detail-row">
                        <span class="detail-label">Shipment ID</span>
                        <span class="detail-value">#${shipment.id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status</span>
                        <span class="detail-value">${getStatusBadge(shipment.status)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Origin</span>
                        <span class="detail-value">${shipment.origin || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Destination</span>
                        <span class="detail-value">${shipment.destination || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Driver</span>
                        <span class="detail-value">${shipment.driver_name || 'Unassigned'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Created</span>
                        <span class="detail-value">${formatDate(shipment.created_at)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Expected Delivery</span>
                        <span class="detail-value">${formatDate(shipment.expected_delivery)}</span>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>Current Location</h3>
                    ${tracking ? `
                        <div class="detail-row">
                            <span class="detail-label">Latitude</span>
                            <span class="detail-value">${tracking.latitude}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Longitude</span>
                            <span class="detail-value">${tracking.longitude}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Last Updated</span>
                            <span class="detail-value">${formatDate(tracking.timestamp)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Speed</span>
                            <span class="detail-value">${tracking.speed || 0} km/h</span>
                        </div>
                    ` : '<p>No tracking data available</p>'}
                </div>
            </div>
            
            <h3 style="margin-top: 30px;">Shipment History</h3>
            <div class="timeline">
                ${history.map((event, index) => `
                    <div class="timeline-item ${index === 0 ? '' : 'completed'}">
                        <div class="timeline-time">${formatDate(event.created_at)}</div>
                        <div class="timeline-title">${event.event_type}</div>
                        <div class="timeline-desc">${event.description || ''}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Failed to load shipment details:', error);
        alert('Failed to load shipment details');
    }
}

// Close modal
function closeModal() {
    document.getElementById('shipmentModal').style.display = 'none';
}

// Track shipment on map
async function trackShipment(shipmentId) {
    document.getElementById('mapShipmentSelect').value = shipmentId;
    showShipmentOnMap(shipmentId);
}

// Show shipment on map
async function showShipmentOnMap(shipmentId) {
    if (!shipmentId) {
        // If no shipment selected, clear any existing markers and polylines
        Object.values(markers).forEach(marker => map.removeLayer(marker));
        Object.values(polylines).forEach(polyline => map.removeLayer(polyline));
        markers = {};
        polylines = {};
        return;
    }
    
    // Leave previous shipment room if any
    if (selectedShipmentId) {
        leaveShipmentRoom(selectedShipmentId);
    }
    
    selectedShipmentId = shipmentId;
    
    try {
        // Join socket room for live updates
        const joined = joinShipmentRoom(shipmentId);
        if (!joined) {
            console.error('Failed to join shipment room');
        }
        
        // Load tracking history
        const historyData = await getTrackingHistory(shipmentId);
        const history = historyData.data || [];
        
        // Draw path history
        if (history.length > 0) {
            const coordinates = history.map(point => [point.latitude, point.longitude]);
            const polyline = L.polyline(coordinates, {
                color: '#3b82f6',
                weight: 3,
                opacity: 0.7
            }).addTo(map);
            
            polylines[shipmentId] = polyline;
            
            // Fit map bounds to path
            const bounds = L.latLngBounds(coordinates);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
        
        // Get current tracking data
        const trackingData = await getTrackingData(shipmentId);
        const tracking = trackingData.data;
        
        if (tracking && tracking.latitude && tracking.longitude) {
            updateMapMarker(shipmentId, tracking.latitude, tracking.longitude, tracking.status);
            
            // Center map on current location if no history
            if (history.length === 0) {
                map.setView([tracking.latitude, tracking.longitude], 12);
            }
            
            console.log(`Now tracking shipment #${shipmentId}`);
        } else {
            console.log('No location data available for this shipment yet');
            map.setView([20.5937, 78.9629], 5);
        }
    } catch (error) {
        console.error('Failed to load tracking data:', error);
        alert('Failed to load tracking data. Please try again.');
    }
}

// Update map marker
function updateMapMarker(shipmentId, lat, lng, status = 'in_transit') {
    // Remove existing marker
    if (markers[shipmentId]) {
        map.removeLayer(markers[shipmentId]);
    }
    
    // Determine marker color based on status
    const markerColors = {
        pending: '#9ca3af',
        in_transit: '#3b82f6',
        delivered: '#10b981'
    };
    
    const color = markerColors[status] || markerColors.in_transit;
    
    // Create custom icon
    const customIcon = L.divIcon({
        html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        className: 'shipment-marker'
    });
    
    // Create new marker
    const marker = L.marker([lat, lng], { icon: customIcon })
        .addTo(map)
        .bindPopup(`Shipment #${shipmentId}`);
    
    markers[shipmentId] = marker;
}

// Socket event handlers
function handleLocationUpdate(data) {
    console.log('Location update received:', data);
    
    // Update map marker
    if (data.latitude && data.longitude) {
        updateMapMarker(data.shipment_id, data.latitude, data.longitude, data.status);
        
        // Update polyline if it exists
        if (polylines[data.shipment_id]) {
            const polyline = polylines[data.shipment_id];
            const latlngs = polyline.getLatLngs();
            latlngs.push([data.latitude, data.longitude]);
            polyline.setLatLngs(latlngs);
        }
    }
    
    // Update shipment in list
    const shipment = allShipments.find(s => s.id === data.shipment_id);
    if (shipment) {
        shipment.current_latitude = data.latitude;
        shipment.current_longitude = data.longitude;
        shipment.updated_at = new Date().toISOString();
        renderShipments(allShipments);
    }
}

function handleDeliveryConfirmation(data) {
    console.log('Delivery confirmed:', data);
    
    // Update shipment status
    const shipment = allShipments.find(s => s.id === data.shipment_id);
    if (shipment) {
        shipment.status = 'delivered';
        renderShipments(allShipments);
        updateStats();
    }
    
    // Show notification
    alert(`Shipment #${data.shipment_id} has been delivered!`);
}

function handleStatusUpdate(data) {
    console.log('Status update:', data);
    
    const shipment = allShipments.find(s => s.id === data.shipment_id);
    if (shipment) {
        shipment.status = data.status;
        renderShipments(allShipments);
        updateStats();
    }
}

function handleRiskAlert(data) {
    console.log('Risk alert:', data);
    
    // Show alert notification
    alert(`⚠️ High Risk Alert: Shipment #${data.shipment_id}\nRisk Score: ${data.risk_score}\nFactors: ${data.factors?.join(', ') || 'N/A'}`);
    
    // Update shipment risk level
    const shipment = allShipments.find(s => s.id === data.shipment_id);
    if (shipment) {
        shipment.risk_level = 'high';
        renderShipments(allShipments);
        updateStats();
    }
}

// Close modal on outside click
window.onclick = function(event) {
    const modal = document.getElementById('shipmentModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}
