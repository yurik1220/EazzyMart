// Quick verification script - checks if server.js can be loaded
// Run with: node verify-server.js

console.log('🔍 Verifying server.js structure...\n');

try {
  // Check if file exists and can be read
  const fs = require('fs');
  const path = require('path');
  const serverPath = path.join(__dirname, 'server.js');
  
  if (!fs.existsSync(serverPath)) {
    console.error('❌ server.js not found!');
    process.exit(1);
  }
  
  const content = fs.readFileSync(serverPath, 'utf8');
  
  // Check for critical components
  const checks = [
    { name: 'Express import', pattern: /const express = require\('express'\)/ },
    { name: 'App creation', pattern: /const app = express\(\)/ },
    { name: 'CORS setup', pattern: /app\.use\(cors/ },
    { name: 'Body parser', pattern: /app\.use\(express\.json\(\)\)/ },
    { name: 'Database connection', pattern: /sqlite3|open\(/ },
    { name: 'Routes defined', pattern: /app\.(get|post|put|delete)\(/ },
    { name: 'Server listen', pattern: /app\.listen/ },
  ];
  
  let passed = 0;
  let failed = [];
  
  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`✅ ${check.name}`);
      passed++;
    } else {
      console.log(`❌ ${check.name} - NOT FOUND`);
      failed.push(check.name);
    }
  });
  
  // Count routes
  const routeMatches = content.match(/app\.(get|post|put|delete)\(['"]/g);
  const routeCount = routeMatches ? routeMatches.length : 0;
  console.log(`\n📊 Routes found: ${routeCount}`);
  
  // Check for common issues
  const issues = [];
  
  if (!content.includes('app.listen')) {
    issues.push('Server not listening - app.listen() missing');
  }
  
  if (!content.includes('cors')) {
    issues.push('CORS not configured');
  }
  
  if (!content.includes('express.json()')) {
    issues.push('JSON body parser missing');
  }
  
  if (content.includes('app.use(express.static') && !content.includes('fs.existsSync')) {
    issues.push('Static file serving may interfere with routes');
  }
  
  console.log(`\n✅ Passed: ${passed}/${checks.length}`);
  
  if (failed.length > 0) {
    console.log(`❌ Failed checks: ${failed.join(', ')}`);
    process.exit(1);
  }
  
  if (issues.length > 0) {
    console.log(`\n⚠️  Potential issues:`);
    issues.forEach(issue => console.log(`   - ${issue}`));
  } else {
    console.log('\n✅ Server structure looks good!');
  }
  
} catch (error) {
  console.error('❌ Error verifying server:', error.message);
  process.exit(1);
}

