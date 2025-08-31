/**
 * Multi-Agent Orchestrator - Main Exports
 * 
 * A sophisticated system for coordinating multiple Claude Code sessions
 * to work together on complex development tasks.
 */

// Main orchestrator
export {
  MultiAgentOrchestrator,
  type Task,
  type OrchestrationRequest,
  type OrchestrationResult
} from './multi-agent-orchestrator.js';

// Graph-Neural Coordination System
export {
  GraphNeuralSystem,
  GraphFlowEngine,
  GraphBuilder,
  InputEnricher,
  OutputPropagator,
  createGraphNeuralExample,
  type GraphNeuralRequest,
  type GraphNeuralResult,
  type GraphNeuralProgress,
  type ExecutionGraph,
  type GraphNode,
  type GraphBuilderRequest,
  type EnrichmentContext,
  type EnrichedPrompt,
  type ParsedOutput,
  type PropagationResult
} from './graph-neural-system.js';

// Import for local use
import { MultiAgentOrchestrator } from './multi-agent-orchestrator.js';
import { GraphNeuralSystem } from './graph-neural-system.js';

// Component systems
export {
  AgentSpawnManager,
  type AgentSession,
  type WorkspaceContext
} from './agent-spawn-manager.js';

export {
  TaskDistributor,
  type TaskDependency
} from './task-distributor.js';

export {
  InterAgentCommunicationBus,
  type AgentMessage,
  type MessageHandler,
  type AgentContext
} from './communication-bus.js';

export {
  ExecutionCoordinator,
  type ExecutionSession,
  type TaskExecution,
  type DependencyGraph
} from './execution-coordinator.js';

export {
  ProgressTracker,
  type ProgressState,
  type AgentProgress,
  type TaskProgress
} from './progress-tracker.js';

// Convenience re-exports for common usage patterns
export type {
  // Request types
  OrchestrationRequest as Request,
  OrchestrationResult as Result,
  
  // Task types  
  Task as AgentTask
} from './multi-agent-orchestrator.js';

export type {
  TaskDependency as Dependency
} from './task-distributor.js';

export type {
  TaskExecution as Execution
} from './execution-coordinator.js';

export type {
  AgentMessage as Message,
  AgentContext as Context
} from './communication-bus.js';

export type {
  ProgressState as Progress,
  AgentProgress as AgentStatus
} from './progress-tracker.js';

/**
 * Create a new multi-agent orchestrator instance
 * 
 * @example
 * ```typescript
 * import { createOrchestrator } from '@graphyn/code/orchestrator';
 * 
 * const orchestrator = createOrchestrator();
 * 
 * const taskId = await orchestrator.orchestrate({
 *   query: "Build a user authentication system",
 *   context: { repository: "/path/to/project" },
 *   agents: ["architect", "backend", "frontend"],
 *   mode: "adaptive"
 * });
 * ```
 */
export function createOrchestrator() {
  return new MultiAgentOrchestrator();
}

/**
 * Create a new graph-neural coordination system
 * 
 * @example
 * ```typescript
 * import { createGraphNeuralSystem } from '@graphyn/code/orchestrator';
 * 
 * const system = createGraphNeuralSystem();
 * 
 * const result = await system.execute({
 *   query: "Build e-commerce checkout flow",
 *   context: { repository: "/path/to/project", framework: "Next.js" },
 *   options: { mode: "neural", parallelismLevel: "high" }
 * });
 * ```
 */
export function createGraphNeuralSystem(basePath?: string) {
  return new GraphNeuralSystem(basePath);
}

/**
 * Available agent types for orchestration
 */
export const AVAILABLE_AGENTS = [
  'architect',
  'backend', 
  'frontend',
  'test-writer',
  'design',
  'cli',
  'pr-merger',
  'task-dispatcher',
  'production-architect'
] as const;

export type AgentType = typeof AVAILABLE_AGENTS[number];

/**
 * Available execution modes
 */
export const EXECUTION_MODES = [
  'sequential',
  'parallel', 
  'adaptive'
] as const;

export type ExecutionMode = typeof EXECUTION_MODES[number];

/**
 * Task status types
 */
export const TASK_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'failed',
  'blocked'
] as const;

export type TaskStatus = typeof TASK_STATUSES[number];

/**
 * Helper function to create a basic orchestration request
 * 
 * @param query - Natural language description of what to build
 * @param repository - Path to the project repository  
 * @param agents - Which agents to involve (optional, will be auto-detected)
 * @param mode - Execution mode (default: 'adaptive')
 * @returns OrchestrationRequest ready to be executed
 * 
 * @example
 * ```typescript
 * const request = createRequest(
 *   "Build a REST API for user management",
 *   "/path/to/project",
 *   ["architect", "backend", "test-writer"]
 * );
 * 
 * const taskId = await orchestrator.orchestrate(request);
 * ```
 */
export function createRequest(
  query: string,
  repository: string,
  agents?: AgentType[],
  mode: ExecutionMode = 'adaptive'
) {
  return {
    query,
    context: {
      repository,
      // Auto-detect framework and language based on repository
      // This would be enhanced with actual detection logic
    },
    agents: agents || ['task-dispatcher'], // Let task dispatcher decide if no agents specified
    mode
  };
}

/**
 * Helper function to create a full-stack request
 */
export function createFullStackRequest(
  query: string,
  repository: string,
  framework?: string,
  mode: ExecutionMode = 'adaptive'
) {
  return {
    query,
    context: {
      repository,
      framework,
      language: 'TypeScript' // Default assumption
    },
    agents: ['architect', 'backend', 'frontend', 'test-writer', 'production-architect'],
    mode
  };
}

/**
 * Helper function to create a backend-only request
 */
export function createBackendRequest(
  query: string,
  repository: string,
  mode: ExecutionMode = 'sequential'
) {
  return {
    query,
    context: {
      repository,
      language: 'TypeScript'
    },
    agents: ['architect', 'backend', 'test-writer'],
    mode
  };
}

/**
 * Helper function to create a frontend-only request
 */
export function createFrontendRequest(
  query: string,
  repository: string,
  framework?: string,
  mode: ExecutionMode = 'sequential'
) {
  return {
    query,
    context: {
      repository,
      framework,
      language: 'TypeScript'
    },
    agents: ['design', 'frontend', 'test-writer'],
    mode
  };
}

/**
 * Default export for convenience
 */
export { MultiAgentOrchestrator as default };