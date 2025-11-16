# API Endpoint Comparison: Frontend vs Backend

## Frontend API Calls Found:

### Authentication
- ✅ `POST /api/customer/login` - Backend: EXISTS (line 566)
- ✅ `POST /api/customer/register` - Backend: EXISTS (line 518)
- ✅ `GET /api/items` - Backend: EXISTS (line 403)
- ✅ `POST /api/sales` - Backend: EXISTS (line 800)
- ✅ `GET /api/sales` - Backend: EXISTS (line 703)
- ✅ `GET /api/return-refund` - Backend: EXISTS (line 1503)
- ✅ `POST /api/return-refund` - Backend: EXISTS (line 1439)
- ✅ `GET /api/orders/customer` - Backend: EXISTS (line 895)
- ✅ `PUT /api/orders/:orderId/received` - Backend: EXISTS (line 939)
- ✅ `PUT /api/orders/:orderId/cancel-customer` - Backend: EXISTS (line 1183)
- ✅ `PUT /api/sales/delivered` - Backend: EXISTS (line 876)
- ✅ `POST /send-email` - Backend: EXISTS (line 1778)
- ✅ `GET /api/user` - Backend: EXISTS (line 641)

## Potential Issues:

1. **Route Order**: Catch-all 404 handler might be interfering
2. **Static File Serving**: `express.static` might be catching requests
3. **Database Not Ready**: Routes might fail if db is null

