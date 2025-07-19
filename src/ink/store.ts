import { create } from 'zustand';
import { Agent } from '../api-client.js';

export type AppMode = 'menu' | 'init' | 'agent' | 'threads' | 'auth' | 'doctor' | 'share' | 'history' | 'status' | 'sync' | 'monitor' | 'collaborate' | 'loading' | 'error' | 'figma-design' | 'figma-auth' | 'figma-logout' | 'agent-command' | 'thread' | 'context' | 'test-memory' | 'diagnose-agents' | 'init-graphyn';

interface Thread {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'complete';
  participants: number;
}

interface AppState {
  // UI State
  mode: AppMode;
  selectedAgent: string;
  selectedAgentConfig?: Agent;
  query: string;
  loading: boolean;
  error: string | null;
  
  // Agent Data
  availableAgents: Agent[];
  agentsLoading: boolean;
  agentsError: string | null;
  currentPath: string;
  
  // Data
  threads: Thread[];
  apiKey: string | null;
  contextPath: string | null;
  claudeSessionActive: boolean;
  
  // Actions
  setMode: (mode: AppMode) => void;
  setSelectedAgent: (agent: string) => void;
  setSelectedAgentConfig: (agent: Agent | undefined) => void;
  setQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAvailableAgents: (agents: Agent[]) => void;
  setAgentsLoading: (loading: boolean) => void;
  setAgentsError: (error: string | null) => void;
  setCurrentPath: (path: string) => void;
  setThreads: (threads: Thread[]) => void;
  setApiKey: (key: string | null) => void;
  setContextPath: (path: string | null) => void;
  setClaudeSessionActive: (active: boolean) => void;
  reset: () => void;
}

export const useStore = create<AppState>((set) => ({
  // Initial state
  mode: 'menu',
  selectedAgent: '',
  selectedAgentConfig: undefined,
  query: '',
  loading: false,
  error: null,
  availableAgents: [],
  agentsLoading: false,
  agentsError: null,
  currentPath: process.cwd(),
  threads: [],
  apiKey: null,
  contextPath: null,
  claudeSessionActive: false,
  
  // Actions
  setMode: (mode) => set({ mode }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setSelectedAgentConfig: (agent) => set({ selectedAgentConfig: agent }),
  setQuery: (query) => set({ query }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setAvailableAgents: (agents) => set({ availableAgents: agents }),
  setAgentsLoading: (loading) => set({ agentsLoading: loading }),
  setAgentsError: (error) => set({ agentsError: error }),
  setCurrentPath: (path) => set({ currentPath: path }),
  setThreads: (threads) => set({ threads }),
  setApiKey: (key) => set({ apiKey: key }),
  setContextPath: (path) => set({ contextPath: path }),
  setClaudeSessionActive: (active) => set({ claudeSessionActive: active }),
  reset: () => set({
    mode: 'menu',
    selectedAgent: '',
    selectedAgentConfig: undefined,
    query: '',
    loading: false,
    error: null,
    contextPath: null
  })
}));