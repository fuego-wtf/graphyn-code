/**
 * Multi-Agent Coordination System
 * REV-018: Enhanced SmartCoordinator with parallel Claude session management
 */

export { SmartCoordinator } from './smart-coordinator.js';
export { AgentRegistry } from './agent-registry.js';
export { TaskDecomposer } from './task-decomposer.js';
export { MultiAgentSessionManager } from './multi-agent-session-manager.js';
export { testMultiAgentSystem } from './test-multi-agent.js';

export type {
  AgentProfile,
  TaskNode,
  ExecutionGraph,
  AgentSession,
  CoordinationResult,
  AgentCapabilityMatch
} from './types.js';