/**
 * Types for Multi-Agent Coordination System
 */

export interface AgentProfile {
  name: string;
  description: string;
  model: string;
  color: string;
  capabilities: string[];
  specializations: string[];
  workloadScore: number; // 0-100, higher = more busy
}

export interface TaskNode {
  id: string;
  description: string;
  type: 'analysis' | 'implementation' | 'review' | 'testing' | 'documentation';
  complexity: 'low' | 'medium' | 'high';
  estimatedTimeMinutes: number;
  dependencies: string[]; // IDs of tasks that must complete first
  assignedAgent?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface ExecutionGraph {
  nodes: TaskNode[];
  totalEstimatedTime: number;
  parallelizable: boolean;
  maxConcurrency: number;
}

export interface AgentSession {
  id: string;
  agentName: string;
  status: 'idle' | 'busy' | 'error';
  currentTask?: string;
  startTime?: Date;
  lastActivity?: Date;
  performance: {
    tasksCompleted: number;
    averageTimeMinutes: number;
    successRate: number;
  };
}

export interface CoordinationResult {
  success: boolean;
  totalTimeSeconds: number;
  tasksCompleted: number;
  tasksFailed: number;
  results: any[];
  errors: string[];
}

export interface AgentCapabilityMatch {
  agentName: string;
  matchScore: number; // 0-1, higher = better match
  reasoning: string;
  workloadFactor: number;
}