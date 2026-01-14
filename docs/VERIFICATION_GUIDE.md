# Schema Verification Guide

This guide helps you verify that the consolidated schema file (`000_complete_schema.sql`) matches your online Supabase database exactly.

## Quick Verification Steps

### Step 1: Run the Verification Script

```bash
PGPASSWORD=your_database_password ./supabase/scripts/verify-schema.sh
```

This will create a `schema-verification-report.txt` file with all online database details.

### Step 2: Compare with Schema Analysis

```bash
python3 supabase/scripts/analyze-schema.py
```

This analyzes the consolidated schema file and shows what it contains.

### Step 3: Run Comparison Tool

```bash
python3 supabase/scripts/compare-schemas.py
```

This compares the migration file with the verification report.

## Manual Verification Checklist

### Tables (Should be 15)
Verify these tables exist in your online database:
- [ ] admins
- [ ] chats
- [ ] final_version_discussions
- [ ] final_version_votes
- [ ] final_versions
- [ ] meeting_chat_messages
- [ ] meeting_transcripts
- [ ] messages
- [ ] prompt_templates
- [ ] room_design_chats
- [ ] snapshots
- [ ] summary_votes
- [ ] transcript_summaries
- [ ] users
- [ ] workflow_states

### Key Things to Verify

1. **Table Structures**: Each table should have the correct columns, data types, and constraints
2. **Indexes**: All 36 indexes should exist
3. **Policies**: All 54 RLS policies should be present
4. **Foreign Keys**: Should reference `public.users` (not `auth.users`) where appropriate
5. **Check Constraints**: 
   - `final_version_votes.vote` should be `('like', 'dislike')` (not the old approve/request_changes/comment)
   - `summary_votes.vote` should be `('agree', 'disagree', 'neutral')`
6. **Functions**: All 5 functions should exist with correct implementations
7. **Triggers**: All 6 triggers should be set up correctly
8. **Views**: Both views should exist with proper grants

## Common Issues to Check

### Issue 1: Missing Tables
If tables are missing, they may need to be created manually or the schema needs updating.

### Issue 2: Wrong Constraints
Check that `final_version_votes` has the updated `like/dislike` constraint, not the old one.

### Issue 3: Foreign Key References
All `user_id` columns should reference `public.users(id)`, not `auth.users(id)` (except where explicitly needed).

### Issue 4: Missing Policies
Every table with RLS enabled should have at least one policy.

## Using the Inspection Script

You can also use the existing inspection script:

```bash
PGPASSWORD=your_password ./supabase/scripts/inspect-supabase.sh
```

This will show you:
- All tables
- All indexes
- All policies
- All foreign keys
- All functions, triggers, and views

## Next Steps After Verification

1. If everything matches: ✅ Your schema is verified!
2. If there are differences: Update `000_complete_schema.sql` to match the online database
3. If tables are missing online: Run the migration file to create them
4. If extra tables exist online: Decide if they should be added to the schema or removed

## Notes

- The `auth` schema reference is expected (it's a Supabase system schema)
- Some tables may have been created manually and not be in migrations - that's okay if they're documented
- The verification report will show the exact state of your online database
