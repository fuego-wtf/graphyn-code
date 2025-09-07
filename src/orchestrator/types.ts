/**
 * Comprehensive Type System for CLI Orchestration Engine
 * 
 * This foundation provides all types needed for the multi-agent orchestration system
 * that transforms the CLI from React UI to invisible coordination engine.
 */

// ============================================================================
// CORE ORCHESTRATION TYPES
// ============================================================================

/**
 * Agent types available in the orchestration system
 */
export type AgentType = 
  | 'architect'           // System design and technical planning
  | 'backend'            // Backend development and API creation
  | 'frontend'           // Frontend development and UI creation
  | 'test-writer'        // Test creation and quality assurance
  | 'design'             // UI/UX design and prototyping
  | 'cli'                // CLI development and tooling
  | 'pr-merger'          // Code review and merge operations
  | 'task-dispatcher'    // Task analysis and assignment
  | 'production-architect' // Deployment and infrastructure
  | 'figma-extractor';   // Figma design extraction (preserved functionality)

/**
 * Execution modes for task coordination
 */
export type ExecutionMode = 
  | 'sequential'         // Tasks run one after another
  | 'parallel'           // Tasks run simultaneously when possible
  | 'adaptive';          // Dynamic execution based on dependencies and resources

/**
 * Task status throughout its lifecycle
 */
export type TaskStatus = 
  | 'pending'            // Task created but not started
  | 'in_progress'        // Task actively being executed
  | 'completed'          // Task finished successfully
  | 'failed'             // Task encountered errors
  | 'blocked'            // Task waiting for dependencies
  | 'cancelled';         // Task was cancelled

/**
 * Query complexity levels for orchestration planning
 */
export type QueryComplexity = 
  | 'simple'             // Single agent, minimal dependencies
  | 'moderate'           // Multiple agents, some coordination
  | 'complex'            // Many agents, complex dependencies
  | 'enterprise';        // Full-scale multi-service coordination

// ============================================================================
// TASK SYSTEM TYPES  
// ============================================================================

/**
 * Core task definition for orchestration system
 */
export interface TaskDefinition {
  readonly id: string;
  readonly description: string;
  readonly agent: AgentType;
  readonly dependencies: readonly string[];
  readonly priority: number;
  readonly estimatedDuration?: number;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Runtime task state with mutable properties
 */
export interface TaskExecution extends TaskDefinition {
  status: TaskStatus;
  startTime?: Date;
  endTime?: Date;
  progress: number; // 0-100
  result?: unknown;
  error?: string;
  logs: readonly string[];
  retryCount: number;
  maxRetries: number;
}

/**
 * Task dependency relationship
 */
export interface TaskDependency {
  readonly sourceTaskId: string;
  readonly targetTaskId: string;
  readonly type: 'hard' | 'soft'; // Hard = blocking, Soft = preferred order
  readonly reason?: string;
}

/**
 * Execution plan generated from query analysis
 */
export interface ExecutionPlan {
  readonly id: string;
  readonly query: string;
  readonly complexity: QueryComplexity;
  readonly mode: ExecutionMode;
  readonly tasks: readonly TaskDefinition[];
  readonly dependencies: readonly TaskDependency[];
  readonly estimatedDuration: number;
  readonly requiredAgents: readonly AgentType[];
  readonly parallelismLevel: number; // 1-10 scale
}

// ============================================================================
// SESSION AND CONTEXT TYPES
// ============================================================================

/**
 * Session configuration for orchestration
 */
export interface SessionConfig {
  readonly sessionId: string;
  readonly userId?: string;
  readonly workspace: WorkspaceContext;
  readonly preferences: UserPreferences;
  readonly constraints: ExecutionConstraints;
  readonly figmaConfig?: FigmaConfiguration; // Preserved Figma functionality
}

/**
 * Workspace context providing environment information
 */
export interface WorkspaceContext {
  readonly repository: string;
  readonly framework?: string;
  readonly language?: string;
  readonly dependencies?: readonly string[];
  readonly structure?: ProjectStructure;
  readonly gitBranch?: string;
  readonly environment?: 'development' | 'staging' | 'production';
}

/**
 * User preferences for orchestration behavior
 */
export interface UserPreferences {
  readonly defaultExecutionMode: ExecutionMode;
  readonly maxParallelTasks: number;
  readonly verboseLogging: boolean;
  readonly autoApprove: boolean;
  readonly preferredAgents?: readonly AgentType[];
  readonly notifications: NotificationSettings;
}

/**
 * Execution constraints and limits
 */
export interface ExecutionConstraints {
  readonly maxExecutionTime: number; // milliseconds
  readonly maxMemoryUsage: number;   // MB
  readonly maxParallelism: number;
  readonly resourceQuota?: ResourceQuota;
  readonly securityPolicy?: SecurityPolicy;
}

// ============================================================================
// COMMUNICATION AND COORDINATION TYPES
// ============================================================================

/**
 * Message passed between agents during execution
 */
export interface AgentMessage {
  readonly id: string;
  readonly from: AgentType;
  readonly to: AgentType | 'broadcast';
  readonly type: MessageType;
  readonly content: unknown;
  readonly timestamp: Date;
  readonly correlationId?: string;
  readonly priority: 'low' | 'normal' | 'high' | 'urgent';
}

/**
 * Types of messages agents can exchange
 */
export type MessageType = 
  | 'task_assignment'
  | 'task_completion'
  | 'task_error'
  | 'dependency_ready'
  | 'resource_request'
  | 'coordination_sync'
  | 'status_update'
  | 'figma_data';          // Preserved Figma message type

/**
 * Agent context during execution
 */
export interface AgentContext {
  readonly agentType: AgentType;
  readonly sessionId: string;
  readonly currentTask?: TaskExecution;
  readonly assignedTasks: readonly string[];
  readonly availableTools: readonly ToolDefinition[];
  readonly workspace: WorkspaceContext;
  readonly communicationBus: CommunicationBusInterface;
}

// ============================================================================
// QUERY PROCESSING TYPES
// ============================================================================

/**
 * Parsed query with extracted components
 */
export interface ParsedQuery {
  readonly originalQuery: string;
  readonly intent: QueryIntent;
  readonly entities: readonly ExtractedEntity[];
  readonly requiredAgents: readonly AgentType[];
  readonly suggestedMode: ExecutionMode;
  readonly complexity: QueryComplexity;
  readonly confidence: number; // 0-1 scale
}

/**
 * Query intent classification
 */
export type QueryIntent = 
  | 'build_feature'
  | 'fix_bug'
  | 'refactor_code'
  | 'add_tests'
  | 'deploy_app'
  | 'design_system'
  | 'extract_figma'       // Preserved Figma intent
  | 'analyze_code'
  | 'optimize_performance';

/**
 * Entities extracted from query analysis
 */
export interface ExtractedEntity {
  readonly type: 'technology' | 'component' | 'action' | 'constraint';
  readonly value: string;
  readonly confidence: number;
  readonly span: readonly [number, number]; // Character positions in query
}

// ============================================================================
// FIGMA INTEGRATION TYPES (PRESERVED)
// ============================================================================

/**
 * Figma configuration for design extraction
 * Preserves existing Figma functionality in the orchestrated system
 */
export interface FigmaConfiguration {
  readonly accessToken: string;
  readonly fileKey?: string;
  readonly nodeIds?: readonly string[];
  readonly extractionMode: 'components' | 'frames' | 'assets' | 'all';
  readonly outputFormat: 'react' | 'vue' | 'html' | 'json';
}

/**
 * Figma extraction result
 */
export interface FigmaExtractionResult {
  readonly success: boolean;
  readonly components?: readonly ComponentDefinition[];
  readonly assets?: readonly AssetDefinition[];
  readonly error?: string;
  readonly metadata: FigmaMetadata;
}

// ============================================================================
// PROGRESS AND MONITORING TYPES
// ============================================================================

/**
 * Overall orchestration progress
 */
export interface OrchestrationProgress {
  readonly sessionId: string;
  readonly startTime: Date;
  readonly currentTime: Date;
  readonly overallProgress: number; // 0-100
  readonly completedTasks: number;
  readonly totalTasks: number;
  readonly activeAgents: readonly AgentType[];
  readonly currentStage: string;
  readonly estimatedTimeRemaining?: number;
  readonly errors: readonly ExecutionError[];
}

/**
 * Individual agent progress
 */
export interface AgentProgress {
  readonly agentType: AgentType;
  readonly status: 'idle' | 'busy' | 'blocked' | 'error';
  readonly currentTask?: string;
  readonly taskProgress: number; // 0-100
  readonly lastActivity: Date;
  readonly metrics: AgentMetrics;
}

/**
 * Agent performance metrics
 */
export interface AgentMetrics {
  readonly tasksCompleted: number;
  readonly averageTaskTime: number;
  readonly successRate: number;
  readonly errorCount: number;
  readonly resourceUsage: ResourceUsage;
}

// ============================================================================
// ERROR HANDLING TYPES
// ============================================================================

/**
 * Execution error with context
 */
export interface ExecutionError {
  readonly id: string;
  readonly type: ErrorType;
  readonly message: string;
  readonly taskId?: string;
  readonly agentType?: AgentType;
  readonly timestamp: Date;
  readonly stack?: string;
  readonly context?: Record<string, unknown>;
  readonly recoverable: boolean;
}

/**
 * Error types in orchestration system
 */
export type ErrorType = 
  | 'task_failure'
  | 'agent_crash'
  | 'dependency_timeout'
  | 'resource_exhaustion'
  | 'communication_failure'
  | 'validation_error'
  | 'figma_api_error'     // Preserved Figma error type
  | 'configuration_error'
  | 'security_violation';

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

/**
 * Tool definition for agent capabilities
 */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: readonly ParameterDefinition[];
  readonly category: 'git' | 'file' | 'api' | 'figma' | 'build' | 'test' | 'deploy';
}

/**
 * Parameter definition for tools
 */
export interface ParameterDefinition {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  readonly required: boolean;
  readonly description: string;
  readonly default?: unknown;
}

/**
 * Project structure analysis
 */
export interface ProjectStructure {
  readonly type: 'monorepo' | 'single' | 'micro-frontend' | 'micro-service';
  readonly directories: readonly DirectoryInfo[];
  readonly configFiles: readonly string[];
  readonly packageManagers: readonly ('npm' | 'yarn' | 'pnpm')[];
}

/**
 * Directory information
 */
export interface DirectoryInfo {
  readonly path: string;
  readonly type: 'source' | 'test' | 'config' | 'docs' | 'build';
  readonly fileCount: number;
}

/**
 * Resource usage tracking
 */
export interface ResourceUsage {
  readonly cpu: number;      // Percentage
  readonly memory: number;   // MB
  readonly disk: number;     // MB
  readonly network: number;  // KB/s
}

/**
 * Resource quota limits
 */
export interface ResourceQuota {
  readonly maxCpu: number;
  readonly maxMemory: number;
  readonly maxDisk: number;
  readonly maxNetwork: number;
}

/**
 * Security policy constraints
 */
export interface SecurityPolicy {
  readonly allowedDomains: readonly string[];
  readonly blockedCommands: readonly string[];
  readonly requireApproval: readonly string[];
  readonly encryptionRequired: boolean;
}

/**
 * Notification settings
 */
export interface NotificationSettings {
  readonly onTaskComplete: boolean;
  readonly onError: boolean;
  readonly onProgress: boolean;
  readonly channels: readonly ('console' | 'file' | 'webhook')[];
}

/**
 * Component definition from Figma extraction
 */
export interface ComponentDefinition {
  readonly name: string;
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children?: readonly ComponentDefinition[];
  readonly styles: Record<string, unknown>;
}

/**
 * Asset definition from Figma extraction
 */
export interface AssetDefinition {
  readonly name: string;
  readonly url: string;
  readonly format: string;
  readonly dimensions: { width: number; height: number };
}

/**
 * Figma metadata
 */
export interface FigmaMetadata {
  readonly fileKey: string;
  readonly version: string;
  readonly lastModified: Date;
  readonly extractedComponents: number;
  readonly extractedAssets: number;
}

/**
 * Communication bus interface for agent coordination
 */
export interface CommunicationBusInterface {
  send(message: AgentMessage): Promise<void>;
  subscribe(agentType: AgentType, handler: MessageHandler): void;
  unsubscribe(agentType: AgentType): void;
  broadcast(message: Omit<AgentMessage, 'to'>): Promise<void>;
}

/**
 * Message handler function type
 */
export type MessageHandler = (message: AgentMessage) => Promise<void>;

// ============================================================================
// QUERY PROCESSING RESULT TYPES
// ============================================================================

/**
 * Result of query processing with execution plan
 */
export interface QueryProcessingResult {
  readonly parsed: ParsedQuery;
  readonly executionPlan: ExecutionPlan;
  readonly recommendations: readonly string[];
  readonly warnings: readonly string[];
  readonly estimatedCost?: CostEstimate;
}

/**
 * Cost estimation for execution
 */
export interface CostEstimate {
  readonly computeTime: number;    // minutes
  readonly resourceUnits: number;
  readonly estimatedCost: number;  // currency units
  readonly breakdown: readonly CostBreakdown[];
}

/**
 * Cost breakdown by component
 */
export interface CostBreakdown {
  readonly component: string;
  readonly usage: number;
  readonly rate: number;
  readonly cost: number;
}

/**
 * Agent-specific execution context for multi-agent coordination
 */
export interface AgentExecutionContext {
  readonly agentType: AgentType;
  readonly executionId: string;
  readonly assignedTasks: readonly TaskExecution[];
  readonly completedTasks: readonly TaskExecution[];
  readonly failedTasks: readonly TaskExecution[];
  readonly pendingTasks: readonly TaskExecution[];
  readonly otherAgents: readonly AgentType[];
  readonly repositoryContext: any; // Will be defined in ContextSynchronizer
  readonly progress: readonly any[]; // Progress updates
  readonly contextFiles: any; // Context file paths
}

/**
 * Task completion result
 */
export interface TaskResult {
  readonly taskId: string;
  readonly agentType: AgentType;
  readonly result?: any;
  readonly error?: string;
  readonly duration: number;
  readonly timestamp: Date;
}

/**
 * Execution results from multi-agent orchestration
 */
export interface ExecutionResults {
  success: boolean;
  readonly executionId: string;
  completedTasks: TaskResult[];
  failedTasks: TaskResult[];
  totalDuration: number;
  statistics: any; // ExecutionStatistics
}