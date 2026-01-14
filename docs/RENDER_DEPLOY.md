# Render.com Deployment Guide

Complete guide for deploying both the main application and transcription agent to Render.com.

## Why Render.com?

- ✅ **Simple**: Deploy both services from one platform
- ✅ **Free tier**: 750 hours/month for both services
- ✅ **No configuration needed**: Works with existing Dockerfile and code
- ✅ **Automatic deployments**: Deploys on git push
- ✅ **Environment variables**: Easy management in dashboard

---

## Prerequisites

1. **GitHub account** with your repository pushed
2. **Render.com account** (sign up at https://render.com)
3. **Cloud services set up**:
   - LiveKit Cloud account with credentials
   - Supabase project with database
   - Deepgram API key
   - At least one AI provider API key (OpenAI, Groq, etc.)

---

## Deployment Steps

### Step 1: Sign Up on Render.com

1. Go to https://render.com
2. Click "Get Started"
3. Sign up with GitHub (easiest option)
4. Authorize Render to access your repositories

---

### Step 2: Deploy Main Application

1. **Click "New +" → "Web Service"**

2. **Connect Repository:**
   - Select your GitHub repository
   - Click "Connect"

3. **Configure Service:**
   - **Name**: `research-video-platform` (or your choice)
   - **Region**: Choose closest to your users (e.g., Oregon)
   - **Branch**: `main`
   - **Root Directory**: Leave blank (or `./` if prompted)
   - **Runtime**: `Node`
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `pnpm run dockerstart`
   - **Instance Type**: `Free`

4. **Add Environment Variables** (Click "Advanced" → "Add Environment Variable"):

```bash
NODE_ENV=production

VITE_SUPABASE_URL=https://ydbrmchrmdfzikjucqix.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkYnJtY2hybWRmemlranVjcWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNzkzNTMsImV4cCI6MjA3NTk1NTM1M30.aL9PqJ9wqOToLDdGX_ZIczAXBiM22fHsfkDQcPzKeJ0

LIVEKIT_URL=wss://hci-rmp8kqpi.livekit.cloud
LIVEKIT_API_KEY=APIXcuwbZ98aweN
LIVEKIT_API_SECRET=amvMnKb4fUDeHidJsobFBL6m1P5aC6eRoQJDl7Y9whuA

DEEPGRAM_API_KEY=your_deepgram_key_here

OPENAI_API_KEY=your_openai_key_here
# OR use another AI provider:
# GROQ_API_KEY=your_groq_key_here
```

5. **Click "Create Web Service"**

Render will:
- Clone your repository
- Install dependencies
- Build the application
- Start the server

**Deployment takes ~5-10 minutes**

---

### Step 3: Deploy Transcription Agent

1. **Click "New +" → "Background Worker"**

2. **Connect Repository:**
   - Select the same GitHub repository
   - Click "Connect"

3. **Configure Worker:**
   - **Name**: `transcription-agent`
   - **Region**: Same as main app (Oregon)
   - **Branch**: `main`
   - **Root Directory**: `agents`
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Context**: `./`
   - **Instance Type**: `Free`

4. **Add Environment Variables:**

```bash
LIVEKIT_WS_URL=wss://hci-rmp8kqpi.livekit.cloud
LIVEKIT_API_KEY=APIXcuwbZ98aweN
LIVEKIT_API_SECRET=amvMnKb4fUDeHidJsobFBL6m1P5aC6eRoQJDl7Y9whuA
DEEPGRAM_API_KEY=your_deepgram_key_here
```

5. **Click "Create Background Worker"**

---

## Step 4: Verify Deployment

### Check Main Application:

1. Go to Render Dashboard → Your web service
2. Wait for "Live" status (green)
3. Click the URL (e.g., `https://research-video-platform.onrender.com`)
4. App should load!

### Check Transcription Agent:

1. Go to Render Dashboard → Your worker
2. Click "Logs" tab
3. Should see:
   ```
   🚀 Starting Transcription Agent
   📡 Connecting to LiveKit...
   ```

---

## Step 5: Test the Application

1. **Open your deployed URL**
2. **Create/join a meeting room**
3. **Speak** and verify transcription appears
4. **Test AI chat** functionality
5. **Test video/audio** works properly

---

## Important Notes

### Free Tier Limitations:

- **Web Service**: Sleeps after 15 minutes of inactivity
  - First request after sleep takes ~30 seconds to wake up
  - Subsequent requests are fast
- **Background Worker**: Runs 24/7 (no sleep)
- **Both services**: 750 hours/month combined

### Upgrading:

If you need 24/7 uptime with no sleeping:
- Upgrade to **Starter plan** ($7/month per service)
- Instant response times
- No cold starts

---

## Updating Your Deployment

### Automatic Deployments:

Render auto-deploys when you push to GitHub:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Render will automatically:
- Pull latest code
- Rebuild
- Redeploy

### Manual Deployment:

1. Go to Render Dashboard
2. Click your service
3. Click **"Manual Deploy"** → **"Deploy latest commit"**

---

## Troubleshooting

### Issue: Web service shows "Deploy failed"

**Solution:**
- Click on the deployment
- Check build logs for errors
- Common fixes:
  - Ensure `pnpm` is available (it is on Render)
  - Check environment variables are set
  - Verify build command is correct

### Issue: Transcription not working

**Solution:**
- Check worker logs for errors
- Verify LIVEKIT_WS_URL uses `wss://` (not `ws://`)
- Ensure Deepgram API key is valid
- Check LiveKit credentials match main app

### Issue: App takes long to load

**Solution:**
- This is normal on free tier (cold start after 15min inactivity)
- Keep the app "warm" by visiting it regularly
- OR upgrade to Starter plan for instant response

### Issue: Environment variable changes not applied

**Solution:**
- Go to service → "Environment" tab
- Update variable
- Click "Save Changes"
- Render will auto-redeploy

---

## Environment Variables Reference

### Main Application:

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `LIVEKIT_URL` | Yes | LiveKit WebSocket URL (wss://) |
| `LIVEKIT_API_KEY` | Yes | LiveKit API key |
| `LIVEKIT_API_SECRET` | Yes | LiveKit API secret |
| `DEEPGRAM_API_KEY` | Yes | Deepgram API key |
| `OPENAI_API_KEY` | Yes* | OpenAI API key |
| `GROQ_API_KEY` | Yes* | OR Groq API key |
| `ANTHROPIC_API_KEY` | Yes* | OR Anthropic API key |

*At least ONE AI provider is required

### Transcription Agent:

| Variable | Required | Description |
|----------|----------|-------------|
| `LIVEKIT_WS_URL` | Yes | LiveKit WebSocket URL (wss://) |
| `LIVEKIT_API_KEY` | Yes | LiveKit API key |
| `LIVEKIT_API_SECRET` | Yes | LiveKit API secret |
| `DEEPGRAM_API_KEY` | Yes | Deepgram API key |

---

## Cost Estimate

**Free Tier (750 hours/month):**
- Main app + transcription agent
- ~25 hours/day if both running
- Sufficient for development/testing
- **Cost: $0/month**

**Paid Tier ($7/month per service):**
- 24/7 uptime, no sleeping
- Faster response times
- Better for production
- **Cost: $14/month total**

Plus external API costs:
- LiveKit Cloud: Free (200 hours/month)
- Supabase: Free (500MB database)
- Deepgram: $0.0125/minute
- AI Provider: Variable (OpenAI/Groq/etc.)

---

## Production Checklist

Before going live:

- [ ] Both services deployed successfully
- [ ] Environment variables configured correctly
- [ ] Test video meeting works
- [ ] Test transcription works
- [ ] Test AI chat works
- [ ] Custom domain configured (optional)
- [ ] Monitoring/alerts set up
- [ ] Database backups enabled (Supabase)
- [ ] Test with multiple users
- [ ] Check logs for errors

---

## Support

- **Render Docs**: https://render.com/docs
- **Render Community**: https://community.render.com
- **LiveKit Docs**: https://docs.livekit.io
- **Supabase Docs**: https://supabase.com/docs

---

**Deployment is complete!** 🎉

Your application should now be live at your Render URL.
