#!/usr/bin/env node

// Quick compatibility test script
const os = require('os');

console.log('🧪 Graphyn Compatibility Test\n');

// Platform detection
const platform = process.platform;
const fullySupported = ['darwin', 'linux'];
const experimental = ['win32'];

console.log(`Platform: ${platform}`);
console.log(`Architecture: ${process.arch}`);
console.log(`Node.js: ${process.version}`);
console.log(`OS: ${os.type()} ${os.release()}`);
console.log(`Shell: ${process.env.SHELL || 'unknown'}`);

// Platform support
if (fullySupported.includes(platform)) {
  console.log('✅ Platform: Fully supported');
} else if (experimental.includes(platform)) {
  console.log('⚠️  Platform: Experimental support');
} else {
  console.log('❌ Platform: Limited support');
}

// Node.js version
const nodeVersion = parseInt(process.version.split('.')[0].substring(1));
if (nodeVersion >= 16) {
  console.log('✅ Node.js: Compatible');
} else {
  console.log('❌ Node.js: Update required (needs 16+)');
}

// ESM dependencies check
try {
  console.log('\n📦 Testing key dependencies...');
  require('command-exists');
  console.log('✅ command-exists: Available');
} catch {
  console.log('❌ command-exists: Missing');
}

try {
  require('commander');
  console.log('✅ commander: Available');
} catch {
  console.log('❌ commander: Missing');
}

try {
  require('inquirer');
  console.log('✅ inquirer: Available');
} catch {
  console.log('❌ inquirer: Missing');
}

console.log('\n🔍 Run "graphyn doctor -v" for full diagnostic');