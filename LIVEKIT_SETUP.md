# LiveKit Setup Guide

This guide explains how to set up LiveKit for the video meeting feature in Bolt.DIY.

## What is LiveKit?

LiveKit is the video conferencing backend that powers the `/meet` feature. You need to run a LiveKit server to use video meetings and coding mode.

---

## Option 1: LiveKit Cloud (Recommended for Beginners) ⭐

**Pros**: No local setup, always running, production-ready
**Cons**: Requires sign-up

### Steps:

1. **Sign up at LiveKit Cloud**
   - Go to [https://cloud.livekit.io/](https://cloud.livekit.io/)
   - Create a free account

2. **Create a Project**
   - Click "New Project"
   - Give it a name (e.g., "bolt-diy-meetings")

3. **Get Your Credentials**
   - In your project dashboard, go to **Settings** → **Keys**
   - Copy these three values:
     - **WebSocket URL** (e.g., `wss://your-project.livekit.cloud`)
     - **API Key** (e.g., `APIxxxxxxxxxxxx`)
     - **API Secret** (long string)

4. **Add to .env.local**
   ```bash
   # LiveKit Configuration
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=APIxxxxxxxxxxxx
   LIVEKIT_API_SECRET=your-secret-here
   ```

5. **That's it!** Restart your dev server and meetings will work.

---

## Option 2: Local LiveKit Server (For Development)

**Pros**: Free, runs locally, full control
**Cons**: Requires Docker, only works on your network

### Prerequisites:
- Docker installed ([Get Docker](https://docs.docker.com/get-docker/))

### Steps:

#### Using Docker (Easiest):

1. **Create docker-compose.yml** in project root:

```yaml
version: '3.9'

services:
  livekit:
    image: livekit/livekit-server:latest
    command: --config /etc/livekit.yaml
    ports:
      - "7880:7880"
      - "7881:7881"
      - "7882:7882/udp"
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml
```

2. **Create livekit.yaml** in project root:

```yaml
port: 7880
rtc:
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: false

keys:
  devkey: secret

# For development only
logging:
  level: debug
```

3. **Start LiveKit**:
   ```bash
   docker-compose up -d
   ```

4. **Add to .env.local**:
   ```bash
   # LiveKit Configuration (Local)
   LIVEKIT_URL=ws://localhost:7880
   LIVEKIT_API_KEY=devkey
   LIVEKIT_API_SECRET=secret
   ```

5. **Verify it's running**:
   ```bash
   # Check Docker logs
   docker-compose logs -f livekit

   # Should see: "starting LiveKit server"
   ```

#### Using Binary (Alternative):

1. **Download LiveKit Server**
   - Go to [LiveKit Releases](https://github.com/livekit/livekit/releases)
   - Download for your OS (Mac, Linux, Windows)

2. **Create livekit.yaml** (same as above)

3. **Run LiveKit**:
   ```bash
   ./livekit-server --config livekit.yaml
   ```

4. **Add to .env.local** (same as Docker setup above)

---

## Testing Your Setup

### 1. Start Your App
```bash
pnpm run dev
```

### 2. Test Meeting
1. Open http://localhost:5174/meet
2. Enter a room name (e.g., "test-room")
3. Click "Join"
4. ✅ You should see your video feed

### 3. Test Coding Mode
1. In the meeting, click **"Coding Mode"**
2. ✅ The coding interface should load
3. Send a message
4. ✅ No errors in console

---

## Troubleshooting

### Error: "Failed to connect to LiveKit"

**Check 1: Is LiveKit running?**
```bash
# For Docker
docker ps | grep livekit

# For binary
ps aux | grep livekit
```

**Check 2: Are credentials correct?**
- Verify `.env.local` has the right values
- Make sure no extra spaces or quotes

**Check 3: Port conflicts?**
```bash
# Check if port 7880 is in use
lsof -i :7880
```

### Error: "Invalid token"

**Solution**: Your API key/secret don't match
- Double-check `.env.local` values
- Restart your dev server after changing env vars

### Video not showing

**Check 1: Browser permissions**
- Allow camera/microphone access
- Check browser console for permission errors

**Check 2: HTTPS requirement**
- LiveKit requires HTTPS in production
- Use `ws://` for local dev, `wss://` for production

### Can't connect from other devices on network

**For Local Setup**:
1. Your firewall might be blocking ports
2. Use LiveKit Cloud instead (easier)
3. Or configure external IP in `livekit.yaml`:
   ```yaml
   rtc:
     use_external_ip: true
   ```

---

## Complete .env.local Example

Here's what your full `.env.local` should look like:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# LiveKit Configuration (Choose ONE option)

# Option 1: LiveKit Cloud (Recommended)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxx
LIVEKIT_API_SECRET=your-secret-here

# Option 2: Local LiveKit Server
# LIVEKIT_URL=ws://localhost:7880
# LIVEKIT_API_KEY=devkey
# LIVEKIT_API_SECRET=secret

# AI Provider (at least one required)
OPENAI_API_KEY=sk-proj-...
```

---

## Production Deployment

### Using LiveKit Cloud:
- Already production-ready
- Handles scaling automatically
- Use the same credentials

### Self-Hosting:
- Use HTTPS (`wss://` not `ws://`)
- Configure SSL certificates
- Set up proper firewall rules
- Use external IP for TURN/STUN
- See [LiveKit Deployment Docs](https://docs.livekit.io/deploy/)

---

## Additional Resources

- **LiveKit Documentation**: [https://docs.livekit.io/](https://docs.livekit.io/)
- **LiveKit Cloud**: [https://cloud.livekit.io/](https://cloud.livekit.io/)
- **LiveKit GitHub**: [https://github.com/livekit/livekit](https://github.com/livekit/livekit)

---

## Quick Commands

```bash
# Start local LiveKit (Docker)
docker-compose up -d

# Stop local LiveKit
docker-compose down

# View LiveKit logs
docker-compose logs -f livekit

# Restart after config changes
docker-compose restart livekit

# Check if port is available
lsof -i :7880
```

---

## FAQ

**Q: Do I need LiveKit for basic Bolt.DIY features?**
A: No, only if you want to use the `/meet` (video meetings) feature.

**Q: Which option should I choose?**
A: Use **LiveKit Cloud** for simplicity. Use **Local** if you want full control or no internet.

**Q: Can multiple people join the same room?**
A: Yes! Share the room URL with others and they can join.

**Q: Is it free?**
A: Yes, LiveKit Cloud has a generous free tier. Local is completely free.

**Q: Can I use my own TURN/STUN servers?**
A: Yes, configure in `livekit.yaml` under `rtc` section.

---

**Need Help?** Check the troubleshooting section above or visit [LiveKit Docs](https://docs.livekit.io/).
