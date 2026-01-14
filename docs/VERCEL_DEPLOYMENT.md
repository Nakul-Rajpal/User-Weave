# 🚀 Vercel Deployment Guide

Complete guide for deploying the Research Video Platform to Vercel.

## ⚠️ Important: Environment Variables Must Be Set Before Build

Vercel needs environment variables **during the build process** because Vite bakes them into the compiled JavaScript. Setting them after deployment won't work!

---

## 📋 Step 1: Prepare Your Repository

1. **Commit your changes** (if not already done):
   ```bash
   git add .
   git commit -m "Configure environment variables for production"
   git push origin main
   ```

2. **Verify `.env.local` is in `.gitignore`** (it should be - never commit secrets!)

---

## 🔧 Step 2: Set Up Vercel Project

### A. Using Vercel CLI (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Link your project**:
   ```bash
   vercel link
   ```

4. **Set environment variables** (all at once):
   ```bash
   # Supabase
   vercel env add VITE_SUPABASE_URL production
   # Paste: https://ydbrmchrmdfzikjucqix.supabase.co

   vercel env add VITE_SUPABASE_ANON_KEY production
   # Paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkYnJtY2hybWRmemlranVjcWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNzkzNTMsImV4cCI6MjA3NTk1NTM1M30.aL9PqJ9wqOToLDdGX_ZIczAXBiM22fHsfkDQcPzKeJ0

   # LiveKit
   vercel env add LIVEKIT_URL production
   # Paste: wss://hci-rmp8kqpi.livekit.cloud

   vercel env add LIVEKIT_API_KEY production
   # Paste: APIXcuwbZ98aweN

   vercel env add LIVEKIT_API_SECRET production
   # Paste: amvMnKb4fUDeHidJsobFBL6m1P5aC6eRoQJDl7Y9whuA

   # Deepgram
   vercel env add DEEPGRAM_API_KEY production
   # Paste: 95ba858e56a1fc65e2790ab78734291b074f0635

   # Add any AI provider keys you're using
   vercel env add OPENAI_API_KEY production
   # Paste your OpenAI key if needed

   vercel env add ANTHROPIC_API_KEY production
   # Paste your Anthropic key if needed
   ```

5. **Deploy**:
   ```bash
   vercel --prod
   ```
   
   **Alternative:** If `vercel --prod` doesn't work (command not found), use:
   ```bash
   pnpm run deploy
   ```
   or
   ```bash
   npx vercel --prod
   ```

### B. Using Vercel Dashboard

1. **Go to [vercel.com](https://vercel.com)** and sign in

2. **Import your Git repository**:
   - New Project → Import Git Repository
   - Select your repository
   - Framework: **Remix**

3. **Configure Environment Variables** (BEFORE clicking Deploy):

   Click "Environment Variables" and add these:

   **Required Variables:**

   | Variable Name | Value | Environment |
   |--------------|-------|-------------|
   | `VITE_SUPABASE_URL` | `https://ydbrmchrmdfzikjucqix.supabase.co` | Production, Preview, Development |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkYnJtY2hybWRmemlranVjcWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNzkzNTMsImV4cCI6MjA3NTk1NTM1M30.aL9PqJ9wqOToLDdGX_ZIczAXBiM22fHsfkDQcPzKeJ0` | Production, Preview, Development |
   | `LIVEKIT_URL` | `wss://hci-rmp8kqpi.livekit.cloud` | Production, Preview, Development |
   | `LIVEKIT_API_KEY` | `APIXcuwbZ98aweN` | Production, Preview, Development |
   | `LIVEKIT_API_SECRET` | `amvMnKb4fUDeHidJsobFBL6m1P5aC6eRoQJDl7Y9whuA` | Production, Preview, Development |
   | `DEEPGRAM_API_KEY` | `95ba858e56a1fc65e2790ab78734291b074f0635` | Production, Preview, Development |

   **Optional (AI Provider Keys):**

   Add any of these based on which AI providers you want to use:
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `GOOGLE_GENERATIVE_AI_API_KEY`
   - `GROQ_API_KEY`
   - `DEEPSEEK_API_KEY`
   - etc.

4. **Deploy**:
   - Click "Deploy"
   - Wait for the build to complete (~2-5 minutes)

---

## ✅ Step 3: Verify Deployment

1. **Check Build Logs**:
   - Look for: `✓ Build completed successfully!`
   - Verify no environment variable errors

2. **Test Your Application**:
   - Open your Vercel deployment URL
   - Try creating a meeting room
   - Verify LiveKit connection works
   - Check that Supabase authentication works

3. **Monitor Logs**:
   - Vercel Dashboard → Your Project → Logs
   - Check for any runtime errors

---

## 🔄 Updating Environment Variables

If you need to update environment variables **after** deployment:

1. **Using CLI**:
   ```bash
   vercel env rm LIVEKIT_API_KEY production
   vercel env add LIVEKIT_API_KEY production
   # Enter new value
   ```

2. **Using Dashboard**:
   - Project Settings → Environment Variables
   - Edit the variable
   - **Important**: Click "Redeploy" after changing variables!

3. **Trigger Redeploy**:
   ```bash
   vercel --prod --force
   ```

   Or in Dashboard: Deployments → Three dots → Redeploy

---

## 🚨 Troubleshooting

### Issue 1: "LIVEKIT_URL is undefined"

**Symptom:** Meeting rooms fail to connect

**Solution:**
1. Verify environment variable is set in Vercel dashboard
2. Ensure variable name is exactly `LIVEKIT_URL` (not `LIVEKIT_WS_URL`)
3. Redeploy after adding the variable

### Issue 2: "supabaseUrl is required"

**Symptom:** App crashes on load

**Solution:**
1. Check that `VITE_SUPABASE_URL` is set (note the `VITE_` prefix!)
2. Verify the URL format: `https://your-project.supabase.co`
3. Redeploy after fixing

### Issue 3: Build succeeds but app doesn't work

**Symptom:** No errors in build, but features don't work

**Solution:**
1. Environment variables were likely added **after** the build
2. Trigger a new deployment: `vercel --prod --force`
3. Verify variables are available during build (check build logs)

### Issue 4: "Cross-Origin-Opener-Policy" errors

**Symptom:** WebContainer or embedded content fails

**Solution:**
- Headers are already configured in [vercel.json](vercel.json:5-31)
- If still having issues, check browser console for specific errors

---

## 🔐 Security Best Practices

1. **Never commit `.env.local` or `.env` files** with real credentials
2. **Rotate API keys regularly** (especially after sharing screenshots)
3. **Use Vercel's secret management** - environment variables are encrypted at rest
4. **Limit API key permissions** where possible (e.g., LiveKit room-specific keys)
5. **Monitor usage** in LiveKit, Deepgram, and Supabase dashboards

---

## 📊 Vercel Configuration

Your project uses these Vercel settings (from [vercel.json](vercel.json)):

```json
{
  "buildCommand": "pnpm run build",
  "installCommand": "pnpm install",
  "framework": "remix"
}
```

**Key Headers Set:**
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

---

## 🔗 Custom Domain (Optional)

1. **Add Domain**:
   - Project Settings → Domains
   - Add your custom domain
   - Follow DNS configuration instructions

2. **Update LiveKit Allowed Origins** (if using custom domain):
   - LiveKit Dashboard → Project Settings → Allowed Origins
   - Add your Vercel domain (e.g., `your-app.vercel.app`)
   - Add your custom domain if using one

---

## 💰 Cost Estimates

**Vercel:**
- Hobby Plan: **Free** (includes 100GB bandwidth, 100 hours serverless)
- Pro Plan: $20/month (if you exceed free limits)

**Total Monthly Cost (assuming moderate usage):**
- Vercel: Free
- LiveKit: Free tier (10,000 participant minutes)
- Deepgram: Free tier (3,750 minutes)
- Supabase: Free tier

**Expected Cost for Small Team:** $0/month on free tiers

---

## 📚 Additional Resources

- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- [Remix on Vercel](https://vercel.com/docs/frameworks/remix)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [LiveKit Cloud Setup](https://docs.livekit.io/cloud/)

---

## 🆘 Still Having Issues?

1. Check the build logs in Vercel dashboard
2. Verify all environment variables are set correctly
3. Try redeploying: `vercel --prod --force`
4. Check LiveKit and Supabase dashboard for API errors
5. Review browser console for client-side errors

---

**Last Updated:** 2025-01-13
**Project:** Research Video Platform
**Framework:** Remix + Vite
