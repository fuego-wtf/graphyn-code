/**
 * Task Coordinator - Multi-agent task distribution and management
 * 
 * Coordinates task execution across specialized agents, handles dependencies,
 * and manages agent lifecycle as specified in DELIVERY.md
 */

import { SQLiteManager } from '../database/sqlite-manager.js';
import { TaskRepository } from '../database/repositories/task-repository.js';
import { AgentRepository } from '../database/repositories/agent-repository.js';

export interface Task {
  id: string;
  description: string;
  agentType: string;
  dependencies: string[];
  priority: number;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  metadata: Record<string, any>;
  assignedAgent?: string;
  result?: Record<string, any>;
  metrics?: TaskMetrics;
  createdAt: Date;
  updatedAt: Date;
  assignedAt?: Date;
  completedAt?: Date;
}

export interface Agent {
  id: string;
  type: string;
  capabilities: string[];
  sessionId: string;
  metadata: Record<string, any>;
  status: 'idle' | 'busy' | 'error' | 'offline';
  currentTask?: string;
  metrics?: AgentMetrics;
  registeredAt: Date;
  updatedAt: Date;
}

export interface TaskMetrics {
  duration?: number;
  tokensUsed?: number;
  toolsUsed?: string[];
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface AgentMetrics {
  cpu?: number;
  memory?: number;
  tasksCompleted?: number;
  averageTaskTime?: number;
  successRate?: number;
}

export interface TaskCompletionInfo {
  agentId: string;
  result: Record<string, any>;
  metrics: TaskMetrics;
  completedAt: Date;
}

export interface AgentStatusUpdate {
  status: 'idle' | 'busy' | 'error' | 'offline';
  currentTask?: string;
  metrics?: AgentMetrics;
  updatedAt: Date;
}

export class TaskCoordinator {
  private dbManager: SQLiteManager;
  private taskQueue: Map<string, Task> = new Map();
  private agentRegistry: Map<string, Agent> = new Map();
  private taskRepository: TaskRepository;
  private agentRepository: AgentRepository;

  constructor(dbManager: SQLiteManager) {
    this.dbManager = dbManager;
    const connection = this.dbManager.getConnection();
    this.taskRepository = new TaskRepository(connection);
    this.agentRepository = new AgentRepository(connection);
  }

  /**
   * Enqueue a new task for execution
   */
  async enqueueTask(task: Task): Promise<void> {
    this.taskRepository.insert({
      id: task.id,
      description: task.description,
      agentType: task.agentType,
      dependencies: task.dependencies,
      priority: task.priority,
      status: task.status,
      metadata: task.metadata,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    });

    if (task.dependencies.length > 0) {
      for (const depId of task.dependencies) {
        this.taskRepository.insertDependency(task.id, depId);
      }
    }

    // Add to in-memory queue
    this.taskQueue.set(task.id, task);

    console.log(`📝 Task ${task.id} enqueued for agent type: ${task.agentType}`);
  }

  /**
   * Get the next available task for an agent
   */
  async getNextTask(agentType: string, capabilities: string[]): Promise<Task | null> {
    const taskRow = this.taskRepository.findReadyTask(agentType, capabilities);

    if (!taskRow) {
      return null;
    }

    // Convert database row to Task object
    const task: Task = {
      id: taskRow.id,
      description: taskRow.description,
      agentType: taskRow.agent_type,
      dependencies: JSON.parse(taskRow.dependencies || '[]'),
      priority: taskRow.priority,
      status: taskRow.status as Task['status'],
      metadata: JSON.parse(taskRow.metadata || '{}'),
      assignedAgent: taskRow.assigned_agent || undefined,
      result: taskRow.result ? JSON.parse(taskRow.result) : undefined,
      metrics: taskRow.metrics ? JSON.parse(taskRow.metrics) : undefined,
      createdAt: new Date(taskRow.created_at),
      updatedAt: new Date(taskRow.updated_at),
      assignedAt: taskRow.assigned_at ? new Date(taskRow.assigned_at) : undefined,
      completedAt: taskRow.completed_at ? new Date(taskRow.completed_at) : undefined
    };

    return task;
  }

  /**
   * Assign a task to an agent
   */
  async assignTask(taskId: string, agentId: string): Promise<void> {
    const now = new Date().toISOString();

    this.taskRepository.assign(taskId, agentId, now);
    this.agentRepository.updateStatus(agentId, {
      status: 'busy',
      currentTask: taskId,
      updatedAt: new Date(now)
    });

    // Update in-memory cache
    const task = this.taskQueue.get(taskId);
    if (task) {
      task.status = 'assigned';
      task.assignedAgent = agentId;
      task.assignedAt = new Date(now);
      task.updatedAt = new Date(now);
    }

    const agent = this.agentRegistry.get(agentId);
    if (agent) {
      agent.status = 'busy';
      agent.currentTask = taskId;
      agent.updatedAt = new Date(now);
    }

    console.log(`🎯 Task ${taskId} assigned to agent ${agentId}`);
  }

  /**
   * Mark a task as completed
   */
  async completeTask(taskId: string, completion: TaskCompletionInfo): Promise<void> {
    const db = this.dbManager.getConnection();
    db.transaction(() => {
      this.taskRepository.complete(
        taskId,
        completion.result,
        completion.metrics ? { ...completion.metrics } : {},
        completion.completedAt.toISOString()
      );

      this.agentRepository.updateStatus(completion.agentId, {
        status: 'idle',
        currentTask: undefined,
        metrics: completion.metrics ? { ...completion.metrics } : undefined,
        updatedAt: completion.completedAt
      });
    })();

    // Update in-memory cache
    const task = this.taskQueue.get(taskId);
    if (task) {
      task.status = 'completed';
      task.result = completion.result;
      task.metrics = completion.metrics;
      task.completedAt = completion.completedAt;
      task.updatedAt = completion.completedAt;
    }

    const agent = this.agentRegistry.get(completion.agentId);
    if (agent) {
      agent.status = 'idle';
      agent.currentTask = undefined;
      agent.updatedAt = completion.completedAt;

      if (completion.metrics) {
        const currentMetrics = agent.metrics || {};
        const existingCount = currentMetrics.tasksCompleted || 0;
        const averageTaskTime = this.calculateAverageTime(
          currentMetrics.averageTaskTime,
          existingCount,
          completion.metrics.duration || 0
        );

        agent.metrics = {
          ...currentMetrics,
          ...completion.metrics,
          tasksCompleted: existingCount + 1,
          averageTaskTime
        };
      }
    }

    console.log(`✅ Task ${taskId} completed by agent ${completion.agentId}`);
  }

  /**
   * Register a new agent
   */
  async registerAgent(agent: Agent): Promise<void> {
    this.agentRepository.upsert({
      id: agent.id,
      type: agent.type,
      capabilities: agent.capabilities,
      sessionId: agent.sessionId,
      metadata: agent.metadata,
      status: agent.status,
      registeredAt: agent.registeredAt,
      updatedAt: agent.updatedAt
    });

    // Add to in-memory registry
    this.agentRegistry.set(agent.id, agent);

    console.log(`🤖 Agent ${agent.id} (${agent.type}) registered for session ${agent.sessionId}`);
  }

  /**
   * Update agent status and metrics
   */
  async updateAgentStatus(agentId: string, update: AgentStatusUpdate): Promise<void> {
    this.agentRepository.updateStatus(agentId, {
      status: update.status,
      currentTask: update.currentTask,
      metrics: update.metrics ? { ...update.metrics } : undefined,
      updatedAt: update.updatedAt
    });

    // Update in-memory registry
    const agent = this.agentRegistry.get(agentId);
    if (agent) {
      agent.status = update.status;
      agent.currentTask = update.currentTask;
      if (update.metrics) {
        agent.metrics = { ...agent.metrics, ...update.metrics };
      }
      agent.updatedAt = update.updatedAt;
    }

    console.log(`📊 Agent ${agentId} status updated to: ${update.status}`);
  }

  /**
   * Get task statuses
   */
  async getTaskStatuses(taskIds?: string[], sessionId?: string): Promise<Task[]> {
    const rows = this.taskRepository.getStatuses(taskIds, sessionId);

    return rows.map(row => ({
      id: row.id,
      description: row.description,
      agentType: row.agent_type,
      dependencies: JSON.parse(row.dependencies || '[]'),
      priority: row.priority,
      status: row.status as Task['status'],
      metadata: JSON.parse(row.metadata || '{}'),
      assignedAgent: row.assigned_agent || undefined,
      result: row.result ? JSON.parse(row.result) : undefined,
      metrics: row.metrics ? JSON.parse(row.metrics) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      assignedAt: row.assigned_at ? new Date(row.assigned_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined
    }));
  }

  /**
   * Get coordinator status and metrics
   */
  async getStatus(): Promise<any> {
    const taskCounts = this.taskRepository.countsByStatus();
    const agentCounts = this.agentRepository.countsByStatusAndType();
    const avgTaskDuration = this.taskRepository.averageDuration();

    return {
      tasks: {
        total: this.taskQueue.size,
        byStatus: taskCounts.reduce<Record<string, number>>((acc, row) => {
          acc[row.status] = row.count;
          return acc;
        }, {})
      },
      agents: {
        total: this.agentRegistry.size,
        byStatus: agentCounts.reduce<Record<string, Record<string, number>>>((acc, row) => {
          if (!acc[row.status]) acc[row.status] = {};
          acc[row.status][row.type] = row.count;
          return acc;
        }, {})
      },
      performance: {
        averageTaskDuration: avgTaskDuration
      }
    };
  }

  /**
   * Load tasks and agents from database on startup
   */
  async loadFromDatabase(): Promise<void> {
    const tasks = this.taskRepository.loadActive();

    for (const row of tasks) {
      const task: Task = {
        id: row.id,
        description: row.description,
        agentType: row.agent_type,
        dependencies: JSON.parse(row.dependencies || '[]'),
        priority: row.priority,
        status: row.status as Task['status'],
        metadata: JSON.parse(row.metadata || '{}'),
        assignedAgent: row.assigned_agent || undefined,
        result: row.result ? JSON.parse(row.result) : undefined,
        metrics: row.metrics ? JSON.parse(row.metrics) : undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        assignedAt: row.assigned_at ? new Date(row.assigned_at) : undefined,
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined
      };

      this.taskQueue.set(task.id, task);
    }

    // Load active agents
    const agents = this.agentRepository.loadActive();

    for (const row of agents) {
      const agent: Agent = {
        id: row.id,
        type: row.type,
        capabilities: JSON.parse(row.capabilities || '[]'),
        sessionId: row.session_id,
        metadata: JSON.parse(row.metadata || '{}'),
        status: row.status as Agent['status'],
        currentTask: row.current_task || undefined,
        metrics: row.metrics ? JSON.parse(row.metrics) : undefined,
        registeredAt: new Date(row.registered_at),
        updatedAt: new Date(row.updated_at)
      };

      this.agentRegistry.set(agent.id, agent);
    }

    console.log(`🔄 Loaded ${tasks.length} tasks and ${agents.length} agents from database`);
  }

  /**
   * Clean up coordinator resources
   */
  async cleanup(): Promise<void> {
    // Mark all agents as offline
    this.agentRepository.markAllOffline(new Date().toISOString());

    this.taskQueue.clear();
    this.agentRegistry.clear();

    console.log('🧹 Task coordinator cleaned up');
  }

  /**
   * Calculate running average for task completion time
   */
  private calculateAverageTime(currentAvg: number | undefined, count: number, newDuration: number): number {
    if (!currentAvg || count === 0) return newDuration;
    return ((currentAvg * count) + newDuration) / (count + 1);
  }
}
