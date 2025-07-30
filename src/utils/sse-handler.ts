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
      try {
        const data = JSON.parse(event.data) as SSEMessage;
        
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
      } catch (err) {
        console.error('Error parsing SSE message:', err);
        onError?.(err);
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
      try {
        const data = JSON.parse(event.data);
        onMessage({
          type: 'squad.recommendation',
          data: data
        });
      } catch (err) {
        console.error('Error parsing squad recommendation:', err);
      }
    });

    this.eventSource.addEventListener('agent.thinking', (event: any) => {
      try {
        const data = JSON.parse(event.data);
        onMessage({
          type: 'agent.thinking',
          content: data.thought,
          agent_id: data.agent_id
        });
      } catch (err) {
        console.error('Error parsing agent thinking:', err);
      }
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