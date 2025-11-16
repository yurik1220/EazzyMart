# Render Deployment - Quick Start Checklist

Follow these steps while in your Render dashboard:

## ✅ Backend Deployment Checklist

### Step 1: Create Web Service
- [ ] Click **"New +"** → **"Web Service"**
- [ ] Connect your Git repository
- [ ] Configure:
  - **Name:** `capstone-backend`
  - **Root Directory:** `capstone-backend` ⚠️ **CRITICAL**
  - **Runtime:** `Node`
  - **Build Command:** `npm install`
  - **Start Command:** `npm start`
  - **Instance Type:** Free

### Step 2: Environment Variables
- [ ] (No environment variables needed - skip this step)

### Step 3: Advanced Settings
- [ ] Health Check Path: `/api/ping`

### Step 4: Deploy
- [ ] Click **"Create Web Service"**
- [ ] Wait for deployment (5-10 minutes)
- [ ] **Copy your backend URL:** `https://capstone-backend-xxxx.onrender.com`

---

## ✅ Frontend Deployment Checklist

### Step 1: Update API URLs
- [ ] Open `frontend/js/` folder in your code editor
- [ ] Find & Replace: `http://localhost:3000` → `https://your-backend-url.onrender.com`
- [ ] Commit and push changes to Git

### Step 2: Create Static Site
- [ ] Click **"New +"** → **"Static Site"**
- [ ] Configure:
  - **Name:** `capstone-frontend`
  - **Repository:** Same as backend
  - **Root Directory:** `frontend` ⚠️ **CRITICAL**
  - **Build Command:** (leave empty)
  - **Publish Directory:** `.` ⚠️ **Use a single dot (period)**

### Step 3: Deploy
- [ ] Click **"Create Static Site"**
- [ ] Wait for deployment (2-5 minutes)
- [ ] **Copy your frontend URL:** `https://capstone-frontend.onrender.com`

---

## ✅ Verification

- [ ] Test backend: Visit `https://your-backend-url.onrender.com/api/ping`
- [ ] Test frontend: Visit your frontend URL and try logging in
- [ ] Check browser console for any errors

---

## ⚠️ Important Reminders

1. **Root Directories are CRITICAL** - Make sure they're set correctly!
2. **SQLite data will be lost** on free tier (service restarts/deployments)
3. **Update API URLs** before deploying frontend
4. **Backend URL** is needed for frontend configuration

---

## 🆘 Quick Troubleshooting

**Backend won't start?**
- Check Root Directory is `capstone-backend`
- Check build logs in Render dashboard

**Frontend can't connect?**
- Verify API URLs are updated
- Check backend is running (test `/api/ping`)

**404 errors?**
- Verify Root Directory is `frontend` for static site

---

For detailed instructions, see `RENDER_DEPLOYMENT_GUIDE.md`

