#!/usr/bin/env node

import { query } from '@anthropic-ai/claude-code';

console.log('🚀 Minimal Streaming Test - Algorithm Design\n');

// SIMPLIFIED ALGORITHM - Single message, no delays, minimal options
async function* generateSimpleMessage(userInput) {
  console.log('📝 Yielding single message...');
  yield {
    type: "user",
    message: {
      role: "user",
      content: `Please respond to: "${userInput}"`
    }
  };
  // NO follow-up messages, NO delays, NO complexity
}

const startTime = Date.now();
let accumulatedResponse = '';

try {
  console.log('⚡ Starting minimal streaming...\n');
  
  for await (const message of query({
    prompt: generateSimpleMessage("Hello, how are you?"),
    options: {
      maxTurns: 1,           // Minimal turns
      allowedTools: []       // No tools = faster response
    }
  })) {
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (message.type === 'assistant') {
      // IMMEDIATE STREAMING - this is the key part
      const content = message.message.content
        .map(block => block.type === 'text' ? block.text : '')
        .join('');
      
      if (content) {
        console.log(`[${elapsed}s] 📨 Chunk: ${content.length} chars`);
        // Stream immediately to user
        process.stdout.write(content);
        accumulatedResponse += content;
      }
    }
    
    else if (message.type === 'result') {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n\n✅ Complete in ${duration}s`);
      console.log(`📊 Total response: ${accumulatedResponse.length} chars`);
      break;
    }
    
    else {
      console.log(`[${elapsed}s] ℹ️  ${message.type} message`);
    }
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
}

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n⏰ Total execution time: ${totalTime}s`);
