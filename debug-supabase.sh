#!/bin/bash

echo "🔍 Supabase Debug & Setup Script"
echo "================================="
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local not found!"
    echo "   Please create .env.local with your Supabase credentials"
    exit 1
fi

echo "✅ .env.local exists"

# Check environment variables
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d'=' -f2)
SUPABASE_KEY=$(grep "VITE_SUPABASE_ANON_KEY" .env.local | cut -d'=' -f2)

if [ -z "$SUPABASE_URL" ] || [ "$SUPABASE_URL" = "https://your-project-id.supabase.co" ]; then
    echo "❌ VITE_SUPABASE_URL not set or using placeholder"
    exit 1
fi

if [ -z "$SUPABASE_KEY" ] || [ "$SUPABASE_KEY" = "your-supabase-anon-key-here" ]; then
    echo "❌ VITE_SUPABASE_ANON_KEY not set or using placeholder"
    exit 1
fi

echo "✅ Environment variables configured"

# Test connection
echo ""
echo "🧪 Testing Supabase connection..."
curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/rest/v1/" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" > /tmp/supabase_test

HTTP_CODE=$(cat /tmp/supabase_test)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    echo "✅ Supabase connection successful (HTTP $HTTP_CODE)"
else
    echo "❌ Supabase connection failed (HTTP $HTTP_CODE)"
    echo "   Check your credentials and project status"
    exit 1
fi

echo ""
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Go to your Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/${SUPABASE_URL#https://*/}/sql"
echo ""
echo "2. Run this SQL query to check if tables exist:"
echo "   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
echo ""
echo "3. If tables don't exist, run the migration:"
echo "   Copy and paste: supabase/migrations/20241214000000_initial_schema.sql"
echo ""
echo "4. After migration, try signing up again!"
echo ""
echo "🔧 Common Issues:"
echo "- 422 error: Database schema not set up"
echo "- 400 error: Invalid credentials or user doesn't exist"
echo "- Connection refused: Wrong URL or project not active"
