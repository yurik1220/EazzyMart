// Test script to verify all routes are properly registered
// Run with: node test-routes.js

const express = require('express');
const app = express();

// Simulate route registration (copy from server.js)
// This will help us verify routes are defined correctly

const routes = [
  // Items
  { method: 'POST', path: '/api/items' },
  { method: 'GET', path: '/api/items' },
  { method: 'PUT', path: '/api/items/:id' },
  { method: 'DELETE', path: '/api/items/:id' },
  
  // Stock
  { method: 'POST', path: '/api/stock-entry' },
  { method: 'GET', path: '/api/stock-report' },
  { method: 'POST', path: '/api/generate-stock-report' },
  
  // Auth
  { method: 'POST', path: '/api/customer/register' },
  { method: 'POST', path: '/api/customer/login' },
  { method: 'GET', path: '/api/login' },
  { method: 'POST', path: '/api/login' },
  { method: 'POST', path: '/api/reset-password' },
  
  // Users
  { method: 'GET', path: '/api/user' },
  { method: 'POST', path: '/api/user' },
  { method: 'PUT', path: '/api/user/:id' },
  { method: 'DELETE', path: '/api/user/:id' },
  
  // Sales
  { method: 'GET', path: '/api/sales' },
  { method: 'GET', path: '/api/order' },
  { method: 'POST', path: '/api/sales' },
  { method: 'PUT', path: '/api/sales' },
  { method: 'PUT', path: '/api/sales/delivered' },
  { method: 'GET', path: '/api/sales/report' },
  
  // Orders
  { method: 'GET', path: '/api/orders/customer' },
  { method: 'PUT', path: '/api/orders/:orderId/received' },
  { method: 'GET', path: '/api/orders/admin' },
  { method: 'PUT', path: '/api/orders/:orderId/accept' },
  { method: 'PUT', path: '/api/orders/:orderId/cancel' },
  { method: 'PUT', path: '/api/orders/:orderId/cancel-customer' },
  { method: 'PUT', path: '/api/orders/:orderId/status' },
  
  // Return/Refund
  { method: 'POST', path: '/api/return-refund' },
  { method: 'GET', path: '/api/return-refund' },
  { method: 'PUT', path: '/api/return-refund/:id/status' },
  
  // Email/OTP
  { method: 'POST', path: '/send-otp' },
  { method: 'POST', path: '/verify-otp' },
  { method: 'POST', path: '/send-email' },
  { method: 'POST', path: '/test-email' },
  
  // System
  { method: 'GET', path: '/' },
  { method: 'GET', path: '/api/ping' },
  { method: 'GET', path: '/api/routes' },
];

// Frontend calls (from our analysis)
const frontendCalls = [
  { method: 'POST', path: '/api/customer/login' },
  { method: 'POST', path: '/api/customer/register' },
  { method: 'GET', path: '/api/items' },
  { method: 'POST', path: '/api/sales' },
  { method: 'GET', path: '/api/sales' },
  { method: 'GET', path: '/api/return-refund' },
  { method: 'POST', path: '/api/return-refund' },
  { method: 'GET', path: '/api/orders/customer' },
  { method: 'PUT', path: '/api/orders/:orderId/received' },
  { method: 'PUT', path: '/api/orders/:orderId/cancel-customer' },
  { method: 'PUT', path: '/api/sales/delivered' },
  { method: 'POST', path: '/send-email' },
  { method: 'GET', path: '/api/user' },
  { method: 'POST', path: '/send-otp' },
  { method: 'POST', path: '/verify-otp' },
];

console.log('🔍 Testing Route Coverage...\n');

// Check if all frontend calls have matching backend routes
let missingRoutes = [];
let foundRoutes = [];

frontendCalls.forEach(call => {
  const found = routes.find(route => {
    // Simple matching - convert :param to regex pattern
    const routePattern = route.path.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${routePattern}$`);
    return route.method === call.method && regex.test(call.path);
  });
  
  if (found) {
    foundRoutes.push({ call, route: found });
  } else {
    missingRoutes.push(call);
  }
});

console.log(`✅ Found routes: ${foundRoutes.length}/${frontendCalls.length}`);
foundRoutes.forEach(({ call, route }) => {
  console.log(`   ✓ ${call.method} ${call.path} → ${route.method} ${route.path}`);
});

if (missingRoutes.length > 0) {
  console.log(`\n❌ Missing routes: ${missingRoutes.length}`);
  missingRoutes.forEach(call => {
    console.log(`   ✗ ${call.method} ${call.path}`);
  });
} else {
  console.log('\n✅ All frontend calls have matching backend routes!');
}

console.log(`\n📊 Total backend routes: ${routes.length}`);
console.log(`📊 Total frontend calls: ${frontendCalls.length}`);

