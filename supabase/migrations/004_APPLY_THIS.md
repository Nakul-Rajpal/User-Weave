# Fix RLS Issue for Room Design Forking

## Problem
Regular users couldn't fork room designs because RLS (Row Level Security) on the `chats` table prevented them from accessing the admin's master chat.

## Solution
Created two secure Postgres functions that bypass RLS to fetch room design master chats:
1. `get_room_design_master_chat(p_chat_id UUID)` - Fetches the master chat
2. `get_room_design_master_messages(p_chat_id UUID)` - Fetches the master messages

These functions are secure because they:
- Only work for chats in the `room_design_chats` table
- Only return data needed for forking
- Users still get their own independent copy

## How to Apply

### Step 1: Run the Migration
Go to Supabase Dashboard → SQL Editor → New Query

Copy and paste the contents of: `004_fix_fork_rls.sql`

Click **Run**

### Step 2: Verify Functions Were Created
Run this query to verify:

```sql
SELECT proname as function_name
FROM pg_proc
WHERE proname IN ('get_room_design_master_chat', 'get_room_design_master_messages');
```

You should see both functions listed.

### Step 3: Test the Feature
1. **As Admin:** Generate a room design from polling page
2. **As Regular User:**
   - Go to polling page
   - Click "View" on the design in Generation History
   - Should successfully create a fork and navigate to it
   - Should see the AI prompt auto-submit

## What Changed in Code

Modified `app/lib/persistence/supabase.ts`:
- Changed `forkRoomDesignChat` to use RPC functions instead of direct queries
- Now uses `supabase.rpc('get_room_design_master_chat', ...)`
- Now uses `supabase.rpc('get_room_design_master_messages', ...)`

This bypasses RLS while maintaining security.

## After Applying

The "Failed to fetch source chat: Cannot coerce the result to a single JSON object" error should be resolved, and all users will be able to fork room designs successfully!
