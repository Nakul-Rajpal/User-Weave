# Room Design Generation Migration Instructions

## Step 1: Check What Already Exists

Go to your Supabase Dashboard → SQL Editor → New Query

Run the contents of: `003_check_existing.sql`

This will show you:
- Which tables exist
- Which functions exist
- Which RLS policies exist

## Step 2: Run Missing Parts

Based on the results from Step 1, run the appropriate files:

### If tables DON'T exist:
Run: `003_part1_tables.sql`

### If RLS is NOT enabled or policies are missing:
Run: `003_part2_rls.sql`

### If functions DON'T exist or need updating:
Run: `003_part3_functions.sql`

## Quick Option: Run Everything

If you're not sure what exists, you can safely run all parts in order:
1. `003_part1_tables.sql` - Creates tables (IF NOT EXISTS)
2. `003_part2_rls.sql` - Enables RLS and creates policies (DROP IF EXISTS then CREATE)
3. `003_part3_functions.sql` - Creates functions (CREATE OR REPLACE)

All statements are designed to be safe to re-run.

## Expected Results After Migration

You should see:
- ✅ `prompt_templates` table with 8 columns
- ✅ `room_design_chats` table with 7 columns
- ✅ 6 RLS policies (2 on prompt_templates, 4 on room_design_chats)
- ✅ 2 helper functions (get_latest_room_design_chat, get_or_create_prompt_template)

## Verify Success

Run this query to verify everything was created:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('prompt_templates', 'room_design_chats');

-- Check functions
SELECT proname FROM pg_proc
WHERE proname IN ('get_latest_room_design_chat', 'get_or_create_prompt_template');

-- Check policies
SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('prompt_templates', 'room_design_chats');
```

## After Migration

Once the migration is complete:
1. Restart your development server
2. Test the AI Design Generation feature
3. All users should now be able to see and access design history
