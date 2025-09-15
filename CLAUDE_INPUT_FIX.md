# MaxListenersExceededWarning Fix for Claude Code SDK

## The Problem

You were getting this error:
```
(node:11358) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 
11 exit listeners added to [process]. MaxListeners is 10. 
Use emitter.setMaxListeners() to increase limit
```

## Root Cause

The issue was in your Claude Code SDK usage pattern:

```javascript
// PROBLEMATIC CODE - Creates new event listeners for each line
async function* generateMessages() {
  yield { type: "user", message: { role: "user", content: "Analyze this codebase" } };
  await new Promise(resolve => setTimeout(resolve, 2000)); // Each line creates listeners
  yield { type: "user", message: { /* ... */ } };
}

for await (const message of query({
  prompt: generateMessages(), // New generator = new listeners
  options: { maxTurns: 10, allowedTools: ["Read", "Grep"] }
})) {
  // Each iteration adds process exit listeners without cleanup
}
```

**Each newline/enter was treated as a separate Claude Code query**, creating multiple event listeners on the `process` object without proper cleanup.

## The Solution

### 1. Proper Text Input Handler

Use the new `ClaudeCodeInputHandler` class that:
- ✅ Collects complete multi-line input before sending to Claude
- ✅ Creates only ONE Claude Code session per conversation
- ✅ Properly manages event listeners with cleanup
- ✅ Supports both single-line and multi-line input modes

### 2. Usage Examples

#### Quick Fix (Single Line Input)
```javascript
import { ClaudeCodeInputHandler } from './src/console/ClaudeCodeInputHandler.js';

const handler = new ClaudeCodeInputHandler();
const userQuery = await handler.startSingleLineInput('Enter query: ');

// Single generator - no repeated event listeners
async function* singleMessage() {
  yield {
    type: "user",
    message: { role: "user", content: userQuery }
  };
}

try {
  for await (const message of query({
    prompt: singleMessage(),
    options: { maxTurns: 10, allowedTools: ["Read", "Grep"] }
  })) {
    if (message.type === 'response') {
      console.log('Claude:', message.response.content);
      if (message.response.finished) break;
    }
  }
} finally {
  handler.cleanup(); // Important: Clean up listeners
}
```

#### Multi-line Input Mode
```javascript
const handler = new ClaudeCodeInputHandler({
  submitKeyword: 'SUBMIT',
  cancelKeyword: 'CANCEL'
});

// User types multiple lines, then "SUBMIT" to send all at once
const submission = await handler.startMultiLineInput();
console.log('User submitted:', submission.content);
```

### 3. Running the Fixed Version

```bash
# Test the fixed implementation
cd /Users/resatugurulu/Developer/graphyn-workspace/code
node fixed-claude-streaming.mjs

# Or simple mode
node fixed-claude-streaming.mjs --simple
```

## Key Improvements

1. **No More Event Listener Leaks**: Each input session properly cleans up
2. **Complete Input Collection**: Multi-line input is collected before sending to Claude
3. **Single Claude Session**: One query session per conversation, not per line
4. **Proper Cleanup**: All event listeners are removed when done
5. **Better UX**: Users can compose complete thoughts before submitting

## How This Fixes Your Issue

- **Before**: Each `generateMessages()` call created new listeners → memory leak
- **After**: Single input collection → single Claude session → proper cleanup

The warning should completely disappear with this approach!

## Integration with Your Project

Replace your current input handling with:

```javascript
// Instead of your old streaming approach
import { executeClaudeWithProperInput } from './src/console/ClaudeCodeInputHandler.js';

// Use the fixed version
await executeClaudeWithProperInput("Your query here");
```

This solution is based on analyzing your existing codebase patterns in `src/clyde/interactive-shell.ts` and `src/console/ContinuousInput.ts`, but specifically tailored for Claude Code SDK usage.
