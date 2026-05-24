/**
 * Event Streaming System for Real-Time Orchestration
 * 
 * PROCESS-008: Event Streaming Pipeline
 * Provides real-time event streaming for multi-agent orchestration with 
 * console output, progress tracking, and inter-agent communication.
 */

import { EventEmitter } from 'events';
import {
  AgentType,
  TaskExecution,
  type CanonicalOrchestrationEvent,
  type OrchestrationAlertThresholds,
  type OrchestrationEventInput,
  type OrchestrationEventKind,
  type OrchestrationRuntimeAlert,
  type OrchestrationTelemetrySnapshot,
  createCanonicalOrchestrationEvent,
  deriveOrchestrationRuntimeAlert
} from './types.js';

// ============================================================================
// EVENT TYPES AND INTERFACES
// ============================================================================

/**
 * Base event structure for all orchestration events
 */
export interface BaseOrchestrationEvent {
  id: string;
  timestamp: Date;
  executionId: string;
  source: string;
}

/**
 * Task lifecycle events
 */
export interface TaskEvent extends BaseOrchestrationEvent {
  type: 'task.started' | 'task.progress' | 'task.completed' | 'task.failed';
  taskId: string;
  agent: AgentType;
  data: {
    progress?: number;
    message?: string;
    result?: any;
    error?: string;
  };
}

/**
 * Agent communication events
 */
export interface AgentEvent extends BaseOrchestrationEvent {
  type: 'agent.message' | 'agent.status' | 'agent.error';
  agent: AgentType;
  data: {
    message?: string;
    status?: 'idle' | 'busy' | 'blocked' | 'error';
    recipient?: AgentType | 'broadcast';
    error?: string;
  };
}

/**
 * System orchestration events
 */
export interface SystemEvent extends BaseOrchestrationEvent {
  type: 'system.phase' | 'system.coordination' | 'system.complete';
  data: {
    phase?: string;
    message?: string;
    stats?: {
      activeAgents: number;
      completedTasks: number;
      totalTasks: number;
    };
  };
}

export type CanonicalOrchestrationEventStreamType =
  | 'orchestration.phase_transition'
  | 'orchestration.phase_gate'
  | 'orchestration.gate_resolved'
  | 'orchestration.task_started'
  | 'orchestration.task_progress'
  | 'orchestration.task_completed'
  | 'orchestration.progress'
  | 'orchestration.error'
  | 'telemetry.agent_spawn_failed'
  | 'telemetry.plan_approval_outcome'
  | 'telemetry.stuck_orchestration_alert';

/**
 * Canonical orchestration event envelope for mode-agnostic consumers.
 */
export interface CanonicalEvent extends BaseOrchestrationEvent {
  type: CanonicalOrchestrationEventStreamType;
  data: CanonicalOrchestrationEvent;
}

/**
 * Alert event emitted from telemetry snapshots or watchdog evaluation.
 */
export interface TelemetryAlertEvent extends BaseOrchestrationEvent {
  type: 'telemetry.orchestration_alert' | 'telemetry.stuck_orchestration_alert';
  data: OrchestrationRuntimeAlert;
}

/**
 * Union type for all possible events
 */
export type OrchestrationEvent = TaskEvent | AgentEvent | SystemEvent | CanonicalEvent | TelemetryAlertEvent;

// ============================================================================
// CONSOLE STREAMING INTERFACE
// ============================================================================

/**
 * Real-time console streaming interface
 */
export interface ConsoleStreamer {
  /**
   * Write text without newline
   */
  write(text: string): void;
  
  /**
   * Write line with newline
   */
  writeLine(text: string): void;
  
  /**
   * Clear current line
   */
  clearLine(): void;
  
  /**
   * Update current line in place
   */
  updateLine(text: string): void;
  
  /**
   * Show animated spinner with message
   */
  showSpinner(message: string): () => void;
  
  /**
   * Stream events as they happen
   */
  stream(events: AsyncIterable<OrchestrationEvent>): Promise<void>;
}

// ============================================================================
// EVENT STREAM IMPLEMENTATION
// ============================================================================

/**
 * Real-time event streaming system for orchestration
 */
export class EventStream extends EventEmitter {
  private eventQueue: OrchestrationEvent[] = [];
  private isStreaming: boolean = false;
  private executionId?: string;
  private streamingPromise?: Promise<void>;
  private streamingResolve?: () => void;
  
  constructor() {
    super();
    this.setMaxListeners(50); // Allow many subscribers
  }

  /**
   * Start streaming for a specific execution
   */
  startStreaming(executionId: string): void {
    this.executionId = executionId;
    this.isStreaming = true;
    this.eventQueue = [];
    
    // Create a promise that resolves when streaming completes
    this.streamingPromise = new Promise((resolve) => {
      this.streamingResolve = resolve;
    });
  }

  /**
   * Stop streaming and complete the execution
   */
  stopStreaming(): void {
    this.isStreaming = false;
    if (this.streamingResolve) {
      this.streamingResolve();
    }
  }

  /**
   * Emit an event to all subscribers
   */
  emitEvent(event: Omit<OrchestrationEvent, 'id' | 'timestamp' | 'executionId'>): void {
    const fullEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
      executionId: this.executionId || 'unknown',
    } as OrchestrationEvent;

    // Add to queue for async iteration
    this.eventQueue.push(fullEvent);
    
    // Emit to synchronous listeners
    this.emit('event', fullEvent);
    this.emit(fullEvent.type, fullEvent);
  }

  /**
   * Emit a versioned canonical orchestration event.
   */
  emitCanonicalEvent(event: OrchestrationEventInput): CanonicalOrchestrationEvent {
    const canonicalEvent = createCanonicalOrchestrationEvent({
      ...event,
      executionId: event.executionId ?? this.executionId ?? event.orchestrationId
    });

    this.emitEvent({
      type: streamTypeForCanonicalEvent(canonicalEvent.kind),
      source: canonicalEvent.source,
      data: canonicalEvent
    });

    return canonicalEvent;
  }

  /**
   * Derive and emit a runtime alert from a sanitized telemetry snapshot.
   */
  deriveAndEmitRuntimeAlert(
    snapshot: OrchestrationTelemetrySnapshot,
    thresholds?: OrchestrationAlertThresholds
  ): OrchestrationRuntimeAlert | null {
    const alert = deriveOrchestrationRuntimeAlert(snapshot, thresholds);
    if (alert) {
      this.emitRuntimeAlert(alert);
    }
    return alert;
  }

  /**
   * Emit a telemetry alert event for subscribers and async stream consumers.
   */
  emitRuntimeAlert(alert: OrchestrationRuntimeAlert): void {
    this.emitEvent({
      type: alert.kind === 'stuck' ? 'telemetry.stuck_orchestration_alert' : 'telemetry.orchestration_alert',
      source: 'orchestration-telemetry',
      data: alert
    });
  }

  /**
   * Get async iterator for streaming events
   */
  async *getEventStream(): AsyncIterableIterator<OrchestrationEvent> {
    let lastIndex = 0;
    
    while (this.isStreaming || lastIndex < this.eventQueue.length) {
      // Yield any new events
      while (lastIndex < this.eventQueue.length) {
        yield this.eventQueue[lastIndex];
        lastIndex++;
      }
      
      // If still streaming, wait a bit for new events
      if (this.isStreaming) {
        await this.sleep(50); // 50ms polling interval
      }
    }
  }

  /**
   * Wait for streaming to complete
   */
  async waitForCompletion(): Promise<void> {
    if (this.streamingPromise) {
      await this.streamingPromise;
    }
  }

  /**
   * Create console streamer with real-time output
   */
  createConsoleStreamer(): ConsoleStreamer {
    return new RealTimeConsoleStreamer(this);
  }

  // Helper methods
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// REAL-TIME CONSOLE STREAMER
// ============================================================================

/**
 * Real-time console output with streaming support
 */
export class RealTimeConsoleStreamer implements ConsoleStreamer {
  private eventStream: EventStream;
  private currentLine: string = '';
  private isAnimating: boolean = false;

  constructor(eventStream: EventStream) {
    this.eventStream = eventStream;
  }

  write(text: string): void {
    process.stdout.write(text);
  }

  writeLine(text: string): void {
    if (this.currentLine) {
      this.clearLine();
    }
    console.log(text);
    this.currentLine = '';
  }

  clearLine(): void {
    if (process.stdout.clearLine && process.stdout.cursorTo) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    } else {
      // Fallback for terminals without clear support
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
    }
    this.currentLine = '';
  }

  updateLine(text: string): void {
    this.clearLine();
    process.stdout.write(text);
    this.currentLine = text;
  }

  showSpinner(message: string): () => void {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    this.isAnimating = true;
    
    const interval = setInterval(() => {
      if (!this.isAnimating) {
        clearInterval(interval);
        return;
      }
      
      this.updateLine(`${frames[i]} ${message}`);
      i = (i + 1) % frames.length;
    }, 100);

    return () => {
      this.isAnimating = false;
      clearInterval(interval);
      this.clearLine();
    };
  }

  async stream(events: AsyncIterable<OrchestrationEvent>): Promise<void> {
    for await (const event of events) {
      this.handleEvent(event);
    }
  }

  /**
   * Handle individual events with appropriate formatting
   */
  private handleEvent(event: OrchestrationEvent): void {
    switch (event.type) {
      case 'task.started':
        this.writeLine(`🚀 @${event.agent}: ${event.data.message || 'Task started'}`);
        break;
        
      case 'task.progress':
        if (typeof event.data.progress === 'number') {
          const progressBar = this.createProgressBar(event.data.progress);
          this.updateLine(`🔄 @${event.agent}: ${progressBar} ${event.data.progress}%`);
        } else {
          this.updateLine(`🔄 @${event.agent}: ${event.data.message || 'Working...'}`);
        }
        break;
        
      case 'task.completed':
        this.writeLine(`✅ @${event.agent}: ${event.data.message || 'Task completed'}`);
        break;
        
      case 'task.failed':
        this.writeLine(`❌ @${event.agent}: ${event.data.error || 'Task failed'}`);
        break;
        
      case 'agent.message':
        this.writeLine(`💬 @${event.agent}: ${event.data.message}`);
        break;
        
      case 'agent.status':
        const statusEmoji = this.getStatusEmoji(event.data.status);
        this.updateLine(`${statusEmoji} @${event.agent}: ${event.data.status}`);
        break;
        
      case 'system.phase':
        this.writeLine(`\n🎯 ${event.data.phase}`);
        this.writeLine('═'.repeat(50));
        break;
        
      case 'system.complete':
        this.writeLine(`\n✅ ${event.data.message || 'Orchestration complete!'}`);
        if (event.data.stats) {
          const stats = event.data.stats;
          this.writeLine(`📊 Summary: ${stats.completedTasks}/${stats.totalTasks} tasks completed with ${stats.activeAgents} agents`);
        }
        break;

      case 'orchestration.phase_transition':
        this.writeLine(`\n🎯 ${event.data.phase || event.data.currentStepName || 'Phase transition'}`);
        break;

      case 'orchestration.phase_gate':
        this.writeLine(`⚠️ Gate pending: ${event.data.gate?.type || event.data.message || 'orchestration gate'}`);
        break;

      case 'orchestration.gate_resolved':
        this.writeLine(`✅ Gate resolved: ${event.data.gate?.type || event.data.message || 'orchestration gate'}`);
        break;

      case 'orchestration.task_started':
        this.writeLine(`🚀 @${event.data.agentId || 'agent'}: ${event.data.message || 'Task started'}`);
        break;

      case 'orchestration.task_progress':
      case 'orchestration.progress':
        if (typeof event.data.progress?.percentage === 'number') {
          const progressBar = this.createProgressBar(event.data.progress.percentage);
          this.updateLine(`🔄 ${progressBar} ${event.data.progress.percentage}%`);
        } else {
          this.updateLine(`🔄 ${event.data.message || 'Orchestration progress'}`);
        }
        break;

      case 'orchestration.task_completed':
        this.writeLine(`✅ @${event.data.agentId || 'agent'}: ${event.data.message || 'Task completed'}`);
        break;

      case 'orchestration.error':
      case 'telemetry.agent_spawn_failed':
        this.writeLine(`❌ ${event.data.message || 'Orchestration error'}`);
        break;

      case 'telemetry.plan_approval_outcome':
        this.writeLine(`⚠️ Plan approval: ${event.data.message || event.data.gate?.status || 'outcome recorded'}`);
        break;

      case 'telemetry.orchestration_alert':
      case 'telemetry.stuck_orchestration_alert':
        this.writeLine(`⚠️ ${event.data.message}`);
        break;
    }
  }

  /**
   * Create visual progress bar
   */
  private createProgressBar(progress: number, width: number = 20): string {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  /**
   * Get emoji for agent status
   */
  private getStatusEmoji(status?: string): string {
    switch (status) {
      case 'idle': return '⚪';
      case 'busy': return '🟡';
      case 'blocked': return '🔴';
      case 'error': return '💥';
      default: return '⚫';
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS FOR INTEGRATION
// ============================================================================

/**
 * Create a task event
 */
export function createTaskEvent(
  type: TaskEvent['type'],
  task: TaskExecution,
  data: TaskEvent['data'],
  source: string = 'orchestrator'
): Omit<TaskEvent, 'id' | 'timestamp' | 'executionId'> {
  return {
    type,
    source,
    taskId: task.id,
    agent: (task.agent || task.agentType || 'task-dispatcher') as AgentType,
    data,
  };
}

/**
 * Create an agent event
 */
export function createAgentEvent(
  type: AgentEvent['type'],
  agent: AgentType,
  data: AgentEvent['data'],
  source: string = 'orchestrator'
): Omit<AgentEvent, 'id' | 'timestamp' | 'executionId'> {
  return {
    type,
    source,
    agent,
    data,
  };
}

/**
 * Create a system event
 */
export function createSystemEvent(
  type: SystemEvent['type'],
  data: SystemEvent['data'],
  source: string = 'orchestrator'
): Omit<SystemEvent, 'id' | 'timestamp' | 'executionId'> {
  return {
    type,
    source,
    data,
  };
}

function streamTypeForCanonicalEvent(kind: OrchestrationEventKind): CanonicalOrchestrationEventStreamType {
  switch (kind) {
    case 'phase_transition':
      return 'orchestration.phase_transition';
    case 'phase_gate':
      return 'orchestration.phase_gate';
    case 'gate_resolved':
      return 'orchestration.gate_resolved';
    case 'task_started':
      return 'orchestration.task_started';
    case 'task_progress':
      return 'orchestration.task_progress';
    case 'task_completed':
      return 'orchestration.task_completed';
    case 'orchestration_error':
      return 'orchestration.error';
    case 'agent_spawn_failed':
      return 'telemetry.agent_spawn_failed';
    case 'plan_approval_outcome':
      return 'telemetry.plan_approval_outcome';
    case 'stuck_orchestration_alert':
      return 'telemetry.stuck_orchestration_alert';
    case 'orchestration_progress':
      return 'orchestration.progress';
  }
}

export default EventStream;
