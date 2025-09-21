import { EventEmitter } from 'events';
import type { Task } from '../task-graph-generator';
import type { TransparencyEngine, TransparencyEvent as TransparencyRecord } from './TransparencyEngine.js';

// Mock session type to avoid cross-package import
export interface ClaudeCodeSession {
  id: string;
  startTime?: Date;
}

export interface MissionControlOptions {
  id: string;
  startTime: Date;
  transparency?: TransparencyEngine;
}

export interface AgentStatus {
  id: string;
  type: 'backend' | 'frontend' | 'security' | 'test' | 'figma' | 'devops';
  name: string;
  status: 'idle' | 'active' | 'paused' | 'error' | 'complete';
  currentTask?: string;
  progress: number;
  currentOperation?: string;
  output?: string[];
  toolsUsed?: string[];
  needsFeedback?: boolean;
  feedbackRequest?: string;
  telemetry?: {
    cpuUsage?: number;
    memoryUsage?: number;
    durationMs?: number;
  };
  metrics: {
    tasksCompleted: number;
    tasksActive: number;
    errorCount: number;
    uptime: number;
  };
  lastActivity: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TaskStatus {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'complete' | 'error' | 'blocked';
  assignedAgent?: string;
  priority: number;
  dependencies: string[];
  progress: number;
  startTime?: Date;
  completedTime?: Date;
  errorMessage?: string;
  metrics: {
    estimatedDuration: number;
    actualDuration?: number;
    complexity: number;
  };
}

export interface SessionMetrics {
  sessionId: string;
  startTime: Date;
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  errorTasks: number;
  activeAgents: number;
  averageTaskDuration: number;
  successRate: number;
  resourceUsage: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  };
  dbLatencyMs: number;
  knowledgeEntries: number;
  knowledgeLastIngested?: Date;
}

export interface MissionControlEvent {
  type: 'agent_status_change' | 'task_status_change' | 'session_metrics_update' | 'error' | 'log';
  timestamp: Date;
  sessionId: string;
  data: AgentStatus | TaskStatus | SessionMetrics | { message: string; level: string };
}

export interface MissionControlAgentInit {
  id: string;
  name: string;
  type?: AgentStatus['type'];
  status?: AgentStatus['status'];
  task?: string;
  initialProgress?: number;
}

export interface AgentRuntimeUpdate extends Partial<AgentStatus> {
  currentOperation?: string;
  output?: string[];
  toolsUsed?: string[];
  needsFeedback?: boolean;
  feedbackRequest?: string;
  telemetry?: AgentStatus['telemetry'];
}

export class MissionControlStream extends EventEmitter {
  private agentStatuses: Map<string, AgentStatus> = new Map();
  private taskStatuses: Map<string, TaskStatus> = new Map();
  private sessionMetrics: SessionMetrics | null = null;
  private subscribers: Set<(event: MissionControlEvent) => void> = new Set();
  private updateInterval: NodeJS.Timeout | null = null;
  private dashboardInterval: NodeJS.Timeout | null = null;
  private transparency?: TransparencyEngine;
  private transparencyListener?: (event: TransparencyRecord) => void;
  private dbLatencySamples: number[] = [];
  private knowledgeStats = { entries: 0, lastIngested: undefined as Date | undefined };
  private readonly maxLatencySamples = 20;
  private session?: ClaudeCodeSession;
  private active = false;

  constructor(sessionOrOptions?: ClaudeCodeSession | MissionControlOptions) {
    super();

    if (sessionOrOptions && 'transparency' in sessionOrOptions) {
      this.session = { id: sessionOrOptions.id, startTime: sessionOrOptions.startTime };
      if (sessionOrOptions.transparency) {
        this.bindTransparency(sessionOrOptions.transparency);
      }
    } else if (sessionOrOptions) {
      this.session = sessionOrOptions;
    }

    this.startMetricsCollection();
  }

  // Core subscription API
  subscribe(callback: (event: MissionControlEvent) => void): () => void {
    this.subscribers.add(callback);
    
    // Send current state to new subscriber
    this.agentStatuses.forEach(status => {
      callback({
        type: 'agent_status_change',
        timestamp: new Date(),
        sessionId: this.session?.id || 'default',
        data: status
      });
    });

    this.taskStatuses.forEach(status => {
      callback({
        type: 'task_status_change',
        timestamp: new Date(),
        sessionId: this.session?.id || 'default',
        data: status
      });
    });

    if (this.sessionMetrics) {
      callback({
        type: 'session_metrics_update',
        timestamp: new Date(),
        sessionId: this.session?.id || 'default',
        data: this.sessionMetrics
      });
    }

    return () => {
      this.subscribers.delete(callback);
    };
  }

  start(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    if (!this.updateInterval) {
      this.startMetricsCollection();
    }
    if (!this.dashboardInterval) {
      this.dashboardInterval = setInterval(() => {
        if (!this.active) {
          return;
        }
        this.renderDashboard();
      }, 1000);
    }
  }

  stop(): void {
    if (!this.active) {
      return;
    }
    this.active = false;
    if (this.dashboardInterval) {
      clearInterval(this.dashboardInterval);
      this.dashboardInterval = null;
    }
  }

  addAgent(agent: MissionControlAgentInit): void {
    const type = agent.type ?? this.inferAgentType(agent.id);
    this.updateAgent(agent.id, {
      id: agent.id,
      name: agent.name,
      type,
      status: agent.status ?? 'idle',
      currentTask: agent.task,
      currentOperation: agent.task,
      progress: agent.initialProgress ?? 0,
    });
  }

  updateAgent(agentId: string, updates: AgentRuntimeUpdate): void {
    const existing = this.agentStatuses.get(agentId);
    const defaults: AgentStatus = existing ?? {
      id: agentId,
      type: this.inferAgentType(agentId),
      name: agentId,
      status: 'idle',
      currentTask: undefined,
      progress: 0,
      currentOperation: undefined,
      output: undefined,
      toolsUsed: undefined,
      needsFeedback: undefined,
      feedbackRequest: undefined,
      telemetry: {},
      metrics: {
        tasksCompleted: 0,
        tasksActive: 0,
        errorCount: 0,
        uptime: 0
      },
      lastActivity: new Date()
    };

    const newStatus = updates.status ?? defaults.status;
    const metrics = {
      ...defaults.metrics,
      ...updates.metrics
    };

    if (newStatus === 'complete' && defaults.status !== 'complete') {
      metrics.tasksCompleted += 1;
      metrics.tasksActive = Math.max(0, metrics.tasksActive - 1);
    } else if (newStatus === 'active' && defaults.status !== 'active') {
      metrics.tasksActive = Math.max(metrics.tasksActive, 1);
    } else if (newStatus === 'error' && defaults.status !== 'error') {
      metrics.errorCount += 1;
      metrics.tasksActive = Math.max(0, metrics.tasksActive - 1);
    }

    const telemetry = {
      ...defaults.telemetry,
      ...updates.telemetry
    };

    const output = updates.output
      ? [...(defaults.output ?? []), ...updates.output]
      : defaults.output;

    const toolsUsed = updates.toolsUsed
      ? Array.from(new Set([...(defaults.toolsUsed ?? []), ...updates.toolsUsed]))
      : defaults.toolsUsed;

    const merged: AgentStatus = {
      ...defaults,
      ...updates,
      status: newStatus,
      type: updates.type ?? defaults.type,
      name: updates.name ?? defaults.name,
      currentTask: updates.currentTask ?? updates.currentOperation ?? defaults.currentTask,
      currentOperation: updates.currentOperation ?? defaults.currentOperation,
      output,
      toolsUsed,
      telemetry,
      needsFeedback: updates.needsFeedback ?? defaults.needsFeedback,
      feedbackRequest: updates.feedbackRequest ?? defaults.feedbackRequest,
      progress: Math.max(0, Math.min(100, updates.progress ?? defaults.progress)),
      metrics,
      lastActivity: new Date(),
      startedAt: defaults.startedAt,
      completedAt: defaults.completedAt
    };

    if (merged.status === 'active' && !merged.startedAt) {
      merged.startedAt = new Date();
    }

    if ((merged.status === 'complete' || merged.status === 'error') && !merged.completedAt) {
      merged.completedAt = new Date();
    }

    this.agentStatuses.set(agentId, merged);
    this.broadcastEvent({
      type: 'agent_status_change',
      timestamp: new Date(),
      sessionId: this.session?.id || 'default',
      data: merged
    });

    this.updateSessionMetrics();
  }

  // Agent management
  updateAgentStatus(agentId: string, updates: Partial<AgentStatus>): void {
    this.updateAgent(agentId, updates);
  }

  // Task management
  updateTaskStatus(taskId: string, updates: Partial<TaskStatus>): void {
    const existing = this.taskStatuses.get(taskId);
    const updated: TaskStatus = {
      id: taskId,
      title: taskId,
      status: 'pending',
      priority: 1,
      dependencies: [],
      progress: 0,
      metrics: {
        estimatedDuration: 0,
        complexity: 1
      },
      ...existing,
      ...updates
    };

    if (updated.status === 'active' && !updated.startTime) {
      updated.startTime = new Date();
    }
    if ((updated.status === 'complete' || updated.status === 'error') && !updated.completedTime) {
      updated.completedTime = new Date();
    }

    this.taskStatuses.set(taskId, updated);
    this.broadcastEvent({
      type: 'task_status_change',
      timestamp: new Date(),
      sessionId: this.session?.id || 'default',
      data: updated
    });

    this.updateSessionMetrics();
  }

  // Batch operations for efficiency
  updateMultipleTasks(tasks: Task[]): void {
    tasks.forEach(task => {
      this.updateTaskStatus(task.id, {
        title: task.description || task.id,
        status: 'pending',
        priority: task.priority || 1,
        dependencies: task.dependencies || [],
        assignedAgent: (task as any).assignedAgent,
        metrics: {
          estimatedDuration: (task as any).estimatedDuration || 300,
          complexity: (task as any).complexity || 1
        }
      });
    });
  }

  // Real-time metrics collection
  private startMetricsCollection(): void {
    this.updateInterval = setInterval(() => {
      this.updateSessionMetrics();
    }, 500); // Update every 500ms
  }

  private updateSessionMetrics(): void {
    if (!this.session) return;

    const now = new Date();
    const tasks = Array.from(this.taskStatuses.values());
    const agents = Array.from(this.agentStatuses.values());

    const completedTasks = tasks.filter(t => t.status === 'complete').length;
    const activeTasks = tasks.filter(t => t.status === 'active').length;
    const errorTasks = tasks.filter(t => t.status === 'error').length;
    const activeAgents = agents.filter(a => a.status === 'active').length;

    // Calculate average task duration
    const completedWithDuration = tasks.filter(t => t.metrics.actualDuration);
    const averageTaskDuration = completedWithDuration.length > 0
      ? completedWithDuration.reduce((sum, t) => sum + (t.metrics.actualDuration || 0), 0) / completedWithDuration.length
      : 0;

    const successRate = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

    this.sessionMetrics = {
      sessionId: this.session.id,
      startTime: this.session.startTime || now,
      totalTasks: tasks.length,
      completedTasks,
      activeTasks,
      errorTasks,
      activeAgents,
      averageTaskDuration,
      successRate,
      resourceUsage: {
        cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // Convert to MB
        diskUsage: 0 // Would need additional tooling for real disk usage
      },
      dbLatencyMs: this.getAverageLatency(),
      knowledgeEntries: this.knowledgeStats.entries,
      knowledgeLastIngested: this.knowledgeStats.lastIngested
    };

    this.broadcastEvent({
      type: 'session_metrics_update',
      timestamp: now,
      sessionId: this.session.id,
      data: this.sessionMetrics
    });
  }

  // Event broadcasting
  private broadcastEvent(event: MissionControlEvent): void {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Mission Control subscriber error:', error);
      }
    });
    this.emit('event', event);
  }

  // Logging integration
  logMessage(level: string, message: string): void {
    this.broadcastEvent({
      type: 'log',
      timestamp: new Date(),
      sessionId: this.session?.id || 'default',
      data: { message, level }
    });
  }

  logError(error: Error | string): void {
    const message = error instanceof Error ? error.message : error;
    this.broadcastEvent({
      type: 'error',
      timestamp: new Date(),
      sessionId: this.session?.id || 'default',
      data: { message, level: 'error' }
    });
  }

  // State access
  getAgentStatus(agentId: string): AgentStatus | undefined {
    return this.agentStatuses.get(agentId);
  }

  getTaskStatus(taskId: string): TaskStatus | undefined {
    return this.taskStatuses.get(taskId);
  }

  getAllAgents(): AgentStatus[] {
    return Array.from(this.agentStatuses.values());
  }

  getAllTasks(): TaskStatus[] {
    return Array.from(this.taskStatuses.values());
  }

  getSessionMetrics(): SessionMetrics | null {
    return this.sessionMetrics;
  }

  // Cleanup
  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.dashboardInterval) {
      clearInterval(this.dashboardInterval);
      this.dashboardInterval = null;
    }
    this.subscribers.clear();
    this.removeAllListeners();
    if (this.transparency && this.transparencyListener) {
      if ('off' in this.transparency && typeof this.transparency.off === 'function') {
        this.transparency.off('event', this.transparencyListener as any);
      }
    }
  }

  bindTransparency(engine: TransparencyEngine): void {
    if (this.transparency === engine) {
      return;
    }

    if (this.transparency && this.transparencyListener) {
      if ('off' in this.transparency && typeof this.transparency.off === 'function') {
        this.transparency.off('event', this.transparencyListener as any);
      }
    }

    this.transparency = engine;
    this.transparencyListener = (event: TransparencyRecord) => {
      this.handleTransparencyEvent(event);
    };

    engine.onEvent(this.transparencyListener);
  }

  private handleTransparencyEvent(event: TransparencyRecord): void {
    switch (event.eventType) {
      case 'task_planned':
        this.updateTaskStatus(event.metadata?.taskId || event.message, {
          id: event.metadata?.taskId || event.message,
          title: event.metadata?.description || event.message,
          status: 'pending',
          priority: event.metadata?.priority ?? 1,
          dependencies: event.metadata?.dependencies ?? [],
        });
        break;
      case 'task_started':
        this.updateTaskStatus(event.metadata?.taskId || event.message, {
          id: event.metadata?.taskId || event.message,
          status: 'active',
          assignedAgent: event.metadata?.agentId,
        });
        if (event.metadata?.agentId) {
          this.updateAgentStatus(event.metadata.agentId, {
            id: event.metadata.agentId,
            type: event.metadata.agentType ?? 'backend',
            status: 'active',
            currentTask: event.metadata.taskId || event.message,
          });
        }
        break;
      case 'task_completed':
        this.updateTaskStatus(event.metadata?.taskId || event.message, {
          id: event.metadata?.taskId || event.message,
          status: 'complete',
          progress: 100,
        });
        if (event.metadata?.agentId) {
          this.updateAgentStatus(event.metadata.agentId, {
            id: event.metadata.agentId,
            status: 'complete',
            currentTask: undefined,
          });
        }
        break;
      case 'task_failed':
        this.updateTaskStatus(event.metadata?.taskId || event.message, {
          id: event.metadata?.taskId || event.message,
          status: 'error',
          errorMessage: event.metadata?.error,
        });
        if (event.metadata?.agentId) {
          this.updateAgentStatus(event.metadata.agentId, {
            id: event.metadata.agentId,
            status: 'error',
            currentTask: undefined,
          });
        }
        break;
      case 'deepwiki_ingest':
        this.knowledgeStats.entries += 1;
        this.knowledgeStats.lastIngested = new Date(event.eventTime ?? new Date());
        break;
      default:
        if (event.source === 'sqlite') {
          const latency = event.metadata?.durationMs ?? event.metadata?.duration ?? null;
          if (typeof latency === 'number') {
            this.dbLatencySamples.push(latency);
            if (this.dbLatencySamples.length > this.maxLatencySamples) {
              this.dbLatencySamples.shift();
            }
          }
        }
        break;
    }
  }

  private getAverageLatency(): number {
    if (this.dbLatencySamples.length === 0) {
      return 0;
    }
    const total = this.dbLatencySamples.reduce((sum, value) => sum + value, 0);
    return Math.round(total / this.dbLatencySamples.length);
  }

  private renderDashboard(): void {
    if (!this.active) {
      return;
    }

    // Rendering is handled by downstream subscribers. This method intentionally keeps
    // side effects minimal while providing a hook for future dashboard integrations.
  }

  private inferAgentType(agentId: string): AgentStatus['type'] {
    if (agentId.includes('frontend')) return 'frontend';
    if (agentId.includes('security')) return 'security';
    if (agentId.includes('test')) return 'test';
    if (agentId.includes('figma')) return 'figma';
    if (agentId.includes('devops')) return 'devops';
    return 'backend';
  }
}
