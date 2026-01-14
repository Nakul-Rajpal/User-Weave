# Supabase Database Setup Guide

This guide will help you set up the database for Bolt.DIY in your Supabase project.

## Prerequisites

- A Supabase account ([sign up here](https://supabase.com))
- A new Supabase project created

## Step 1: Create a New Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in the project details:
   - **Name**: Choose a name (e.g., "bolt-diy")
   - **Database Password**: Generate a strong password (save it somewhere safe)
   - **Region**: Choose the closest region to your users
4. Click **"Create new project"**
5. Wait for the project to be provisioned (takes 1-2 minutes)

## Step 2: Run the Database Migration

1. In your Supabase project dashboard, navigate to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Copy the entire contents of [`migrations/001_initial_schema.sql`](./migrations/001_initial_schema.sql)
4. Paste it into the SQL Editor
5. Click **"Run"** (or press `Ctrl/Cmd + Enter`)
6. You should see: `Success. No rows returned`

This will create:
- ✅ All database tables (`users`, `chats`, `messages`, `snapshots`, `final_versions`)
- ✅ All indexes for query optimization
- ✅ All functions and triggers
- ✅ All Row Level Security (RLS) policies

## Step 3: Enable Anonymous Sign-Ins

This is crucial for the meeting feature to work:

1. In your Supabase dashboard, go to **Authentication** → **Providers**
2. Scroll down to find **"Anonymous"**
3. Toggle it **ON** (Enable anonymous sign-ins)
4. Click **"Save"**

## Step 4: Get Your API Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. You'll see two important values:

   **Project URL:**
   ```
   https://xxxxxxxxxxxxx.supabase.co
   ```

   **Anon/Public Key (anon key):**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. Copy both of these values

## Step 5: Configure Your Application

1. In your project root, create or update `.env.local`:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AI Provider API Keys (optional - add as needed)
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_google_key_here
```

2. Replace the values with your actual Supabase credentials

## Step 6: Verify Setup

1. Start your development server:
   ```bash
   pnpm run dev
   ```

2. Open your browser to `http://localhost:5174`

3. Try creating a new chat - it should work without errors

4. Try the meeting feature:
   - Navigate to `/meet`
   - Create or join a room
   - Click "Coding Mode"
   - Send a message - it should save to the database

## Database Schema Overview

### Tables

| Table | Description |
|-------|-------------|
| `users` | User profiles (synced with `auth.users`) |
| `chats` | Chat sessions |
| `messages` | Individual messages within chats |
| `snapshots` | Code snapshots at specific points in time |
| `final_versions` | User-selected final versions of their projects |

### Security

All tables have **Row Level Security (RLS)** enabled:
- Regular users can only access their own data
- Anonymous users (for meetings) get temporary UUIDs
- Data is isolated per user automatically

### Key Features

1. **Automatic User Sync**: When a user signs up (or signs in anonymously), a corresponding row is automatically created in `public.users`

2. **Automatic Timestamps**: `created_at` and `updated_at` are managed automatically

3. **Cascade Deletes**: When a chat is deleted, all related messages and snapshots are automatically deleted

4. **Indexes**: All common queries are optimized with indexes

## Troubleshooting

### Error: "new row violates row-level security policy"

**Solution**: Make sure:
1. Anonymous sign-ins are enabled (Step 3)
2. You're authenticated (check browser console for auth errors)
3. The migration script ran successfully

### Error: "relation does not exist"

**Solution**:
1. Re-run the migration script
2. Make sure you selected the correct project in Supabase dashboard

### Error: "Database error creating anonymous user"

**Solution**:
1. Make sure the `users.email` column is nullable (it should be after running the migration)
2. Check if anonymous sign-ins are enabled
3. Try this SQL fix:
   ```sql
   ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;
   ```

### Users Table Already Exists

If you've been testing and already have a `users` table, you may need to drop it first:

```sql
-- WARNING: This deletes all data. Only use in development!
DROP TABLE IF EXISTS public.final_versions CASCADE;
DROP TABLE IF EXISTS public.snapshots CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.chats CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Then re-run the migration script
```

## Maintenance

### Backing Up Your Database

1. In Supabase dashboard, go to **Database** → **Backups**
2. Backups are automatic, but you can create manual backups here

### Viewing Data

1. Go to **Table Editor** in Supabase dashboard
2. Select a table to view/edit data
3. You can also use the **SQL Editor** for custom queries

### Monitoring

1. Go to **Database** → **Query Performance**
2. Check for slow queries
3. Add indexes if needed for your specific use case

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)

## Need Help?

If you encounter issues:
1. Check the browser console for errors
2. Check Supabase logs in **Logs** → **Postgres Logs**
3. Verify your `.env.local` configuration
4. Ensure all migration steps completed successfully
