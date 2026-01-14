#!/bin/bash

# Supabase Database Inspection Script
# Usage: 
#   PGPASSWORD=your_password ./inspect-supabase.sh
#   OR: ./inspect-supabase.sh (will prompt for password)

SUPABASE_HOST="db.ydbrmchrmdfzikjucqix.supabase.co"
# Use connection pooler port 6543 (transaction mode) - more reliable than direct connection
# Alternative: Use port 5432 for session mode pooler if 6543 doesn't work
SUPABASE_PORT="${SUPABASE_PORT:-6543}"
SUPABASE_DB="postgres"
SUPABASE_USER="postgres"

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Supabase Database Inspector${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to run a query
run_query() {
    local query="$1"
    local description="$2"
    
    echo -e "${YELLOW}${description}${NC}"
    echo "----------------------------------------"
    
    if [ -z "$PGPASSWORD" ]; then
        psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" -c "$query"
    else
        PGPASSWORD="$PGPASSWORD" psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" -c "$query"
    fi
    echo ""
}

# Check if password is provided
if [ -z "$PGPASSWORD" ]; then
    echo -e "${YELLOW}Note: Set PGPASSWORD environment variable to avoid password prompts${NC}"
    echo "Example: PGPASSWORD=your_password $0"
    echo ""
fi

echo -e "${BLUE}Using connection pooler on port ${SUPABASE_PORT}${NC}"
echo -e "${BLUE}If this fails, try: SUPABASE_PORT=5432 $0${NC}"
echo ""

# 1. List all tables
run_query "\dt" "📋 PUBLIC SCHEMA TABLES"

# 2. List all tables with details
run_query "\d+" "📊 TABLES WITH DETAILS"

# 3. List all indexes
run_query "SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;" "🔍 INDEXES"

# 4. List all policies (RLS)
run_query "SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;" "🔐 ROW LEVEL SECURITY POLICIES"

# 5. List all foreign keys
run_query "SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' ORDER BY tc.table_name;" "🔗 FOREIGN KEY CONSTRAINTS"

# 6. Table sizes and row counts
run_query "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size, (xpath('/row/cnt/text()', xml_count))[1]::text::int AS row_count FROM (SELECT schemaname, tablename, query_to_xml(format('select count(*) as cnt from %I.%I', schemaname, tablename), false, true, '') AS xml_count FROM pg_tables WHERE schemaname = 'public') t ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;" "📈 TABLE SIZES AND ROW COUNTS"

# 7. List all sequences
run_query "\ds" "🔢 SEQUENCES"

# 8. List all functions
run_query "SELECT routine_name, routine_type, data_type FROM information_schema.routines WHERE routine_schema = 'public' ORDER BY routine_name;" "⚙️ FUNCTIONS"

# 9. List all triggers
run_query "SELECT trigger_name, event_object_table, action_statement, action_timing, event_manipulation FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY event_object_table, trigger_name;" "⚡ TRIGGERS"

# 10. List all views
run_query "\dv" "👁️ VIEWS"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Inspection Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
