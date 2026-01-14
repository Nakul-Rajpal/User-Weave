#!/usr/bin/env python3
"""
Consolidate Supabase Migration Files
Parses all migration files and generates a single consolidated schema file
that matches the online database structure.
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Set, Tuple
from collections import defaultdict

MIGRATIONS_DIR = Path("supabase/migrations")
OUTPUT_FILE = "000_complete_schema_consolidated.sql"

# Track what we've seen
tables: Dict[str, str] = {}  # table_name -> CREATE TABLE statement
indexes: List[str] = []  # CREATE INDEX statements
policies: List[str] = []  # CREATE POLICY statements
functions: Dict[str, str] = {}  # function_name -> CREATE FUNCTION statement
triggers: List[str] = []  # CREATE TRIGGER statements
views: Dict[str, str] = {}  # view_name -> CREATE VIEW statement
extensions: Set[str] = set()  # extension names
rls_enabled: Set[str] = set()  # tables with RLS enabled
realtime_tables: Set[str] = set()  # tables added to realtime publication
comments: Dict[str, str] = {}  # object_name -> COMMENT statement

def extract_table_definition(content: str) -> Dict[str, str]:
    """Extract CREATE TABLE statements from SQL content."""
    tables = {}
    # Match CREATE TABLE IF NOT EXISTS or CREATE TABLE
    pattern = r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\((.*?)\);'
    matches = re.finditer(pattern, content, re.DOTALL | re.IGNORECASE)
    
    for match in matches:
        table_name = match.group(1)
        table_def = match.group(0)
        tables[table_name] = table_def
    return tables

def extract_indexes(content: str) -> List[str]:
    """Extract CREATE INDEX statements."""
    indexes = []
    pattern = r'CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[\w\.]+\s+ON\s+[^;]+;'
    matches = re.finditer(pattern, content, re.IGNORECASE)
    for match in matches:
        indexes.append(match.group(0))
    return indexes

def extract_policies(content: str) -> List[str]:
    """Extract CREATE POLICY statements."""
    policies = []
    # Match CREATE POLICY with multiline content
    pattern = r'CREATE\s+POLICY\s+"[^"]+"\s+ON\s+[^;]+;'
    matches = re.finditer(pattern, content, re.DOTALL | re.IGNORECASE)
    for match in matches:
        policies.append(match.group(0))
    return policies

def extract_functions(content: str) -> Dict[str, str]:
    """Extract CREATE FUNCTION statements."""
    functions = {}
    # Match CREATE OR REPLACE FUNCTION with body
    pattern = r'CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(\w+)\s*\([^)]*\)\s*RETURNS\s+[^$]+\$\$.*?\$\$'
    matches = re.finditer(pattern, content, re.DOTALL | re.IGNORECASE)
    for match in matches:
        func_name = match.group(1)
        func_def = match.group(0)
        functions[func_name] = func_def
    return functions

def extract_triggers(content: str) -> List[str]:
    """Extract CREATE TRIGGER statements."""
    triggers = []
    pattern = r'CREATE\s+TRIGGER\s+[^;]+;'
    matches = re.finditer(pattern, content, re.DOTALL | re.IGNORECASE)
    for match in matches:
        triggers.append(match.group(0))
    return triggers

def extract_views(content: str) -> Dict[str, str]:
    """Extract CREATE VIEW statements."""
    views = {}
    pattern = r'CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:public\.)?(\w+)\s+AS\s+[^;]+;'
    matches = re.finditer(pattern, content, re.DOTALL | re.IGNORECASE)
    for match in matches:
        view_name = match.group(1)
        view_def = match.group(0)
        views[view_name] = view_def
    return views

def extract_extensions(content: str) -> Set[str]:
    """Extract CREATE EXTENSION statements."""
    extensions = set()
    pattern = r'CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"'
    matches = re.finditer(pattern, content, re.IGNORECASE)
    for match in matches:
        extensions.add(match.group(1))
    return extensions

def extract_rls_enabled(content: str) -> Set[str]:
    """Extract tables with RLS enabled."""
    rls_tables = set()
    pattern = r'ALTER\s+TABLE\s+(?:public\.)?(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY'
    matches = re.finditer(pattern, content, re.IGNORECASE)
    for match in matches:
        rls_tables.add(match.group(1))
    return rls_tables

def extract_realtime_tables(content: str) -> Set[str]:
    """Extract tables added to realtime publication."""
    realtime = set()
    pattern = r'ALTER\s+PUBLICATION\s+supabase_realtime\s+ADD\s+TABLE\s+(?:public\.)?(\w+)'
    matches = re.finditer(pattern, content, re.IGNORECASE)
    for match in matches:
        realtime.add(match.group(1))
    return realtime

def parse_migration_file(file_path: Path) -> None:
    """Parse a single migration file and extract all schema elements."""
    print(f"Parsing: {file_path.name}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract different elements
    file_tables = extract_table_definition(content)
    tables.update(file_tables)
    
    file_indexes = extract_indexes(content)
    indexes.extend(file_indexes)
    
    file_policies = extract_policies(content)
    policies.extend(file_policies)
    
    file_functions = extract_functions(content)
    functions.update(file_functions)
    
    file_triggers = extract_triggers(content)
    triggers.extend(file_triggers)
    
    file_views = extract_views(content)
    views.update(file_views)
    
    file_extensions = extract_extensions(content)
    extensions.update(file_extensions)
    
    file_rls = extract_rls_enabled(content)
    rls_enabled.update(file_rls)
    
    file_realtime = extract_realtime_tables(content)
    realtime_tables.update(file_realtime)

def generate_consolidated_schema() -> str:
    """Generate the consolidated schema SQL file."""
    output = []
    
    # Header
    output.append("-- =============================================")
    output.append("-- Bolt.DIY Complete Database Schema (Consolidated)")
    output.append("-- =============================================")
    output.append("-- This file consolidates all migrations into a single schema")
    output.append("-- that matches the online database structure exactly.")
    output.append("-- Generated automatically from migration files.")
    output.append("-- =============================================")
    output.append("")
    
    # Extensions
    output.append("-- =============================================")
    output.append("-- EXTENSIONS")
    output.append("-- =============================================")
    for ext in sorted(extensions):
        output.append(f'CREATE EXTENSION IF NOT EXISTS "{ext}";')
    output.append("")
    
    # Tables
    output.append("-- =============================================")
    output.append("-- TABLES")
    output.append("-- =============================================")
    # Sort tables to ensure dependencies are created first
    # Simple heuristic: users first, then others
    sorted_tables = sorted(tables.items())
    if 'users' in tables:
        sorted_tables.insert(0, ('users', tables.pop('users')))
    
    for table_name, table_def in sorted_tables:
        output.append(f"-- Table: {table_name}")
        output.append(table_def)
        output.append("")
    
    # Indexes
    output.append("-- =============================================")
    output.append("-- INDEXES")
    output.append("-- =============================================")
    # Remove duplicates while preserving order
    seen_indexes = set()
    for idx in indexes:
        # Normalize for comparison (remove IF NOT EXISTS variations)
        normalized = re.sub(r'\s+IF\s+NOT\s+EXISTS\s+', ' ', idx, flags=re.IGNORECASE)
        if normalized not in seen_indexes:
            seen_indexes.add(normalized)
            output.append(idx)
    output.append("")
    
    # Functions
    output.append("-- =============================================")
    output.append("-- FUNCTIONS")
    output.append("-- =============================================")
    for func_name, func_def in sorted(functions.items()):
        output.append(f"-- Function: {func_name}")
        output.append(func_def)
        output.append("")
    
    # Triggers
    output.append("-- =============================================")
    output.append("-- TRIGGERS")
    output.append("-- =============================================")
    # Remove duplicates
    seen_triggers = set()
    for trigger in triggers:
        normalized = re.sub(r'\s+IF\s+NOT\s+EXISTS\s+', ' ', trigger, flags=re.IGNORECASE)
        if normalized not in seen_triggers:
            seen_triggers.add(normalized)
            output.append(trigger)
    output.append("")
    
    # Enable RLS
    output.append("-- =============================================")
    output.append("-- ENABLE ROW LEVEL SECURITY")
    output.append("-- =============================================")
    for table in sorted(rls_enabled):
        output.append(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;")
    output.append("")
    
    # Policies
    output.append("-- =============================================")
    output.append("-- ROW LEVEL SECURITY POLICIES")
    output.append("-- =============================================")
    # Group by table
    policies_by_table = defaultdict(list)
    for policy in policies:
        # Extract table name from policy
        match = re.search(r'ON\s+(?:public\.)?(\w+)', policy, re.IGNORECASE)
        if match:
            table_name = match.group(1)
            policies_by_table[table_name].append(policy)
    
    for table_name in sorted(policies_by_table.keys()):
        output.append(f"-- Policies for: {table_name}")
        for policy in policies_by_table[table_name]:
            output.append(policy)
        output.append("")
    
    # Views
    output.append("-- =============================================")
    output.append("-- VIEWS")
    output.append("-- =============================================")
    for view_name, view_def in sorted(views.items()):
        output.append(f"-- View: {view_name}")
        output.append(view_def)
        output.append("")
    
    # Realtime
    output.append("-- =============================================")
    output.append("-- ENABLE REALTIME")
    output.append("-- =============================================")
    for table in sorted(realtime_tables):
        output.append(f"ALTER PUBLICATION supabase_realtime ADD TABLE public.{table};")
    output.append("")
    
    # Footer
    output.append("-- =============================================")
    output.append("-- MIGRATION COMPLETE")
    output.append("-- =============================================")
    
    return "\n".join(output)

def main():
    """Main function to consolidate migrations."""
    print("Consolidating Supabase Migrations")
    print("=" * 50)
    
    if not MIGRATIONS_DIR.exists():
        print(f"Error: {MIGRATIONS_DIR} does not exist")
        return
    
    # Parse all migration files
    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    print(f"\nFound {len(migration_files)} migration files")
    
    for file_path in migration_files:
        parse_migration_file(file_path)
    
    # Print summary
    print("\n" + "=" * 50)
    print("Summary:")
    print(f"  Tables: {len(tables)}")
    print(f"  Indexes: {len(indexes)}")
    print(f"  Policies: {len(policies)}")
    print(f"  Functions: {len(functions)}")
    print(f"  Triggers: {len(triggers)}")
    print(f"  Views: {len(views)}")
    print(f"  Extensions: {len(extensions)}")
    print(f"  RLS Enabled Tables: {len(rls_enabled)}")
    print(f"  Realtime Tables: {len(realtime_tables)}")
    
    # Generate consolidated schema
    consolidated = generate_consolidated_schema()
    
    # Write to file
    output_path = MIGRATIONS_DIR / OUTPUT_FILE
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(consolidated)
    
    print(f"\n✅ Consolidated schema written to: {output_path}")
    print("\n⚠️  Note: This is generated from migration files.")
    print("   Please compare with online schema using capture-online-schema.sh")

if __name__ == "__main__":
    main()
