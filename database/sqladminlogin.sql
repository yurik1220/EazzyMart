USE grocery;
GO

-- Create table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
BEGIN
    CREATE TABLE dbo.users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(256) NOT NULL,           -- plain text password (simple setup)
        role VARCHAR(20) NOT NULL DEFAULT 'customer',  -- 'admin' or 'customer'
        email VARCHAR(150) NULL,                  -- optional (only for customers)
        created_at DATETIME DEFAULT GETDATE()
    );
END
GO

-- Add missing columns if table already exists
IF COL_LENGTH('dbo.users', 'role') IS NULL
    ALTER TABLE dbo.users ADD role VARCHAR(20) DEFAULT 'customer';

IF COL_LENGTH('dbo.users', 'email') IS NULL
    ALTER TABLE dbo.users ADD email VARCHAR(150) NULL;

-- Insert superadmin for admin website login
INSERT INTO dbo.users (username, password, role)
VALUES ('superadmin', 'superadmin', 'admin');
GO

-- Optional: Add a sample customer account
INSERT INTO dbo.users (username, password, role, email)
VALUES ('samplecustomer', 'samplecustomer', 'customer', 'samplecustomer@email.com');
GO

-- View current users
SELECT id, username, password, role, email, created_at
FROM dbo.users;
GO
