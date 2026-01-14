#!/usr/bin/env python3
"""
Analyze the consolidated schema file for completeness and correctness
"""

import re
from pathlib import Path
from collections import defaultdict

MIGRATION_FILE = Path("supabase/migrations/000_complete_schema.sql")

def analyze_schema():
    """Analyze the schema file for completeness."""
    if not MIGRATION_FILE.exists():
        print(f"Error: {MIGRATION_FILE} not found")
        return
    
    with open(MIGRATION_FILE, 'r') as f:
        content = f.read()
    
    # Extract all schema elements
    tables = set()
    indexes = defaultdict(list)
    policies = defaultdict(list)
    functions = set()
    triggers = defaultdict(list)
    views = set()
    constraints = defaultdict(list)
    
    # Tables
    table_pattern = r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)'
    for match in re.finditer(table_pattern, content, re.IGNORECASE):
        tables.add(match.group(1))
    
    # Indexes
    index_pattern = r'CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w\.]+)\s+ON\s+(?:public\.)?(\w+)'
    for match in re.finditer(index_pattern, content, re.IGNORECASE):
        index_name = match.group(1).split('.')[-1]
        table_name = match.group(2)
        indexes[table_name].append(index_name)
    
    # Policies
    policy_pattern = r'CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+(?:public\.)?(\w+)'
    for match in re.finditer(policy_pattern, content, re.IGNORECASE):
        policy_name = match.group(1)
        table_name = match.group(2)
        policies[table_name].append(policy_name)
    
    # Functions
    func_pattern = r'CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(\w+)\s*\('
    for match in re.finditer(func_pattern, content, re.IGNORECASE):
        functions.add(match.group(1))
    
    # Triggers
    trigger_pattern = r'CREATE\s+TRIGGER\s+(\w+)\s+.*?\s+ON\s+(?:public\.)?(\w+)'
    for match in re.finditer(trigger_pattern, content, re.DOTALL | re.IGNORECASE):
        trigger_name = match.group(1)
        table_name = match.group(2)
        triggers[table_name].append(trigger_name)
    
    # Views
    view_pattern = r'CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:public\.)?(\w+)'
    for match in re.finditer(view_pattern, content, re.IGNORECASE):
        views.add(match.group(1))
    
    # Check constraints
    check_pattern = r'CHECK\s+\(([^)]+)\)'
    for match in re.finditer(check_pattern, content, re.IGNORECASE):
        constraint_text = match.group(1)
        # Try to find which table it belongs to
        table_match = re.search(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)', content[:match.start()], re.IGNORECASE)
        if table_match:
            table_name = table_match.group(1)
            constraints[table_name].append(constraint_text[:50] + '...')
    
    # Print analysis
    print("=" * 60)
    print("SCHEMA ANALYSIS REPORT")
    print("=" * 60)
    print()
    
    print(f"📊 SUMMARY:")
    print(f"   Tables: {len(tables)}")
    print(f"   Indexes: {sum(len(idx) for idx in indexes.values())}")
    print(f"   Policies: {sum(len(p) for p in policies.values())}")
    print(f"   Functions: {len(functions)}")
    print(f"   Triggers: {sum(len(t) for t in triggers.values())}")
    print(f"   Views: {len(views)}")
    print()
    
    print(f"📋 TABLES ({len(tables)}):")
    for table in sorted(tables):
        idx_count = len(indexes.get(table, []))
        policy_count = len(policies.get(table, []))
        trigger_count = len(triggers.get(table, []))
        print(f"   • {table}")
        if idx_count > 0:
            print(f"     - {idx_count} indexes")
        if policy_count > 0:
            print(f"     - {policy_count} policies")
        if trigger_count > 0:
            print(f"     - {trigger_count} triggers")
    print()
    
    print(f"🔍 INDEXES:")
    for table in sorted(indexes.keys()):
        print(f"   {table}:")
        for idx in indexes[table]:
            print(f"     • {idx}")
    print()
    
    print(f"🔐 POLICIES:")
    for table in sorted(policies.keys()):
        print(f"   {table}:")
        for policy in policies[table]:
            print(f"     • {policy}")
    print()
    
    print(f"⚙️  FUNCTIONS ({len(functions)}):")
    for func in sorted(functions):
        print(f"   • {func}")
    print()
    
    print(f"⚡ TRIGGERS:")
    for table in sorted(triggers.keys()):
        print(f"   {table}:")
        for trigger in triggers[table]:
            print(f"     • {trigger}")
    print()
    
    print(f"👁️  VIEWS ({len(views)}):")
    for view in sorted(views):
        print(f"   • {view}")
    print()
    
    # Check for common issues
    print("🔍 VALIDATION CHECKS:")
    issues = []
    
    # Check if all tables have RLS enabled
    rls_pattern = r'ALTER\s+TABLE\s+(?:public\.)?(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY'
    rls_tables = set(re.findall(rls_pattern, content, re.IGNORECASE))
    missing_rls = tables - rls_tables
    if missing_rls:
        issues.append(f"⚠️  Tables without RLS: {missing_rls}")
    else:
        print("   ✅ All tables have RLS enabled")
    
    # Check for tables that should have policies
    tables_without_policies = tables - set(policies.keys())
    if tables_without_policies:
        issues.append(f"⚠️  Tables without policies: {tables_without_policies}")
    else:
        print("   ✅ All tables have policies")
    
    # Check for foreign key consistency
    fk_pattern = r'REFERENCES\s+(?:public\.)?(\w+)'
    fk_refs = set(re.findall(fk_pattern, content, re.IGNORECASE))
    missing_fk_tables = fk_refs - tables
    if missing_fk_tables:
        issues.append(f"⚠️  Foreign keys reference non-existent tables: {missing_fk_tables}")
    else:
        print("   ✅ All foreign key references are valid")
    
    if issues:
        print()
        for issue in issues:
            print(f"   {issue}")
    else:
        print("   ✅ No validation issues found")
    
    print()
    print("=" * 60)
    print("ANALYSIS COMPLETE")
    print("=" * 60)
    print()
    print("Next steps:")
    print("1. Run: PGPASSWORD=your_password ./verify-schema.sh")
    print("2. Compare the output with this analysis")
    print("3. Run: python3 compare-schemas.py")

if __name__ == "__main__":
    analyze_schema()
