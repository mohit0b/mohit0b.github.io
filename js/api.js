/**
 * LinkNode API Module
 * REST API functions for all dashboard operations
 */

const API_BASE_URL = 'http://localhost:5001/api/v1';

// Get JWT token from localStorage
function getToken() {
    return localStorage.getItem('jwt');
}

// Get auth headers
function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
    };
}

// Handle API errors
function handleError(error) {
    console.error('API Error:', error);
    throw error;
}

// ============================================
// AUTHENTICATION
// ============================================

async function login(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.message || responseData.error?.message || 'Login failed');
        }
        
        // Extract user data and token from the nested structure
        const { user, token } = responseData.data;
        
        // Store token and user data
        localStorage.setItem('jwt', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        return { user, token };
    } catch (error) {
        return handleError(error);
    }
}

async function register(userData) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.message || responseData.error?.message || 'Registration failed');
        }
        
        // Extract user data and token from the nested structure
        const { user, token } = responseData.data;
        
        // Store token and user data
        localStorage.setItem('jwt', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        return { user, token };
    } catch (error) {
        return handleError(error);
    }
}

function logout() {
    localStorage.removeItem('jwt');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

function getCurrentUser() {
    try {
        const user = localStorage.getItem('user');
        if (!user) return null;
        
        // Check if user is valid JSON
        if (user === 'undefined' || user === 'null') {
            localStorage.removeItem('user');
            return null;
        }
        
        return JSON.parse(user);
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('user');
        return null;
    }
}

function isAuthenticated() {
    return !!getToken();
}

// ============================================
// SHIPMENTS
// ============================================

async function getShipments(filters = {}) {
    try {
        const queryParams = new URLSearchParams(filters).toString();
        const url = `${API_BASE_URL}/shipments${queryParams ? '?' + queryParams : ''}`;
        
        const response = await fetch(url, {
            headers: getHeaders()
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.message || responseData.error?.message || 'Failed to fetch shipments');
        }
        
        return responseData;
    } catch (error) {
        return handleError(error);
    }
}

async function getShipmentById(shipmentId) {
    try {
        const response = await fetch(`${API_BASE_URL}/shipments/${shipmentId}`, {
            headers: getHeaders()
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.message || responseData.error?.message || 'Failed to fetch shipment');
        }
        
        return responseData;
    } catch (error) {
        return handleError(error);
    }
}

async function getShipmentHistory(shipmentId) {
    try {
        const response = await fetch(`${API_BASE_URL}/shipments/${shipmentId}/history`, {
            headers: getHeaders()
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.message || responseData.error?.message || 'Failed to fetch history');
        }
        
        return responseData;
    } catch (error) {
        return handleError(error);
    }
}

async function confirmDelivery(shipmentId, deliveryData) {
    try {
        const response = await fetch(`${API_BASE_URL}/shipments/${shipmentId}/confirm-delivery`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(deliveryData)
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.message || responseData.error?.message || 'Failed to confirm delivery');
        }
        
        return responseData;
    } catch (error) {
        return handleError(error);
    }
}

async function getAssignedShipments() {
    try {
        const response = await fetch(`${API_BASE_URL}/shipments/assigned`, {
            headers: getHeaders()
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.message || responseData.error?.message || 'Failed to fetch assigned shipments');
        }
        
        return responseData;
    } catch (error) {
        return handleError(error);
    }
}

// ============================================
// TRACKING / GPS
// ============================================

async function updateLocation(shipmentId, locationData) {
    try {
        const response = await fetch(`${API_BASE_URL}/tracking/update`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                shipment_id: parseInt(shipmentId),  // Ensure it's a number
                latitude: parseFloat(locationData.latitude),
                longitude: parseFloat(locationData.longitude),
                accuracy: locationData.accuracy ? Math.min(parseFloat(locationData.accuracy), 1000) : null,  // Cap at 1000m
                speed: locationData.speed ? parseFloat(locationData.speed) : null,
                heading: locationData.heading ? parseFloat(locationData.heading) : null
            })
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.message || responseData.error?.message || 'Failed to update location');
        }
        
        return responseData;
    } catch (error) {
        return handleError(error);
    }
}

async function getTrackingData(shipmentId) {
    try {
        const response = await fetch(`${API_BASE_URL}/tracking/${shipmentId}`, {
            headers: getHeaders()
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.message || responseData.error?.message || 'Failed to fetch tracking data');
        }
        
        return responseData;
    } catch (error) {
        return handleError(error);
    }
}

// ============================================
// RISK & RECOVERY
// ============================================

async function getRiskScore(shipmentId) {
    try {
        const response = await fetch(`${API_BASE_URL}/risk/${shipmentId}`, {
            headers: getHeaders()
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.message || responseData.error?.message || 'Failed to fetch risk score');
        }
        
        return responseData;
    } catch (error) {
        return handleError(error);
    }
}

async function triggerRecovery(shipmentId, recoveryData) {
    try {
        const response = await fetch(`${API_BASE_URL}/recovery/${shipmentId}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(recoveryData)
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.message || responseData.error?.message || 'Failed to trigger recovery');
        }
        
        return responseData;
    } catch (error) {
        return handleError(error);
    }
}

// ============================================
// HASH VERIFICATION
// ============================================

async function verifyHash(shipmentId, hashData) {
    try {
        const response = await fetch(`${API_BASE_URL}/shipments/${shipmentId}/verify`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(hashData)
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.message || responseData.error?.message || 'Failed to verify hash');
        }
        
        return responseData;
    } catch (error) {
        return handleError(error);
    }
}

// ============================================
// STATS & DASHBOARD
// ============================================

async function getDashboardStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
            headers: getHeaders()
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.message || responseData.error?.message || 'Failed to fetch stats');
        }
        
        return responseData;
    } catch (error) {
        return handleError(error);
    }
}

// Export all functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        login, register, logout, getCurrentUser, isAuthenticated,
        getShipments, getShipmentById, getShipmentHistory, confirmDelivery, getAssignedShipments,
        updateLocation, getTrackingData,
        getRiskScore, triggerRecovery,
        verifyHash,
        getDashboardStats
    };
}
