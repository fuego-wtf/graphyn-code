#!/usr/bin/env node

/**
 * Fixed Claude Code Streaming Example
 * 
 * This replaces your original problematic code that was causing
 * the MaxListenersExceededWarning by properly handling text input.
 */

import { query } from "@anthropic-ai/claude-code";
import { readFileSync } from "fs";
import { ClaudeCodeInputHandler } from "./src/console/ClaudeCodeInputHandler.ts";

// Fix max listeners at startup
process.setMaxListeners(20);

const inputHandler = new ClaudeCodeInputHandler({
  prompt: 'graphyn> ',
  submitKeyword: 'SUBMIT',
  cancelKeyword: 'CANCEL'
});

// Proper message generator - only yields what's needed
async function* generateProperMessages() {
  // Get the user's complete input first
  console.log('📝 Enter your request (type SUBMIT on a new line when done):');
  
  try {
    const userInput = await inputHandler.startMultiLineInput();
    
    // Single message to Claude - no repeated iterations
    yield {
      type: "user",
      message: {
        role: "user",
        content: userInput.content
      }
    };
    
    // Optional: Include image if available
    try {
      const imageData = readFileSync("diagram.png", "base64");
      yield {
        type: "user",
        message: {
          role: "user", 
          content: [
            {
              type: "text",
              text: "Please also review this architecture diagram:"
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: imageData
              }
            }
          ]
        }
      };
    } catch (error) {
      // Image not available, continue without it
    }
    
  } catch (error) {
    console.log('Input cancelled or failed:', error.message);
    return;
  }
}

// Main execution with proper cleanup
async function main() {
  console.log('🤖 Starting Claude Code session...');
  console.log('This version properly handles input without creating event listener leaks.\n');
  
  let messageCount = 0;
  let conversationActive = true;
  
  // Cleanup function
  const cleanup = () => {
    inputHandler.cleanup();
    console.log('\n👋 Session ended cleanly!');
    process.exit(0);
  };
  
  // Handle interruption gracefully  
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);
  
  try {
    // SINGLE Claude Code session - no multiple iterations
    for await (const message of query({
      prompt: generateProperMessages(),
      options: {
        maxTurns: 10,
        allowedTools: ["Read", "Grep"]
      }
    })) {
      
      messageCount++;
      
      if (message.type === 'response') {
        console.log(`\n🧠 Claude (${messageCount}):`);
        console.log('─'.repeat(60));
        console.log(message.response.content);
        console.log('─'.repeat(60));
        
        // Check if Claude is done
        if (message.response.finished) {
          console.log('\n✅ Claude has finished the task!');
          
          // Ask if user wants to continue
          const continueChat = await inputHandler.startSingleLineInput(
            '\nWould you like to ask a follow-up question? (y/n): '
          );
          
          if (continueChat.toLowerCase() !== 'y' && continueChat.toLowerCase() !== 'yes') {
            conversationActive = false;
            break;
          } else {
            // Get follow-up question
            const followUp = await inputHandler.startSingleLineInput('What else would you like to know: ');
            if (followUp.trim()) {
              // This would normally require a new Claude session
              // For now, just acknowledge and end
              console.log(`\nReceived follow-up: "${followUp}"`);
              console.log('(Starting a new session would be needed for follow-ups)');
            }
            break;
          }
        }
      }
      
      // Safety limit to prevent infinite loops
      if (messageCount > 50) {
        console.log('\n⚠️ Message limit reached, ending session.');
        break;
      }
    }
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('\n⚠️ Session aborted by user');
    } else {
      console.error('\n❌ Session error:', error.message);
    }
  } finally {
    cleanup();
  }
}

// Alternative simple usage
async function simpleUsage() {
  console.log('🤖 Simple Claude Code Usage (no event listener issues):\n');
  
  // Get user input first
  const inputHandler = new ClaudeCodeInputHandler();
  const userQuery = await inputHandler.startSingleLineInput('Enter your query: ');
  
  if (!userQuery.trim()) {
    console.log('No query provided, exiting.');
    return;
  }
  
  // Single generator function
  async function* singleMessage() {
    yield {
      type: "user",
      message: {
        role: "user",
        content: userQuery
      }
    };
  }
  
  // Execute once
  try {
    for await (const message of query({
      prompt: singleMessage(),
      options: {
        maxTurns: 5,
        allowedTools: ["Read", "Grep"]
      }
    })) {
      if (message.type === 'response') {
        console.log('\nClaude:', message.response.content);
        if (message.response.finished) break;
      }
    }
  } finally {
    inputHandler.cleanup();
  }
}

// Choose which version to run
const args = process.argv.slice(2);
if (args.includes('--simple')) {
  simpleUsage();
} else {
  main();
}
