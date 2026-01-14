# 🎙️ Transcription Agent Deployment Guide

This guide covers deploying the LiveKit transcription agent to various cloud platforms.

## 📋 Prerequisites

Before deploying, ensure you have:

1. **LiveKit Account & Credentials**
   - LiveKit Cloud URL (e.g., `wss://your-project.livekit.cloud`)
   - API Key and Secret from [LiveKit Dashboard](https://cloud.livekit.io)

2. **Deepgram API Key**
   - Get your API key from [Deepgram](https://deepgram.com)
   - Free tier includes 45,000 minutes per year

## 🚀 Deployment Options

### Option 1: Render.com (Recommended)

The project already has `render.yaml` configured for automatic deployment.

#### Steps:

1. **Sign up/Login to Render**
   - Go to [render.com](https://render.com)
   - Connect your GitHub repository

2. **Create New Blueprint**
   - Dashboard → New → Blueprint
   - Select your repository
   - Render will detect `render.yaml` automatically

3. **Set Environment Variables**

   For the **transcription-agent** service, set:
   ```
   LIVEKIT_WS_URL=wss://hci-rmp8kqpi.livekit.cloud
   LIVEKIT_API_KEY=APIXcuwbZ98aweN
   LIVEKIT_API_SECRET=amvMnKb4fUDeHidJsobFBL6m1P5aC6eRoQJDl7Y9whuA
   DEEPGRAM_API_KEY=95ba858e56a1fc65e2790ab78734291b074f0635
   ```

4. **Deploy**
   - Click "Apply" to deploy both services
   - Monitor logs to ensure agent connects successfully

#### Expected Output:
```
🎙️ Transcription agent connected to room: <room-name>
👥 Participants in room: <count>
```

---

### Option 2: Railway.app

1. **Install Railway CLI**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login & Initialize**
   ```bash
   railway login
   cd agents
   railway init
   ```

3. **Set Environment Variables**
   ```bash
   railway variables set LIVEKIT_WS_URL="wss://hci-rmp8kqpi.livekit.cloud"
   railway variables set LIVEKIT_API_KEY="APIXcuwbZ98aweN"
   railway variables set LIVEKIT_API_SECRET="amvMnKb4fUDeHidJsobFBL6m1P5aC6eRoQJDl7Y9whuA"
   railway variables set DEEPGRAM_API_KEY="95ba858e56a1fc65e2790ab78734291b074f0635"
   ```

4. **Deploy**
   ```bash
   railway up
   ```

---

### Option 3: Fly.io

1. **Install Fly CLI**
   ```bash
   # macOS
   brew install flyctl

   # Linux
   curl -L https://fly.io/install.sh | sh
   ```

2. **Create Fly App for Agent**
   ```bash
   cd agents
   fly launch --no-deploy
   ```

3. **Create fly.toml in agents directory**
   ```toml
   app = "transcription-agent"
   primary_region = "iad"

   [build]
     dockerfile = "Dockerfile"

   [env]
     LIVEKIT_WS_URL = "wss://hci-rmp8kqpi.livekit.cloud"

   [[services]]
     internal_port = 8080
     protocol = "tcp"
   ```

4. **Set Secrets**
   ```bash
   fly secrets set LIVEKIT_API_KEY="APIXcuwbZ98aweN"
   fly secrets set LIVEKIT_API_SECRET="amvMnKb4fUDeHidJsobFBL6m1P5aC6eRoQJDl7Y9whuA"
   fly secrets set DEEPGRAM_API_KEY="95ba858e56a1fc65e2790ab78734291b074f0635"
   ```

5. **Deploy**
   ```bash
   fly deploy
   ```

---

### Option 4: Docker (Self-Hosted)

#### Build and Run Locally:

```bash
cd agents

# Build Docker image
docker build -t transcription-agent .

# Run container
docker run -d \
  --name transcription-agent \
  -e LIVEKIT_WS_URL="wss://hci-rmp8kqpi.livekit.cloud" \
  -e LIVEKIT_API_KEY="APIXcuwbZ98aweN" \
  -e LIVEKIT_API_SECRET="amvMnKb4fUDeHidJsobFBL6m1P5aC6eRoQJDl7Y9whuA" \
  -e DEEPGRAM_API_KEY="95ba858e56a1fc65e2790ab78734291b074f0635" \
  transcription-agent

# View logs
docker logs -f transcription-agent
```

#### Using Docker Compose:

Create `agents/docker-compose.yml`:
```yaml
version: '3.8'

services:
  transcription-agent:
    build: .
    environment:
      - LIVEKIT_WS_URL=wss://hci-rmp8kqpi.livekit.cloud
      - LIVEKIT_API_KEY=APIXcuwbZ98aweN
      - LIVEKIT_API_SECRET=amvMnKb4fUDeHidJsobFBL6m1P5aC6eRoQJDl7Y9whuA
      - DEEPGRAM_API_KEY=95ba858e56a1fc65e2790ab78734291b074f0635
    restart: unless-stopped
    volumes:
      - ./transcripts:/app/transcripts
```

Then run:
```bash
docker-compose up -d
```

---

## 🧪 Testing the Deployment

1. **Test Locally First**
   ```bash
   cd agents

   # Install dependencies
   pip install -r requirements.txt

   # Run the agent
   python transcription_agent.py
   ```

2. **Create a LiveKit Room**
   - Use your main application to create a meeting room
   - Join with audio enabled

3. **Verify Agent Connection**
   - Check deployment logs for: `🎙️ Transcription agent connected to room`
   - Speak and verify transcriptions appear in real-time

---

## 🔍 Monitoring & Troubleshooting

### Common Issues:

#### 1. Agent not connecting
```
Error: Failed to connect to LiveKit room
```
**Solution:** Verify `LIVEKIT_WS_URL` uses `wss://` (not `ws://`) and credentials are correct.

#### 2. Deepgram API errors
```
Error: Invalid Deepgram API key
```
**Solution:** Check your Deepgram API key at [console.deepgram.com](https://console.deepgram.com)

#### 3. No transcriptions appearing
- Ensure participants have audio tracks enabled
- Check agent logs for: `🔊 New audio track from <participant>`

### Viewing Logs:

**Render:** Dashboard → transcription-agent → Logs
**Railway:** `railway logs`
**Fly.io:** `fly logs`
**Docker:** `docker logs -f transcription-agent`

---

## 📊 Cost Estimates

### Free Tier Limits:

- **LiveKit:** Free tier includes 10,000 participant minutes/month
- **Deepgram:** Free tier includes 45,000 minutes/year (~3,750 min/month)
- **Render:** Free tier includes 750 hours/month per service
- **Railway:** $5 free credit per month

### Recommended for Production:

- **Render Starter Plan:** $7/month (512 MB RAM)
- **Deepgram Pay-as-you-go:** $0.0043/minute

---

## 🔐 Security Best Practices

1. **Never commit `.env` files** to git
2. **Use environment variables** for all secrets
3. **Rotate API keys** regularly
4. **Monitor usage** to detect unauthorized access
5. **Use secure WebSocket** (wss://) for LiveKit connections

---

## 📚 Additional Resources

- [LiveKit Agents Documentation](https://docs.livekit.io/agents/)
- [Deepgram Python SDK](https://developers.deepgram.com/docs/python-sdk)
- [Render Documentation](https://render.com/docs)
- [Railway Documentation](https://docs.railway.app)

---

## 🆘 Support

If you encounter issues:

1. Check the [GitHub Issues](https://github.com/your-repo/issues)
2. Review LiveKit and Deepgram documentation
3. Verify all environment variables are set correctly
4. Test locally before deploying to production
