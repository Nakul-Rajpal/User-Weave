#!/usr/bin/env node

/**
 * Production build script that loads environment variables
 * from .env.local before building with Vite
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log(`
★═══════════════════════════════════════★
          B O L T . D I Y
         ⚡️  Building  ⚡️
★═══════════════════════════════════════★
`);

// Check if .env.local exists
const envLocalPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envLocalPath)) {
  console.warn('⚠️  Warning: .env.local file not found');
  console.warn('   Using .env.example as fallback...\n');
}

// Load environment variables from .env.local
require('dotenv').config({ path: envLocalPath });

console.log('  Loading environment variables...');
console.log('  Building with Vite...');
console.log('★═══════════════════════════════════════★\n');

// Run remix vite:build with environment variables
const build = spawn('./node_modules/.bin/remix', ['vite:build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
  },
  shell: false,
});

build.on('error', (error) => {
  console.error('Failed to build:', error);
  process.exit(1);
});

build.on('close', (code) => {
  if (code === 0) {
    console.log(`
★═══════════════════════════════════════★
  ✓  Build completed successfully!
★═══════════════════════════════════════★
`);
  }
  process.exit(code || 0);
});

// Handle termination signals
process.on('SIGINT', () => {
  build.kill('SIGINT');
});

process.on('SIGTERM', () => {
  build.kill('SIGTERM');
});
