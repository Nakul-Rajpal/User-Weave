#!/bin/bash

# Quick Supabase Query Script
# Usage: PGPASSWORD=your_password ./query-supabase.sh "SELECT * FROM users LIMIT 5;"

SUPABASE_HOST="db.ydbrmchrmdfzikjucqix.supabase.co"
# Use connection pooler port 6543 (transaction mode) - more reliable than direct connection
# Alternative: Use port 5432 for session mode pooler if 6543 doesn't work
SUPABASE_PORT="${SUPABASE_PORT:-6543}"
SUPABASE_DB="postgres"
SUPABASE_USER="postgres"

if [ -z "$1" ]; then
    echo "Usage: PGPASSWORD=your_password $0 \"SQL_QUERY\""
    echo ""
    echo "Examples:"
    echo "  $0 \"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';\""
    echo "  $0 \"\\dt\""
    echo "  $0 \"SELECT * FROM users LIMIT 5;\""
    exit 1
fi

QUERY="$1"

if [ -z "$PGPASSWORD" ]; then
    psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" -c "$QUERY"
else
    PGPASSWORD="$PGPASSWORD" psql -h "$SUPABASE_HOST" -p "$SUPABASE_PORT" -d "$SUPABASE_DB" -U "$SUPABASE_USER" -c "$QUERY"
fi
