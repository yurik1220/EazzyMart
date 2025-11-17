-- PostgreSQL Schema for EazzyMart
-- Migrated from SQLite schema

-- Items table
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  names TEXT,
  price NUMERIC(10, 2),
  stock INTEGER,
  category TEXT,
  descs TEXT,
  images TEXT
);

-- Stock entries table
CREATE TABLE IF NOT EXISTS stock_entries (
  id SERIAL PRIMARY KEY,
  item_id INTEGER,
  quantity_added INTEGER,
  date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'customer',
  firstname TEXT,
  lastname TEXT,
  gender TEXT,
  birthDate TIMESTAMP,
  isVerified BOOLEAN NOT NULL DEFAULT FALSE
);

-- Tax reports table
CREATE TABLE IF NOT EXISTS tax_reports (
  id SERIAL PRIMARY KEY,
  report_content TEXT
);

-- Sales table (legacy - for backward compatibility)
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  order_id TEXT UNIQUE,
  customer TEXT,
  address TEXT,
  payment TEXT,
  status TEXT DEFAULT 'Pending',
  total NUMERIC(10, 2),
  type TEXT,
  delivery TEXT,
  reason TEXT,
  trnumber TEXT,
  createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  out_for_delivery_date TIMESTAMP,
  isDelivered BOOLEAN DEFAULT FALSE,
  contact TEXT,
  createdbyuser TEXT
);

-- Normalized orders table (order header)
CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  user_id INTEGER,
  total_amount NUMERIC(10, 2) NOT NULL,
  order_status TEXT NOT NULL DEFAULT 'Pending',
  payment_method TEXT,
  shipping_address TEXT,
  order_type TEXT,
  contact_number TEXT,
  transaction_number TEXT,
  order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  out_for_delivery_date TIMESTAMP,
  estimated_delivery_datetime TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Normalized order_items table (order details)
CREATE TABLE IF NOT EXISTS order_items (
  order_item_id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC(10, 2) NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES items(id) ON DELETE RESTRICT
);

-- Salesorder table (legacy - for backward compatibility)
CREATE TABLE IF NOT EXISTS salesorder (
  id SERIAL PRIMARY KEY,
  salesid INTEGER,
  name TEXT,
  price NUMERIC(10, 2),
  qty INTEGER
);

-- Return/Refund requests table
CREATE TABLE IF NOT EXISTS return_refund_requests (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL,
  user_id INTEGER,
  reason TEXT NOT NULL,
  image_path TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  request_type TEXT NOT NULL DEFAULT 'Return',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  admin_notes TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_id ON sales(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_return_refund_order_id ON return_refund_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_refund_status ON return_refund_requests(status);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic updated_at updates
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at 
  BEFORE UPDATE ON orders 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
CREATE TRIGGER update_sales_updated_at 
  BEFORE UPDATE ON sales 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_return_refund_updated_at ON return_refund_requests;
CREATE TRIGGER update_return_refund_updated_at 
  BEFORE UPDATE ON return_refund_requests 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

