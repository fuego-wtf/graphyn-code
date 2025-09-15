#!/usr/bin/env node

import { query } from '@anthropic-ai/claude-code';

console.log('🔍 Testing Claude SDK streaming behavior...\n');

async function* generateMessages() {
  console.log('📝 Yielding first message to Claude...');
  // First message - exactly like the documentation
  yield {
    type: "user",
    message: {
      role: "user",
      content: "Say hello and count from 1 to 10, with a brief pause between each number."
    }
  };
  
  console.log('⏳ Waiting 2 seconds before follow-up...');
  // Wait for conditions or user input
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('📝 Yielding follow-up message...');
  // Follow-up message
  yield {
    type: "user",
    message: {
      role: "user",
      content: "Now please explain what you just did step by step."
    }
  };
}

const startTime = Date.now();
let messageCount = 0;
let firstChunkTime = null;

// Add a timeout warning
const timeoutWarning = setTimeout(() => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`⚠️  [${elapsed}s] Still waiting for first response from Claude...`);
}, 10000); // 10 second warning

const longTimeoutWarning = setTimeout(() => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`🚨 [${elapsed}s] This is taking unusually long - Claude SDK might be hanging`);
}, 30000); // 30 second warning

try {
  for await (const message of query({
    prompt: generateMessages(),
    options: {
      maxTurns: 10,
      allowedTools: ["Read", "Grep"]
    }
  })) {
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    messageCount++;
    
    console.log(`⏱️  [${elapsed}s] Message #${messageCount}: ${message.type}`);
    
    // Clear timeout warnings once we get ANY response
    clearTimeout(timeoutWarning);
    clearTimeout(longTimeoutWarning);
    
    // Log ALL message types for debugging
    if (message.type === 'assistant') {
      if (!firstChunkTime) {
        firstChunkTime = Date.now();
        console.log(`🎯 First assistant chunk received after ${((firstChunkTime - startTime) / 1000).toFixed(1)}s`);
      }
      
      const content = message.message.content
        .map(block => block.type === 'text' ? block.text : '')
        .join('');
      
      console.log(`📨 Assistant chunk (${content.length} chars): "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`);
      process.stdout.write(`\n🔴 STREAMING: ${content}\n`);
    }
    
    else if (message.type === 'user') {
      console.log(`👤 User message processed`);
    }
    
    else if (message.type === 'system') {
      console.log(`⚙️  System message: ${JSON.stringify(message).slice(0, 100)}...`);
    }
    
    else if (message.type === 'result') {
      console.log(`\n✅ Final result: ${message.subtype}`);
      if (message.result) {
        console.log(`📋 Result content (${message.result.length} chars): "${message.result.slice(0, 100)}${message.result.length > 100 ? '...' : ''}"`);
      }
      break;
    }
    
    else {
      console.log(`❓ Unknown message type: ${JSON.stringify(message).slice(0, 100)}...`);
    }
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n⏰ Total time: ${totalTime}s`);
console.log(`📊 Total messages: ${messageCount}`);
console.log(`🚀 First chunk delay: ${firstChunkTime ? ((firstChunkTime - startTime) / 1000).toFixed(1) : 'N/A'}s`);
