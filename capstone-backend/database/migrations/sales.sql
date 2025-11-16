-- Updated sales table with order_id for proper Order Management
USE grocery;

-- Drop existing table if needed (for migration)
-- IF OBJECT_ID('dbo.sales', 'U') IS NOT NULL DROP TABLE sales;

CREATE TABLE dbo.sales (
    id INT IDENTITY(1,1) PRIMARY KEY,
    order_id VARCHAR(50) UNIQUE NOT NULL,  -- Unique order identifier (e.g., ORD-20250123-001)
    item_id INT NULL,  -- Optional, kept for backward compatibility
    quantity_sold INT NULL CHECK (quantity_sold > 0),
    customer NVARCHAR(100) NULL,
    payment NVARCHAR(50) NULL,
    status NVARCHAR(50) NOT NULL DEFAULT 'Pending',  -- Pending, In Process, Out for Delivery, Delivered, Cancelled
    type NVARCHAR(50) NULL,  -- Delivery or Pickup
    address NVARCHAR(255) NULL,
    total DECIMAL(10,2) NULL,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    out_for_delivery_date DATETIME NULL,  -- Track when order went "Out for Delivery" for auto-completion
    
    -- Optional foreign key to items table
    CONSTRAINT FK_sales_items FOREIGN KEY (item_id)
        REFERENCES dbo.items(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- Create normalized orders table (order header)
CREATE TABLE dbo.orders (
    order_id VARCHAR(50) PRIMARY KEY,  -- Unique order identifier
    user_id INT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    order_status NVARCHAR(50) NOT NULL DEFAULT 'Pending',
    payment_method NVARCHAR(50),
    shipping_address NVARCHAR(MAX),
    order_type NVARCHAR(50),  -- Delivery or Pickup
    contact_number NVARCHAR(20),
    transaction_number NVARCHAR(100),  -- For GCash payments
    order_date DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    out_for_delivery_date DATETIME NULL,
    
    FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
);

-- Create normalized order_items table (order details)
CREATE TABLE dbo.order_items (
    order_item_id INT IDENTITY(1,1) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    product_id INT NOT NULL,
    product_name NVARCHAR(200) NOT NULL,  -- Store name at time of purchase
    quantity INT NOT NULL CHECK (quantity > 0),
    price DECIMAL(10, 2) NOT NULL,  -- Price per item at time of purchase
    total DECIMAL(10, 2) NOT NULL,  -- quantity * price
    
    FOREIGN KEY (order_id) REFERENCES dbo.orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES dbo.items(id) ON DELETE RESTRICT
);

-- Create indexes for better query performance
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_sales_order_id ON sales(order_id);

SELECT * FROM sales;
SELECT * FROM orders;
SELECT * FROM order_items;
