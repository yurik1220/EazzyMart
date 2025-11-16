# Resend Email API Setup Guide for Render

## Why Resend?

- ✅ Simple and modern API
- ✅ Works perfectly on Render (no SMTP blocks)
- ✅ Free tier: 3,000 emails/month (vs SendGrid's 100/day)
- ✅ Better developer experience
- ✅ No complex sender verification
- ✅ Built for transactional emails

## Setup Steps

### 1. Create Resend Account

1. Go to: https://resend.com/
2. Click **"Start Building for Free"**
3. Sign up with GitHub or email
4. Verify your email address

### 2. Get API Key

1. Log in to Resend Dashboard: https://resend.com/api-keys
2. Click **"Create API Key"**
3. Name: `EazzyMart Production`
4. Permission: **Full Access** (or Sending access)
5. Click **"Add"**
6. **COPY THE API KEY** (starts with `re_`)

Example: `re_123456789_AbCdEfGhIjKlMnOpQrStUvWxYz`

### 3. Verify Domain (Optional but Recommended)

**For testing:** Skip this and use `onboarding@resend.dev` (included free)

**For production:**
1. Go to: **Domains** tab in Resend Dashboard
2. Click **"Add Domain"**
3. Enter your domain: `eazzymart.com` (or your actual domain)
4. Add DNS records as instructed
5. Wait for verification (usually 5-15 minutes)
6. Once verified, you can use: `noreply@eazzymart.com`

### 4. Add Environment Variables to Render

1. Go to **Render Dashboard**
2. Select your **Backend Service** (`eazzymart-backend`)
3. Click **"Environment"** tab
4. Click **"Add Environment Variable"**

Add these variables:

**Variable 1: API Key (Required)**
```
Key:   RESEND_API_KEY
Value: re_your_actual_api_key_here
```

**Variable 2: From Email (Optional)**
```
Key:   RESEND_FROM_EMAIL
Value: EazzyMart <onboarding@resend.dev>
```

Note: Use `onboarding@resend.dev` for testing. Once you verify your domain, change to your own email like `EazzyMart <noreply@yourdomain.com>`.

5. Click **"Save Changes"**
6. Render will automatically redeploy your backend

### 5. Test Email Sending

After Render redeploys (2-3 minutes):

1. Go to your frontend
2. Try creating an account
3. You should receive OTP email within seconds!

Check Resend Dashboard → **Emails** to see delivery status.

## Testing Without API Key (Current Mode)

**Right now** (without `RESEND_API_KEY` set):
- OTP is generated and stored
- Email send is skipped
- OTP appears in a popup on the frontend
- Allows testing registration flow

**After adding API key:**
- OTP sent via email (no popup)
- Professional email delivery
- Track emails in Resend dashboard

## Code Changes Made

### Backend (`capstone-backend/server.js`):
- ✅ Replaced `@sendgrid/mail` with `resend`
- ✅ Updated `/send-otp` endpoint to use Resend
- ✅ Updated `/send-email` endpoint to use Resend
- ✅ Falls back to showing OTP in response if Resend not configured

### Frontend (`frontend/pages/login.html`):
- ✅ Shows OTP in popup if `debug_otp` is returned (temporary for testing)

### Package.json:
- ✅ Replaced `@sendgrid/mail` with `resend`

## Environment Variables Summary

**Required for production:**
```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Optional (recommended for production):**
```env
RESEND_FROM_EMAIL=EazzyMart <noreply@yourdomain.com>
```

**Default if not set:**
```
FROM: EazzyMart <onboarding@resend.dev>
```

## Using Resend's Test Email

Resend provides `onboarding@resend.dev` for free testing:
- No domain verification needed
- Works immediately
- Perfect for development
- 3,000 emails/month free tier

## Troubleshooting

### "Invalid API Key" Error
- Check environment variable name: `RESEND_API_KEY` (case-sensitive)
- Verify API key starts with `re_`
- Regenerate key in Resend dashboard if needed

### No Email Received
1. Check **Resend Dashboard** → **Emails**
2. See delivery status (Sent, Delivered, Bounced, etc.)
3. Check spam folder
4. Verify recipient email is valid

### Still Getting debug_otp
- API key not set in Render environment variables
- Wait for backend to redeploy after setting env vars
- Check Render logs for "RESEND_API_KEY not set" warning

## Resend vs SendGrid

| Feature | Resend | SendGrid |
|---------|--------|----------|
| Free Tier | 3,000 emails/month | 100 emails/day |
| Setup | Very easy | Complex |
| Sender Verification | Optional (use onboarding@resend.dev) | Required |
| Works on Render | ✅ Yes | ✅ Yes |
| API Simplicity | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Developer Experience | Excellent | Good |

## Quick Start (No Domain)

1. Get API key from Resend
2. Add to Render environment variables:
   ```
   RESEND_API_KEY=re_your_key_here
   ```
3. Done! Emails will use `onboarding@resend.dev`

## Production Setup (With Domain)

1. Verify your domain in Resend
2. Update environment variable:
   ```
   RESEND_FROM_EMAIL=EazzyMart <noreply@yourdomain.com>
   ```
3. Professional branded emails!

## Testing Locally

Before pushing to Render, test locally:

1. Create `.env` file in `capstone-backend/`:
   ```env
   RESEND_API_KEY=re_your_key_here
   RESEND_FROM_EMAIL=EazzyMart <onboarding@resend.dev>
   ```

2. Install dotenv:
   ```bash
   npm install dotenv
   ```

3. Add to top of `server.js`:
   ```javascript
   require('dotenv').config();
   ```

4. Test registration flow locally

## Resend Dashboard

Monitor your emails at: https://resend.com/emails
- See delivery status
- View email content
- Check bounce reasons
- Track open rates (if enabled)

## Support

- Resend Docs: https://resend.com/docs
- API Reference: https://resend.com/docs/api-reference
- Examples: https://resend.com/docs/send-with-nodejs

---

**Ready to deploy!** Just add the Resend API key to Render environment variables and emails will work automatically.

