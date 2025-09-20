/**
 * @graphyn/core - Core types, utilities, and base functionality
 *
 * Provides shared types, validation schemas, utility functions,
 * and base classes used across the Graphyn ecosystem
 */
import { z } from 'zod';
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
    agentType: z.string(),
    description: z.string(),
    priority: z.number().int().min(1).max(10),
    dependencies: z.array(z.string()),
    status: z.enum(['pending', 'running', 'completed', 'failed']),
    workspace: z.string().optional(),
    config: z.any().optional(),
    result: z.any().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
    startedAt: z.date().optional(),
    completedAt: z.date().optional(),
    assignedAgent: z.string().optional(),
    error: z.string().optional()
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
export function generateId(prefix) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}
export function validateTask(task) {
    return TaskSchema.parse(task);
}
export function validateAgent(agent) {
    return AgentSchema.parse(agent);
}
export function validateFlow(flow) {
    return ExecutionFlowSchema.parse(flow);
}
export function validateConfig(config) {
    return GraphynConfigSchema.parse(config);
}
// Task status utilities
export function isTaskComplete(task) {
    return task.status === 'completed' || task.status === 'failed';
}
export function isTaskReady(task, completedTasks) {
    if (task.status !== 'pending')
        return false;
    return task.dependencies.every(dep => completedTasks.has(dep));
}
export function getReadyTasks(tasks) {
    const completedTasks = new Set(tasks.filter(isTaskComplete).map(t => t.id));
    return tasks.filter(task => isTaskReady(task, completedTasks));
}
// Agent status utilities
export function isAgentAvailable(agent) {
    return agent.status === 'idle';
}
export function canAgentExecuteTask(agent, task) {
    if (!isAgentAvailable(agent))
        return false;
    if (agent.type !== task.agentType && agent.type !== 'general')
        return false;
    return true;
}
// Priority queue utilities
export function sortTasksByPriority(tasks) {
    return [...tasks].sort((a, b) => {
        if (a.priority !== b.priority) {
            return b.priority - a.priority; // Higher priority first
        }
        return a.createdAt.getTime() - b.createdAt.getTime(); // Older first for same priority
    });
}
// Flow execution utilities
export function buildDependencyGraph(steps) {
    const graph = new Map();
    for (const step of steps) {
        graph.set(step.id, new Set(step.dependencies));
    }
    return graph;
}
export function topologicalSort(steps) {
    const graph = buildDependencyGraph(steps);
    const inDegree = new Map();
    const result = [];
    const stepMap = new Map(steps.map(s => [s.id, s]));
    // Calculate in-degrees
    for (const step of steps) {
        inDegree.set(step.id, step.dependencies.length);
    }
    // Find steps with no dependencies
    const queue = steps.filter(step => step.dependencies.length === 0);
    while (queue.length > 0) {
        const current = queue.shift();
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
export function success(data) {
    return { success: true, data };
}
export function failure(error) {
    return { success: false, error };
}
export function isSuccess(result) {
    return result.success;
}
export function isFailure(result) {
    return !result.success;
}
// Constants
export const DEFAULT_CONFIG = {
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
};
export const TASK_STATUSES = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed'
};
export const AGENT_STATUSES = {
    IDLE: 'idle',
    BUSY: 'busy',
    ERROR: 'error',
    OFFLINE: 'offline'
};
// Re-export core components (will be migrated from src/core/)
export * from './claude-api-wrapper.js';
export * from './agent-tool-system.js';
export * from './repo-analyzer.js';
export * from './task-graph-generator.js';
// Re-export orchestrators
export * from './orchestrator/GraphynOrchestrator.js';
export * from './orchestrator/MultiAgentOrchestrator.js';
//# sourceMappingURL=index.js.map