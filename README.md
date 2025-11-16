# Nino's Grocery Store

A full-stack e-commerce grocery store application with customer, admin, and cashier interfaces.

## 📁 Project Structure

```
capstone/
├── frontend/                 # Frontend application
│   ├── pages/               # HTML pages
│   │   ├── Index.html       # Customer shopping interface
│   │   ├── Admin.html       # Admin dashboard
│   │   ├── Cashier.html    # Cashier order management
│   │   ├── login.html       # Authentication page
│   │   ├── user-management.html
│   │   └── sales-report.html
│   ├── js/                  # JavaScript files
│   │   ├── Index.js         # Customer logic
│   │   ├── adminscript.js   # Admin logic
│   │   ├── cashier.js       # Cashier logic
│   │   ├── sales-report.js
│   │   └── ItemService.js
│   ├── css/                 # Stylesheets
│   │   ├── webstyle.css     # Customer styles
│   │   ├── cashier.css      # Cashier styles
│   │   └── adminstyle.css   # Admin styles
│   └── assets/              # Static assets
│       └── images/          # Images
│           ├── flash-deals.png
│           └── gcash_qr.png
├── database/                # Database scripts
│   ├── sqladminlogin.sql   # Users table setup
│   └── sales.sql           # Sales table setup
├── docs/                    # Documentation & archived files
├── node_modules/            # Dependencies
├── package.json            # Project configuration
└── README.md               # This file
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Frontend Server
```bash
npm start
```

The application will be available at `http://localhost:8000`

### 3. Access Pages
- **Login:** `http://localhost:8000/frontend/pages/login.html`
- **Customer:** `http://localhost:8000/frontend/pages/Index.html`
- **Admin:** `http://localhost:8000/frontend/pages/Admin.html`
- **Cashier:** `http://localhost:8000/frontend/pages/Cashier.html`

## 🔧 Requirements

- **Backend API Server** running on `http://localhost:3000`
- **SQL Server Database** with `grocery` database
- **Node.js** (v14+)
- Modern web browser

## 📝 Default Credentials

- **Admin:** `superadmin` / `superadmin`
- **Customer:** `samplecustomer` / `samplecustomer`

⚠️ **Change these in production!**

## 🎯 Features

### Customer Interface
- Browse products by category
- Shopping cart functionality
- Checkout (Delivery/Pickup)
- Payment methods (Cash on Delivery, GCash)
- Order tracking

### Admin Dashboard
- Product management (Add/Edit/Delete)
- Sales reports and analytics
- User management
- Dashboard with statistics and charts

### Cashier Dashboard
- View pending orders
- Accept/Reject orders
- Track delivery status
- Real-time order updates

## 🔌 API Endpoints Required

The frontend expects a backend API at `http://localhost:3000` with these endpoints:

- `GET/POST/PUT/DELETE /api/items` - Product management
- `GET/POST/PUT /api/sales` - Order management
- `GET /api/sales/report` - Sales reports
- `POST /api/login` - Authentication
- `POST /api/customer/register` - Registration
- `POST /send-otp` - OTP verification
- `POST /send-email` - Email notifications

## 📦 Technologies Used

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **UI Framework:** Bootstrap 5.3.8
- **Charts:** Chart.js 4.5.1
- **Notifications:** SweetAlert2 11.26.3
- **Backend:** Node.js/Express (separate repository)
- **Database:** Microsoft SQL Server

## 🗂️ File Organization

All frontend files are organized in the `frontend/` directory:
- **Pages** are in `frontend/pages/`
- **Scripts** are in `frontend/js/`
- **Styles** are in `frontend/css/`
- **Assets** are in `frontend/assets/`

This keeps the project clean and maintainable.

## 📚 Documentation

- Database setup scripts are in `database/`
- Archived/example files are in `docs/`

## 🐛 Troubleshooting

### Pages not loading?
- Ensure you're accessing files from `frontend/pages/` directory
- Check browser console for 404 errors
- Verify file paths are correct

### API calls failing?
- Verify backend server is running on port 3000
- Check CORS settings in backend
- Review browser network tab for errors

### Images not showing?
- Verify images are in `frontend/assets/images/`
- Check image paths in HTML/JS files

## 📄 License

ISC



