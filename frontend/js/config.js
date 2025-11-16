// API Configuration
// This file centralizes the API base URL
// For local development: use 'http://localhost:3000'
// For production: use your Render backend URL

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://eazzymart-backend.onrender.com'; // ⚠️ REPLACE THIS WITH YOUR ACTUAL RENDER BACKEND URL

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API_BASE_URL };
}

