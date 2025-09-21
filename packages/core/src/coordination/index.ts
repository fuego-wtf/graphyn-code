/**
 * Agent Coordination Module
 *
 * Complete inter-agent communication and coordination system for
 * multi-agent workflows in the Graphyn platform.
 */

// Core coordination protocol
export {
  AgentCoordinationProtocol,
  createAgentCoordinationProtocol,
  type AgentMessage,
  type TaskDelegation,
  type WorkflowSync,
  type AgentCapability,
  type AgentCoordinationConfig
} from './AgentCoordinationProtocol.js';

// Figma-specific workflow coordination
export {
  FigmaWorkflowOrchestrator,
  FigmaAuthCoordinator,
  FigmaExtractionCoordinator,
  FigmaGenerationCoordinator,
  createFigmaWorkflowOrchestrator,
  type FigmaWorkflowStep,
  type FigmaWorkflowOrchestration
} from './FigmaWorkflowCoordination.js';

// Figma types
export {
  type FigmaWorkflowConfig,
  type FigmaWorkflowProgress,
  type FigmaWorkflowResult,
  type ExtractedComponent
} from '../figma/types.js';