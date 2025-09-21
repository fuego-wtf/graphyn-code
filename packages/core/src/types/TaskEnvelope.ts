export interface TaskConfig {
  tools?: string[];
  timeoutSeconds?: number;
  maxRetries?: number;
  environment?: Record<string, string>;
}

export interface TaskEnvelope {
  id: string;
  agentType: string;
  description: string;
  priority: number;
  dependencies: string[];
  workspace?: string;
  config?: TaskConfig;
  metadata?: Record<string, any>;
  tags?: string[];
}

export type TaskEnvelopeList = TaskEnvelope[];
