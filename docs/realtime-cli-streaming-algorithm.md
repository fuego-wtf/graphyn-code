# Real-Time CLI Streaming Algorithm

## Overview
This document defines the algorithm for implementing real-time inference using Claude's headless CLI, replacing the broken Node.js SDK streaming.

## Problem Statement
- Node.js Claude Code SDK has a 70-second delay bug
- SDK streaming hangs indefinitely waiting for final "result" event
- CLI works perfectly with sub-4-second real-time streaming

## Solution Architecture

### 1. Core Streaming Engine
```typescript
interface StreamingEngine {
  // Real-time streaming with immediate chunk delivery
  streamQuery(message: string, callbacks: StreamingCallbacks): Promise<void>
  
  // Session-based multi-turn conversations
  streamConversation(sessionId: string, message: string): Promise<void>
  
  // Broadcast streaming to multiple listeners
  broadcastStream(message: string, listeners: StreamListener[]): Promise<void>
}
```

### 2. CLI Process Management
```bash
# Real-time streaming command
claude -p "user message" \
  --output-format=stream-json \
  --input-format=stream-json \
  --verbose
```

### 3. Streaming Flow Algorithm

#### Phase 1: Process Initialization
1. **Spawn Claude CLI** with streaming flags
2. **Configure pipes** for stdin/stdout/stderr
3. **Set up event handlers** for data, error, close
4. **Initialize buffer** for incomplete JSON lines

#### Phase 2: Input Processing  
1. **Format user input** as streaming JSON:
   ```json
   {
     "type": "user",
     "message": {
       "role": "user", 
       "content": [{"type": "text", "text": "user message"}]
     }
   }
   ```
2. **Send to stdin** and close input stream
3. **Start timeout timer** for response handling

#### Phase 3: Real-Time Output Processing
1. **Buffer management**:
   ```typescript
   let buffer = '';
   process.stdout.on('data', (data) => {
     buffer += data.toString();
     const lines = buffer.split('\n');
     buffer = lines.pop() || ''; // Keep incomplete line
     
     for (const line of lines) {
       if (line.trim()) processStreamLine(line);
     }
   });
   ```

2. **JSON parsing per line**:
   ```typescript
   function processStreamLine(line: string) {
     try {
       const message = JSON.parse(line);
       
       if (message.type === 'assistant') {
         // Extract and stream content immediately  
         const content = message.message.content
           .map(block => block.type === 'text' ? block.text : '')
           .join('');
         
         if (content) {
           onChunk(content);      // Stream immediately
           fullResponse += content;
         }
       }
       
       else if (message.type === 'result') {
         onComplete(fullResponse);  // Finalize
         resolve();
       }
     } catch (err) {
       // Ignore incomplete JSON - will complete on next chunk
     }
   }
   ```

#### Phase 4: Error Handling & Cleanup
1. **Process monitoring**:
   ```typescript
   process.on('error', (err) => {
     reject(new Error(`CLI spawn failed: ${err.message}`));
   });
   
   process.on('close', (code) => {
     if (code !== 0) {
       reject(new Error(`CLI exited with code ${code}`));
     }
   });
   ```

2. **Timeout handling**:
   ```typescript
   const timeout = setTimeout(() => {
     process.kill();
     reject(new Error('Streaming timeout'));
   }, 30000);
   ```

## Advanced Features

### Multi-Turn Conversations
```typescript
class ConversationSession {
  private process: ChildProcess;
  private messageQueue: Message[] = [];
  
  async sendMessage(content: string): Promise<void> {
    const message = this.formatMessage(content);
    this.process.stdin.write(JSON.stringify(message) + '\n');
  }
  
  async streamResponse(callbacks: StreamingCallbacks): Promise<void> {
    // Process streaming output with session context
  }
}
```

### Session Management
```typescript
interface SessionManager {
  createSession(config: SessionConfig): Promise<string>;
  getSession(id: string): ConversationSession;
  destroySession(id: string): Promise<void>;
  cleanupSessions(): Promise<void>;
}
```

### Parallel Streaming
```typescript
class ParallelStreamer {
  async streamToMultiple(
    message: string, 
    targets: StreamTarget[]
  ): Promise<void> {
    const promises = targets.map(target => 
      this.streamQuery(message, target.callbacks)
    );
    
    await Promise.allSettled(promises);
  }
}
```

## Performance Optimizations

### 1. Process Pooling
- Maintain pool of warm Claude processes
- Reuse processes for subsequent queries
- Auto-scale based on demand

### 2. Buffer Optimization  
- Use efficient string concatenation
- Minimize JSON parsing overhead
- Batch small chunks to reduce callbacks

### 3. Memory Management
- Limit response buffer size
- Stream to disk for large responses
- Garbage collect completed sessions

## Integration Points

### 1. QueryUnderstandingEngine
```typescript
// Replace broken SDK with CLI streaming
await claudeHeadlessStreamingService.streamGreeting(
  userQuery,
  { workingDirectory },
  (chunk) => process.stdout.write(chunk),    // Real-time output
  (full) => resolveUnderstanding(full)       // Final classification
);
```

### 2. Agent Orchestration
```typescript
// Stream agent responses in real-time
await agentService.executeWithStreaming(
  agentPrompt,
  (chunk) => broadcastToUI(chunk),          // Live updates
  (result) => completeTask(result)          // Task completion
);
```

### 3. UI Integration
```typescript
// WebSocket/SSE streaming to frontend
websocket.on('user_message', async (data) => {
  await streamingService.streamQuery(
    data.message,
    (chunk) => websocket.emit('ai_chunk', chunk),
    (full) => websocket.emit('ai_complete', full)  
  );
});
```

## Testing Strategy

### 1. Unit Tests
- Buffer management correctness
- JSON parsing edge cases  
- Error handling scenarios
- Session lifecycle

### 2. Integration Tests
- End-to-end streaming flow
- Multi-turn conversation accuracy
- Parallel streaming stability
- Performance benchmarks

### 3. Load Testing
- Concurrent session handling
- Memory usage under load
- Response time consistency
- Error recovery

## Monitoring & Observability

### Metrics
- **Latency**: Time to first chunk, full response
- **Throughput**: Messages/second, concurrent sessions  
- **Reliability**: Success rate, error frequency
- **Resource**: Memory, CPU, file descriptors

### Logging
```typescript
interface StreamingMetrics {
  sessionId: string;
  startTime: number;
  firstChunkTime?: number;
  completionTime?: number;
  chunkCount: number;
  totalBytes: number;
  errorCount: number;
}
```

This algorithm provides true real-time streaming with sub-second latency, replacing the broken SDK approach with a robust CLI-based solution.
