// server.js
// Load environment variables from .env file (for local development)
require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const bodyParser = require('body-parser');
const session = require('express-session');
const { Resend } = require('resend');

// SQLite dependencies
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const upload = multer();
const app = express();
const port = process.env.PORT || 3000;

// CORS configuration - allow frontend domain and all origins
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all origins for now (you can restrict this later)
    callback(null, true);
    
    // To restrict to specific domains, use:
    // const allowedOrigins = ['https://eazzymart-frontend.onrender.com', 'http://localhost:3000'];
    // if (allowedOrigins.indexOf(origin) !== -1) {
    //   callback(null, true);
    // } else {
    //   callback(new Error('Not allowed by CORS'));
    // }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Request logging middleware (early in chain to log all requests)
app.use((req, res, next) => {
  // Skip logging for static assets and health checks
  if (!req.path.startsWith('/uploads') && req.path !== '/api/ping' && req.path !== '/') {
    console.log(`📥 ${req.method} ${req.path} - Origin: ${req.get('origin') || 'none'}`);
  }
  next();
});

app.use(express.json());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// ============================================
// SQLITE DATABASE CONNECTION
// ============================================
let db;
const otpStore = {};

(async () => {
  db = await open({
    filename: path.join(__dirname, 'grocery.db'),
    driver: sqlite3.Database
  });

  // Initialize tables if not exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      names TEXT,
      price REAL,
      stock INTEGER,
      category TEXT,
      descs TEXT,
      images TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      quantity_added INTEGER,
      date_added TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'customer',
      firstname TEXT,
      lastname TEXT,
      gender TEXT,
      birthDate DATETIME,
      isVerified INTEGER NOT NULL DEFAULT 0 CHECK (isVerified IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS tax_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_content TEXT
    );
    
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE,
      customer TEXT,
      address TEXT,
      payment TEXT,
      status TEXT DEFAULT 'Pending',
      total INTEGER,
      type TEXT,
      delivery TEXT,
      reason TEXT,
      trnumber TEXT,
      createddate DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
      out_for_delivery_date DATETIME,
      isDelivered BOOLEAN DEFAULT 0,
      contact TEXT,
      createdbyuser TEXT
    );

    -- Normalized orders table (order header)
    CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      user_id INTEGER,
      total_amount REAL NOT NULL,
      order_status TEXT NOT NULL DEFAULT 'Pending',
      payment_method TEXT,
      shipping_address TEXT,
      order_type TEXT,
      contact_number TEXT,
      transaction_number TEXT,
      order_date DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
      out_for_delivery_date DATETIME,
      estimated_delivery_datetime DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Normalized order_items table (order details)
    CREATE TABLE IF NOT EXISTS order_items (
      order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      price REAL NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES items(id) ON DELETE RESTRICT
    );
    
    CREATE TABLE IF NOT EXISTS salesorder (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salesid INTEGER,
      name TEXT,
      price INTEGER,
      qty INTEGER
    );

    CREATE TABLE IF NOT EXISTS return_refund_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      user_id INTEGER,
      reason TEXT NOT NULL,
      image_path TEXT,
      status TEXT NOT NULL DEFAULT 'Pending',
      request_type TEXT NOT NULL DEFAULT 'Return',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
      admin_notes TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    -- Note: idx_sales_order_id will be created after migration if order_id column exists
  `);

  // Migration: Add order_id column to sales table if it doesn't exist
  try {
    const salesTableInfo = await db.all(`PRAGMA table_info(sales)`);
    const columnNames = salesTableInfo.map(col => col.name);
    console.log('📋 Current sales table columns:', columnNames);
    
    const hasOrderId = columnNames.includes('order_id');
    const hasUpdatedAt = columnNames.includes('updated_at');
    const hasOutForDeliveryDate = columnNames.includes('out_for_delivery_date');
    
    let migrationNeeded = false;
    
    if (!hasOrderId) {
      console.log('🔄 Adding order_id column to sales table...');
      await db.run(`ALTER TABLE sales ADD COLUMN order_id TEXT`);
      migrationNeeded = true;
      console.log('✅ Added order_id column');
    }
    
    if (!hasUpdatedAt) {
      console.log('🔄 Adding updated_at column to sales table...');
      // SQLite doesn't support functions in DEFAULT when adding columns, so add without default
      await db.run(`ALTER TABLE sales ADD COLUMN updated_at DATETIME`);
      // Set default value for existing rows
      await db.run(`UPDATE sales SET updated_at = datetime('now', 'localtime') WHERE updated_at IS NULL`);
      migrationNeeded = true;
      console.log('✅ Added updated_at column');
    }
    
    if (!hasOutForDeliveryDate) {
      console.log('🔄 Adding out_for_delivery_date column to sales table...');
      await db.run(`ALTER TABLE sales ADD COLUMN out_for_delivery_date DATETIME`);
      migrationNeeded = true;
      console.log('✅ Added out_for_delivery_date column');
    }
    
    // Migration: Add estimated_delivery_datetime to orders table if it doesn't exist
    try {
      const ordersTableInfo = await db.all(`PRAGMA table_info(orders)`);
      const ordersColumnNames = ordersTableInfo.map(col => col.name);
      const hasEstimatedDelivery = ordersColumnNames.includes('estimated_delivery_datetime');
      
      if (!hasEstimatedDelivery) {
        console.log('🔄 Adding estimated_delivery_datetime column to orders table...');
        await db.run(`ALTER TABLE orders ADD COLUMN estimated_delivery_datetime DATETIME`);
        console.log('✅ Added estimated_delivery_datetime column');
      }
    } catch (err) {
      console.warn('⚠️ Could not check/add estimated_delivery_datetime column:', err.message);
    }
    
    if (migrationNeeded) {
      console.log('✅ Migration complete: Missing columns added to sales table');
      
      // Generate order_id for existing sales records that don't have one
      if (!hasOrderId) {
        try {
          const existingSales = await db.all(`SELECT id FROM sales WHERE order_id IS NULL OR order_id = ''`);
          console.log(`🔄 Generating order_ids for ${existingSales.length} existing sales records...`);
          for (const sale of existingSales) {
            const orderId = `ORD-LEGACY-${String(sale.id).padStart(6, '0')}`;
            await db.run(`UPDATE sales SET order_id = ? WHERE id = ?`, [orderId, sale.id]);
          }
          console.log('✅ Generated order_ids for existing sales');
        } catch (genErr) {
          console.error('⚠️ Error generating order_ids:', genErr.message);
        }
      }
    } else {
      console.log('✅ Sales table migration: All columns already exist');
    }
    
    // Create index on order_id if column exists (whether migrated or already existed)
    const salesTableInfoAfter = await db.all(`PRAGMA table_info(sales)`);
    const hasOrderIdAfter = salesTableInfoAfter.some(col => col.name === 'order_id');
    if (hasOrderIdAfter) {
      try {
        await db.run(`CREATE INDEX IF NOT EXISTS idx_sales_order_id ON sales(order_id)`);
        console.log('✅ Created index on sales.order_id');
      } catch (idxErr) {
        // Index might already exist, ignore
        if (!idxErr.message.includes('already exists')) {
          console.debug('Index creation note:', idxErr.message);
        }
      }
    }
  } catch (err) {
    console.error('⚠️ Migration error:', err.message);
    console.error('⚠️ Full error:', err);
  }

  console.log('✅ SQLite database ready at grocery.db');
  
  // Run auto-completion check after database is ready
  autoCompleteDeliveries();
  setInterval(autoCompleteDeliveries, 60 * 60 * 1000);
})().catch(err => {
  console.error('❌ Failed to initialize database:', err);
  process.exit(1);
});

// ============================================
// ORDER MANAGEMENT HELPERS
// ============================================

// Generate unique order ID
async function generateOrderId() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Check for existing orders today to get sequence number
  const today = date.toISOString().slice(0, 10);
  const existingOrders = await db.all(
    `SELECT order_id FROM orders WHERE date(order_date) = date(?) ORDER BY order_id DESC LIMIT 1`,
    [today]
  );
  
  let sequence = 1;
  if (existingOrders.length > 0) {
    // Extract sequence number from the latest order_id
    const latestOrderId = existingOrders[0].order_id;
    const match = latestOrderId.match(/ORD-\d{8}-(\d+)/);
    if (match) {
      sequence = parseInt(match[1], 10) + 1;
    } else {
      // If format doesn't match, count all orders for today
      const countResult = await db.get(
        `SELECT COUNT(*) as count FROM orders WHERE date(order_date) = date(?)`,
        [today]
      );
      sequence = (countResult?.count || 0) + 1;
    }
  }
  
  // Generate order ID with sequence
  let orderId = `ORD-${dateStr}-${String(sequence).padStart(4, '0')}`;
  
  // Ensure uniqueness - check if it exists and increment if needed
  let attempts = 0;
  let exists = await db.get(`SELECT order_id FROM orders WHERE order_id = ?`, [orderId]);
  while (exists && attempts < 100) {
    sequence++;
    orderId = `ORD-${dateStr}-${String(sequence).padStart(4, '0')}`;
    exists = await db.get(`SELECT order_id FROM orders WHERE order_id = ?`, [orderId]);
    attempts++;
  }
  
  if (exists) {
    // Fallback: use timestamp-based ID if we still have conflicts
    const timestamp = Date.now().toString().slice(-8);
    orderId = `ORD-${dateStr}-${timestamp}`;
  }
  
  return orderId;
}

// Auto-complete orders that have been "Out for Delivery" for more than 1 day
async function autoCompleteDeliveries() {
  // Check if db is initialized
  if (!db) {
    console.debug('Database not initialized yet, skipping auto-completion check');
    return;
  }

  try {
    // SQLite: Calculate 1 day ago using datetime subtraction
    await db.run(
      `UPDATE orders SET order_status = 'Delivered', updated_at = datetime('now', 'localtime') 
       WHERE order_status = 'Out for Delivery' 
       AND out_for_delivery_date IS NOT NULL 
       AND datetime(out_for_delivery_date) < datetime('now', '-1 day')`
    );

    // Also update sales table for backward compatibility (only if order_id column exists)
    try {
      await db.run(
        `UPDATE sales SET status = 'Delivered', updated_at = datetime('now', 'localtime'), isDelivered = 1 
         WHERE status = 'Out for Delivery' 
         AND out_for_delivery_date IS NOT NULL 
         AND datetime(out_for_delivery_date) < datetime('now', '-1 day')`
      );
    } catch (salesErr) {
      // Ignore if sales table doesn't have the columns yet
      if (!salesErr.message.includes('no such column')) {
        console.debug('Sales table update skipped:', salesErr.message);
      }
    }
  } catch (err) {
    console.error('Error auto-completing deliveries:', err.message);
  }
}

// ============================================
// ITEMS CRUD
// ============================================

// Create
app.post('/api/items', upload.none(), async (req, res) => {
  try {
    const { names, price, stock, category, descs, images } = req.body;
    const result = await db.run(
      `INSERT INTO items (names, price, stock, category, descs, images)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [names, parseFloat(price) || 0, parseInt(stock) || 0, category, descs, images || null]
    );
    res.status(201).json({ id: result.lastID });
  } catch (err) {
    console.error('Error inserting product:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all
app.get('/api/items', async (req, res) => {
  try {
    const rows = await db.all(`SELECT * FROM items`);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update
app.put('/api/items/:id', upload.none(), async (req, res) => {
  try {
    const { id } = req.params;
    const { names, price, stock, category, descs, images } = req.body;
    const result = await db.run(
      `UPDATE items
       SET names = ?, price = ?, stock = ?, category = ?, descs = ?, images = ?
       WHERE id = ?`,
      [names, parseFloat(price) || 0, parseInt(stock) || 0, category, descs, images || null, id]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item updated successfully' });
  } catch (err) {
    console.error('Error updating item:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete
app.delete('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.run(`DELETE FROM items WHERE id = ?`, [id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// STOCK ENTRY
// ============================================
app.post('/api/stock-entry', async (req, res) => {
  const { productId, quantityAdded } = req.body;
  const qty = parseInt(quantityAdded) || 0;
  const prodId = parseInt(productId);
  if (!prodId || qty <= 0) return res.status(400).json({ error: 'Invalid input' });

  try {
    await db.run(
      `INSERT INTO stock_entries (item_id, quantity_added, date_added)
       VALUES (?, ?, datetime('now'))`,
      [prodId, qty]
    );
    await db.run(`UPDATE items SET stock = stock + ? WHERE id = ?`, [qty, prodId]);
    res.json({ message: 'Stock entry added successfully' });
  } catch (err) {
    console.error('Error inserting stock entry:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// STOCK REPORT (today)
// ============================================
app.get('/api/stock-report', async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT * FROM stock_entries WHERE DATE(date_added) = DATE('now')`
    );
    let content = 'Stock Report for Today:\n\n';
    rows.forEach(r => {
      content += `Product ID: ${r.item_id}, Quantity Added: ${r.quantity_added}\n`;
    });
    res.json({ content });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GENERATE STOCK REPORT FILE
// ============================================
app.post('/api/generate-stock-report', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT s.item_id, i.names, s.quantity_added, s.date_added
      FROM stock_entries s
      JOIN items i ON s.item_id = i.id
      WHERE DATE(s.date_added) = DATE('now')
    `);

    let reportText = `Incoming Stock Report - ${new Date().toLocaleDateString()}\n\n`;
    rows.forEach(row => {
      reportText += `ID: ${row.item_id}, Name: ${row.names}, Quantity: ${row.quantity_added}, Date: ${row.date_added}\n`;
    });

    await db.run(`INSERT INTO tax_reports (report_content) VALUES (?)`, [reportText]);

    const filePath = path.join(__dirname, 'public', `stock_report_${Date.now()}.txt`);
    fs.writeFileSync(filePath, reportText);
    res.json({ content: reportText });
  } catch (err) {
    console.error('Error generating stock report:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// AUTH: Register / Login
// ============================================
app.post('/api/customer/register', async (req, res) => {
  if (!db) {
    return res.status(503).json({ success: false, message: 'Database not initialized yet. Please try again in a moment.' });
  }
  
  const { username, password, firstname, lastname, birthDate, gender } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, message: 'Username and password required' });

  try {
    const existing = await db.get(`SELECT id FROM users WHERE username = ?`, [username]);
    if (existing) return res.status(400).json({ success: false, message: 'Username already exists' });
    
    // Username validation (3–20 chars, letters/numbers/_ only)
    if (username.length < 6 || username.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Username must atleast 6–50 characters long.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
    }

    await db.run(`INSERT INTO users (username, password, role, firstname, lastname, birthDate, gender) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
      username, password, 'customer', firstname, lastname, birthDate, gender 
    ]);
    res.json({ success: true, message: 'Account created successfully' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/login - return error message (login requires POST)
// Customer-specific login endpoint (matches frontend expectations)
app.post('/api/customer/login', async (req, res) => {
  if (!db) {
    return res.status(503).json({ success: false, message: 'Database not initialized yet. Please try again in a moment.' });
  }
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }
  try {
    const user = await db.get(`SELECT * FROM users WHERE username = ?`, [username]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.password !== password)
      return res.status(401).json({ success: false, message: 'Invalid password' });
    
    // Return format expected by frontend
    res.json({ 
      success: true, 
      message: 'Login successful', 
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        firstname: user.firstname,
        lastname: user.lastname,
        gender: user.gender,
        birthDate: user.birthDate,
        isVerified: user.isVerified
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// General login endpoint (for admin/cashier) - MUST be before GET handler
app.post('/api/login', async (req, res) => {
  console.log('🔐 POST /api/login called');
  if (!db) {
    console.error('❌ Database not ready for /api/login');
    return res.status(503).json({ message: 'Database not initialized yet. Please try again in a moment.' });
  }
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  try {
    const user = await db.get(`SELECT * FROM users WHERE username = ?`, [username]);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.password !== password)
      return res.status(401).json({ message: 'Invalid password' });
    console.log('✅ Login successful for:', username);
    res.json({ message: 'Login successful', user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET handler for /api/login (returns helpful error for GET requests)
app.get('/api/login', (req, res) => {
  res.status(405).json({ 
    error: 'Method not allowed', 
    message: 'Login requires POST method. Please use POST /api/login with username and password in the request body.',
    allowedMethods: ['POST']
  });
});

app.post('/api/reset-password', async (req, res) => {
  const { username, newPassword } = req.body;
  try {
    const result = await db.run(`UPDATE users SET password = ? WHERE username = ?`, [
      newPassword,
      username
    ]);
    if (result.changes === 0)
      return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ============================================
// User Management
// ============================================
app.get('/api/user', async (req, res) => {
    const user = await db.all(`SELECT * FROM users`);
    res.status(200).json(user);
}) 

app.post('/api/user', async (req, res) => {
  const { username, password, role, firstname, lastname, birthDate, gender } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username and password required' });

  try {
    const existing = await db.get(`SELECT id FROM users WHERE username = ?`, [username]);
    if (existing) return res.status(400).json({ message: 'Username already exists' });

    await db.run(`INSERT INTO users (username, password, role, firstname, lastname, birthDate, gender) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
      username, password, role, firstname, lastname, birthDate, gender 
    ]);
    res.json({ message: 'Account created successfully' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/user/:id', async (req, res) => {
  const { firstname, lastname, birthDate, gender, role, isVerified } = req.body;
  const { id } = req.params;

  try {
    const result = await db.run(`UPDATE users SET firstname = ?, lastname = ?, birthDate = ?, gender = ?, role = ?, isVerified = ? WHERE id = ?`, [
    firstname,
    lastname,
    birthDate,
    gender,
    role,
    isVerified,
    id
  ]);
  if (result.changes === 0)
    return res.status(404).json({ message: 'User not found' });
  res.json({ message: 'User ' + id +' has been updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}) 

app.delete('/api/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.run(`DELETE FROM users WHERE id = ?`, [id]);
    if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User is deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: err.message });
  }
}) 


// ============================================
// SALES
// ============================================
app.get("/api/sales", async (req, res) => {
    try {
      // Try to get from normalized orders table first
      const orders = await db.all(`
        SELECT o.*, 
               u.username as createdbyuser,
               u.firstname,
               u.lastname
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY o.order_date DESC
      `);

      // Get items for each order
      const result = [];
      for (const order of orders) {
        const items = await db.all(`
          SELECT product_id as id, product_name as name, price, quantity as qty, total
          FROM order_items
          WHERE order_id = ?
        `, [order.order_id]);

        // Get customer name: use firstname + lastname, fallback to username, fallback to contact
        const customerName = order.firstname && order.lastname
          ? `${order.firstname} ${order.lastname}`.trim()
          : (order.createdbyuser || order.contact_number || 'Guest');

        // Get reason from sales table if order is cancelled
        let reason = null;
        if (order.order_status === 'Cancelled') {
          try {
            const sale = await db.get('SELECT reason FROM sales WHERE order_id = ?', [order.order_id]);
            reason = sale?.reason || null;
          } catch (err) {
            console.debug('Could not fetch reason from sales table:', err.message);
          }
        }

        result.push({
          id: order.order_id,
          order_id: order.order_id,
          address: order.shipping_address,
          customer: customerName,
          payment: order.payment_method,
          status: order.order_status,
          total: order.total_amount,
          type: order.order_type,
          trnumber: order.transaction_number,
          items: items,
          contact: order.contact_number,
          createdbyuser: order.createdbyuser,
          order_date: order.order_date,
          updated_at: order.updated_at,
          estimated_delivery_datetime: order.estimated_delivery_datetime,
          reason: reason
        });
      }

      // Fallback to sales table if orders table is empty (backward compatibility)
      if (result.length === 0) {
        const sales = await db.all(`SELECT * FROM sales`);
        const salesorder = await db.all(`SELECT * FROM salesorder`);
        
        for (const sale of sales) {
          result.push({
            id: sale.id,
            order_id: sale.order_id || `ORD-${sale.id}`,
            address: sale.address,
            customer: sale.customer,
            payment: sale.payment,
            status: sale.status,
            total: sale.total,
            type: sale.type,
            trnumber: sale.trnumber,
            reason: sale.reason,
            isDelivered: sale.isDelivered,
            items: salesorder.filter(o => o.salesid == sale.id),
            contact: sale.contact,
            createdbyuser: sale.createdbyuser,
            order_date: sale.createddate,
            updated_at: sale.updated_at
          });
        }
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching sales:', error);
      res.status(500).json({ success: false, message: "Failed to fetch orders" });
    }
})

app.get("/api/order", async (req, res) => {
    const orders = await db.all(`SELECT * FROM salesorder`);
    res.status(200).json(orders);
})

app.post("/api/sales", async (req, res) => {
  const { id, address, customer, payment, status, total, type, items, trnumber, contact, createdbyuser } = req.body;
  try {
    // Generate unique order_id
    const orderId = await generateOrderId();
    
    // Get user_id from username
    let userId = null;
    if (createdbyuser) {
      const user = await db.get('SELECT id FROM users WHERE username = ?', [createdbyuser]);
      userId = user ? user.id : null;
    }

    // Insert into normalized orders table
    await db.run(
      `INSERT INTO orders (order_id, user_id, total_amount, order_status, payment_method, shipping_address, order_type, contact_number, transaction_number) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, userId, total, status || 'Pending', payment, address, type, contact, trnumber]
    );

    // Insert order items
    for (const item of items) {
      const itemTotal = (item.price || 0) * (item.qty || 0);
      await db.run(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, price, total) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.id, item.name || item.names, item.qty || item.quantity, item.price, itemTotal]
      );

      // Update stock
      await db.run('UPDATE items SET stock = stock - ? WHERE id = ?', [
        item.qty || item.quantity, item.id
      ]);
    }

    // Also insert into sales table for backward compatibility
    const sales = await db.run(
      'INSERT INTO sales (order_id, address, customer, payment, status, total, type, trnumber, contact, createdbyuser) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [orderId, address, customer, payment, status || 'Pending', total, type, trnumber, contact, createdbyuser]
    );

    // Insert into salesorder for backward compatibility
    items.forEach(item => {
      db.run('INSERT INTO salesorder (name, price, qty, salesid) values (?, ?, ?, ?)', [
        item.name || item.names,
        item.price, 
        item.qty || item.quantity,
        sales.lastID
      ]);
    });

    res.json({ 
      success: true, 
      message: "Order placed successfully", 
      orderId: orderId,
      id: orderId // Also include as 'id' for backward compatibility
    });
  } catch(error) {
    console.error('Order creation error:', error);
    res.status(500).json({ success: false, message: "Failed to process order", error: error.message });
  }
});

app.put("/api/sales", async (req, res) => {
  const { id, address, customer, payment, status, total, type, trnumber, reason } = req.body;
  try {
    db.run('UPDATE sales SET address = ?, customer = ?, payment = ?, status = ?, total = ?, type = ?, trnumber = ?, reason = ? where id = ?', [
      address, customer, payment, status, total, type, trnumber, reason, id
    ]);

    res.json({ message: "Order has been placed."});
  } catch(err) {
    res.status(500).json({ success: false, message: "Failed to process order" });
  }
});

app.put("/api/sales/delivered", async (req, res) => {
  const { orderId, isDelivered } = req.body;
  try {
    console.log(orderId);
    console.log(isDelivered);
    db.run('UPDATE sales SET isDelivered = ? where id = ?', [
      isDelivered, orderId
    ]);
    res.json({ message: "Delivery has been updated."});
  } catch(err) {
    res.status(500).json({ suuccess: false, message: "Failed to update delivered"});
  }
})

// ============================================
// CUSTOMER ORDER MANAGEMENT
// ============================================

// Get customer orders (filtered by user)
app.get("/api/orders/customer", async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ success: false, message: "Username required" });
    }

    const user = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const orders = await db.all(`
      SELECT o.*
      FROM orders o
      WHERE o.user_id = ?
      ORDER BY o.order_date DESC
    `, [user.id]);

    // Get items for each order
    const result = [];
    for (const order of orders) {
      const items = await db.all(`
        SELECT product_id, product_name as name, price, quantity, total
        FROM order_items
        WHERE order_id = ?
      `, [order.order_id]);

      result.push({
        ...order,
        items: items,
        // Explicitly include estimated_delivery_datetime to ensure it's in the response
        estimated_delivery_datetime: order.estimated_delivery_datetime || null
      });
    }

    res.json({ success: true, orders: result });
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
});

// Customer: Mark order as received (Out for Delivery -> Delivered)
app.put("/api/orders/:orderId/received", async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Check if order exists and is in "Out for Delivery" status
    const order = await db.get('SELECT order_status FROM orders WHERE order_id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.order_status !== 'Out for Delivery') {
      return res.status(400).json({ 
        success: false, 
        message: `Order cannot be marked as received. Current status: ${order.order_status}` 
      });
    }

    // Update to Delivered
    await db.run(
      `UPDATE orders SET order_status = 'Delivered', updated_at = datetime('now', 'localtime') 
       WHERE order_id = ?`,
      [orderId]
    );

    // Also update sales table for backward compatibility (optional)
    try {
      // Always update status and isDelivered first (basic update)
      await db.run(
        `UPDATE sales SET status = 'Delivered', isDelivered = 1 WHERE order_id = ?`,
        [orderId]
      );
      
      // Try to update updated_at if column exists
      try {
        const salesTableInfo = await db.all(`PRAGMA table_info(sales)`);
        const hasUpdatedAt = salesTableInfo.some(col => col.name === 'updated_at');
        if (hasUpdatedAt) {
          await db.run(
            `UPDATE sales SET updated_at = datetime('now', 'localtime') WHERE order_id = ?`,
            [orderId]
          );
        }
      } catch (updateErr) {
        // Ignore updated_at update errors
        console.debug('Sales table updated_at update skipped:', updateErr.message);
      }
    } catch (salesErr) {
      // Ignore sales table update errors completely (backward compatibility only)
      console.debug('Sales table update skipped (non-critical):', salesErr.message);
    }

    res.json({ success: true, message: "Order marked as received" });
  } catch (error) {
    console.error('Error marking order as received:', error);
    res.status(500).json({ success: false, message: "Failed to update order" });
  }
});

// ============================================
// ADMIN ORDER MANAGEMENT
// ============================================

// Get all orders for admin
app.get("/api/orders/admin", async (req, res) => {
  try {
    const orders = await db.all(`
      SELECT o.*, u.username
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.order_date DESC
    `);

    // Get items for each order
    const result = [];
    for (const order of orders) {
      const items = await db.all(`
        SELECT product_id, product_name as name, price, quantity, total
        FROM order_items
        WHERE order_id = ?
      `, [order.order_id]);

      result.push({
        ...order,
        items: items
      });
    }

    res.json({ success: true, orders: result });
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
});

// Admin: Accept order (Pending -> In Process)
app.put("/api/orders/:orderId/accept", async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await db.get('SELECT order_status FROM orders WHERE order_id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.order_status !== 'Pending') {
      return res.status(400).json({ 
        success: false, 
        message: `Order cannot be accepted. Current status: ${order.order_status}` 
      });
    }

    // Update orders table (main update - this must succeed)
    await db.run(
      `UPDATE orders SET order_status = 'In Process', updated_at = datetime('now', 'localtime') 
       WHERE order_id = ?`,
      [orderId]
    );

    // Also update sales table for backward compatibility (use 'Accepted' for old system)
    // This is optional and failures should not affect the main update
    try {
      // Try to update sales table - use simple query without updated_at first
      await db.run(
        `UPDATE sales SET status = 'Accepted' WHERE order_id = ?`,
        [orderId]
      );
      
      // If that works, try to add updated_at if column exists
      try {
        const salesTableInfo = await db.all(`PRAGMA table_info(sales)`);
        const hasUpdatedAt = salesTableInfo.some(col => col.name === 'updated_at');
        if (hasUpdatedAt) {
          await db.run(
            `UPDATE sales SET updated_at = datetime('now', 'localtime') WHERE order_id = ?`,
            [orderId]
          );
        }
      } catch (updateErr) {
        // Ignore updated_at update errors
        console.debug('Sales table updated_at update skipped:', updateErr.message);
      }
    } catch (salesErr) {
      // Ignore sales table update errors completely (backward compatibility only)
      console.debug('Sales table update skipped (non-critical):', salesErr.message);
    }

    res.json({ success: true, message: "Order accepted" });
  } catch (error) {
    console.error('Error accepting order:', error);
    res.status(500).json({ success: false, message: "Failed to accept order", error: error.message });
  }
});

// Helper function to restore stock for cancelled/rejected orders
async function restoreOrderStock(orderId) {
  try {
    // Get order items
    const orderItems = await db.all(`
      SELECT product_id, quantity
      FROM order_items
      WHERE order_id = ?
    `, [orderId]);

    // Restore stock for each item
    for (const item of orderItems) {
      await db.run(
        'UPDATE items SET stock = stock + ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
      console.log(`✅ Restored ${item.quantity} units of product ${item.product_id} to stock`);
    }
  } catch (err) {
    console.error('Error restoring stock:', err);
    throw err;
  }
}

// Admin: Cancel/Reject order
app.put("/api/orders/:orderId/cancel", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason, status } = req.body; // status can be 'Cancelled' or 'Rejected'
    
    const order = await db.get('SELECT order_status FROM orders WHERE order_id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Can only cancel/reject "Pending" orders
    if (order.order_status !== 'Pending') {
      return res.status(400).json({ 
        success: false, 
        message: `Order cannot be cancelled/rejected. Current status: ${order.order_status}. Only pending orders can be cancelled or rejected.` 
      });
    }

    // Determine final status (default to 'Cancelled', but can be 'Rejected')
    const finalStatus = status === 'Rejected' ? 'Rejected' : 'Cancelled';
    const salesStatus = status === 'Rejected' ? 'Rejected' : 'Cancelled';

    // Restore stock before cancelling/rejecting
    await restoreOrderStock(orderId);

    await db.run(
      `UPDATE orders SET order_status = ?, updated_at = datetime('now', 'localtime') 
       WHERE order_id = ?`,
      [finalStatus, orderId]
    );

    // Also update sales table for backward compatibility (optional)
    try {
      // Try simple update first (without updated_at)
      await db.run(
        `UPDATE sales SET status = ?, reason = ? WHERE order_id = ?`,
        [salesStatus, reason || '', orderId]
      );
      
      // Try to update updated_at if column exists
      try {
        const salesTableInfo = await db.all(`PRAGMA table_info(sales)`);
        const hasUpdatedAt = salesTableInfo.some(col => col.name === 'updated_at');
        if (hasUpdatedAt) {
          await db.run(
            `UPDATE sales SET updated_at = datetime('now', 'localtime') WHERE order_id = ?`,
            [orderId]
          );
        }
      } catch (updateErr) {
        // Ignore updated_at update errors
        console.debug('Sales table updated_at update skipped:', updateErr.message);
      }
    } catch (salesErr) {
      // Ignore sales table update errors completely (backward compatibility only)
      console.debug('Sales table update skipped (non-critical):', salesErr.message);
    }

    res.json({ success: true, message: `Order ${finalStatus.toLowerCase()} and stock restored` });
  } catch (error) {
    console.error('Error cancelling/rejecting order:', error);
    res.status(500).json({ success: false, message: "Failed to cancel/reject order", error: error.message });
  }
});

// Customer: Cancel order (can cancel "Pending" orders)
app.put("/api/orders/:orderId/cancel-customer", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.session?.userId || null;
    
    if (!reason || !reason.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: "Cancellation reason is required" 
      });
    }
    
    // Get order with payment method
    const order = await db.get('SELECT order_status, payment_method FROM orders WHERE order_id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Customer can only cancel "Pending" orders
    // Cannot cancel "In Process", "Out for Delivery", or "Delivered" orders
    if (order.order_status !== 'Pending') {
      return res.status(400).json({ 
        success: false, 
        message: `Order cannot be cancelled. Current status: ${order.order_status}. Only pending orders can be cancelled by customers.` 
      });
    }

    if (order.order_status === 'Cancelled') {
      return res.status(400).json({ 
        success: false, 
        message: "Order is already cancelled" 
      });
    }

    // Restore stock before cancelling (only for Pending orders)
    await restoreOrderStock(orderId);

    // Update orders table
    await db.run(
      `UPDATE orders SET order_status = 'Cancelled', updated_at = datetime('now', 'localtime') 
       WHERE order_id = ?`,
      [orderId]
    );

    // Also update sales table for backward compatibility (optional)
    try {
      await db.run(
        `UPDATE sales SET status = 'Cancelled', reason = ? WHERE order_id = ?`,
        [reason.trim(), orderId]
      );
      
      try {
        const salesTableInfo = await db.all(`PRAGMA table_info(sales)`);
        const hasUpdatedAt = salesTableInfo.some(col => col.name === 'updated_at');
        if (hasUpdatedAt) {
          await db.run(
            `UPDATE sales SET updated_at = datetime('now', 'localtime') WHERE order_id = ?`,
            [orderId]
          );
        }
      } catch (updateErr) {
        console.debug('Sales table updated_at update skipped:', updateErr.message);
      }
    } catch (salesErr) {
      console.debug('Sales table update skipped (non-critical):', salesErr.message);
    }

    // Get user_id from order if not available from session
    let orderUserId = userId;
    if (!orderUserId) {
      const orderWithUser = await db.get('SELECT user_id FROM orders WHERE order_id = ?', [orderId]);
      if (orderWithUser) {
        orderUserId = orderWithUser.user_id;
      }
    }

    // Special Case: If payment was via GCash, create a refund request automatically
    if (order.payment_method === 'GCash') {
      try {
        await db.run(
          `INSERT INTO return_refund_requests (order_id, user_id, reason, status, request_type)
           VALUES (?, ?, ?, 'Pending', 'Refund')`,
          [orderId, orderUserId, `Order cancelled - ${reason.trim()}`]
        );
        console.log(`✅ Auto-created refund request for GCash order ${orderId}`);
      } catch (refundErr) {
        console.error('Error creating auto-refund request:', refundErr);
        // Don't fail the cancellation if refund request creation fails
      }
    }

    res.json({ 
      success: true, 
      message: order.payment_method === 'GCash' 
        ? "Order cancelled successfully. Refund request created for manual processing."
        : "Order cancelled successfully and stock restored",
      isGCash: order.payment_method === 'GCash'
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, message: "Failed to cancel order", error: error.message });
  }
});

// Admin: Update order status
app.put("/api/orders/:orderId/status", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, estimated_delivery_datetime } = req.body;
    
    // Get order details including order type
    const order = await db.get('SELECT order_status, order_type FROM orders WHERE order_id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Define valid statuses based on order type
    const isPickup = order.order_type === 'Pickup' || order.order_type === 'Pick up';
    const validStatuses = isPickup 
      ? ['Pending', 'In Process', 'Ready for Pick up', 'Completed', 'Cancelled']
      : ['Pending', 'In Process', 'Out for Delivery', 'Delivered', 'Cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status for ${isPickup ? 'Pickup' : 'Delivery'} order. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    // Validate status transitions based on order type
    if (isPickup) {
      // Pickup order status flow: Pending -> In Process -> Ready for Pick up -> Completed
      const validTransitions = {
        'Pending': ['In Process', 'Cancelled'],
        'In Process': ['Ready for Pick up', 'Cancelled'],
        'Ready for Pick up': ['Completed'],
        'Completed': [], // Final state
        'Cancelled': [] // Final state
      };
      
      if (validTransitions[order.order_status] && !validTransitions[order.order_status].includes(status)) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid status transition for Pickup order. Cannot change from "${order.order_status}" to "${status}". Valid next statuses: ${validTransitions[order.order_status].join(', ') || 'None (order is completed)'}` 
        });
      }
    } else {
      // Delivery order status flow: Pending -> In Process -> Out for Delivery -> Delivered
      const validTransitions = {
        'Pending': ['In Process', 'Cancelled'],
        'In Process': ['Out for Delivery', 'Cancelled'],
        'Out for Delivery': ['Delivered'],
        'Delivered': [], // Final state
        'Cancelled': [] // Final state
      };
      
      if (validTransitions[order.order_status] && !validTransitions[order.order_status].includes(status)) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid status transition for Delivery order. Cannot change from "${order.order_status}" to "${status}". Valid next statuses: ${validTransitions[order.order_status].join(', ') || 'None (order is completed)'}` 
        });
      }
    }

    // Set out_for_delivery_date and estimated_delivery_datetime when status changes to "Out for Delivery" (Delivery orders only)
    // Set ready_for_pickup_date when status changes to "Ready for Pick up" (Pickup orders only)
    // Also allow updating estimated_delivery_datetime for orders already "Out for Delivery"
    let updateQuery;
    let queryParams;
    
    // Check if order is already "Out for Delivery" and we're just updating the estimated time
    const currentOrder = await db.get('SELECT order_status FROM orders WHERE order_id = ?', [orderId]);
    const isUpdatingEstimatedTime = currentOrder && currentOrder.order_status === 'Out for Delivery' && 
                                     status === 'Out for Delivery' && estimated_delivery_datetime;
    
    if (status === 'Out for Delivery') {
      // If estimated_delivery_datetime is provided, use it; otherwise set out_for_delivery_date only
      if (estimated_delivery_datetime) {
        if (isUpdatingEstimatedTime) {
          // Just update the estimated delivery time, don't change out_for_delivery_date
          updateQuery = `UPDATE orders SET estimated_delivery_datetime = ?, updated_at = datetime('now', 'localtime') WHERE order_id = ?`;
          queryParams = [estimated_delivery_datetime, orderId];
        } else {
          // New status change to "Out for Delivery" - set both dates
          updateQuery = `UPDATE orders SET order_status = ?, updated_at = datetime('now', 'localtime'), out_for_delivery_date = datetime('now', 'localtime'), estimated_delivery_datetime = ? WHERE order_id = ?`;
          queryParams = [status, estimated_delivery_datetime, orderId];
        }
      } else {
        updateQuery = `UPDATE orders SET order_status = ?, updated_at = datetime('now', 'localtime'), out_for_delivery_date = datetime('now', 'localtime') WHERE order_id = ?`;
        queryParams = [status, orderId];
      }
    } else {
      updateQuery = `UPDATE orders SET order_status = ?, updated_at = datetime('now', 'localtime') WHERE order_id = ?`;
      queryParams = [status, orderId];
    }

    await db.run(updateQuery, queryParams);

    // Also update sales table for backward compatibility (optional)
    try {
      // Always update status first (basic update)
      await db.run(
        `UPDATE sales SET status = ? WHERE order_id = ?`,
        [status, orderId]
      );
      
      // Try to update additional columns if they exist
      try {
        const salesTableInfo = await db.all(`PRAGMA table_info(sales)`);
        const hasUpdatedAt = salesTableInfo.some(col => col.name === 'updated_at');
        const hasOutForDeliveryDate = salesTableInfo.some(col => col.name === 'out_for_delivery_date');
        
        if (status === 'Out for Delivery' && hasOutForDeliveryDate) {
          await db.run(
            `UPDATE sales SET out_for_delivery_date = datetime('now', 'localtime') WHERE order_id = ?`,
            [orderId]
          );
        }
        
        if (hasUpdatedAt) {
          await db.run(
            `UPDATE sales SET updated_at = datetime('now', 'localtime') WHERE order_id = ?`,
            [orderId]
          );
        }
      } catch (updateErr) {
        // Ignore additional column update errors
        console.debug('Sales table additional columns update skipped:', updateErr.message);
      }

      // If status is Delivered or Completed, also set isDelivered
      if (status === 'Delivered' || status === 'Completed') {
        try {
          await db.run('UPDATE sales SET isDelivered = 1 WHERE order_id = ?', [orderId]);
        } catch (deliveredErr) {
          console.debug('Sales table isDelivered update skipped:', deliveredErr.message);
        }
      }
    } catch (salesErr) {
      // Ignore sales table update errors completely (backward compatibility only)
      console.debug('Sales table update skipped (non-critical):', salesErr.message);
    }

    res.json({ success: true, message: `Order status updated to ${status}` });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: "Failed to update order status" });
  }
});

// ============================================
// RETURN/REFUND REQUESTS API
// ============================================

// Create return/refund request
app.post("/api/return-refund", upload.single('image'), async (req, res) => {
  try {
    const { order_id, reason, request_type } = req.body;
    
    if (!order_id || !reason) {
      return res.status(400).json({ 
        success: false, 
        message: "Order ID and reason are required" 
      });
    }

    // Verify order exists and get user_id from order
    const order = await db.get('SELECT order_id, order_status, payment_method, user_id FROM orders WHERE order_id = ?', [order_id]);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    // Use user_id from order (more reliable than session)
    const userId = order.user_id || req.session?.userId || null;

    if (order.order_status !== 'Completed' && order.order_status !== 'Delivered') {
      return res.status(400).json({ 
        success: false, 
        message: `Return/Refund can only be requested for completed orders. Current status: ${order.order_status}` 
      });
    }

    // Handle image upload
    let imagePath = null;
    if (req.file) {
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, 'uploads', 'return-refund');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Save file with unique name
      const fileExt = path.extname(req.file.originalname);
      const fileName = `return-${order_id}-${Date.now()}${fileExt}`;
      imagePath = path.join('uploads', 'return-refund', fileName);
      const fullPath = path.join(__dirname, imagePath);
      
      fs.writeFileSync(fullPath, req.file.buffer);
    }

    // Insert return/refund request
    const result = await db.run(
      `INSERT INTO return_refund_requests (order_id, user_id, reason, image_path, request_type, status)
       VALUES (?, ?, ?, ?, ?, 'Pending')`,
      [order_id, userId, reason.trim(), imagePath, request_type || 'Return']
    );

    res.json({ 
      success: true, 
      message: "Return/Refund request submitted successfully",
      requestId: result.lastID 
    });
  } catch (error) {
    console.error('Error creating return/refund request:', error);
    res.status(500).json({ success: false, message: "Failed to create return/refund request", error: error.message });
  }
});

// Get all return/refund requests (for admin/cashier) or filtered by user (for customers)
app.get("/api/return-refund", async (req, res) => {
  try {
    const { username, user_id } = req.query;
    
    let query = `
      SELECT 
        r.id,
        r.order_id,
        r.user_id,
        r.reason,
        r.image_path,
        r.status,
        r.request_type,
        r.created_at,
        r.updated_at,
        r.admin_notes,
        o.total_amount,
        o.payment_method,
        o.order_status,
        o.user_id as order_user_id,
        (u.firstname || ' ' || u.lastname) as customer_name
      FROM return_refund_requests r
      LEFT JOIN orders o ON r.order_id = o.order_id
      LEFT JOIN users u ON r.user_id = u.id
    `;
    
    const params = [];
    
    // Filter by user if username or user_id provided (for customer view)
    if (username || user_id) {
      if (username) {
        // Get user ID from username
        const user = await db.get('SELECT id FROM users WHERE username = ?', [username]);
        if (user) {
          query += ` WHERE (r.user_id = ? OR o.user_id = ? OR u.username = ?)`;
          params.push(user.id, user.id, username);
        } else {
          // User not found, return empty
          return res.json({ success: true, requests: [] });
        }
      } else if (user_id) {
        query += ` WHERE (r.user_id = ? OR o.user_id = ?)`;
        params.push(user_id, user_id);
      }
    }
    
    query += ` ORDER BY r.created_at DESC`;
    
    const requests = await db.all(query, params);

    res.json({ success: true, requests });
  } catch (error) {
    console.error('Error fetching return/refund requests:', error);
    res.status(500).json({ success: false, message: "Failed to fetch return/refund requests", error: error.message });
  }
});

// Update return/refund request status
app.put("/api/return-refund/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const validStatuses = ['Pending', 'Approved', 'Returned', 'Refunded', 'Rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const request = await db.get('SELECT * FROM return_refund_requests WHERE id = ?', [id]);
    if (!request) {
      return res.status(404).json({ success: false, message: "Return/Refund request not found" });
    }

    // Update request status
    await db.run(
      `UPDATE return_refund_requests 
       SET status = ?, admin_notes = ?, updated_at = datetime('now', 'localtime')
       WHERE id = ?`,
      [status, admin_notes || null, id]
    );

    // If status is "Returned", update order status if needed
    if (status === 'Returned') {
      await db.run(
        `UPDATE orders SET order_status = 'Returned', updated_at = datetime('now', 'localtime') WHERE order_id = ?`,
        [request.order_id]
      );
    }

    res.json({ success: true, message: `Return/Refund request status updated to ${status}` });
  } catch (error) {
    console.error('Error updating return/refund request status:', error);
    res.status(500).json({ success: false, message: "Failed to update return/refund request status", error: error.message });
  }
});

app.get("/api/sales/report", async (req, res) => {
  try {
    const sales = await db.all(`SELECT * FROM sales`);
    const orders = await db.all(`SELECT * FROM salesorder`);

    // Aggregate stats
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    const pendingSales = sales.filter(s => s.status === 'Pending').length;
    const acceptedSales = sales.filter(s => s.status === 'Accepted').length;
    const rejectedSales = sales.filter(s => s.status === 'Rejected').length;

    // Group per payment type
    const paymentSummary = {};
    for (const s of sales) {
      paymentSummary[s.payment] = (paymentSummary[s.payment] || 0) + (s.total || 0);
    }

    res.json({
      totalSales,
      totalRevenue,
      pendingSales,
      acceptedSales,
      rejectedSales,
      paymentSummary,
      orders,
      sales,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error generating sales report" });
  }
});



// ============================================
// OTP
// ============================================
app.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validate email
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
    const expires = Date.now() + 5 * 60 * 1000; // expires in 5 minutes
    otpStore[email] = { otp, expires };

    // Set Resend API key from environment variable
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      console.warn('⚠️ RESEND_API_KEY not set - returning OTP in response for testing');
      // For testing without Resend API key
      return res.json({ 
        success: true, 
        message: "OTP generated (email not configured)",
        debug_otp: otp, // ⚠️ REMOVE IN PRODUCTION
        debug_note: "Set RESEND_API_KEY environment variable to enable email sending"
      });
    }

    // Initialize Resend client
    const resend = new Resend(resendApiKey);

    // Send email using Resend
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'EazzyMart <onboarding@resend.dev>',
        to: email,
        subject: 'Your OTP Code - EazzyMart',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Your OTP Code</h2>
            <p>Your OTP code is:</p>
            <div style="background: #f0f0f0; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="color: #007bff; font-size: 36px; letter-spacing: 5px; margin: 0;">${otp}</h1>
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in 5 minutes.</p>
            <p style="color: #999; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
            <p style="color: #999; font-size: 11px;">EazzyMart - Your Trusted Online Grocery Store</p>
          </div>
        `,
      });

      if (error) {
        throw error;
      }

      console.log(`✅ OTP sent to ${email} via Resend (ID: ${data.id})`);
      
      res.json({ 
        success: true, 
        message: "OTP sent successfully. Please check your email."
      });
    } catch (emailError) {
      // Email failed, but OTP is still stored
      console.error(`❌ Resend error for ${email}:`, emailError);
      console.warn('⚠️ OTP was generated and stored, but email delivery failed');
      
      // Return OTP in response for testing when email fails
      res.json({ 
        success: true, 
        message: "OTP generated but email failed",
        debug_otp: otp, // ⚠️ TEMPORARY - REMOVE IN PRODUCTION
        debug_error: emailError.message || emailError
      });
    }
  } catch (error) {
    console.error("❌ Send OTP error:", error);
    console.error("❌ Error details:", {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      message: error.message
    });
    
    // Provide more specific error messages
    let errorMessage = "Failed to send email. Please try again later.";
    if (error.code === 'EAUTH') {
      errorMessage = "Email authentication failed. Please contact support.";
    } else if (error.code === 'ECONNECTION' || error.message.includes('timeout')) {
      errorMessage = "Could not connect to email server. Please try again later.";
    } else if (error.response) {
      errorMessage = `Email server error: ${error.response}`;
    }
    
    res.status(500).json({ success: false, message: errorMessage });
  }
});

// Test email endpoint (for debugging)
app.post("/test-email", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const emailUser = process.env.EMAIL_USER || "nodomailer@gmail.com";
    const emailPass = process.env.EMAIL_PASS || "tilwuymdmlgftizy";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    await transporter.verify();
    
    await transporter.sendMail({
      from: '"EazzyMart Test" <nodomailer@gmail.com>',
      to: email,
      subject: "Test Email from EazzyMart",
      text: "This is a test email. If you receive this, email is working!",
      html: "<h2>Test Email</h2><p>This is a test email. If you receive this, email is working!</p>",
    });

    res.json({ success: true, message: "Test email sent successfully" });
  } catch (error) {
    console.error("Test email error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      code: error.code,
      response: error.response 
    });
  }
});

app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).json({ success: false, message: "Email and OTP required" });

  const record = otpStore[email];
  if (!record)
    return res.status(400).json({ success: false, message: "No OTP found for this email" });

  if (Date.now() > record.expires)
    return res.status(400).json({ success: false, message: "OTP expired" });

  if (parseInt(otp) !== record.otp)
    return res.status(400).json({ success: false, message: "Invalid OTP" });

  // OTP is valid
  delete otpStore[email]; // optional: clear OTP after successful use

  res.json({ success: true, message: "OTP verified successfully!" });
});

app.post("/send-email", async (req, res) => {
  try {
    const { email, sales } = req.body;
    
    // Validate inputs
    if (!email || !sales) {
      return res.status(400).json({ success: false, message: "Email and sales data required" });
    }

    // Set Resend API key from environment variable
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      console.warn('⚠️ RESEND_API_KEY not set - email not sent');
      return res.json({ 
        success: false, 
        message: "Email service not configured. Set RESEND_API_KEY environment variable."
      });
    }

    // Initialize Resend client
    const resend = new Resend(resendApiKey);

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'EazzyMart <onboarding@resend.dev>',
      to: email,
      subject: 'Your order has been Accepted - EazzyMart',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Hi ${sales.customer},</h2>
          <p>Good news! Your order <strong>${sales.id}</strong> is on its way to you.</p>
          <p>You can expect delivery soon. Thank you for shopping with us!</p>
          <p>If you have any questions or need assistance, feel free to reply to this email.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="margin-top: 30px;">Best regards,<br><strong>EAZZY MART</strong></p>
          <p style="color: #999; font-size: 11px;">EazzyMart - Your Trusted Online Grocery Store</p>
        </div>
      `,
    });

    if (error) {
      throw error;
    }

    console.log(`✅ Order confirmation email sent to ${email} (ID: ${data.id})`);
    res.json({ success: true, message: "Email sent successfully" });
    
  } catch (error) {
    console.error('❌ Send email error:', error);
    res.status(500).json({ success: false, message: "Failed to send email", error: error.message || error });
  }
});



// ============================================
// ROOT ROUTE
// ============================================
app.get('/', (req, res) => {
  res.json({ 
    ok: true, 
    message: 'EazzyMart Backend API is running',
    database: 'SQLite',
    endpoints: {
      health: '/api/ping',
      items: '/api/items',
      sales: '/api/sales',
      orders: '/api/orders',
      users: '/api/user'
    }
  });
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/ping', (req, res) => {
  res.json({ 
    ok: true, 
    message: 'Server is running with SQLite',
    databaseReady: !!db 
  });
});

// Debug route to list all registered routes
app.get('/api/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
      routes.push(`${methods} ${middleware.route.path}`);
    }
  });
  res.json({ routes, total: routes.length });
});

// Serve static files AFTER all API routes (prevents interference with routes)
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

// Serve uploaded files
const uploadsPath = path.join(__dirname, 'uploads');
if (fs.existsSync(uploadsPath)) {
  app.use('/uploads', express.static(uploadsPath));
}

// Catch-all for undefined routes (MUST be last, after all routes)
app.use((req, res) => {
  console.warn(`⚠️ 404: ${req.method} ${req.path} not found`);
  res.status(404).json({ 
    error: 'Route not found', 
    path: req.path,
    method: req.method,
    message: `The route ${req.method} ${req.path} does not exist.`,
    hint: 'Check /api/routes for available endpoints'
  });
});

// ============================================
// START SERVER (only after database is ready)
// ============================================
// Wait for database to be ready before starting server
(async () => {
  try {
    // Wait a bit for database to initialize
    let attempts = 0;
    while (!db && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!db) {
      console.error('❌ Database failed to initialize. Starting server anyway but routes may fail.');
    }
    
    app.listen(port, '0.0.0.0', () => {
      console.log(`✅ Server is running on port ${port}`);
      console.log(`✅ Server accessible at http://0.0.0.0:${port}`);
      if (db) {
        console.log('✅ Database is ready');
      } else {
        console.warn('⚠️ Database not ready yet');
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
})();
