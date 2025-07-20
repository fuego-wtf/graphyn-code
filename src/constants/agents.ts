/**
 * Centralized agent types to avoid duplication across the codebase
 */
export const AGENT_TYPES = ['backend', 'frontend', 'architect', 'design', 'cli'] as const;
export type AgentType = typeof AGENT_TYPES[number];

// Helper function to check if a string is a valid agent type
export function isAgentType(value: string): value is AgentType {
  return AGENT_TYPES.includes(value as AgentType);
}