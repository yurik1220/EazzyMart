# Render Deployment Guide

This guide will walk you through deploying your grocery store application to Render.

## 📋 Prerequisites

- A GitHub account (or GitLab/Bitbucket)
- Your code pushed to a Git repository
- A Render account (sign up at https://render.com)

## 🏗️ Architecture

You'll deploy two services:
1. **Backend** - Node.js Web Service (API server)
2. **Frontend** - Static Site (HTML/CSS/JS files)

---

## 🚀 Step 1: Prepare Your Repository

Make sure your code is pushed to GitHub/GitLab/Bitbucket. Your repository should have this structure:

```
capstone/
├── capstone-backend/     # Backend folder
│   ├── server.js
│   ├── package.json
│   └── ...
└── frontend/              # Frontend folder
    ├── pages/
    ├── js/
    ├── css/
    └── ...
```

---

## 🔧 Step 2: Deploy Backend (Web Service)

### In Render Dashboard:

1. **Click "New +"** → Select **"Web Service"**

2. **Connect Repository:**
   - Connect your Git repository
   - Select the repository containing your code

3. **Configure Service:**
   - **Name:** `capstone-backend` (or any name you prefer)
   - **Region:** Choose closest to your users
   - **Branch:** `main` (or your default branch)
   - **Root Directory:** `capstone-backend` ⚠️ **IMPORTANT**
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free (or choose based on your needs)

4. **Environment Variables:**
   (No environment variables needed - leave this section empty)

5. **Advanced Settings:**
   - **Health Check Path:** `/api/ping`

6. **Click "Create Web Service"**

   ⏱️ Wait for deployment (5-10 minutes on first deploy)

7. **Copy your backend URL:**
   - Once deployed, you'll see a URL like: `https://capstone-backend-xxxx.onrender.com`
   - **Copy this URL** - you'll need it for the frontend!

---

## 🌐 Step 3: Update Frontend API URLs

Before deploying the frontend, you need to update all API calls to use your Render backend URL instead of `localhost:3000`.

### Quick Method: Find and Replace

1. **In your code editor** (VS Code, etc.), open the `frontend/js/` folder
2. **Use Find and Replace** (Ctrl+Shift+H or Cmd+Shift+H):
   - **Find:** `http://localhost:3000`
   - **Replace:** `https://your-backend-url.onrender.com` (use your actual backend URL from Step 2)
   - **Scope:** `frontend/js/*.js`
   - Click "Replace All"

**Files that will be updated:**
- `frontend/js/Index.js`
- `frontend/js/adminscript.js`
- `frontend/js/cashier.js`
- `frontend/js/order-tracking.js`
- `frontend/js/sales-report.js`
- `frontend/js/webscriptcustomer.js`
- `frontend/js/ItemService.js`

**Example:**
```javascript
// Before:
const response = await fetch('http://localhost:3000/api/items');

// After:
const response = await fetch('https://capstone-backend-xxxx.onrender.com/api/items');
```

### Alternative: Use Config File (For Future Updates)

A `config.js` file has been created at `frontend/js/config.js`. You can update it with your backend URL and modify your JS files to use it, but the find-and-replace method above is faster for now.

---

## 📦 Step 4: Deploy Frontend (Static Site)

### In Render Dashboard:

1. **Click "New +"** → Select **"Static Site"**

2. **Configure Static Site:**
   - **Name:** `capstone-frontend` (or any name)
   - **Repository:** Same repository as backend
   - **Branch:** `main`
   - **Root Directory:** `frontend` ⚠️ **IMPORTANT**
   - **Build Command:** (Leave empty - no build needed)
   - **Publish Directory:** `.` ⚠️ **Use a single dot (period)**

3. **Click "Create Static Site"**

   ⏱️ Wait for deployment (2-5 minutes)

4. **Copy your frontend URL:**
   - You'll get a URL like: `https://capstone-frontend.onrender.com`

---

## ✅ Step 5: Verify Deployment

1. **Test Backend:**
   - Visit: `https://your-backend-url.onrender.com/api/ping`
   - Should return: `{"ok":true,"message":"Server is running with SQLite"}`

2. **Test Frontend:**
   - Visit your frontend URL
   - Try logging in or browsing products
   - Check browser console for any API errors

---

## ⚠️ Important Notes

### SQLite Database Persistence

**⚠️ CRITICAL:** Render's free tier does NOT have persistent disk storage. This means:
- Your SQLite database (`grocery.db`) will be **reset every time the service restarts**
- Data will be lost on:
  - Service restarts (automatic after 15 minutes of inactivity on free tier)
  - Deployments
  - Service updates

**Solutions:**
1. **Upgrade to paid plan** - Get persistent disk storage
2. **Use external database** - Migrate to PostgreSQL (Render provides free PostgreSQL)
3. **Accept data loss** - For testing/demo purposes only

### CORS Configuration

The backend already has CORS enabled, so it should work with your frontend. If you encounter CORS errors, you may need to update the CORS configuration in `server.js` to allow your frontend domain.

### Environment Variables

If you need to store sensitive data (like email passwords), use Render's Environment Variables feature instead of hardcoding them in your code.

---

## 🔄 Updating Your Deployment

Whenever you push changes to your repository:
- **Backend:** Render will automatically rebuild and redeploy
- **Frontend:** Render will automatically rebuild and redeploy

You can also manually trigger deployments from the Render dashboard.

---

## 🐛 Troubleshooting

### Backend won't start
- Check build logs in Render dashboard
- Verify `package.json` has correct `start` script
- Ensure `server.js` is in the root directory of `capstone-backend`

### Frontend can't connect to backend
- Verify backend URL is correct in frontend files
- Check CORS settings in backend
- Verify backend is running (check `/api/ping`)

### Database errors
- Remember: SQLite data is not persistent on free tier
- Check that `grocery.db` file exists (it will be created automatically)

### 404 errors on frontend
- Verify `Root Directory` is set to `frontend` in Static Site settings
- Check that your HTML files are in `frontend/pages/` directory

---

## 📞 Need Help?

- Render Documentation: https://render.com/docs
- Render Community: https://community.render.com
- Check deployment logs in Render dashboard for detailed error messages

---

## 🎉 You're Done!

Your application should now be live on Render! Share your frontend URL with users to access the grocery store.

