export interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  role: string;
  systemPrompt: string;
  capabilities: string[];
  metadata?: Record<string, any>;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assigned_agent: string;
  assigned_agent_name?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  dependencies: string[];
  output?: string;
  error_message?: string;
  metadata?: Record<string, any>;
}