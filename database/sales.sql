use grocery;


CREATE TABLE dbo.sales (
    id INT IDENTITY(1,1) PRIMARY KEY,
    item_id INT NOT NULL,
    quantity_sold INT NOT NULL CHECK (quantity_sold > 0),
    customer NVARCHAR(100) NULL,
    payment NVARCHAR(50) NULL,
    status NVARCHAR(50) NULL,
    type NVARCHAR(50) NULL,
    address NVARCHAR(255) NULL,
    total DECIMAL(10,2) NULL,
    created_at DATETIME DEFAULT GETDATE(),

    -- Optional foreign key to your items table
    CONSTRAINT FK_sales_items FOREIGN KEY (item_id)
        REFERENCES dbo.items(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

SELECT * FROM sales;
