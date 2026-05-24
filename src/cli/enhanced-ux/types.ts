export type AgentType =
  | 'architect'
  | 'backend'
  | 'frontend'
  | 'tester'
  | 'devops'
  | 'security'
  | 'data'
  | 'docs'
  | 'fullstack-dev'
  | (string & {});

export type TaskStatus = 'pending' | 'approved' | 'rejected' | 'running' | 'completed' | 'failed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type DecompositionStatus =
  | 'analyzing'
  | 'pending_approval'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalAction = 'approve' | 'reject' | 'cancel' | 'modify' | 'toggle';

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  agent: AgentType;
  estimatedTime: number;
  dependencies: string[];
  status: TaskStatus;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedAgent: AgentType;
  estimatedDuration: number;
  dependencies: string[];
  status: TaskStatus;
  priority: TaskPriority;
}

export interface TaskDecompositionResult {
  query: string;
  tasks: TaskItem[];
  totalEstimatedTime: number;
  parallelizable: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface ApprovalState {
  tasks: TaskItem[];
  selectedIndex: number;
  modified: boolean;
  approved: boolean;
  workflowId?: string;
  deviceId?: string;
  revision?: number;
  recoveredDecisionId?: string;
}

export interface KeyboardAction {
  key: string;
  action:
    | 'next'
    | 'previous'
    | 'approve'
    | 'modify'
    | 'filter'
    | 'cancel'
    | 'toggle'
    | (string & {});
  target?: TaskStatus;
}

export interface EnhancedUXConfig {
  performance: {
    maxRenderTime: number;
    maxAnalysisTime: number;
    maxInputResponseTime: number;
    maxMemoryUsage: number;
  };
  layout: {
    streamingRatio: number;
    approvalRatio: number;
    inputRatio: number;
  };
  features: {
    enableExitProtection: boolean;
    enableContextCaching: boolean;
    enablePerformanceMonitoring: boolean;
  };
  storage?: {
    approvalDirectory?: string;
    deviceId?: string;
    persistDecisions?: boolean;
  };
}

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
  streaming: RegionBounds;
  approval: RegionBounds;
  input: RegionBounds;
  streamingOutput?: RegionBounds;
}

export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  inputResponseTime: number;
}

export interface InputState {
  text: string;
  cursorPosition: number;
  history: string[];
  historyIndex: number;
}

export interface RepositoryDependency {
  name: string;
  version?: string;
  type: 'dependency' | 'devDependency' | 'peerDependency' | (string & {});
}

export interface RepositoryFingerprint {
  techStack: {
    languages: string[];
    frameworks: string[];
    dependencies: RepositoryDependency[];
    buildTools: string[];
    testFrameworks: string[];
  };
  architecture: Array<{ name: string; description: string; confidence: number }>;
  scale: { fileCount: number; lineCount: number; complexity: 'small' | 'medium' | 'large' | (string & {}) };
  conventions: {
    indentStyle: 'spaces' | 'tabs' | (string & {});
    indentSize: number;
    lineEndings: 'lf' | 'crlf' | (string & {});
    trailingComma: boolean;
    semicolons: boolean;
  };
  documentation: {
    hasReadme: boolean;
    hasApiDocs: boolean;
    hasTypeDefinitions: boolean;
    documentationCoverage: number;
  };
}

export type ApprovalDecisionStatus = 'approved' | 'rejected' | 'modified' | 'cancelled';

export interface ApprovalDecisionRecord {
  id: string;
  workflowId: string;
  status: ApprovalDecisionStatus;
  taskIds: string[];
  approvedTaskIds: string[];
  rejectedTaskIds: string[];
  modifiedTaskIds: string[];
  deviceId: string;
  sequence: number;
  decidedAt: string;
  reason?: string;
  stateHash: string;
}

export interface ApprovalDecisionInput {
  workflowId: string;
  status: ApprovalDecisionStatus;
  taskIds?: string[];
  approvedTaskIds?: string[];
  rejectedTaskIds?: string[];
  modifiedTaskIds?: string[];
  deviceId?: string;
  sequence?: number;
  decidedAt?: string | Date;
  reason?: string;
}
