# Supabase Database Configuration

This directory contains the database schema and setup instructions for Bolt.DIY.

## Quick Start

1. **Create a Supabase Project** at [supabase.com](https://supabase.com)

2. **Run the Migration**:
   - Open your Supabase SQL Editor
   - Copy and paste the contents of [`migrations/001_initial_schema.sql`](./migrations/001_initial_schema.sql)
   - Click "Run"

3. **Enable Anonymous Auth**:
   - Go to Authentication → Providers → Anonymous
   - Toggle it ON

4. **Get Your Credentials**:
   - Go to Settings → API
   - Copy your Project URL and Anon Key

5. **Configure Your App**:
   - Add credentials to `.env.local`:
     ```bash
     VITE_SUPABASE_URL=your_project_url
     VITE_SUPABASE_ANON_KEY=your_anon_key
     ```

## Full Documentation

See [SETUP.md](./SETUP.md) for detailed step-by-step instructions, troubleshooting, and maintenance guide.

## Files

- **`migrations/001_initial_schema.sql`** - Complete database schema with tables, indexes, RLS policies, functions, and triggers
- **`SETUP.md`** - Comprehensive setup guide with troubleshooting
- **`README.md`** - This file (quick reference)

## Database Schema

```
users
  ├── id (UUID) - Primary Key, references auth.users
  ├── email (TEXT) - User email (nullable for anonymous users)
  └── created_at (TIMESTAMPTZ)

chats
  ├── id (UUID) - Primary Key
  ├── user_id (UUID) - Foreign Key → users.id
  ├── title (TEXT)
  ├── url_id (TEXT) - Unique identifier for sharing
  ├── metadata (JSONB)
  ├── created_at (TIMESTAMPTZ)
  └── updated_at (TIMESTAMPTZ)

messages
  ├── id (TEXT) - Primary Key
  ├── chat_id (UUID) - Foreign Key → chats.id
  ├── role (TEXT) - 'user', 'assistant', 'system'
  ├── content (JSONB) - Message content
  ├── sequence (INTEGER) - Message order
  ├── annotations (JSONB) - Additional metadata
  └── created_at (TIMESTAMPTZ)

snapshots
  ├── id (UUID) - Primary Key
  ├── chat_id (UUID) - Foreign Key → chats.id
  ├── message_id (TEXT) - Associated message
  ├── files_json (JSONB) - File contents
  ├── summary (TEXT) - Snapshot description
  └── created_at (TIMESTAMPTZ)

final_versions
  ├── id (UUID) - Primary Key
  ├── user_id (UUID) - Foreign Key → auth.users.id
  ├── snapshot_id (UUID) - Foreign Key → snapshots.id
  ├── chat_id (UUID) - Foreign Key → chats.id
  ├── selected_at (TIMESTAMPTZ)
  ├── notes (TEXT)
  ├── created_at (TIMESTAMPTZ)
  └── updated_at (TIMESTAMPTZ)
```

## Security

All tables have **Row Level Security (RLS)** enabled:
- Users can only access their own data
- Anonymous users get temporary UUIDs
- Automatic data isolation per user

## Features

✅ Automatic user sync with `auth.users`
✅ Automatic timestamp management
✅ Cascade deletes for related data
✅ Optimized indexes for performance
✅ Anonymous authentication support
✅ Real-time subscriptions ready

## Support

For issues or questions:
1. Check [SETUP.md](./SETUP.md) troubleshooting section
2. Review Supabase logs in your dashboard
3. Verify `.env.local` configuration
