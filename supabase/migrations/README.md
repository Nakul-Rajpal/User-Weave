# Database Migrations

## Overview
This directory contains SQL migration files for the Bolt.DIY database schema changes.

## Migration Files

### 001_create_final_versions_table.sql
Creates the `final_versions` table to support the multi-user code merging feature.

**What it does:**
- Creates `final_versions` table with proper foreign keys
- Adds indexes for query performance
- Sets up Row Level Security (RLS) policies
- Adds automatic `updated_at` timestamp handling
- Enforces ONE final version per user globally

**To apply:**
```bash
# Using Supabase CLI (if available)
supabase db push

# OR manually via Supabase Dashboard:
# 1. Go to your Supabase project dashboard
# 2. Navigate to SQL Editor
# 3. Copy and paste the contents of 001_create_final_versions_table.sql
# 4. Click "Run"

# OR using psql:
psql -h <your-supabase-host> -U postgres -d postgres -f 001_create_final_versions_table.sql
```

### 001_rollback_final_versions_table.sql
Rollback script to undo the final_versions table creation.

**WARNING:** This will delete all final version selections!

**To rollback:**
```bash
# Using psql:
psql -h <your-supabase-host> -U postgres -d postgres -f 001_rollback_final_versions_table.sql

# OR via Supabase Dashboard SQL Editor
```

## Verification

After running the migration, verify it worked:

```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'final_versions'
);

-- Check table structure
\d public.final_versions

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'final_versions';

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'final_versions';
```

## Migration Order
Always run migrations in numerical order:
1. 001_create_final_versions_table.sql
2. (future migrations...)

## Notes
- All migrations use `IF EXISTS` / `IF NOT EXISTS` clauses to be idempotent
- RLS is enabled to ensure users can only modify their own final versions
- The `user_id` UNIQUE constraint ensures only ONE final version per user
- Cascade deletes are configured to maintain referential integrity
