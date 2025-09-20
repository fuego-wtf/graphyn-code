/**
 * @graphyn/core - Core types, utilities, and base functionality
 *
 * Provides shared types, validation schemas, utility functions,
 * and base classes used across the Graphyn ecosystem
 */
import { z } from 'zod';
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
export interface Task {
    id: string;
    agentType: string;
    description: string;
    priority: number;
    dependencies: string[];
    status: 'pending' | 'running' | 'completed' | 'failed';
    workspace?: string;
    config?: any;
    result?: any;
    createdAt: Date;
    updatedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    assignedAgent?: string;
    error?: string;
}
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
export declare const AgentSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    status: z.ZodEnum<["idle", "busy", "error", "offline"]>;
    capabilities: z.ZodArray<z.ZodString, "many">;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    lastActive: z.ZodOptional<z.ZodDate>;
    currentTask: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "error" | "idle" | "busy" | "offline";
    type: string;
    id: string;
    capabilities: string[];
    metadata?: Record<string, any> | undefined;
    lastActive?: Date | undefined;
    currentTask?: string | undefined;
}, {
    status: "error" | "idle" | "busy" | "offline";
    type: string;
    id: string;
    capabilities: string[];
    metadata?: Record<string, any> | undefined;
    lastActive?: Date | undefined;
    currentTask?: string | undefined;
}>;
export declare const TaskSchema: z.ZodObject<{
    id: z.ZodString;
    agentType: z.ZodString;
    description: z.ZodString;
    priority: z.ZodNumber;
    dependencies: z.ZodArray<z.ZodString, "many">;
    status: z.ZodEnum<["pending", "running", "completed", "failed"]>;
    workspace: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodAny>;
    result: z.ZodOptional<z.ZodAny>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    startedAt: z.ZodOptional<z.ZodDate>;
    completedAt: z.ZodOptional<z.ZodDate>;
    assignedAgent: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "completed" | "failed" | "running" | "pending";
    dependencies: string[];
    description: string;
    agentType: string;
    id: string;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
    error?: string | undefined;
    result?: any;
    workspace?: string | undefined;
    config?: any;
    startedAt?: Date | undefined;
    completedAt?: Date | undefined;
    assignedAgent?: string | undefined;
}, {
    status: "completed" | "failed" | "running" | "pending";
    dependencies: string[];
    description: string;
    agentType: string;
    id: string;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
    error?: string | undefined;
    result?: any;
    workspace?: string | undefined;
    config?: any;
    startedAt?: Date | undefined;
    completedAt?: Date | undefined;
    assignedAgent?: string | undefined;
}>;
export declare const FlowStepSchema: z.ZodObject<{
    id: z.ZodString;
    key: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    agentType: z.ZodString;
    command: z.ZodString;
    rollback: z.ZodOptional<z.ZodString>;
    validation: z.ZodOptional<z.ZodString>;
    dependencies: z.ZodArray<z.ZodString, "many">;
    priority: z.ZodNumber;
    tags: z.ZodArray<z.ZodString, "many">;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    command: string;
    dependencies: string[];
    description: string;
    agentType: string;
    id: string;
    priority: number;
    key: string;
    title: string;
    tags: string[];
    validation?: string | undefined;
    metadata?: Record<string, any> | undefined;
    rollback?: string | undefined;
}, {
    command: string;
    dependencies: string[];
    description: string;
    agentType: string;
    id: string;
    priority: number;
    key: string;
    title: string;
    tags: string[];
    validation?: string | undefined;
    metadata?: Record<string, any> | undefined;
    rollback?: string | undefined;
}>;
export declare const ExecutionFlowSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    version: z.ZodString;
    description: z.ZodString;
    steps: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        agentType: z.ZodString;
        command: z.ZodString;
        rollback: z.ZodOptional<z.ZodString>;
        validation: z.ZodOptional<z.ZodString>;
        dependencies: z.ZodArray<z.ZodString, "many">;
        priority: z.ZodNumber;
        tags: z.ZodArray<z.ZodString, "many">;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        command: string;
        dependencies: string[];
        description: string;
        agentType: string;
        id: string;
        priority: number;
        key: string;
        title: string;
        tags: string[];
        validation?: string | undefined;
        metadata?: Record<string, any> | undefined;
        rollback?: string | undefined;
    }, {
        command: string;
        dependencies: string[];
        description: string;
        agentType: string;
        id: string;
        priority: number;
        key: string;
        title: string;
        tags: string[];
        validation?: string | undefined;
        metadata?: Record<string, any> | undefined;
        rollback?: string | undefined;
    }>, "many">;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    description: string;
    id: string;
    name: string;
    version: string;
    steps: {
        command: string;
        dependencies: string[];
        description: string;
        agentType: string;
        id: string;
        priority: number;
        key: string;
        title: string;
        tags: string[];
        validation?: string | undefined;
        metadata?: Record<string, any> | undefined;
        rollback?: string | undefined;
    }[];
    metadata?: Record<string, any> | undefined;
}, {
    description: string;
    id: string;
    name: string;
    version: string;
    steps: {
        command: string;
        dependencies: string[];
        description: string;
        agentType: string;
        id: string;
        priority: number;
        key: string;
        title: string;
        tags: string[];
        validation?: string | undefined;
        metadata?: Record<string, any> | undefined;
        rollback?: string | undefined;
    }[];
    metadata?: Record<string, any> | undefined;
}>;
export declare const GraphynConfigSchema: z.ZodObject<{
    version: z.ZodString;
    workspace: z.ZodString;
    database: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<["sqlite", "mock"]>;
        path: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "sqlite" | "mock";
        path?: string | undefined;
    }, {
        type: "sqlite" | "mock";
        path?: string | undefined;
    }>>;
    logging: z.ZodOptional<z.ZodObject<{
        level: z.ZodEnum<["debug", "info", "warn", "error"]>;
        pretty: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        level: "error" | "debug" | "info" | "warn";
        pretty?: boolean | undefined;
    }, {
        level: "error" | "debug" | "info" | "warn";
        pretty?: boolean | undefined;
    }>>;
    agents: z.ZodOptional<z.ZodObject<{
        maxConcurrent: z.ZodOptional<z.ZodNumber>;
        timeout: z.ZodOptional<z.ZodNumber>;
        types: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        timeout?: number | undefined;
        maxConcurrent?: number | undefined;
        types?: string[] | undefined;
    }, {
        timeout?: number | undefined;
        maxConcurrent?: number | undefined;
        types?: string[] | undefined;
    }>>;
    coordination: z.ZodOptional<z.ZodObject<{
        port: z.ZodOptional<z.ZodNumber>;
        host: z.ZodOptional<z.ZodString>;
        enableWebSocket: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        port?: number | undefined;
        host?: string | undefined;
        enableWebSocket?: boolean | undefined;
    }, {
        port?: number | undefined;
        host?: string | undefined;
        enableWebSocket?: boolean | undefined;
    }>>;
    mcp: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodOptional<z.ZodBoolean>;
        tools: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        enabled?: boolean | undefined;
        tools?: string[] | undefined;
    }, {
        enabled?: boolean | undefined;
        tools?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    workspace: string;
    version: string;
    database?: {
        type: "sqlite" | "mock";
        path?: string | undefined;
    } | undefined;
    logging?: {
        level: "error" | "debug" | "info" | "warn";
        pretty?: boolean | undefined;
    } | undefined;
    agents?: {
        timeout?: number | undefined;
        maxConcurrent?: number | undefined;
        types?: string[] | undefined;
    } | undefined;
    coordination?: {
        port?: number | undefined;
        host?: string | undefined;
        enableWebSocket?: boolean | undefined;
    } | undefined;
    mcp?: {
        enabled?: boolean | undefined;
        tools?: string[] | undefined;
    } | undefined;
}, {
    workspace: string;
    version: string;
    database?: {
        type: "sqlite" | "mock";
        path?: string | undefined;
    } | undefined;
    logging?: {
        level: "error" | "debug" | "info" | "warn";
        pretty?: boolean | undefined;
    } | undefined;
    agents?: {
        timeout?: number | undefined;
        maxConcurrent?: number | undefined;
        types?: string[] | undefined;
    } | undefined;
    coordination?: {
        port?: number | undefined;
        host?: string | undefined;
        enableWebSocket?: boolean | undefined;
    } | undefined;
    mcp?: {
        enabled?: boolean | undefined;
        tools?: string[] | undefined;
    } | undefined;
}>;
export declare function generateId(prefix?: string): string;
export declare function validateTask(task: unknown): Task;
export declare function validateAgent(agent: unknown): Agent;
export declare function validateFlow(flow: unknown): ExecutionFlow;
export declare function validateConfig(config: unknown): GraphynConfig;
export declare function isTaskComplete(task: Task): boolean;
export declare function isTaskReady(task: Task, completedTasks: Set<string>): boolean;
export declare function getReadyTasks(tasks: Task[]): Task[];
export declare function isAgentAvailable(agent: Agent): boolean;
export declare function canAgentExecuteTask(agent: Agent, task: Task): boolean;
export declare function sortTasksByPriority(tasks: Task[]): Task[];
export declare function buildDependencyGraph(steps: FlowStep[]): Map<string, Set<string>>;
export declare function topologicalSort(steps: FlowStep[]): FlowStep[];
export type Result<T, E = Error> = {
    success: true;
    data: T;
} | {
    success: false;
    error: E;
};
export declare function success<T>(data: T): Result<T>;
export declare function failure<E = Error>(error: E): Result<never, E>;
export declare function isSuccess<T, E>(result: Result<T, E>): result is {
    success: true;
    data: T;
};
export declare function isFailure<T, E>(result: Result<T, E>): result is {
    success: false;
    error: E;
};
export declare const DEFAULT_CONFIG: GraphynConfig;
export declare const AGENT_TYPES: {
    readonly GENERAL: "general";
    readonly TYPESCRIPT: "typescript";
    readonly FIGMA: "figma";
    readonly BASH: "bash";
    readonly PYTHON: "python";
    readonly REACT: "react";
    readonly NODE: "node";
};
export declare const TASK_STATUSES: {
    readonly PENDING: "pending";
    readonly RUNNING: "running";
    readonly COMPLETED: "completed";
    readonly FAILED: "failed";
};
export declare const AGENT_STATUSES: {
    readonly IDLE: "idle";
    readonly BUSY: "busy";
    readonly ERROR: "error";
    readonly OFFLINE: "offline";
};
export * from './claude-api-wrapper.js';
export * from './agent-tool-system.js';
export * from './repo-analyzer.js';
export * from './task-graph-generator.js';
export * from './orchestrator/GraphynOrchestrator.js';
export * from './orchestrator/MultiAgentOrchestrator.js';
//# sourceMappingURL=index.d.ts.map