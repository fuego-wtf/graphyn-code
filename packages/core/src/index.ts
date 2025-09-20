/**
 * @graphyn/core - Core types, utilities, and base functionality
 * 
 * Provides shared types, validation schemas, utility functions,
 * and base classes used across the Graphyn ecosystem
 */

import { z } from 'zod';

// Core types
export interface GraphynConfig {
  version: string;
  workspace: string;
  database?: {
    type: 'sqlite' | 'mock';
    path?: string;
  };
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    pretty?: boolean;
  };
  agents?: {
    maxConcurrent?: number;
    timeout?: number;
    types?: string[];
  };
  coordination?: {
    port?: number;
    host?: string;
    enableWebSocket?: boolean;
  };
  mcp?: {
    enabled?: boolean;
    tools?: string[];
  };
}

export interface Agent {
  id: string;
  type: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  capabilities: string[];
  metadata?: Record<string, any>;
  lastActive?: Date;
  currentTask?: string;
}

// Task interface is now exported from task-graph-generator
// export interface Task is replaced by import/export from task-graph-generator

export interface FlowStep {
  id: string;
  key: string;
  title: string;
  description: string;
  agentType: string;
  command: string;
  rollback?: string;
  validation?: string;
  dependencies: string[];
  priority: number;
  tags: string[];
  metadata?: Record<string, any>;
}

export interface ExecutionFlow {
  id: string;
  name: string;
  version: string;
  description: string;
  steps: FlowStep[];
  metadata?: Record<string, any>;
}

export interface Session {
  id: string;
  name: string;
  workspace: string;
  config: Record<string, any>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt?: Date;
  tasks?: string[];
  agents?: string[];
}

// Validation schemas
export const AgentSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.enum(['idle', 'busy', 'error', 'offline']),
  capabilities: z.array(z.string()),
  metadata: z.record(z.any()).optional(),
  lastActive: z.date().optional(),
  currentTask: z.string().optional()
});

export const TaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  type: z.enum(['analysis', 'implementation', 'testing', 'security', 'deployment', 'documentation', 'backend_development', 'security_analysis']),
  dependencies: z.array(z.string()),
  workingDirectory: z.string(),
  priority: z.number().int().min(1).max(5),
  estimatedDuration: z.number().int().positive(),
  requiredSkills: z.array(z.string()),
  deliverables: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  requirements: z.array(z.string()).optional(),
  config: z.object({
    tools: z.array(z.string()).optional()
  }).optional()
});

export const FlowStepSchema = z.object({
  id: z.string(),
  key: z.string(),
  title: z.string(),
  description: z.string(),
  agentType: z.string(),
  command: z.string(),
  rollback: z.string().optional(),
  validation: z.string().optional(),
  dependencies: z.array(z.string()),
  priority: z.number().int(),
  tags: z.array(z.string()),
  metadata: z.record(z.any()).optional()
});

export const ExecutionFlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  steps: z.array(FlowStepSchema),
  metadata: z.record(z.any()).optional()
});

export const GraphynConfigSchema = z.object({
  version: z.string(),
  workspace: z.string(),
  database: z.object({
    type: z.enum(['sqlite', 'mock']),
    path: z.string().optional()
  }).optional(),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    pretty: z.boolean().optional()
  }).optional(),
  agents: z.object({
    maxConcurrent: z.number().int().positive().optional(),
    timeout: z.number().int().positive().optional(),
    types: z.array(z.string()).optional()
  }).optional(),
  coordination: z.object({
    port: z.number().int().positive().optional(),
    host: z.string().optional(),
    enableWebSocket: z.boolean().optional()
  }).optional(),
  mcp: z.object({
    enabled: z.boolean().optional(),
    tools: z.array(z.string()).optional()
  }).optional()
});

// Utility functions
export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

export function validateTask(task: unknown) {
  return TaskSchema.parse(task);
}

export function validateAgent(agent: unknown): Agent {
  return AgentSchema.parse(agent);
}

export function validateFlow(flow: unknown): ExecutionFlow {
  return ExecutionFlowSchema.parse(flow);
}

export function validateConfig(config: unknown): GraphynConfig {
  return GraphynConfigSchema.parse(config);
}

// Task status utilities (commented out - need to be adapted to new Task interface)
// export function isTaskComplete(task: Task): boolean {
//   return task.status === 'completed' || task.status === 'failed';
// }

// export function isTaskReady(task: Task, completedTasks: Set<string>): boolean {
//   if (task.status !== 'pending') return false;
//   return task.dependencies.every(dep => completedTasks.has(dep));
// }

// export function getReadyTasks(tasks: Task[]): Task[] {
//   const completedTasks = new Set(
//     tasks.filter(isTaskComplete).map(t => t.id)
//   );
//   
//   return tasks.filter(task => isTaskReady(task, completedTasks));
// }

// Agent status utilities
export function isAgentAvailable(agent: Agent): boolean {
  return agent.status === 'idle';
}

// export function canAgentExecuteTask(agent: Agent, task: Task): boolean {
//   if (!isAgentAvailable(agent)) return false;
//   if (agent.type !== task.agentType && agent.type !== 'general') return false;
//   return true;
// }

// Priority queue utilities (commented out - need to adapt to new Task interface)
// export function sortTasksByPriority(tasks: Task[]): Task[] {
//   return [...tasks].sort((a, b) => {
//     if (a.priority !== b.priority) {
//       return b.priority - a.priority; // Higher priority first
//     }
//     return a.createdAt.getTime() - b.createdAt.getTime(); // Older first for same priority
//   });
// }

// Flow execution utilities
export function buildDependencyGraph(steps: FlowStep[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  
  for (const step of steps) {
    graph.set(step.id, new Set(step.dependencies));
  }
  
  return graph;
}

export function topologicalSort(steps: FlowStep[]): FlowStep[] {
  const graph = buildDependencyGraph(steps);
  const inDegree = new Map<string, number>();
  const result: FlowStep[] = [];
  const stepMap = new Map(steps.map(s => [s.id, s]));
  
  // Calculate in-degrees
  for (const step of steps) {
    inDegree.set(step.id, step.dependencies.length);
  }
  
  // Find steps with no dependencies
  const queue = steps.filter(step => step.dependencies.length === 0);
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    
    // Update in-degrees of dependent steps
    for (const step of steps) {
      if (step.dependencies.includes(current.id)) {
        const newDegree = (inDegree.get(step.id) || 0) - 1;
        inDegree.set(step.id, newDegree);
        
        if (newDegree === 0) {
          queue.push(step);
        }
      }
    }
  }
  
  if (result.length !== steps.length) {
    throw new Error('Circular dependency detected in flow steps');
  }
  
  return result;
}

// Result types for async operations
export type Result<T, E = Error> = {
  success: true;
  data: T;
} | {
  success: false;
  error: E;
};

export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

export function failure<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success;
}

export function isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return !result.success;
}

// Constants
export const DEFAULT_CONFIG: GraphynConfig = {
  version: '0.1.70',
  workspace: process.cwd(),
  database: {
    type: 'sqlite',
    path: './data/graphyn.db'
  },
  logging: {
    level: 'info',
    pretty: process.env.NODE_ENV !== 'production'
  },
  agents: {
    maxConcurrent: 4,
    timeout: 300000, // 5 minutes
    types: ['general', 'typescript', 'figma', 'bash']
  },
  coordination: {
    port: 3001,
    host: '0.0.0.0',
    enableWebSocket: true
  },
  mcp: {
    enabled: true,
    tools: ['enqueue_task', 'get_next_task', 'complete_task', 'get_task_status']
  }
};

export const AGENT_TYPES = {
  GENERAL: 'general',
  TYPESCRIPT: 'typescript', 
  FIGMA: 'figma',
  BASH: 'bash',
  PYTHON: 'python',
  REACT: 'react',
  NODE: 'node'
} as const;

export const TASK_STATUSES = {
  PENDING: 'pending',
  RUNNING: 'running', 
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

export const AGENT_STATUSES = {
  IDLE: 'idle',
  BUSY: 'busy',
  ERROR: 'error', 
  OFFLINE: 'offline'
} as const;

// Re-export core components (will be migrated from src/core/)
export * from './claude-api-wrapper.js';
export * from './agent-tool-system.js';
export * from './repo-analyzer.js';
export * from './task-graph-generator.js';

// Re-export Task interface from task-graph-generator
export type { Task, TaskGraph, Goal } from './task-graph-generator.js';

// Re-export orchestrators
export * from './orchestrator/GraphynOrchestrator.js';
export * from './orchestrator/MultiAgentOrchestrator.js';
export * from './orchestrator/MCPCoordinator.js';

// Re-export session management
export * from './session/UserDataManager.js';
export * from './session/SessionManager.js';

// Re-export planning
export * from './planning/TaskDecomposer.js';
export type { TaskDecomposition, DecompositionContext } from './planning/TaskDecomposer.js';

// Export monitoring and mission control
export { MissionControlStream } from './monitoring/MissionControlStream';
export type { AgentStatus, TaskStatus, SessionMetrics, MissionControlEvent } from './monitoring/MissionControlStream';
export { TransparencyEngine } from './monitoring/TransparencyEngine.js';
