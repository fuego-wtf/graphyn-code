/**
 * Ultimate Orchestration Platform - Core Types
 * All interfaces use PascalCase without I prefix
 * All type aliases use PascalCase without T prefix
 * All enums use PascalCase with UPPER_CASE members
 * All variables/functions use camelCase
 * All constants use UPPER_CASE
 *
 * NOTE: All timeout constants are defined in constants.ts to avoid conflicts
 */

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

// ============================================================================
// CANONICAL ORCHESTRATION EVENT + TELEMETRY SCHEMA
// ============================================================================

export const ORCHESTRATION_EVENT_SCHEMA_VERSION = 'orchestration.event.v1' as const;
export const ORCHESTRATION_TELEMETRY_SCHEMA_VERSION = 'orchestration.telemetry.v1' as const;

export type OrchestrationEventSeverity = 'info' | 'warning' | 'error' | 'critical';

export type OrchestrationEventKind =
  | 'phase_transition'
  | 'phase_gate'
  | 'gate_resolved'
  | 'task_started'
  | 'task_progress'
  | 'task_completed'
  | 'orchestration_progress'
  | 'orchestration_error'
  | 'agent_spawn_failed'
  | 'plan_approval_outcome'
  | 'stuck_orchestration_alert';

export type OrchestrationRuntimeState =
  | 'pending'
  | 'initializing'
  | 'running'
  | 'blocked'
  | 'stuck'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type OrchestrationRuntimeAlertKind = 'blocked' | 'stuck';
export type OrchestrationRuntimeAlertSeverity = 'warning' | 'critical';
export type OrchestrationAlertReceiptSource =
  | 'runtime_snapshot'
  | 'orchestration_event'
  | 'watchdog_timer';

export interface OrchestrationEventProgress {
  readonly completedSteps?: number;
  readonly totalSteps?: number;
  readonly percentage?: number;
}

export interface OrchestrationEventGate {
  readonly type: string;
  readonly status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  readonly description?: string;
}

export interface CanonicalOrchestrationEvent {
  readonly schemaVersion: typeof ORCHESTRATION_EVENT_SCHEMA_VERSION;
  readonly eventId: string;
  readonly kind: OrchestrationEventKind;
  readonly executionId: string;
  readonly orchestrationId: string;
  readonly threadId?: string;
  readonly timestampMs: number;
  readonly source: string;
  readonly severity: OrchestrationEventSeverity;
  readonly phase?: string;
  readonly taskId?: string;
  readonly agentId?: string;
  readonly stepIndex?: number;
  readonly totalSteps?: number;
  readonly currentStepName?: string;
  readonly gate?: OrchestrationEventGate;
  readonly progress?: OrchestrationEventProgress;
  readonly message?: string;
  readonly blockers?: readonly string[];
  readonly payload?: Record<string, unknown>;
}

export interface OrchestrationEventInput
  extends Omit<
    CanonicalOrchestrationEvent,
    'schemaVersion' | 'eventId' | 'executionId' | 'orchestrationId' | 'timestampMs' | 'severity'
  > {
  readonly schemaVersion?: typeof ORCHESTRATION_EVENT_SCHEMA_VERSION;
  readonly eventId?: string;
  readonly executionId?: string;
  readonly orchestrationId?: string;
  readonly timestampMs?: number;
  readonly severity?: OrchestrationEventSeverity;
}

export interface OrchestrationAlertThresholds {
  readonly stuckAfterMs: number;
  readonly blockedAfterMs: number;
}

export const DEFAULT_ORCHESTRATION_ALERT_THRESHOLDS: OrchestrationAlertThresholds = Object.freeze({
  stuckAfterMs: 120_000,
  blockedAfterMs: 0
});

/**
 * Summary snapshot used for receipts. Raw prompt, plan, gate, and payload text
 * stays outside this shape so alert evidence can be reported without leakage.
 */
export interface OrchestrationTelemetrySnapshot {
  readonly schemaVersion: typeof ORCHESTRATION_TELEMETRY_SCHEMA_VERSION;
  readonly orchestrationId: string;
  readonly threadId?: string;
  readonly state: OrchestrationRuntimeState;
  readonly phase?: string;
  readonly stepIndex?: number;
  readonly totalSteps?: number;
  readonly currentStepName?: string;
  readonly lastProgressAtMs: number;
  readonly observedAtMs: number;
  readonly blockers: readonly string[];
  readonly pendingGateType?: string;
  readonly sourceEvent?: OrchestrationEventKind;
}

export interface OrchestrationAlertReceipt {
  readonly receiptId: string;
  readonly source: OrchestrationAlertReceiptSource;
  readonly generatedAtMs: number;
  readonly evidence: Record<string, string>;
}

export interface OrchestrationRuntimeAlert {
  readonly schemaVersion: typeof ORCHESTRATION_TELEMETRY_SCHEMA_VERSION;
  readonly alertId: string;
  readonly kind: OrchestrationRuntimeAlertKind;
  readonly severity: OrchestrationRuntimeAlertSeverity;
  readonly state: OrchestrationRuntimeState;
  readonly message: string;
  readonly receipt: OrchestrationAlertReceipt;
}

export function createCanonicalOrchestrationEvent(
  input: OrchestrationEventInput
): CanonicalOrchestrationEvent {
  const timestampMs = input.timestampMs ?? Date.now();
  const executionId = input.executionId ?? input.orchestrationId ?? 'unknown';
  const orchestrationId = input.orchestrationId ?? executionId;

  return {
    ...input,
    schemaVersion: ORCHESTRATION_EVENT_SCHEMA_VERSION,
    eventId: input.eventId ?? `orch_evt_${timestampMs}_${Math.random().toString(36).slice(2, 8)}`,
    executionId,
    orchestrationId,
    timestampMs,
    severity: input.severity ?? defaultSeverityForOrchestrationEvent(input.kind)
  };
}

export function createOrchestrationTelemetrySnapshot(
  event: CanonicalOrchestrationEvent,
  observedAtMs: number = event.timestampMs
): OrchestrationTelemetrySnapshot {
  const state = runtimeStateForOrchestrationEvent(event);
  const blockers = blockersForOrchestrationEvent(event);
  const stepIndex = event.stepIndex ?? event.progress?.completedSteps;
  const totalSteps = event.totalSteps ?? event.progress?.totalSteps;

  return {
    schemaVersion: ORCHESTRATION_TELEMETRY_SCHEMA_VERSION,
    orchestrationId: event.orchestrationId,
    threadId: event.threadId,
    state,
    phase: event.phase ?? phaseForOrchestrationEvent(event),
    stepIndex,
    totalSteps,
    currentStepName: event.currentStepName ?? event.message,
    lastProgressAtMs: isProgressEvent(event) ? event.timestampMs : observedAtMs,
    observedAtMs,
    blockers,
    pendingGateType: event.kind === 'phase_gate' ? event.gate?.type : undefined,
    sourceEvent: event.kind
  };
}

export function deriveOrchestrationRuntimeAlert(
  snapshot: OrchestrationTelemetrySnapshot,
  thresholds: OrchestrationAlertThresholds = DEFAULT_ORCHESTRATION_ALERT_THRESHOLDS,
  receiptSource?: OrchestrationAlertReceiptSource
): OrchestrationRuntimeAlert | null {
  if (isTerminalOrchestrationRuntimeState(snapshot.state)) {
    return null;
  }

  const elapsedMs = elapsedSinceProgress(snapshot);
  const isBlocked =
    snapshot.state === 'blocked' ||
    Boolean(snapshot.pendingGateType) ||
    snapshot.blockers.length > 0;

  if (isBlocked && elapsedMs >= thresholds.blockedAfterMs) {
    return buildOrchestrationRuntimeAlert(
      snapshot,
      thresholds,
      elapsedMs,
      'blocked',
      'warning',
      receiptSource
    );
  }

  const canBeStuck =
    snapshot.state === 'pending' ||
    snapshot.state === 'initializing' ||
    snapshot.state === 'running' ||
    snapshot.state === 'stuck';

  if (canBeStuck && elapsedMs >= thresholds.stuckAfterMs) {
    return buildOrchestrationRuntimeAlert(
      snapshot,
      thresholds,
      elapsedMs,
      'stuck',
      'critical',
      receiptSource
    );
  }

  return null;
}

export function isTerminalOrchestrationRuntimeState(state: OrchestrationRuntimeState): boolean {
  return state === 'completed' || state === 'failed' || state === 'cancelled';
}

function defaultSeverityForOrchestrationEvent(kind: OrchestrationEventKind): OrchestrationEventSeverity {
  switch (kind) {
    case 'phase_gate':
    case 'plan_approval_outcome':
      return 'warning';
    case 'orchestration_error':
    case 'agent_spawn_failed':
    case 'stuck_orchestration_alert':
      return 'error';
    default:
      return 'info';
  }
}

function runtimeStateForOrchestrationEvent(event: CanonicalOrchestrationEvent): OrchestrationRuntimeState {
  switch (event.kind) {
    case 'phase_gate':
      return 'blocked';
    case 'orchestration_error':
    case 'agent_spawn_failed':
      return 'failed';
    case 'stuck_orchestration_alert':
      return 'stuck';
    case 'task_completed':
      return event.progress?.totalSteps !== undefined &&
        event.progress.completedSteps !== undefined &&
        event.progress.completedSteps >= event.progress.totalSteps
        ? 'completed'
        : 'running';
    default:
      return 'running';
  }
}

function blockersForOrchestrationEvent(event: CanonicalOrchestrationEvent): readonly string[] {
  if (event.blockers && event.blockers.length > 0) {
    return event.blockers;
  }

  if (event.kind === 'phase_gate') {
    return [event.gate?.description ?? event.message ?? `pending gate: ${event.gate?.type ?? 'unknown'}`];
  }

  if (event.kind === 'orchestration_error' || event.kind === 'agent_spawn_failed') {
    return [event.message ?? event.kind];
  }

  return [];
}

function phaseForOrchestrationEvent(event: CanonicalOrchestrationEvent): string | undefined {
  switch (event.kind) {
    case 'phase_transition':
      return event.currentStepName ?? 'phase_transition';
    case 'phase_gate':
      return 'phase_gate';
    case 'gate_resolved':
      return 'gate_resolved';
    case 'orchestration_error':
      return 'error';
    default:
      return undefined;
  }
}

function isProgressEvent(event: CanonicalOrchestrationEvent): boolean {
  return (
    event.kind === 'phase_transition' ||
    event.kind === 'gate_resolved' ||
    event.kind === 'task_started' ||
    event.kind === 'task_progress' ||
    event.kind === 'task_completed' ||
    event.kind === 'orchestration_progress'
  );
}

function elapsedSinceProgress(snapshot: OrchestrationTelemetrySnapshot): number {
  if (snapshot.observedAtMs <= snapshot.lastProgressAtMs) {
    return 0;
  }
  return snapshot.observedAtMs - snapshot.lastProgressAtMs;
}

function buildOrchestrationRuntimeAlert(
  snapshot: OrchestrationTelemetrySnapshot,
  thresholds: OrchestrationAlertThresholds,
  elapsedMs: number,
  kind: OrchestrationRuntimeAlertKind,
  severity: OrchestrationRuntimeAlertSeverity,
  receiptSource?: OrchestrationAlertReceiptSource
): OrchestrationRuntimeAlert {
  const receipt = buildOrchestrationAlertReceipt(snapshot, thresholds, elapsedMs, kind, receiptSource);
  return {
    schemaVersion: ORCHESTRATION_TELEMETRY_SCHEMA_VERSION,
    alertId: receipt.receiptId,
    kind,
    severity,
    state: kind === 'stuck' ? 'stuck' : 'blocked',
    message: orchestrationAlertMessage(snapshot, kind, elapsedMs),
    receipt
  };
}

function buildOrchestrationAlertReceipt(
  snapshot: OrchestrationTelemetrySnapshot,
  thresholds: OrchestrationAlertThresholds,
  elapsedMs: number,
  kind: OrchestrationRuntimeAlertKind,
  receiptSource?: OrchestrationAlertReceiptSource
): OrchestrationAlertReceipt {
  const evidence: Record<string, string> = {
    state: snapshot.state,
    elapsed_ms: String(elapsedMs),
    stuck_after_ms: String(thresholds.stuckAfterMs),
    blocked_after_ms: String(thresholds.blockedAfterMs),
    blocker_count: String(snapshot.blockers.length)
  };

  addEvidence(evidence, 'thread_id', snapshot.threadId);
  addEvidence(evidence, 'phase', snapshot.phase);
  addEvidence(evidence, 'step_index', numberToEvidence(snapshot.stepIndex));
  addEvidence(evidence, 'total_steps', numberToEvidence(snapshot.totalSteps));
  addEvidence(evidence, 'gate_type', snapshot.pendingGateType);
  addEvidence(evidence, 'source_event', snapshot.sourceEvent);

  return {
    receiptId: `${snapshot.orchestrationId}:${kind}:${snapshot.observedAtMs}`,
    source: receiptSource ?? (snapshot.sourceEvent ? 'orchestration_event' : 'runtime_snapshot'),
    generatedAtMs: snapshot.observedAtMs,
    evidence
  };
}

function addEvidence(evidence: Record<string, string>, key: string, value?: string): void {
  if (value !== undefined && value !== '') {
    evidence[key] = value;
  }
}

function numberToEvidence(value?: number): string | undefined {
  return value === undefined ? undefined : String(value);
}

function orchestrationAlertMessage(
  snapshot: OrchestrationTelemetrySnapshot,
  kind: OrchestrationRuntimeAlertKind,
  elapsedMs: number
): string {
  if (kind === 'blocked') {
    const blocker = snapshot.blockers[0] ?? snapshot.pendingGateType ?? 'blocked runtime state';
    return `Orchestration ${snapshot.orchestrationId} is blocked after ${elapsedMs} ms: ${blocker}`;
  }

  return `Orchestration ${snapshot.orchestrationId} is stuck: no progress for ${elapsedMs} ms`;
}
