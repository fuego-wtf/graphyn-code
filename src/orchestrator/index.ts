/**
 * Orchestrator - Main Exports (CONSOLIDATED)
 * 
 * Simplified after massive file reduction from 36 to 14 files.
 */

// Main orchestrator exports
export {
  AgentOrchestrator,
  type AgentConfig,
  type TaskAnalysis,
  type OrchestrationResult
} from './AgentOrchestrator.js';

export {
  RealTimeExecutor,
  type ExecutionContext
} from './RealTimeExecutor.js';

// Import for type annotations in functions
import { AgentOrchestrator } from './AgentOrchestrator.js';
import { RealTimeExecutor } from './RealTimeExecutor.js';

// Core orchestrator classes (simplified exports)
export { MultiAgentSessionManager } from './MultiAgentSessionManager.js';
export { QueryProcessor } from './QueryProcessor.js'; 
export { TaskDependencyGraph } from './TaskDependencyGraph.js';
export { TaskPlanner } from './TaskPlanner.js';
export { ContextSynchronizer } from './ContextSynchronizer.js';
export { EventStream } from './EventStream.js';
export { SessionPoolManager } from './SessionPoolManager.js';

// Re-export types
export * from './types.js';

// Task distributor removed - functionality consolidated into AgentOrchestrator

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
  'production-architect',
  'code-cli-developer'
] as const;

export type AgentType = typeof AVAILABLE_AGENTS[number];

/**
 * Create a new agent orchestrator instance
 */
export function createOrchestrator(agentsPath?: string): AgentOrchestrator {
  return new AgentOrchestrator(agentsPath);
}

/**
 * Create a real-time executor
 */
export function createRealTimeExecutor(agentsPath?: string): RealTimeExecutor {
  return new RealTimeExecutor(agentsPath);
}

/**
 * Default export
 */
export { AgentOrchestrator as default };