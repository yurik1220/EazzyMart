// API Configuration
// This file centralizes the API base URL
// For local development: use 'http://localhost:3000'
// For production: use your Render backend URL

// Make API_BASE_URL available globally
window.API_BASE_URL = (function() {
  const hostname = window.location.hostname;
  // Check if running locally
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
    return 'http://localhost:3000';
  }
  // Production backend URL - UPDATE THIS WITH YOUR ACTUAL RENDER BACKEND URL
  return 'https://eazzymart-backend.onrender.com';
})();

// Also export for Node.js/CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API_BASE_URL: window.API_BASE_URL };
}

// Helper function to build API URLs
window.getApiUrl = function(endpoint) {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  return `${window.API_BASE_URL}/${cleanEndpoint}`;
};

