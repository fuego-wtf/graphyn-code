/**
 * Core business types for Task Planning and Orchestration
 * 
 * Extracted from UI components to preserve business logic while removing terminal UI.
 * Used by TaskPlanner and other orchestration components.
 */

// Re-export AgentType from constants
export { AgentType } from '../constants/agents.js';

// Task Planning Types (from ApprovalWorkflowPanel)
export interface Task {
  id: string;
  title: string;
  description: string;
  assignedAgent: string;
  estimatedDuration: number; // in minutes
  dependencies: string[];
  status: TaskStatus;
  priority: TaskPriority;
  tools?: string[];
  expectedOutputs?: string[];
}

export enum TaskStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum TaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface TaskDecomposition {
  id: string;
  originalQuery: string;
  tasks: Task[];
  estimatedTotalDuration: number;
  confidence: number;
  riskFactors: RiskFactor[];
}

export interface RiskFactor {
  type: 'complexity' | 'dependency' | 'resource' | 'time';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ApprovalState {
  selectedTaskIndex: number;
  approvedTasks: Set<string>;
  mode: 'selection' | 'approval' | 'execution' | 'complete';
}

// Additional types needed by orchestrator components
export interface TaskExecution {
  id: string;
  taskId: string;
  agentType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  result?: any;
  error?: string;
}

export interface ExecutionResults {
  success: boolean;
  results: TaskResult[];
  errors: string[];
  totalDuration: number;
  primaryResponse?: string;
}

export interface TaskResult {
  taskId: string;
  agentType: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

export interface ExecutionPlan {
  id: string;
  tasks: TaskDefinition[];
  dependencies: TaskDependency[];
  estimatedDuration: number;
  parallelizable: boolean;
}

export interface TaskDefinition {
  id: string;
  title: string;
  description: string;
  agentType: string;
  complexity: 'low' | 'medium' | 'high';
  estimatedDuration: number;
  dependencies: string[];
  tools: string[];
}

export interface TaskDependency {
  fromTask: string;
  toTask: string;
  type: 'blocking' | 'preferred' | 'data';
}

export interface AgentExecutionContext {
  agentType: string;
  sessionId: string;
  workingDirectory: string;
  currentTask?: string;
  isActive: boolean;
}

export interface QueryProcessingResult {
  query: string;
  intent: QueryIntent;
  complexity: QueryComplexity;
  executionPlan: ExecutionPlan;
  confidence: number;
}

export interface ParsedQuery {
  originalQuery: string;
  intent: QueryIntent;
  entities: ExtractedEntity[];
  complexity: QueryComplexity;
  agentHints: string[];
}

export enum QueryIntent {
  ANALYZE = 'analyze',
  BUILD = 'build',
  DEBUG = 'debug',
  OPTIMIZE = 'optimize',
  DOCUMENT = 'document',
  TEST = 'test',
  DEPLOY = 'deploy'
}

export enum QueryComplexity {
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
  ENTERPRISE = 'enterprise'
}

export enum ExecutionMode {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  HYBRID = 'hybrid'
}

export interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
}

export interface ExecutionError {
  type: string;
  message: string;
  taskId?: string;
  agentType?: string;
  stack?: string;
}