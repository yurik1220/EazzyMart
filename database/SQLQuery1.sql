USE grocery;

IF OBJECT_ID('dbo.items', 'U') IS NOT NULL DROP TABLE items;

-- Recreate items table with image column
CREATE TABLE items (
    id INT IDENTITY(1,1) PRIMARY KEY,
    names NVARCHAR(100),
    price FLOAT,
    stock INT,
    category NVARCHAR(100),
    descs NVARCHAR(255),
    images NVARCHAR(MAX)
);