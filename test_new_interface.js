#!/usr/bin/env node

// Test the new Claude Code style interface
import { main } from './src/cli-orchestrator.js';

// Test direct query
process.argv = ['node', 'cli', 'help me understand this repository'];

console.log('🧪 Testing new Claude Code style interface...\n');

main().then(() => {
  console.log('\n✅ Test completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});