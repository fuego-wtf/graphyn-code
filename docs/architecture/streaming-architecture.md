# Real-Time Streaming Architecture

## Current Problem

The GraphynOrchestrator.ts uses `console.log()` which is **line-buffered**, causing all output to dump at once when the process completes instead of showing real-time updates **under the hood** during orchestration.

## Required Architecture Changes (Internal Streaming)

### 1. Replace Buffered Output with Unbuffered Streaming

**Current Broken Code in GraphynOrchestrator.orchestrate():**
```typescript
// packages/core/src/orchestrator/GraphynOrchestrator.ts lines 103-150
console.log('🔍 Analyzing repository structure...');
this.repoAnalysis = await this.repoAnalyzer.analyzeRepository();
console.log('📝 Goal captured:', goal.description);
console.log('🚀 Spawning agents with streaming enabled...\n');
```

**Required Fix - Internal Streaming:**
```typescript
// Use real-time terminal updates within orchestrate() method
process.stdout.write('🔍 Analyzing repository structure...\n');
// Show progress during repo analysis
process.stdout.write('\r🔄 Repository analysis... 25%');
process.stdout.write('\r\x1b[2K🔄 Repository analysis... 75%');
process.stdout.write('\r\x1b[2K✅ Repository analyzed\n');
```

### 2. Implement Real-Time Progress Updates

**Create:** `src/cli/ui/real-time-logger.ts`
```typescript
export class RealTimeLogger {
  private currentLine: string = '';
  
  // Update progress in place
  updateProgress(message: string, percentage?: number): void {
    const display = percentage ? `${message} ${percentage}%` : message;
    process.stdout.write(`\r\x1b[2K${display}`);
    this.currentLine = display;
  }
  
  // Add new line (permanent)
  logLine(message: string): void {
    if (this.currentLine) {
      process.stdout.write('\n');
    }
    process.stdout.write(`${message}\n`);
    this.currentLine = '';
  }
  
  // Force immediate output
  flush(): void {
    if (process.stdout.isTTY) {
      process.stdout.write('');
    }
  }
}
```

### 3. Connect Streaming Generators to Terminal Output (Internal to Orchestrator)

**Fix:** `packages/core/src/orchestrator/GraphynOrchestrator.ts lines 387-460`

**Current Issue:**
```typescript
// Line 387: Generator exists but doesn't output to user's terminal
const stream = await agent.executeStreaming(task);

// Line 460: Updates stay in memory, never reach console
async *executeStreaming(task: Task): AsyncGenerator<AgentUpdate> {
  yield { type: 'progress', message: 'Starting task...', progress: 0 };
  // These updates are consumed by Mission Control but not shown!
}
```

**Required Fix - Internal Streaming in spawnAndWatchAgent:**
```typescript
// Inside GraphynOrchestrator.spawnAndWatchAgent()
const stream = await agent.executeStreaming(task);
const logger = new RealTimeLogger();

for await (const update of stream) {
  // Update Mission Control state (existing)
  this.missionControl.updateAgent(agent.id, update);
  
  // NEW: Also show real-time updates to user
  switch (update.type) {
    case 'progress':
      logger.updateProgress(`[${agent.name}] ${update.message}`, update.progress);
      break;
    case 'status':
      logger.logLine(`✅ [${agent.name}] ${update.message}`);
      break;
    case 'error':
      logger.logLine(`❌ [${agent.name}] ${update.message}`);
      break;
  }
  logger.flush(); // Immediate output to user's terminal
}
```

### 4. Implement Mission Control Dashboard (Internal Updates)

**Fix:** `packages/core/src/orchestrator/GraphynOrchestrator.ts lines 50-53`

**Current Empty Implementation:**
```typescript
// In MissionControlStream class
private renderDashboard(): void {
  // Simplified implementation - does nothing!
  if (!this.active) return;
}
```

**Required Implementation - Real-time Dashboard Updates:**
```typescript
private renderDashboard(): void {
  if (!this.active) return;
  
  // Only clear and redraw if terminal supports it
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[2J\x1b[0f'); // Clear screen, move to top
  }
  
  // Render header
  process.stdout.write('\n🚀 Graphyn Mission Control Dashboard\n');
  process.stdout.write('─'.repeat(50) + '\n');
  
  // Active agents status (using this.agents Map)
  process.stdout.write(`📊 Active Agents: ${this.agents.size}\n`);
  this.agents.forEach((agent) => {
    const agentData = this.agents.get(agent.id);
    const status = agentData?.status === 'executing' ? '🟢' : '🟡';
    const task = agentData?.currentOperation || 'Idle';
    process.stdout.write(`  ${status} ${agent.name}: ${task}\n`);
  });
  
  // Task queue status
  const totalTasks = this.taskGraph?.tasks?.length || 0;
  process.stdout.write(`📋 Total Tasks: ${totalTasks}\n`);
  
  process.stdout.write('\n');
}
```

### 5. ANSI Escape Sequences for Terminal Control

**Essential ANSI Codes:**
```typescript
export const ANSI = {
  // Cursor control
  CLEAR_SCREEN: '\x1b[2J',
  MOVE_TO_TOP: '\x1b[0f',
  CLEAR_LINE: '\x1b[2K',
  MOVE_UP: '\x1b[1A',
  CARRIAGE_RETURN: '\r',
  
  // Colors
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
  
  // Styles
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  BLINK: '\x1b[5m'
};
```

### 6. Progress Bar Implementation

**Create:** `src/cli/ui/progress-bar.ts`
```typescript
export class ProgressBar {
  private width: number = 40;
  private current: number = 0;
  private total: number = 100;
  
  constructor(total: number = 100, width: number = 40) {
    this.total = total;
    this.width = width;
  }
  
  update(current: number, message?: string): void {
    this.current = current;
    const percentage = Math.round((current / this.total) * 100);
    const filled = Math.round((current / this.total) * this.width);
    const empty = this.width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const display = `[${bar}] ${percentage}%${message ? ' ' + message : ''}`;
    
    process.stdout.write(`\r${display}`);
  }
  
  complete(message?: string): void {
    this.update(this.total, message);
    process.stdout.write('\n');
  }
}
```

### 7. Spinner Implementation

**Create:** `src/cli/ui/spinner.ts`
```typescript
export class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private interval: NodeJS.Timeout | null = null;
  private frameIndex = 0;
  private message = '';
  
  start(message: string): void {
    this.message = message;
    this.interval = setInterval(() => {
      const frame = this.frames[this.frameIndex];
      process.stdout.write(`\r${frame} ${this.message}`);
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 80);
  }
  
  stop(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (finalMessage) {
      process.stdout.write(`\r✅ ${finalMessage}\n`);
    } else {
      process.stdout.write(`\r\x1b[2K`);
    }
  }
}
```

## Critical Implementation Points

### 1. TTY Detection
Always check if output is going to a terminal:
```typescript
if (process.stdout.isTTY) {
  // Use ANSI escape sequences
  process.stdout.write('\r\x1b[2K' + message);
} else {
  // Plain text output for pipes/files
  console.log(message);
}
```

### 2. Graceful Degradation
```typescript
export const isInteractive = (): boolean => {
  return process.stdout.isTTY && process.env.CI !== 'true';
};
```

### 3. Signal Handling
```typescript
process.on('SIGINT', () => {
  // Clean up progress indicators
  process.stdout.write('\r\x1b[2K');
  process.exit(0);
});
```

## Files That Need Changes

### Primary Changes (Dev #1):
1. `packages/core/src/orchestrator/GraphynOrchestrator.ts`
   - Lines 103-150: Replace console.log with real-time process.stdout.write
   - Lines 377-407: Connect executeStreaming output to terminal via RealTimeLogger
   - Lines 50-53: Implement renderDashboard() with real-time agent status
   - Add throttled dashboard updates during orchestration

2. `packages/core/src/orchestrator/GraphynOrchestrator.ts` (MissionControlStream class)
   - Lines 23-54: Implement real-time dashboard rendering
   - Add agent progress tracking with terminal updates

### New Files to Create (Dev #1):
- `packages/core/src/ui/real-time-logger.ts` - Core streaming logger
- `packages/core/src/ui/progress-bar.ts` - Progress visualization
- `packages/core/src/ui/spinner.ts` - Loading indicators
- `packages/core/src/ui/terminal-renderer.ts` - Terminal control utilities

## Testing Strategy

The streaming implementation should be testable by:
1. Mocking process.stdout.write
2. Capturing ANSI escape sequences
3. Verifying timing of updates
4. Testing TTY vs non-TTY behavior

## Performance Considerations

1. **Throttle Updates**: Don't update more than 30fps (33ms intervals)
2. **Batch Writes**: Group multiple stdout.write calls
3. **Memory Management**: Clean up intervals and listeners
4. **CPU Usage**: Avoid complex calculations in tight loops

## User Experience Flow

When users run `graphyn "build auth system"`, they will see:

1. **Initial Analysis** - Real-time repository scanning with progress updates
2. **Agent Spawning** - Live agent creation with PID tracking
3. **Mission Control Dashboard** - Real-time agent status grid (auto-refreshing)
4. **Agent Progress** - Streaming updates from each Claude Code process
5. **Task Completion** - Live completion notifications

**All streaming happens automatically during the `orchestrate()` method execution - no separate commands needed.**

This architecture gives users the real-time streaming experience they expect from the Graphyn CLI, **handled completely under the hood** during orchestration.
