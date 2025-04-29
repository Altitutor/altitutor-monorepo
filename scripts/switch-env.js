#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get command line arguments
const args = process.argv.slice(2);
const env = args[0]?.toLowerCase();

if (!env || (env !== 'local' && env !== 'remote')) {
  console.log('\n📋 Supabase Environment Switcher');
  console.log('--------------------------------');
  console.log('Usage: node scripts/switch-env.js [local|remote]');
  console.log('\nOr use npm scripts:');
  console.log('  npm run dev:local  - Run with local Supabase');
  console.log('  npm run dev:remote - Run with remote Supabase\n');
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const envLocal = path.join(rootDir, '.env.local');
const envRemote = path.join(rootDir, '.env.remote');
const envBackup = path.join(rootDir, '.env.local.backup');

// Ensure both env files exist
if (!fs.existsSync(envLocal)) {
  console.error('❌ Error: .env.local file not found. Please create it first.');
  process.exit(1);
}

if (!fs.existsSync(envRemote)) {
  console.error('❌ Error: .env.remote file not found. Please create it first.');
  process.exit(1);
}

try {
  // Create backup if it doesn't exist
  if (!fs.existsSync(envBackup)) {
    fs.copyFileSync(envLocal, envBackup);
  }

  if (env === 'local') {
    // Switch to local
    fs.copyFileSync(envBackup, envLocal);
    console.log('🔄 Switched to LOCAL Supabase environment');
  } else {
    // Create backup if needed
    if (!fs.existsSync(envBackup)) {
      fs.copyFileSync(envLocal, envBackup);
    }
    
    // Switch to remote
    fs.copyFileSync(envRemote, envLocal);
    console.log('🔄 Switched to REMOTE Supabase environment');
  }

  // Display current env
  console.log('\nCurrent environment:');
  const envContent = fs.readFileSync(envLocal, 'utf8');
  const url = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1] || 'Unknown';
  console.log(`🔗 Supabase URL: ${url}`);
  
  console.log('\n✅ Environment switched successfully');
  console.log('Run "npm run dev" to start your app with the new environment\n');
} catch (error) {
  console.error('❌ Error switching environments:', error.message);
  process.exit(1);
} 