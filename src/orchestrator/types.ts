/**
 * Ultimate Orchestration Platform - Core Types
 * All interfaces use PascalCase without I prefix
 * All type aliases use PascalCase without T prefix
 * All enums use PascalCase with UPPER_CASE members
 * All variables/functions use camelCase
 * All constants use UPPER_CASE
 */

// Constants for configuration
const MAX_PARALLEL_AGENTS = 8;
const DEFAULT_TIMEOUT_MS = 30000;
const TASK_COMPLETION_TARGET_MS = 30000;

// Re-export AgentType from constants with proper naming
export { AgentType } from '../constants/agents.js';

// Core task interface - proper PascalCase, no I prefix
export interface TaskNode {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly assignedAgent: string;
  readonly estimatedDuration: number; // in minutes
  readonly dependencies: readonly string[];
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly tools: readonly string[];
  readonly expectedOutputs: readonly string[];
  readonly createdAt: Date;
  readonly metadata: TaskMetadata;
}

// Enums with proper PascalCase name and UPPER_CASE members
export enum TaskStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  BLOCKED = 'BLOCKED'
}

export enum TaskPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum AgentState {
  IDLE = 'IDLE',
  BUSY = 'BUSY',
  ERROR = 'ERROR',
  TERMINATED = 'TERMINATED'
}

export enum TaskComplexity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum InteractionMode {
  Planning = 'Planning',
  Execution = 'Execution',
  Review = 'Review',
  Emergency = 'Emergency'
}

export enum MessageType {
  OUTPUT = 'OUTPUT',
  ERROR = 'ERROR',
  PROGRESS = 'PROGRESS',
  COMPLETION = 'COMPLETION'
}

// Additional task metadata interface
export interface TaskMetadata {
  readonly priority: number; // 1-10
  readonly tags: readonly string[];
  readonly gitBranch: string | null;
  readonly worktreePath: string | null;
}

// Agent performance metrics
export interface AgentPerformanceMetrics {
  readonly tasksCompleted: number;
  readonly averageTimeMinutes: number;
  readonly successRate: number; // 0-1
  readonly lastActivity: Date | null;
}

// Core agent persona interface
export interface AgentPersona {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly role: string;
  readonly systemPrompt: string;
  readonly capabilities: readonly string[];
  readonly specializations: readonly string[];
  readonly workloadScore: number; // 0-100
  readonly performanceMetrics: AgentPerformanceMetrics;
}

// Agent session management
export interface AgentSession {
  readonly id: string;
  readonly agentPersona: AgentPersona;
  state: AgentState;
  currentTask: string | null;
  readonly startTime: Date;
  lastHeartbeat: Date;
  processId: number | null;
  readonly worktreePath: string | null;
  readonly gitBranch: string | null;
}

// Task result interface (consolidated)
export interface TaskResult {
  readonly taskId: string;
  readonly agentType: string;
  readonly success: boolean;
  readonly output?: string;
  readonly result?: any;
  readonly error?: string;
  readonly duration: number;
  readonly artifacts?: readonly string[];
  readonly filesModified?: readonly string[];
  readonly timeElapsedMs?: number;
  readonly memoryUsedMb?: number;
}

// Task error interface
export interface TaskError {
  readonly message: string;
  readonly code: string;
  readonly stack: string | null;
  readonly recoverable: boolean;
}

// Orchestration performance metrics
export interface OrchestrationPerformanceMetrics {
  readonly memoryPeakMb: number;
  readonly cpuAveragePercent: number;
  readonly parallelEfficiency: number; // 0-1
  readonly targetTimeAchieved: boolean;
}

// Main orchestration result
export interface OrchestrationResult {
  readonly success: boolean;
  readonly totalTimeSeconds: number;
  readonly tasksCompleted: number;
  readonly tasksFailed: number;
  readonly agentsUsed: number;
  readonly results: readonly TaskResult[];
  readonly errors: readonly string[];
  readonly performanceMetrics: OrchestrationPerformanceMetrics;
}

// Git worktree information
export interface GitWorktreeInfo {
  readonly path: string;
  readonly branch: string;
  readonly commitHash: string;
  readonly isClean: boolean;
}

// UI state management
export interface UiState {
  readonly mode: InteractionMode;
  readonly activeAgents: readonly string[];
  readonly currentTask: TaskNode | null;
  readonly pendingApproval: PendingApproval | null;
  readonly streamingOutput: readonly StreamingMessage[];
  readonly inputHistory: readonly string[];
}

// Pending approval interface
export interface PendingApproval {
  readonly taskId: string;
  readonly agentAssignments: readonly AgentAssignment[];
  readonly estimatedTime: number;
  readonly risks: readonly string[];
}

// Agent assignment interface
export interface AgentAssignment {
  readonly agentId: string;
  readonly taskIds: readonly string[];
  readonly estimatedTime: number;
}

// Streaming message interface
export interface StreamingMessage {
  readonly timestamp: Date;
  readonly agentId: string;
  readonly type: MessageType;
  readonly content: string;
  readonly metadata: MessageMetadata;
}

// Message metadata interface
export interface MessageMetadata {
  readonly taskId: string | null;
  readonly severity: 'info' | 'warn' | 'error';
  readonly attachments: readonly string[];
}

// Execution graph interface (consolidated)
export interface ExecutionGraph {
  readonly nodes: TaskNode[] | TaskDefinition[];
  readonly edges?: TaskDependency[];
  readonly batches?: TaskDefinition[][];
  readonly totalEstimatedTimeMinutes: number;
  readonly maxConcurrency: number;
  readonly parallelizable: boolean;
  readonly criticalPath: readonly string[];
}

// Type aliases for complex types - PascalCase, no T prefix
export type AgentCapabilityScore = number; // 0-1
export type TaskDependencyGraph = Map<string, readonly string[]>;
export type AgentWorkloadMap = Map<string, number>;
export type TaskNodeArray = readonly TaskNode[];
export type AgentSessionMap = Map<string, AgentSession>;

// Utility types
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

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
  status: 'pending' | 'running' | 'completed' | 'failed' | 'in_progress' | 'blocked';
  startTime?: Date;
  endTime?: Date;
  result?: any;
  error?: string;
  agent?: string;
  priority?: number;
  dependencies?: string[];
  description?: string;
  estimatedDuration?: number;
  tags?: string[];
  progress?: number;
  logs: any[];
  retryCount: number;
  maxRetries: number;
  title?: string;
  complexity?: 'low' | 'medium' | 'high';
  tools?: string[];
}

export interface ExecutionResults {
  success: boolean;
  results: TaskResult[];
  errors: string[];
  totalDuration: number;
  primaryResponse?: string;
  executionId?: string;
  completedTasks?: TaskResult[];
  failedTasks?: TaskResult[];
  statistics?: any;
}

// ExecutionPlan interface (consolidated)
export interface ExecutionPlan {
  readonly id?: string;
  readonly nodes?: TaskNode[];
  readonly tasks?: TaskDefinition[];
  readonly dependencies?: TaskDependency[];
  readonly estimatedDuration?: number;
  readonly parallelizable?: boolean;
  readonly query?: string;
  readonly mode?: ExecutionMode;
  readonly confidence?: number;
  readonly requiredAgents?: string[];
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
  agent?: string;
  priority?: number;
  estimatedMinutes?: number;
}

export interface TaskDependency {
  fromTask: string;
  toTask: string;
  type: 'blocking' | 'preferred' | 'data' | 'hard' | 'soft';
  sourceTaskId?: string;
  targetTaskId?: string;
}

export interface AgentExecutionContext {
  agentType: string;
  sessionId?: string;
  workingDirectory?: string;
  currentTask?: string;
  isActive?: boolean;
  executionId?: string;
  repositoryContext?: any;
  otherAgents?: string[];
  tasks?: TaskExecution[];
  assignedTasks?: TaskExecution[];
  completedTasks?: TaskExecution[];
  failedTasks?: TaskExecution[];
  pendingTasks?: TaskExecution[];
  progress?: any[];
  contextFiles?: any;
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
  requiredAgents?: string[];
  confidence?: number;
  suggestedMode?: ExecutionMode;
  parsed?: any;
}

export enum QueryIntent {
  ANALYZE = 'analyze',
  BUILD = 'build',
  DEBUG = 'debug',
  OPTIMIZE = 'optimize',
  DOCUMENT = 'document',
  TEST = 'test',
  DEPLOY = 'deploy',
  EXTRACT_FIGMA = 'extract_figma',
  BUILD_FEATURE = 'build_feature',
  FIX_BUG = 'fix_bug',
  ADD_TESTS = 'add_tests',
  REFACTOR_CODE = 'refactor_code',
  DEPLOY_APP = 'deploy_app'
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
  HYBRID = 'hybrid',
  ADAPTIVE = 'adaptive'
}

export interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
  span?: number[];
}

export interface ExecutionError {
  type: string;
  message: string;
  taskId?: string;
  agentType?: string;
  stack?: string;
}

// Additional type aliases and interfaces for task management
export interface Task {
  id: string;
  title: string;
  description: string;
  assignedAgent: string;
  agentType?: string;
  complexity?: 'low' | 'medium' | 'high';
  estimatedDuration: number;
  dependencies: string[];
  status: TaskStatus;
  priority: TaskPriority;
  tools: string[];
  expectedOutputs: string[];
}

export interface TaskTemplate {
  id: string;
  pattern: RegExp;
  generator: (query: string, context: any) => TaskDefinition[];
}

// Type for task status used in ConsoleOutput
export type TaskStatus2 = 'pending' | 'running' | 'completed' | 'failed' | 'in_progress' | 'blocked';

// Additional execution options
export interface ExecutionOptions {
  mode: ExecutionMode;
  maxConcurrency?: number;
  timeout?: number;
}

// Query processor configuration
export interface QueryProcessorConfig {
  maxComplexity: QueryComplexity;
  defaultMode: ExecutionMode;
  enableSpecialization?: boolean;
}
