import { EventEmitter } from 'events';
import type { Task } from '../planning/TaskGraphGenerator';
import type { ClaudeCodeSession } from '../session/WorkspaceManager';

export interface AgentStatus {
  id: string;
  type: 'backend' | 'frontend' | 'security' | 'test' | 'figma' | 'devops';
  name: string;
  status: 'idle' | 'active' | 'paused' | 'error' | 'complete';
  currentTask?: string;
  progress: number;
  metrics: {
    tasksCompleted: number;
    tasksActive: number;
    errorCount: number;
    uptime: number;
  };
  lastActivity: Date;
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
}

export interface MissionControlEvent {
  type: 'agent_status_change' | 'task_status_change' | 'session_metrics_update' | 'error' | 'log';
  timestamp: Date;
  sessionId: string;
  data: AgentStatus | TaskStatus | SessionMetrics | { message: string; level: string };
}

export class MissionControlStream extends EventEmitter {
  private agentStatuses: Map<string, AgentStatus> = new Map();
  private taskStatuses: Map<string, TaskStatus> = new Map();
  private sessionMetrics: SessionMetrics | null = null;
  private subscribers: Set<(event: MissionControlEvent) => void> = new Set();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(private session?: ClaudeCodeSession) {
    super();
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

  // Agent management
  updateAgentStatus(agentId: string, updates: Partial<AgentStatus>): void {
    const existing = this.agentStatuses.get(agentId);
    const updated: AgentStatus = {
      id: agentId,
      type: 'backend',
      name: agentId,
      status: 'idle',
      progress: 0,
      metrics: {
        tasksCompleted: 0,
        tasksActive: 0,
        errorCount: 0,
        uptime: 0
      },
      lastActivity: new Date(),
      ...existing,
      ...updates,
      lastActivity: new Date()
    };

    this.agentStatuses.set(agentId, updated);
    this.broadcastEvent({
      type: 'agent_status_change',
      timestamp: new Date(),
      sessionId: this.session?.id || 'default',
      data: updated
    });

    this.updateSessionMetrics();
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
        title: task.name,
        status: 'pending',
        priority: task.priority || 1,
        dependencies: task.dependencies || [],
        assignedAgent: task.assignedAgent,
        metrics: {
          estimatedDuration: task.estimatedDuration || 300,
          complexity: task.complexity || 1
        }
      });
    });
  }

  // Real-time metrics collection
  private startMetricsCollection(): void {
    this.updateInterval = setInterval(() => {
      this.updateSessionMetrics();
    }, 5000); // Update every 5 seconds
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
      }
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
    this.subscribers.clear();
    this.removeAllListeners();
  }
}