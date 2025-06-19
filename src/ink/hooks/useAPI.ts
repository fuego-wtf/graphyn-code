import { useState, useEffect, useCallback } from 'react';
import { useAPI } from '../contexts/APIContext.js';
import { Thread, Agent } from '../../api-client.js';

// Re-export useAPI for convenience
export { useAPI } from '../contexts/APIContext.js';

// Hook for loading data with loading/error states
export const useAPIQuery = <T,>(
  queryFn: () => Promise<T>,
  deps: any[] = []
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await queryFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    refetch();
  }, deps);

  return { data, loading, error, refetch };
};

// Hook for mutations with loading/error states
export const useAPIMutation = <TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>
) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TData | null>(null);

  const mutate = useCallback(async (variables: TVariables) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await mutationFn(variables);
      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [mutationFn]);

  return { mutate, loading, error, data };
};

// Specific hooks for common operations
export const useThreads = () => {
  const api = useAPI();
  
  const { data: threads, loading, error, refetch } = useAPIQuery(
    () => api.threads.list(),
    [api.isAuthenticated]
  );

  const createThread = useAPIMutation(
    (data: { name: string; type?: 'testing' | 'builder' }) => 
      api.threads.create(data.name, data.type)
  );

  const deleteThread = useAPIMutation(
    (id: string) => api.threads.delete(id)
  );

  return {
    threads: threads || [],
    loading,
    error,
    refetch,
    createThread: createThread.mutate,
    deleteThread: deleteThread.mutate,
    creating: createThread.loading,
    deleting: deleteThread.loading
  };
};

export const useAgents = () => {
  const api = useAPI();
  
  const { data: agents, loading, error, refetch } = useAPIQuery(
    () => api.agents.list(),
    [api.isAuthenticated]
  );

  const { data: availableAgents, loading: loadingAvailable } = useAPIQuery(
    () => api.agents.getAvailable(),
    [api.isAuthenticated]
  );

  return {
    agents: agents || [],
    availableAgents: availableAgents || [],
    loading: loading || loadingAvailable,
    error,
    refetch
  };
};

export const useThread = (threadId: string | null) => {
  const api = useAPI();
  
  const { data: thread, loading, error, refetch } = useAPIQuery(
    () => threadId ? api.threads.get(threadId) : Promise.resolve(null),
    [threadId, api.isAuthenticated]
  );

  return {
    thread,
    loading,
    error,
    refetch
  };
};

export const useParticipants = (threadId: string | null) => {
  const api = useAPI();
  
  const { data: participants, loading, error, refetch } = useAPIQuery(
    () => threadId ? api.get<any[]>(`/api/v1/threads/${threadId}/participants`) : Promise.resolve([]),
    [threadId, api.isAuthenticated]
  );

  const addParticipant = useAPIMutation(
    (data: { threadId: string; type: string; agentId: string }) =>
      api.post(`/api/v1/threads/${data.threadId}/participants`, {
        type: data.type,
        agentId: data.agentId
      })
  );

  const removeParticipant = useAPIMutation(
    (data: { threadId: string; participantId: string }) =>
      api.delete(`/api/v1/threads/${data.threadId}/participants/${data.participantId}`)
  );

  return {
    participants: participants || [],
    loading,
    error,
    refetch,
    addParticipant: addParticipant.mutate,
    removeParticipant: removeParticipant.mutate,
    adding: addParticipant.loading,
    removing: removeParticipant.loading
  };
};

// Hook for authentication state
export const useAuth = () => {
  const api = useAPI();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Load user info from config
    const loadUser = async () => {
      if (api.isAuthenticated) {
        const { ConfigManager } = await import('../../config-manager.js');
        const configManager = new ConfigManager();
        const userInfo = await configManager.get('auth.user');
        setUser(userInfo);
      } else {
        setUser(null);
      }
    };
    
    loadUser();
  }, [api.isAuthenticated]);

  return {
    isAuthenticated: api.isAuthenticated,
    user,
    authenticate: api.authenticate,
    getTestToken: api.getTestToken,
    logout: api.logout
  };
};

// Hook for SSE streaming
export const useThreadStream = (threadId: string | null) => {
  const api = useAPI();
  const [messages, setMessages] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!threadId || !api.isAuthenticated) return;

    let eventSource: any;

    try {
      eventSource = api.threads.stream(threadId);
      
      eventSource.onopen = () => {
        setConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMessages(prev => [...prev, data]);
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      eventSource.onerror = (err) => {
        setConnected(false);
        setError('Connection lost');
        eventSource.close();
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [threadId, api.isAuthenticated]);

  return {
    messages,
    connected,
    error
  };
};