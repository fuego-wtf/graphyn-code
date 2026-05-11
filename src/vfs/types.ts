export type SchemaVersion = 'w235.v1';
export type AclEffect = 'allow' | 'ask' | 'deny';
export type ReceiptDecision = 'allowed' | 'prompted' | 'denied';
export type OverallReceiptDecision = ReceiptDecision | 'mixed';
export type PromptOutcome = 'not_prompted' | 'approved' | 'declined' | 'expired';
export type QueryClass = 'none' | 'literal' | 'regex' | 'glob' | 'path' | 'unknown';
export type VfsFreshness = 'live' | 'cache' | 'snapshot';
export type VfsAction = 'ls' | 'cat' | 'grep' | 'snapshot_read' | 'snapshot_create';
export type GrantSource =
  | 'operator'
  | 'preset-install'
  | 'mode'
  | 'session-resume'
  | 'imported';

export interface RuntimeGrant {
  schemaVersion: SchemaVersion;
  id: string;
  threadId: string;
  sessionId: string;
  agentId: string;
  workspaceId: string;
  subjectHash: string;
  grantSource: GrantSource;
  aclRuleIds: string[];
  effectiveMatrix: Record<string, AclEffect>;
  capabilityHandles: string[];
  policyHash: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface WorkspaceMount {
  schemaVersion: SchemaVersion;
  id: string;
  virtualPrefix: string;
  driverId: 'local_repo' | 'local_docs' | 'local_receipts';
  sourceRoot: string;
  sourceRootHash: string;
  capabilities: VfsAction[];
}

export interface VfsRedactionEvent {
  schemaVersion: SchemaVersion;
  field: 'displayCommand' | 'args' | 'virtualPath' | 'content' | 'metadata';
  reasonCode: string;
  hash?: string;
}

export interface VfsPathOutcome {
  schemaVersion: SchemaVersion;
  virtualPath: string;
  virtualPathHash: string;
  action: VfsAction;
  decision: ReceiptDecision;
  reasonCode: string;
  contentHash?: string;
  redactionApplied: boolean;
}

export interface VfsReceipt {
  schemaVersion: SchemaVersion;
  id: string;
  workspaceId: string;
  threadId: string;
  runtimeGrantId: string;
  actorHash: string;
  displayCommandSanitized: string;
  argHashes: string[];
  queryClass: QueryClass;
  pathOutcomes: VfsPathOutcome[];
  redactionEvents: VfsRedactionEvent[];
  mountIds: string[];
  sourceSystems: string[];
  overallDecision: OverallReceiptDecision;
  promptOutcome: PromptOutcome;
  freshness: VfsFreshness;
  snapshotId?: string;
  policyHash: string;
  principalHash: string;
  contentHashes: string[];
  redactionApplied: boolean;
  status: 'ok' | 'partial' | 'error';
  timestamp: string;
  previousReceiptHash: string | null;
  receiptHash: string;
}

export interface VfsSnapshot {
  schemaVersion: SchemaVersion;
  id: string;
  workspaceId: string;
  threadId: string;
  runtimeGrantId: string;
  actorHash: string;
  policyHash: string;
  sourcePaths: string[];
  sourcePathHashes: string[];
  contentHashes: string[];
  redactionApplied: boolean;
  redactionEvents: VfsRedactionEvent[];
  freshness: 'snapshot';
  createdAt: string;
}

export interface VfsEnvelope {
  status: 'ok' | 'partial' | 'denied' | 'not_found' | 'no_match' | 'error';
  receiptId: string;
  data?: unknown;
  pathOutcomes: VfsPathOutcome[];
  error?: {
    code: string;
    message: string;
  };
}

export interface FsGlobalOptions {
  grantId?: string;
  workspaceId: string;
  threadId: string;
  sessionId: string;
  agentId: string;
  subjectHash: string;
}

