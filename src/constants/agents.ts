/**
 * Centralized agent types to avoid duplication across the codebase
 */
export const AGENT_TYPES = [
  'architect', 
  'backend', 
  'frontend', 
  'test-writer',
  'design', 
  'cli',
  'security',
  'researcher',
  'figma-extractor',
  'production-architect',
  'task-dispatcher',
  'pr-merger',
  'devops',
  'performance',
  'code-cli-developer'
] as const;
export type AgentType = typeof AGENT_TYPES[number];

// Helper function to check if a string is a valid agent type
export function isAgentType(value: string): value is AgentType {
  return AGENT_TYPES.includes(value as AgentType);
}