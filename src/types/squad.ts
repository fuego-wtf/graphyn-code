export interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  role: string;
  systemPrompt: string;
  capabilities: string[];
  metadata?: Record<string, any>;
}

export interface Squad {
  id: string;
  name: string;
  description?: string;
  organization_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  usage_count: number;
  last_used_at?: string;
  agents?: AgentConfig[];
  metadata?: Record<string, any>;
}

export interface SquadSession {
  id: string;
  squad_id: string;
  thread_id: string;
  repository_context?: {
    url?: string;
    branch?: string;
    path?: string;
    commit?: string;
  };
  status: 'initializing' | 'active' | 'completed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  user_id: string;
  feedback_rating?: number;
  feedback_comment?: string;
  tmux_session_name?: string;
  metadata?: Record<string, any>;
}

export interface SquadTask {
  id: string;
  session_id: string;
  title: string;
  description?: string;
  assigned_agent_id: string;
  assigned_agent_name?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  dependencies: string[];
  created_at: string;
  started_at?: string;
  completed_at?: string;
  output?: string;
  error_message?: string;
  metadata?: Record<string, any>;
}