// fix-image-paths.js
// Utility script to fix image paths in return_refund_requests table
// Converts backslashes to forward slashes for URL compatibility

require('dotenv').config();
const path = require('path');

// Conditional database imports
let sqlite3, open, Pool;
const USE_POSTGRES = process.env.DB_TYPE === 'postgres';
if (!USE_POSTGRES) {
  sqlite3 = require('sqlite3');
  ({ open } = require('sqlite'));
} else {
  ({ Pool } = require('pg'));
}

async function fixImagePaths() {
  let db;
  
  try {
    if (USE_POSTGRES) {
      console.log('🔄 Connecting to PostgreSQL...');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      });
      
      const client = await pool.connect();
      console.log('✅ Connected to PostgreSQL');
      
      // Get all records with image paths
      const result = await client.query(
        `SELECT id, image_path FROM return_refund_requests WHERE image_path IS NOT NULL AND image_path != ''`
      );
      
      console.log(`\n📊 Found ${result.rows.length} records with image paths`);
      
      let fixedCount = 0;
      for (const row of result.rows) {
        const oldPath = row.image_path;
        const newPath = oldPath.replace(/\\/g, '/'); // Replace all backslashes with forward slashes
        
        if (oldPath !== newPath) {
          await client.query(
            `UPDATE return_refund_requests SET image_path = $1 WHERE id = $2`,
            [newPath, row.id]
          );
          console.log(`✅ Fixed: ${oldPath} → ${newPath}`);
          fixedCount++;
        }
      }
      
      client.release();
      await pool.end();
      
      console.log(`\n✅ Fixed ${fixedCount} image paths in PostgreSQL`);
      
    } else {
      console.log('🔄 Connecting to SQLite...');
      db = await open({
        filename: path.join(__dirname, 'grocery.db'),
        driver: sqlite3.Database
      });
      console.log('✅ Connected to SQLite');
      
      // Get all records with image paths
      const rows = await db.all(
        `SELECT id, image_path FROM return_refund_requests WHERE image_path IS NOT NULL AND image_path != ''`
      );
      
      console.log(`\n📊 Found ${rows.length} records with image paths`);
      
      let fixedCount = 0;
      for (const row of rows) {
        const oldPath = row.image_path;
        const newPath = oldPath.replace(/\\/g, '/'); // Replace all backslashes with forward slashes
        
        if (oldPath !== newPath) {
          await db.run(
            `UPDATE return_refund_requests SET image_path = ? WHERE id = ?`,
            [newPath, row.id]
          );
          console.log(`✅ Fixed: ${oldPath} → ${newPath}`);
          fixedCount++;
        }
      }
      
      await db.close();
      console.log(`\n✅ Fixed ${fixedCount} image paths in SQLite`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing image paths:', error);
    process.exit(1);
  }
}

// Run the fix
console.log('🔧 Starting image path fix...\n');
fixImagePaths()
  .then(() => {
    console.log('\n✅ Image path fix completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Failed to fix image paths:', err);
    process.exit(1);
  });

