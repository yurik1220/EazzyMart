# Grocery Admin System Backend

A Node.js/Express backend API for a grocery store admin system with SQLite database.

## 📁 Project Structure

```
capstone-backend/
├── server.js                 # Main Express server (entry point)
├── package.json              # Dependencies and scripts
├── grocery.db               # SQLite database file
│
├── frontend/                # Frontend-related files
│   ├── adminscript.js       # Admin panel frontend script
│   ├── ItemService.js       # Item fetch utility
│   ├── OTP(base).html       # OTP email template
│   └── Sample.html          # Sample frontend demo
│
├── scripts/                 # Utility scripts
│   └── taxReport.js         # Tax report generator
│
├── database/                # Database-related files
│   ├── migrations/          # SQL migration scripts (legacy SQL Server)
│   │   ├── sales.sql
│   │   ├── sqladminlogin.sql
│   │   ├── SQLQuery1.sql
│   │   └── SQLQuery1.1.sql
│   └── *.ssmssln            # SQL Server solution files (legacy)
│
├── archive/                 # Legacy/unused files
│   ├── database.js          # Old SQL Server config (unused)
│   └── security.js          # Standalone OTP service (ES modules, unused)
│
├── docs/                    # Documentation
│   └── wads.txt             # Project notes
│
├── start-backend.bat        # Windows script to start server
└── stop-backend.bat         # Windows script to stop server
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

Or use the batch file:
```bash
start-backend.bat
```

For development with auto-reload:
```bash
npm run dev
```

### Server
- **Port:** 3000
- **URL:** http://localhost:3000
- **Health Check:** http://localhost:3000/api/ping

## 📊 Database

The project uses **SQLite** (`grocery.db`). The database is automatically created and initialized on first run.

### Tables
- `items` - Product catalog
- `users` - User accounts (customers & admins)
- `sales` - Orders/transactions
- `salesorder` - Order line items
- `stock_entries` - Stock history
- `tax_reports` - Generated reports

### Viewing the Database
- **DB Browser for SQLite:** https://sqlitebrowser.org/
- **VS Code Extension:** SQLite Viewer
- **Command Line:** `sqlite3 grocery.db`

## 🔌 API Endpoints

### Items
- `GET /api/items` - List all items
- `POST /api/items` - Create item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item

### Stock
- `POST /api/stock-entry` - Add stock entry
- `GET /api/stock-report` - Get today's stock report
- `POST /api/generate-stock-report` - Generate stock report file

### Users
- `GET /api/user` - List all users
- `POST /api/user` - Create user (admin)
- `PUT /api/user/:id` - Update user
- `DELETE /api/user/:id` - Delete user
- `POST /api/customer/register` - Customer registration
- `POST /api/login` - Login
- `POST /api/reset-password` - Reset password

### Sales
- `GET /api/sales` - List all sales with order items
- `POST /api/sales` - Create new sale/order
- `PUT /api/sales` - Update sale
- `PUT /api/sales/delivered` - Update delivery status
- `GET /api/sales/report` - Sales report with statistics
- `GET /api/order` - List all order items

### Email/OTP
- `POST /send-otp` - Send OTP email
- `POST /verify-otp` - Verify OTP
- `POST /send-email` - Send order confirmation email

## 📝 Scripts

- `npm start` - Start the server
- `npm run dev` - Start with nodemon (auto-reload)
- `npm run generate-tax-report` - Generate tax report

## ⚠️ Security Notes

- Passwords are currently stored in plain text (should be hashed)
- Session secret is hardcoded (should use environment variables)
- Email credentials are exposed in code (should use environment variables)
- No authentication middleware on protected routes

## 📦 Dependencies

- **express** - Web framework
- **sqlite3** - SQLite database driver
- **cors** - Cross-origin resource sharing
- **nodemailer** - Email service
- **express-session** - Session management
- **multer** - File upload handling
- **bcryptjs** - Password hashing (installed but not used)

## 🔄 Migration Notes

This project was migrated from SQL Server to SQLite. Legacy SQL Server files are stored in `database/migrations/` and `archive/` folders.

## 📄 License

[Add your license here]

