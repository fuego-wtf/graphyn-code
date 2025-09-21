#!/usr/bin/env node

import { createInteractiveSession } from './apps/cli/src/commands/interactive-session.js';

async function testInteractiveSession() {
  console.log('🧪 Testing Interactive Session with Streaming UI...\n');
  
  const session = createInteractiveSession();
  
  try {
    await session.handleDirectQuery('Hello, this is a test query');
  } catch (error) {
    console.error('Test failed:', error);
    session.cleanup();
    process.exit(1);
  }
}

testInteractiveSession();