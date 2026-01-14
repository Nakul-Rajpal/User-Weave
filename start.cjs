#!/usr/bin/env node

/**
 * Production start script that loads environment variables
 * from .env.local before starting the server
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log(`
★═══════════════════════════════════════★
          B O L T . D I Y
         ⚡️  Starting  ⚡️
★═══════════════════════════════════════★
`);

// Check if .env.local exists
const envLocalPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envLocalPath)) {
  console.warn('⚠️  Warning: .env.local file not found');
  console.warn('   Using environment variables from system...\n');
}

// Load environment variables from .env.local
require('dotenv').config({ path: envLocalPath });

console.log('  Loading environment variables...');
console.log('  Starting Remix server...');
console.log('★═══════════════════════════════════════★\n');

// Find the remix-serve binary path
let remixServePath;
try {
  remixServePath = execSync('pnpm bin', { encoding: 'utf8' }).trim() + '/remix-serve';
  if (!fs.existsSync(remixServePath)) {
    // Fallback to node_modules/.bin
    remixServePath = path.join(__dirname, 'node_modules', '.bin', 'remix-serve');
  }
} catch {
  remixServePath = path.join(__dirname, 'node_modules', '.bin', 'remix-serve');
}

// Run remix-serve with the built files
const start = spawn(remixServePath, ['./build/server/index.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'production',
  },
  shell: false,
});

start.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

start.on('close', (code) => {
  process.exit(code || 0);
});

// Handle termination signals
process.on('SIGINT', () => {
  start.kill('SIGINT');
});

process.on('SIGTERM', () => {
  start.kill('SIGTERM');
});
