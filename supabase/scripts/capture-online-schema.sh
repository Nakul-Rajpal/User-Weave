#!/bin/bash

# Enhanced Supabase Schema Capture Script
# Captures complete database schema including tables, indexes, policies, functions, triggers, views
# Usage: PGPASSWORD=your_password ./capture-online-schema.sh

SUPABASE_HOST="db.ydbrmchrmdfzikjucqix.supabase.co"
SUPABASE_PORT="${SUPABASE_PORT:-6543}"
SUPABASE_DB="postgres"
SUPABASE_USER="postgres"
OUTPUT_FILE="online-schema-export.sql"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Supabase Schema Capture${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if password is provided
if [ -z "$PGPASSWORD" ]; then
    echo -e "${YELLOW}Note: Set PGPASSWORD environment variable${NC}"
    echo "Example: PGPASSWORD=your_password $0"
    echo ""
fi

echo -e "${BLUE}Connecting to: ${SUPABASE_HOST}:${SUPABASE_PORT}${NC}"
echo -e "${BLUE}Output file: ${OUTPUT_FILE}${NC}"
echo ""

# Function to run query and append to file
run_query_to_file() {
    local query="$1"
    local description="$2"
    
    echo -e "${YELLOW}Capturing: ${description}${NC}"
    
    if [ -z "$PGPASSWORD" ]; then
        psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" -t -A -c "$query" >> "$OUTPUT_FILE" 2>&1
    else
        PGPASSWORD="$PGPASSWORD" psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" -t -A -c "$query" >> "$OUTPUT_FILE" 2>&1
    fi
}

# Initialize output file
echo "-- =============================================" > "$OUTPUT_FILE"
echo "-- Online Supabase Schema Export" >> "$OUTPUT_FILE"
echo "-- Generated: $(date)" >> "$OUTPUT_FILE"
echo "-- Host: ${SUPABASE_HOST}:${SUPABASE_PORT}" >> "$OUTPUT_FILE"
echo "-- =============================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# 1. Extensions
echo -e "${YELLOW}1. Extensions${NC}"
echo "-- =============================================" >> "$OUTPUT_FILE"
echo "-- EXTENSIONS" >> "$OUTPUT_FILE"
echo "-- =============================================" >> "$OUTPUT_FILE"
if [ -z "$PGPASSWORD" ]; then
    psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" -t -A -c "SELECT 'CREATE EXTENSION IF NOT EXISTS \"' || extname || '\";' FROM pg_extension WHERE extname != 'plpgsql' ORDER BY extname;" >> "$OUTPUT_FILE" 2>&1
else
    PGPASSWORD="$PGPASSWORD" psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" -t -A -c "SELECT 'CREATE EXTENSION IF NOT EXISTS \"' || extname || '\";' FROM pg_extension WHERE extname != 'plpgsql' ORDER BY extname;" >> "$OUTPUT_FILE" 2>&1
fi
echo "" >> "$OUTPUT_FILE"

# 2. Use pg_dump for complete schema (if available)
echo -e "${YELLOW}2. Attempting pg_dump for complete schema...${NC}"
if command -v pg_dump &> /dev/null; then
    echo "-- =============================================" >> "$OUTPUT_FILE"
    echo "-- COMPLETE SCHEMA (from pg_dump)" >> "$OUTPUT_FILE"
    echo "-- =============================================" >> "$OUTPUT_FILE"
    
    if [ -z "$PGPASSWORD" ]; then
        PGPASSWORD="$PGPASSWORD" pg_dump -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" \
            --schema=public --schema-only --no-owner --no-privileges \
            --no-tablespaces --no-security-labels --no-comments >> "$OUTPUT_FILE" 2>&1
    else
        PGPASSWORD="$PGPASSWORD" pg_dump -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" \
            --schema=public --schema-only --no-owner --no-privileges \
            --no-tablespaces --no-security-labels >> "$OUTPUT_FILE" 2>&1
    fi
    echo "" >> "$OUTPUT_FILE"
else
    echo -e "${YELLOW}pg_dump not available, using detailed queries...${NC}"
    
    # 3. Tables with full definitions
    echo -e "${YELLOW}3. Tables${NC}"
    echo "-- =============================================" >> "$OUTPUT_FILE"
    echo "-- TABLES" >> "$OUTPUT_FILE"
    echo "-- =============================================" >> "$OUTPUT_FILE"
    
    # Get table creation statements
    if [ -z "$PGPASSWORD" ]; then
        psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" \
            -c "\d+ public.*" >> "$OUTPUT_FILE" 2>&1
    else
        PGPASSWORD="$PGPASSWORD" psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" \
            -c "\d+ public.*" >> "$OUTPUT_FILE" 2>&1
    fi
    echo "" >> "$OUTPUT_FILE"
    
    # 4. Indexes
    echo -e "${YELLOW}4. Indexes${NC}"
    echo "-- =============================================" >> "$OUTPUT_FILE"
    echo "-- INDEXES" >> "$OUTPUT_FILE"
    echo "-- =============================================" >> "$OUTPUT_FILE"
    run_query_to_file "SELECT indexdef || ';' FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;" "Indexes"
    echo "" >> "$OUTPUT_FILE"
    
    # 5. Functions
    echo -e "${YELLOW}5. Functions${NC}"
    echo "-- =============================================" >> "$OUTPUT_FILE"
    echo "-- FUNCTIONS" >> "$OUTPUT_FILE"
    echo "-- =============================================" >> "$OUTPUT_FILE"
    if [ -z "$PGPASSWORD" ]; then
        psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" \
            -c "\df+ public.*" >> "$OUTPUT_FILE" 2>&1
    else
        PGPASSWORD="$PGPASSWORD" psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" \
            -c "\df+ public.*" >> "$OUTPUT_FILE" 2>&1
    fi
    echo "" >> "$OUTPUT_FILE"
    
    # 6. Triggers
    echo -e "${YELLOW}6. Triggers${NC}"
    echo "-- =============================================" >> "$OUTPUT_FILE"
    echo "-- TRIGGERS" >> "$OUTPUT_FILE"
    echo "-- =============================================" >> "$OUTPUT_FILE"
    run_query_to_file "SELECT 'CREATE TRIGGER ' || trigger_name || ' ' || action_timing || ' ' || event_manipulation || ' ON ' || event_object_table || ' FOR EACH ROW EXECUTE FUNCTION ' || action_statement || ';' FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY event_object_table, trigger_name;" "Triggers"
    echo "" >> "$OUTPUT_FILE"
    
    # 7. Views
    echo -e "${YELLOW}7. Views${NC}"
    echo "-- =============================================" >> "$OUTPUT_FILE"
    echo "-- VIEWS" >> "$OUTPUT_FILE"
    echo "-- =============================================" >> "$OUTPUT_FILE"
    if [ -z "$PGPASSWORD" ]; then
        psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" \
            -c "\d+ public.*" | grep "View" >> "$OUTPUT_FILE" 2>&1 || true
    else
        PGPASSWORD="$PGPASSWORD" psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" \
            -c "\d+ public.*" | grep "View" >> "$OUTPUT_FILE" 2>&1 || true
    fi
    echo "" >> "$OUTPUT_FILE"
    
    # 8. Policies (RLS)
    echo -e "${YELLOW}8. RLS Policies${NC}"
    echo "-- =============================================" >> "$OUTPUT_FILE"
    echo "-- ROW LEVEL SECURITY POLICIES" >> "$OUTPUT_FILE"
    echo "-- =============================================" >> "$OUTPUT_FILE"
    run_query_to_file "SELECT 'CREATE POLICY \"' || policyname || '\" ON ' || schemaname || '.' || tablename || ' FOR ' || cmd || ' USING (' || COALESCE(qual::text, 'true') || ') WITH CHECK (' || COALESCE(with_check::text, 'true') || ');' FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;" "RLS Policies"
    echo "" >> "$OUTPUT_FILE"
fi

# 9. Get detailed table definitions using a more comprehensive approach
echo -e "${YELLOW}9. Detailed Table Definitions${NC}"
echo "-- =============================================" >> "$OUTPUT_FILE"
echo "-- DETAILED TABLE DEFINITIONS" >> "$OUTPUT_FILE"
echo "-- =============================================" >> "$OUTPUT_FILE"

# Get list of tables
TABLES=$(if [ -z "$PGPASSWORD" ]; then
    psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" -t -A -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
else
    PGPASSWORD="$PGPASSWORD" psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" -t -A -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
fi)

for table in $TABLES; do
    echo -e "${YELLOW}  - Table: ${table}${NC}"
    echo "-- Table: ${table}" >> "$OUTPUT_FILE"
    if [ -z "$PGPASSWORD" ]; then
        psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" \
            -c "\d+ public.${table}" >> "$OUTPUT_FILE" 2>&1
    else
        PGPASSWORD="$PGPASSWORD" psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" \
            -c "\d+ public.${table}" >> "$OUTPUT_FILE" 2>&1
    fi
    echo "" >> "$OUTPUT_FILE"
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Schema capture complete!${NC}"
echo -e "${GREEN}Output saved to: ${OUTPUT_FILE}${NC}"
echo -e "${GREEN}========================================${NC}"
