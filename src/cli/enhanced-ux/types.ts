/**
 * Enhanced UX Phase 2 - Shared Type Definitions
 * 
 * Core types for split-screen terminal interface with repository-aware prompts
 */

// Terminal Layout Types
export interface TerminalDimensions {
  width: number;
  height: number;
}

export interface RegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutRegions {
  streaming: RegionBounds;      // 70% - Streaming output area
  approval: RegionBounds;       // 20% - Approval workflow area
  input: RegionBounds;          // 10% - Persistent input area
}

// Repository Context Types
export interface RepositoryInfo {
  path: string;
  name: string;
  techStack: string[];
  packageManagers: string[];
  frameworks: string[];
  scale: 'small' | 'medium' | 'large';
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface ContextAnalysisResult {
  repository: RepositoryInfo;
  agentPrompts: Record<string, string>;
  analysisTime: number;
  cacheKey: string;
  timestamp: number;
}

// Task Decomposition Types
export interface TaskItem {
  id: string;
  title: string;
  description: string;
  agent: string;
  estimatedTime: number;
  dependencies: string[];
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed';
}

export interface TaskDecompositionResult {
  query: string;
  tasks: TaskItem[];
  totalEstimatedTime: number;
  parallelizable: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
}

// Approval Workflow Types
export interface ApprovalState {
  tasks: TaskItem[];
  selectedIndex: number;
  modified: boolean;
  approved: boolean;
}

export interface KeyboardAction {
  key: string;
  action: 'approve' | 'modify' | 'filter' | 'cancel' | 'next' | 'previous' | 'toggle';
  target?: string;
}

// Exit Protection Types
export interface ExitRequest {
  signal: 'SIGINT' | 'SIGTERM';
  timestamp: number;
  activeProcesses: string[];
  hasUnsavedWork: boolean;
}

export interface ExitProtectionConfig {
  enableGracefulShutdown: boolean;
  autoConfirmTimeout: number;
  preserveSession: boolean;
}

// Persistent Input Types
export interface InputState {
  text: string;
  cursorPosition: number;
  history: string[];
  historyIndex: number;
}

export interface InputEvent {
  type: 'keypress' | 'submit' | 'clear' | 'history';
  data: string;
  timestamp: number;
}

// Performance Monitoring Types
export interface PerformanceMetrics {
  renderTime: number;      // Target: <16ms for 60fps
  analysisTime: number;    // Target: <3s for repository context
  inputResponseTime: number; // Target: <50ms
  memoryUsage: number;     // Target: <150MB
}

export interface PerformanceBenchmark {
  name: string;
  target: number;
  actual: number;
  passed: boolean;
}

// Event Types
export interface EnhancedUXEvent {
  type: 'terminal_resize' | 'context_change' | 'task_approval' | 'exit_request' | 'input_submit';
  payload: unknown;
  timestamp: number;
  source: 'user' | 'system';
}

// Error Types
export interface EnhancedUXError extends Error {
  code: string;
  context: Record<string, unknown>;
  recoverable: boolean;
}

// Configuration Types
export interface EnhancedUXConfig {
  performance: {
    maxRenderTime: number;
    maxAnalysisTime: number;
    maxInputResponseTime: number;
    maxMemoryUsage: number;
  };
  layout: {
    streamingRatio: number;   // Default: 0.7
    approvalRatio: number;    // Default: 0.2
    inputRatio: number;       // Default: 0.1
  };
  features: {
    enableExitProtection: boolean;
    enableContextCaching: boolean;
    enablePerformanceMonitoring: boolean;
  };
}