# Bolt.DIY Setup Guide for New Developers

Complete setup guide to get Bolt.DIY running on your machine in ~15 minutes.

---

## Prerequisites

Before you start, install:
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **pnpm** - Install with: `npm install -g pnpm`
- **Git** - [Download](https://git-scm.com/)

---

## Step 1: Clone & Install Dependencies (2 min)

```bash
# Clone the repository
git clone <repository-url>
cd bolt.diy

# Install dependencies
pnpm install
```

---

## Step 2: Database Setup (5 min)

### 2.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click **"New Project"**
3. Fill in:
   - **Name**: `bolt-diy` (or any name)
   - **Database Password**: Generate and save it
   - **Region**: Choose closest to you
4. Click **"Create new project"**
5. Wait ~2 minutes for provisioning

### 2.2 Run Database Migration

1. In Supabase dashboard, open **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Open `supabase/migrations/000_complete_schema.sql` from this project
4. Copy **all** the SQL code
5. Paste into SQL Editor
6. Click **"Run"** or press `Ctrl+Enter`
7. You should see: ✅ `Success. No rows returned`

### 2.3 Enable Anonymous Authentication

1. Go to **Authentication** → **Providers**
2. Scroll to **"Anonymous"**
3. Toggle it **ON**
4. Click **"Save"**
5. also uncheck email confirmation below it

### 2.4 Get API Credentials

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJhbGci...`) - for client-side operations
   - **service_role** key (starts with `eyJhbGci...`) - for server-side operations (keep this secret!)

---

## Step 3: Environment Configuration (2 min)

Create a `.env.local` file in the project root:

```bash
# Supabase Configuration (REQUIRED)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Server-side operations (keep secret!)

# LiveKit Configuration (REQUIRED for video meetings)
# See LIVEKIT_SETUP.md for detailed setup instructions
# Option 1: LiveKit Cloud (recommended)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxx
LIVEKIT_API_SECRET=your-secret-here

# Option 2: Local LiveKit Server (for development)
# LIVEKIT_URL=ws://localhost:7880
# LIVEKIT_API_KEY=devkey
# LIVEKIT_API_SECRET=secret

# AI Provider API Keys (At least ONE required)
# Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-...

# Optional: Add more AI providers
ANTHROPIC_API_KEY=sk-ant-...
```

**Important**:
- Replace the Supabase values with YOUR actual credentials from Step 2.4
- Add at least ONE AI provider API key (OpenAI recommended for testing)
- **For video meetings**: Follow [LIVEKIT_SETUP.md](./LIVEKIT_SETUP.md) to get LiveKit credentials (takes 5 minutes)

---

## Step 4: Start Development Server (1 min)

```bash
pnpm run dev
```

The app will start at: **http://localhost:5174**

---

## Step 5: Verify Everything Works (5 min)

### Test 1: Basic Chat
1. Open http://localhost:5174
2. You should see "Where ideas begin"
3. Type a message: "create a simple react button"
4. Click Send
5. ✅ AI should respond and generate code

### Test 2: Authentication
1. Check browser console (F12)
2. You should NOT see any authentication errors
3. ✅ No red errors about Supabase

### Test 3: Database Persistence
1. Create a chat and send a message
2. Refresh the page
3. ✅ Your chat should still be there (loaded from database)

### Test 4: Meeting Feature (Requires LiveKit Setup)
**Note**: This test only works if you've set up LiveKit. See [LIVEKIT_SETUP.md](./LIVEKIT_SETUP.md) if you haven't.

1. Navigate to http://localhost:5174/meet
2. Click **"Create Room"** or enter a room name
3. Click **"Join"**
4. ✅ You should see your video feed
5. Click **"Coding Mode"** button
6. ✅ The coding interface should load
7. Send a message in coding mode
8. ✅ Message should save without errors

**If video meetings don't work**: You need to set up LiveKit first. Follow [LIVEKIT_SETUP.md](./LIVEKIT_SETUP.md) (takes 5 minutes).

---

## Common Issues & Fixes

### ❌ "Failed to fetch chats" or RLS error
**Solution**:
- Make sure you enabled Anonymous auth (Step 2.3)
- Verify `.env.local` has correct credentials (both anon key and service role key)
- Check that the migration ran successfully (Step 2.2)
- Verify RLS policies are enabled: Go to Supabase dashboard → Table Editor → Check that tables show "RLS enabled"

### ❌ "Table does not exist"
**Solution**: Re-run the migration script from Step 2.2

### ❌ "Invalid API key" for AI provider
**Solution**:
- Check your API key is correct in `.env.local`
- Make sure it starts with correct prefix (OpenAI: `sk-`, Anthropic: `sk-ant-`)
- Try a different AI provider

### ❌ Port 5174 already in use
**Solution**:
```bash
# Kill the process using port 5174
lsof -ti:5174 | xargs kill -9

# Or change port in vite.config.ts
```

### ❌ Module not found errors
**Solution**:
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

## Project Structure Overview

```
bolt.diy/
├── app/                          # Main application code
│   ├── routes/                   # Remix routes (pages)
│   │   ├── _index.tsx           # Home page (chat interface)
│   │   ├── meet.$roomId.tsx     # Video meeting room
│   │   └── meet_.$roomId_.code.tsx  # Coding mode in meeting
│   ├── components/               # React components
│   │   ├── chat/                # Chat UI components
│   │   ├── meet/                # Meeting components
│   │   └── workbench/           # Code editor & preview
│   ├── lib/                     # Business logic
│   │   ├── stores/              # State management (Nanostores)
│   │   ├── persistence/         # Database operations
│   │   └── supabase/            # Supabase client & auth
│   └── styles/                  # Global styles
├── supabase/                    # Database setup files
│   ├── migrations/              # SQL migration scripts
│   │   └── 000_complete_schema.sql  # Main database schema
│   └── scripts/                 # Database utility scripts
├── docs/                        # Documentation
│   ├── SETUP_GUIDE.md          # This file
│   ├── LIVEKIT_SETUP.md        # LiveKit configuration
│   └── CLAUDE.md               # Architecture overview
├── .env.local                   # Environment variables (create this)
└── package.json                 # Dependencies
```

---

## Key Features

✅ **AI-Powered Code Generation** - Uses OpenAI/Anthropic/Google
✅ **Live Preview** - See your code running in real-time
✅ **Video Meetings** - Built-in video chat with LiveKit
✅ **Coding Mode in Meetings** - Collaborate on code during meetings
✅ **Persistent Storage** - Chats saved to Supabase
✅ **Anonymous Users** - No signup required for meetings
✅ **Version Control** - Track different versions of your code

---

## Development Tips

### View Database Data
1. Go to Supabase dashboard → **Table Editor**
2. Browse your tables: `users`, `chats`, `messages`, etc.

### Debug Authentication
```javascript
// In browser console
localStorage.getItem('supabase.auth.token')  // Check if authenticated
```

### Clear Local Storage (Fresh Start)
```javascript
// In browser console
localStorage.clear()
location.reload()
```

### Watch Logs
```bash
# Terminal running pnpm run dev shows server logs
# Browser console (F12) shows client logs
```

---

## Next Steps

Now that you're set up:

1. **Explore the Code**:
   - Start with `app/routes/_index.tsx` (home page)
   - Check `app/lib/supabase/auth.ts` (authentication)
   - Look at `app/components/chat/Chat.client.tsx` (chat logic)

2. **Try Meeting Features**:
   - Create a meeting at `/meet`
   - Test video conferencing
   - Try coding mode collaboration

3. **Customize**:
   - Add your own AI prompts
   - Customize the UI theme
   - Add new features

4. **Read Documentation**:
   - `docs/VERIFICATION_GUIDE.md` - Database schema verification
   - `docs/CLAUDE.md` - Architecture overview
   - `docs/WORKFLOW_SETUP.md` - Workflow setup guide
   - Code comments throughout the project

---

## Getting Help

- **Database Issues**: See troubleshooting section above or `docs/VERIFICATION_GUIDE.md`
- **Architecture Questions**: Read `docs/CLAUDE.md`
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Remix Docs**: [remix.run/docs](https://remix.run/docs)

---

## Important Commands

```bash
# Start development server
pnpm run dev

# Build for production
pnpm run build

# Run tests (if configured)
pnpm run test

# Lint code
pnpm run lint

# Format code
pnpm run format
```

---

## 🎉 You're Ready!

You now have a fully functional Bolt.DIY development environment.

**What to try first**:
1. Create a chat and ask AI to build something
2. Test the meeting feature with coding mode
3. Explore the codebase and make changes
4. Have fun building! 🚀

---

**Questions?** Check the troubleshooting section above or review the detailed documentation in the `docs/` folder.
