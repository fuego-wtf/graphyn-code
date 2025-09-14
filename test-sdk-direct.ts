/**
 * Direct SDK Test - Verify @anthropic-ai/claude-code package works independently
 *
 * This test bypasses ALL our wrapper code and tests the raw SDK directly
 * to determine if the package itself is functional or broken.
 */

import { query } from "@anthropic-ai/claude-code";
import fs from 'fs';

async function testSDKDirect() {
  console.log('🧪 Testing @anthropic-ai/claude-code SDK directly...');
  const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  console.log('📦 Package version:', packageJson.dependencies['@anthropic-ai/claude-code']);

  const startTime = Date.now();
  let messageCount = 0;
  let hasReceivedFirstMessage = false;

  // 30-second timeout for first message
  const firstMessageTimeout = setTimeout(() => {
    if (!hasReceivedFirstMessage) {
      console.error('❌ TIMEOUT: No first message from SDK after 30s');
      process.exit(1);
    }
  }, 30000);

  try {
    console.log('🚀 Starting SDK query...');

    const queryPromise = query({
      prompt: 'Say hello and tell me the current time. Keep it brief.',
      options: {
        maxTurns: 3,
        model: 'claude-3-5-sonnet-20241022',
        allowedTools: [], // No tools to simplify test
      }
    });

    console.log('⏳ Waiting for messages from SDK...');

    for await (const message of queryPromise) {
      messageCount++;

      if (!hasReceivedFirstMessage) {
        hasReceivedFirstMessage = true;
        clearTimeout(firstMessageTimeout);
        console.log('✅ First message received successfully');
        console.log(`⏱️  Time to first message: ${Date.now() - startTime}ms`);
      }

      console.log(`📨 Message #${messageCount}:`, {
        type: message.type,
        keys: Object.keys(message),
        timestamp: Date.now() - startTime
      });

      // Log message content if it's a result
      if (message.type === 'result') {
        console.log('📝 Result:', message);
        break;
      }

      // Log assistant messages
      if (message.type === 'assistant' && message.message) {
        console.log('🤖 Assistant response:', message.message.content?.[0]?.text?.slice(0, 100) + '...');
      }
    }

    clearTimeout(firstMessageTimeout);
    console.log(`✅ SDK test completed successfully in ${Date.now() - startTime}ms`);
    console.log(`📊 Total messages: ${messageCount}`);

  } catch (error) {
    clearTimeout(firstMessageTimeout);
    console.error('❌ SDK test failed:', error);
    console.error(`⏱️  Failed after: ${Date.now() - startTime}ms`);
    throw error;
  }
}

// Run the test
testSDKDirect()
  .then(() => {
    console.log('🎉 SDK test PASSED - Package is working');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 SDK test FAILED - Package is broken');
    console.error('Error details:', error.message);
    process.exit(1);
  });