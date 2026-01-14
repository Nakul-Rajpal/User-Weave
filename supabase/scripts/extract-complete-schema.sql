-- Complete Schema Extraction SQL
-- Run this with: PGPASSWORD=password psql -h db.ydbrmchrmdfzikjucqix.supabase.co -p 6543 -d postgres -U postgres -f extract-complete-schema.sql > online-schema-complete.sql

-- Set output format
\set ON_ERROR_STOP on

-- Extensions
\echo '-- ============================================='
\echo '-- EXTENSIONS'
\echo '-- ============================================='
SELECT 'CREATE EXTENSION IF NOT EXISTS "' || extname || '";' 
FROM pg_extension 
WHERE extname != 'plpgsql' 
ORDER BY extname;

-- Tables with full definitions
\echo ''
\echo '-- ============================================='
\echo '-- TABLES'
\echo '-- ============================================='

-- Get all tables in public schema
SELECT 
    'CREATE TABLE IF NOT EXISTS public.' || tablename || ' (' || E'\n' ||
    string_agg(
        '  ' || column_name || ' ' || 
        CASE 
            WHEN data_type = 'USER-DEFINED' THEN udt_name
            WHEN data_type = 'ARRAY' THEN udt_name || '[]'
            ELSE data_type
        END ||
        CASE WHEN character_maximum_length IS NOT NULL 
            THEN '(' || character_maximum_length || ')'
            ELSE ''
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN column_default IS NOT NULL 
            THEN ' DEFAULT ' || column_default
            ELSE ''
        END,
        ',' || E'\n'
        ORDER BY ordinal_position
    ) || E'\n' || ');'
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Get table constraints (primary keys, unique, check)
\echo ''
\echo '-- ============================================='
\echo '-- TABLE CONSTRAINTS'
\echo '-- ============================================='

-- Primary keys
SELECT 'ALTER TABLE public.' || tc.table_name || 
       ' ADD CONSTRAINT ' || tc.constraint_name || 
       ' PRIMARY KEY (' || string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) || ');'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
    AND tc.constraint_type = 'PRIMARY KEY'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;

-- Unique constraints
SELECT 'ALTER TABLE public.' || tc.table_name || 
       ' ADD CONSTRAINT ' || tc.constraint_name || 
       ' UNIQUE (' || string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) || ');'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
    AND tc.constraint_type = 'UNIQUE'
    AND tc.constraint_name NOT LIKE '%_pkey'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;

-- Check constraints
SELECT 'ALTER TABLE public.' || tc.table_name || 
       ' ADD CONSTRAINT ' || tc.constraint_name || 
       ' CHECK (' || cc.check_clause || ');'
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public' 
    AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name, tc.constraint_name;

-- Foreign keys
\echo ''
\echo '-- ============================================='
\echo '-- FOREIGN KEYS'
\echo '-- ============================================='
SELECT 
    'ALTER TABLE public.' || tc.table_name || 
    ' ADD CONSTRAINT ' || tc.constraint_name || 
    ' FOREIGN KEY (' || kcu.column_name || ') ' ||
    'REFERENCES ' || ccu.table_schema || '.' || ccu.table_name || 
    '(' || ccu.column_name || ') ' ||
    CASE 
        WHEN rc.delete_rule = 'CASCADE' THEN 'ON DELETE CASCADE'
        WHEN rc.delete_rule = 'SET NULL' THEN 'ON DELETE SET NULL'
        WHEN rc.delete_rule = 'RESTRICT' THEN 'ON DELETE RESTRICT'
        ELSE ''
    END || ';'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_schema = 'public' 
    AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, tc.constraint_name;

-- Indexes
\echo ''
\echo '-- ============================================='
\echo '-- INDEXES'
\echo '-- ============================================='
SELECT indexdef || ';'
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Functions
\echo ''
\echo '-- ============================================='
\echo '-- FUNCTIONS'
\echo '-- ============================================='
SELECT pg_get_functiondef(oid) || ';'
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
ORDER BY proname;

-- Triggers
\echo ''
\echo '-- ============================================='
\echo '-- TRIGGERS'
\echo '-- ============================================='
SELECT 
    'CREATE TRIGGER ' || trigger_name || 
    ' ' || action_timing || ' ' || event_manipulation || 
    ' ON ' || event_object_schema || '.' || event_object_table || 
    ' FOR EACH ROW EXECUTE FUNCTION ' || action_statement || ';'
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Views
\echo ''
\echo '-- ============================================='
\echo '-- VIEWS'
\echo '-- ============================================='
SELECT definition || ';'
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- RLS Policies
\echo ''
\echo '-- ============================================='
\echo '-- ROW LEVEL SECURITY POLICIES'
\echo '-- ============================================='
SELECT 
    'CREATE POLICY "' || policyname || '" ON ' || 
    schemaname || '.' || tablename || 
    ' FOR ' || cmd || 
    CASE 
        WHEN qual IS NOT NULL THEN ' USING (' || qual || ')'
        ELSE ''
    END ||
    CASE 
        WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')'
        ELSE ''
    END || ';'
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Realtime tables
\echo ''
\echo '-- ============================================='
\echo '-- REALTIME PUBLICATION'
\echo '-- ============================================='
SELECT 'ALTER PUBLICATION supabase_realtime ADD TABLE public.' || tablename || ';'
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
ORDER BY tablename;
