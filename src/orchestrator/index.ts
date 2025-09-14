/**
 * Ultimate Orchestration Platform - Main Exports
 * All exports follow proper TypeScript naming conventions
 * - Classes: PascalCase
 * - Interfaces: PascalCase (no I prefix)
 * - Functions: camelCase
 * - Constants: UPPER_CASE
 * - Enums: PascalCase with UPPER_CASE members
 */

// Main orchestrator class - now with proper naming
export { UltimateOrchestrator } from './UltimateOrchestrator.js';

// Core supporting classes - PascalCase
export { TaskDecomposer } from './TaskDecomposer.js';
export { AgentSessionManager } from './AgentSessionManager.js';
export { GitWorktreeManager } from './GitWorktreeManager.js';

// Import for factory functions
import { UltimateOrchestrator } from './UltimateOrchestrator.js';
import { TaskDecomposer } from './TaskDecomposer.js';
import { AgentSessionManager } from './AgentSessionManager.js';
import { GitWorktreeManager } from './GitWorktreeManager.js';
import { TaskComplexity, AgentState, TaskStatus } from './types.js';
import {
  MAX_PARALLEL_AGENTS,
  DEFAULT_TIMEOUT_MS,
  REPOSITORY_ANALYSIS_TARGET_MS,
  MEMORY_LIMIT_MB,
  UI_RESPONSE_TARGET_MS
} from './constants.js';

// Type exports - PascalCase interfaces, no I prefix
export type {
  TaskNode,
  AgentPersona,
  AgentSession,
  AgentPerformanceMetrics,
  ExecutionGraph,
  OrchestrationResult,
  OrchestrationPerformanceMetrics,
  GitWorktreeInfo,
  UiState,
  PendingApproval,
  AgentAssignment,
  StreamingMessage,
  MessageMetadata,
  TaskResult,
  TaskError,
  TaskMetadata,
  DeepReadonly,
  RequiredFields,
  OptionalFields
} from './types.js';

// Enum exports - PascalCase with UPPER_CASE members
export {
  TaskStatus,
  TaskPriority,
  AgentState,
  TaskComplexity,
  InteractionMode,
  MessageType
} from './types.js';

// Type aliases - PascalCase, no T prefix
export type {
  AgentCapabilityScore,
  TaskDependencyGraph,
  AgentWorkloadMap,
  ExecutionPlan,
  AgentSessionMap
} from './types.js';

// Constants - UPPER_CASE
export {
  DEFAULT_TIMEOUT_MS,
  MAX_CLAUDE_SESSIONS,
  TASK_COMPLETION_TARGET_MS,
  REPOSITORY_ANALYSIS_TARGET_MS,
  UI_RESPONSE_TARGET_MS,
  MEMORY_LIMIT_MB,
  AGENT_ROLES,
  MAX_PARALLEL_AGENTS,
  DEFAULT_AGENT_CONCURRENCY,
  WORKTREE_PREFIX,
  BRANCH_PREFIX,
  STREAMING_OUTPUT_PERCENTAGE,
  APPROVAL_WORKFLOW_PERCENTAGE,
  PERSISTENT_INPUT_PERCENTAGE,
  GRAPHYN_CONFIG_DIR,
  PLAN_FILENAME,
  CONTEXT_FILENAME,
  PROGRESS_FILENAME,
  EVENTS_FILENAME,
  COMMIT_MESSAGE_PREFIX,
  PR_TITLE_PREFIX,
  MAIN_BRANCH,
  ERROR_MESSAGES
} from './constants.js';

// Additional exports from supporting classes
export type { SessionMetrics } from './AgentSessionManager.js';
export type { WorktreeStatus } from './GitWorktreeManager.js';

/**
 * Factory functions for external consumption - camelCase
 * Provides clean API while keeping class names internal
 */
export function createUltimateOrchestrator(): UltimateOrchestrator {
  return new UltimateOrchestrator();
}

export function createTaskDecomposer(): TaskDecomposer {
  return new TaskDecomposer();
}

export function createAgentSessionManager(): AgentSessionManager {
  return new AgentSessionManager();
}

export function createGitWorktreeManager(repositoryRoot?: string): GitWorktreeManager {
  return new GitWorktreeManager(repositoryRoot);
}

/**
 * Utility functions - camelCase
 */
export function validateTaskComplexity(complexity: string): complexity is TaskComplexity {
  return Object.values(TaskComplexity).includes(complexity as TaskComplexity);
}

export function validateAgentState(state: string): state is AgentState {
  return Object.values(AgentState).includes(state as AgentState);
}

export function validateTaskStatus(status: string): status is TaskStatus {
  return Object.values(TaskStatus).includes(status as TaskStatus);
}

/**
 * Available agent types - PascalCase enum with camelCase values
 */
export const AVAILABLE_AGENTS = [
  'architect',
  'backend',
  'frontend',
  'tester',
  'devops',
  'security',
  'researcher',
  'assistant'
] as const;

export type AgentType = typeof AVAILABLE_AGENTS[number];

/**
 * Version information - UPPER_CASE constants
 */
export const ORCHESTRATOR_VERSION = '1.0.0';
export const SUPPORTED_CLAUDE_VERSION = '^1.0.108';

/**
 * Default configuration - UPPER_CASE constant with camelCase properties
 */
export const DEFAULT_ORCHESTRATOR_CONFIG = {
  maxParallelAgents: MAX_PARALLEL_AGENTS,
  taskTimeoutMs: DEFAULT_TIMEOUT_MS,
  repositoryAnalysisTargetMs: REPOSITORY_ANALYSIS_TARGET_MS,
  memoryLimitMb: MEMORY_LIMIT_MB,
  enableAutoCommit: true,
  enableAutoMerge: false,
  uiResponseTargetMs: UI_RESPONSE_TARGET_MS
} as const;

/**
 * Default export - PascalCase class
 */
export { UltimateOrchestrator as default };