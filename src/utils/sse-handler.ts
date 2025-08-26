import EventSource from 'eventsource';

export interface SSEMessage {
  type: string;
  content?: string;
  data?: any;
  agent_id?: string;
  thread_id?: string;
  chunk_index?: number;
  total_chunks?: number;
}

export class ThreadStreamHandler {
  private eventSource: EventSource | null = null;
  private messages: Map<string, string> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(
    private threadId: string,
    private token: string,
    private apiUrl: string = process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz'
  ) {}

  // Helper: safely parse SSE event data, fall back to text/raw without throwing
  private safeParse(raw: any): any {
    if (raw == null) return { raw: null };
    if (typeof raw !== 'string') return raw;
    const t = raw.trim();
    if (!t) return { raw: '' };
    if (t.startsWith('{') || t.startsWith('[')) {
      try { return JSON.parse(t); } catch { return { raw: raw }; }
    }
    return { text: raw };
  }

  connect(
    onMessage: (message: SSEMessage) => void,
    onError?: (error: any) => void,
    onConnect?: () => void
  ): void {
    const url = `${this.apiUrl}/api/threads/${this.threadId}/stream`;
    
    this.eventSource = new EventSource(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    this.eventSource.onopen = () => {
      console.log('SSE connection established');
      this.reconnectAttempts = 0;
      onConnect?.();
    };

    this.eventSource.onmessage = (event) => {
      const parsed = this.safeParse(event.data);
      
      // If parsing failed, create a fallback message
      if (!parsed || typeof parsed !== 'object' || !parsed.type) {
        const fallbackMessage: SSEMessage = {
          type: 'raw',
          data: parsed
        };
        onMessage(fallbackMessage);
        return;
      }

      const data = parsed as SSEMessage;
      
      // Handle message chunks
      if (data.type === 'message.chunk' && data.agent_id) {
        const currentContent = this.messages.get(data.agent_id) || '';
        this.messages.set(data.agent_id, currentContent + (data.content || ''));
        
        onMessage({
          ...data,
          content: this.messages.get(data.agent_id)
        });
      } else if (data.type === 'message.complete' && data.agent_id) {
        // Clear accumulated message
        const fullMessage = this.messages.get(data.agent_id) || '';
        this.messages.delete(data.agent_id);
        
        onMessage({
          ...data,
          content: fullMessage
        });
      } else {
        // Pass through other message types
        onMessage(data);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
          this.close();
          this.connect(onMessage, onError, onConnect);
        }, this.reconnectDelay * this.reconnectAttempts);
      } else {
        onError?.(new Error('Max reconnection attempts reached'));
        this.close();
      }
    };

    // Custom event listeners for specific message types
    this.eventSource.addEventListener('squad.recommendation', (event: any) => {
      const parsed = this.safeParse(event.data);
      onMessage({
        type: 'squad.recommendation',
        data: parsed
      });
    });

    this.eventSource.addEventListener('agent.thinking', (event: any) => {
      const parsed = this.safeParse(event.data);
      // Extract thought and agent_id safely from parsed data
      const thought = (parsed && typeof parsed === 'object' && parsed.thought) || '';
      const agent_id = (parsed && typeof parsed === 'object' && parsed.agent_id) || undefined;
      
      onMessage({
        type: 'agent.thinking',
        content: thought,
        agent_id: agent_id
      });
    });
  }

  close(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.messages.clear();
  }

  async sendMessage(content: string, metadata?: any): Promise<void> {
    const response = await fetch(`${this.apiUrl}/api/threads/${this.threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content,
        metadata: metadata || {}
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }
  }

  async getThreadInfo(): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/threads/${this.threadId}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get thread info: ${response.statusText}`);
    }

    return response.json();
  }
}

// Helper hook for React components
export function useThreadStream(
  threadId: string,
  token: string,
  apiUrl?: string
): {
  handler: ThreadStreamHandler;
  sendMessage: (content: string) => Promise<void>;
} {
  const handler = new ThreadStreamHandler(threadId, token, apiUrl);

  return {
    handler,
    sendMessage: (content: string) => handler.sendMessage(content)
  };
}