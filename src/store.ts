import { create } from 'zustand';

// Global state store for reactive updates
export interface AppState {
  mode: 'menu' | 'agent' | 'thread' | 'auth' | 'exit';
  selectedAgent: string | null;
  loading: boolean;
  error: string | null;
  contextPrepared: boolean;
  threadData: any[];
  apiKey: string | null;
  setMode: (mode: AppState['mode']) => void;
  setSelectedAgent: (agent: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setContextPrepared: (prepared: boolean) => void;
  setThreadData: (data: any[]) => void;
  setApiKey: (key: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  mode: 'menu',
  selectedAgent: null,
  loading: false,
  error: null,
  contextPrepared: false,
  threadData: [],
  apiKey: null,
  setMode: (mode) => set({ mode }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setContextPrepared: (prepared) => set({ contextPrepared: prepared }),
  setThreadData: (data) => set({ threadData: data }),
  setApiKey: (key) => set({ apiKey: key }),
}));