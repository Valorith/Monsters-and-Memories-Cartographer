// API service for database operations
import { useCSRF } from '../composables/useCSRF.js'

const API_BASE = '/api';
const { fetchWithCSRF } = useCSRF();

// Helper function for API calls with CSRF protection
async function apiCall(url, options = {}) {
  try {
    const response = await fetchWithCSRF(`${API_BASE}${url}`, options);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

// Maps API
export const mapsAPI = {
  // Get all maps
  async getAll() {
    return apiCall('/maps');
  },
  
  // Get single map with all its data
  async getById(id) {
    return apiCall(`/maps/${id}`);
  },
  
  // Create or update map
  async save(map) {
    return apiCall('/maps', {
      method: 'POST',
      body: map
    });
  },
  
  // Delete map
  async delete(id) {
    return apiCall(`/maps/${id}`, {
      method: 'DELETE'
    });
  }
};

// POIs API
export const poisAPI = {
  // Save POI (create or update)
  async save(poi) {
    return apiCall('/pois', {
      method: 'POST',
      body: poi
    });
  },
  
  // Delete POI
  async delete(id) {
    return apiCall(`/pois/${id}`, {
      method: 'DELETE'
    });
  }
};

// Connections API
export const connectionsAPI = {
  // Save connection
  async save(connection) {
    return apiCall('/connections', {
      method: 'POST',
      body: connection
    });
  },
  
  // Delete connection
  async delete(id) {
    return apiCall(`/connections/${id}`, {
      method: 'DELETE'
    });
  }
};

// Point Connectors API
export const pointConnectorsAPI = {
  // Save point connector
  async save(connector) {
    return apiCall('/point-connectors', {
      method: 'POST',
      body: connector
    });
  },
  
  // Delete point connector
  async delete(id) {
    return apiCall(`/point-connectors/${id}`, {
      method: 'DELETE'
    });
  }
};

// Zone Connectors API
export const zoneConnectorsAPI = {
  // Save zone connector
  async save(connector) {
    return apiCall('/zone-connectors', {
      method: 'POST',
      body: connector
    });
  },
  
  // Delete zone connector
  async delete(id) {
    return apiCall(`/zone-connectors/${id}`, {
      method: 'DELETE'
    });
  }
};