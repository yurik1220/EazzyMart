# Frontend-Backend Connection Fixes

## Problem
The deployed backend was not connecting with the frontend, resulting in 404 errors and "route not found" messages.

## Root Cause
1. **Hardcoded API URLs**: All frontend JavaScript files were using hardcoded backend URLs (`https://eazzymart-backend.onrender.com`) instead of a centralized configuration
2. **Config.js not being used**: A `config.js` file existed but wasn't being loaded or used by any frontend files
3. **Inconsistent URL management**: Different files had different ways of determining the API base URL

## Fixes Applied

### 1. Updated `config.js` (frontend/js/config.js)
- Made `API_BASE_URL` available globally via `window.API_BASE_URL`
- Added helper function `window.getApiUrl(endpoint)` for building API URLs
- Automatically detects localhost vs production environment

### 2. Updated All Frontend JavaScript Files
Replaced all hardcoded URLs with `window.getApiUrl()` calls in:
- ✅ `Index.js` - 4 occurrences
- ✅ `ItemService.js` - 1 occurrence
- ✅ `webscriptcustomer.js` - 4 occurrences
- ✅ `order-tracking.js` - 11 occurrences
- ✅ `sales-report.js` - 2 occurrences
- ✅ `cashier.js` - 12 occurrences
- ✅ `adminscript.js` - 8 occurrences

### 3. Updated HTML Files
Added `config.js` script tag before all other scripts in:
- ✅ `Index.html`
- ✅ `Cart.html`
- ✅ `Checkout.html`
- ✅ `Admin.html`
- ✅ `Cashier.html`
- ✅ `OrderTracking.html`
- ✅ `sales-report.html`
- ✅ `login.html` (also updated inline scripts)
- ✅ `user-management.html` (also updated inline scripts)

### 4. Fixed Image URLs
For image paths (not API endpoints), updated to use `window.API_BASE_URL` directly:
- Image URLs in `order-tracking.js` and `cashier.js`

## Testing

### Before Pushing
1. **Test locally**: 
   - Start backend: `cd capstone-backend && npm start`
   - Open `test-api-connection.html` in browser
   - Click "Run Tests" to verify all endpoints work

2. **Verify config.js is loaded**:
   - Open browser console on any page
   - Type: `window.API_BASE_URL` - should show the correct URL
   - Type: `window.getApiUrl('api/ping')` - should build correct URL

3. **Test key functionality**:
   - Login/Register
   - Browse products
   - Add to cart
   - Place order
   - View orders

### After Deployment
1. Update `config.js` with your actual Render backend URL:
   ```javascript
   return 'https://your-actual-backend-url.onrender.com';
   ```

2. Test the deployed frontend:
   - Open browser console
   - Check for any 404 errors
   - Verify API calls are going to the correct backend URL

## Important Notes

1. **Backend URL**: The current backend URL in `config.js` is set to `https://eazzymart-backend.onrender.com`. Make sure this matches your actual deployed backend URL on Render.

2. **Local Development**: When running locally, the config automatically uses `http://localhost:3000`

3. **Image URLs**: Image paths use `window.API_BASE_URL` directly (not `getApiUrl()`) because they're not API endpoints

4. **Query Parameters**: The `getApiUrl()` function properly handles query parameters:
   ```javascript
   window.getApiUrl(`api/orders/customer?username=${username}`)
   ```

## Files Modified

### JavaScript Files (8 files)
- frontend/js/config.js
- frontend/js/Index.js
- frontend/js/ItemService.js
- frontend/js/webscriptcustomer.js
- frontend/js/order-tracking.js
- frontend/js/sales-report.js
- frontend/js/cashier.js
- frontend/js/adminscript.js

### HTML Files (9 files)
- frontend/pages/Index.html
- frontend/pages/Cart.html
- frontend/pages/Checkout.html
- frontend/pages/Admin.html
- frontend/pages/Cashier.html
- frontend/pages/OrderTracking.html
- frontend/pages/sales-report.html
- frontend/pages/login.html
- frontend/pages/user-management.html

## Verification Checklist

- [x] All hardcoded URLs replaced with `window.getApiUrl()`
- [x] `config.js` loaded in all HTML files before other scripts
- [x] No syntax errors in modified files
- [x] Backend routes verified (all frontend calls have matching backend routes)
- [x] Image URLs properly handled
- [x] Query parameters properly handled
- [ ] **TODO**: Update backend URL in `config.js` with actual Render URL before deployment
- [ ] **TODO**: Test locally before pushing
- [ ] **TODO**: Test deployed frontend after pushing

## Next Steps

1. **Update Backend URL**: Edit `frontend/js/config.js` line 14 with your actual Render backend URL
2. **Test Locally**: Use `test-api-connection.html` to verify connectivity
3. **Commit and Push**: Once verified, commit and push changes
4. **Monitor**: After deployment, check browser console for any remaining 404 errors

