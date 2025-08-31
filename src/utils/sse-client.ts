import EventSource from 'eventsource';
import { EventEmitter } from 'events';
import chalk from 'chalk';


const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  agent: chalk.cyan,
  message: chalk.white
};

export interface SSEEvent {
  type: string;
  data: any;
  id?: string;
  retry?: number;
}

export interface SSEClientOptions {
  url: string;
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
  headers?: Record<string, string>;
}

export class SSEClient extends EventEmitter {
  private url: string;
  private maxRetries: number;
  private retryDelay: number;
  private backoffMultiplier: number;
  private headers: Record<string, string>;
  private eventSource: EventSource | null = null;
  private retryCount = 0;
  private isConnecting = false;
  private shouldReconnect = true;

  constructor(options: SSEClientOptions) {
    super();
    this.url = options.url;
    this.maxRetries = options.maxRetries ?? 5;
    this.retryDelay = options.retryDelay ?? 1000;
    this.backoffMultiplier = options.backoffMultiplier ?? 2;
    this.headers = options.headers ?? {};
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.eventSource?.readyState === EventSource.OPEN) {
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    try {
      // Get Bearer token for authentication
      const token = await null;
      
      // In Node, EventSource supports custom headers; prefer Authorization header over query params
      const headers: Record<string, string> = { ...this.headers };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      this.eventSource = new EventSource(this.url, { headers });

      this.eventSource.onopen = () => {
        this.isConnecting = false;
        this.retryCount = 0;
        console.log(colors.success('✓ Connected to thread stream\n'));
        this.emit('connect');
      };

      this.eventSource.onmessage = (event) => {
        // Default message channel; parse defensively
        const raw = (event as any)?.data;
        let data: any;
        if (typeof raw === 'string') {
          const t = raw.trim();
          if (t && (t.startsWith('{') || t.startsWith('['))) {
            try { data = JSON.parse(t); } catch { data = { text: raw }; }
          } else if (t) {
            data = { text: raw };
          } else {
            data = { raw: '' };
          }
        } else {
          data = raw ?? { raw: null };
        }
        const sseEvent: SSEEvent = {
          type: (event as any)?.type || 'message',
          data,
          id: (event as any)?.lastEventId
        };
        this.emit('message', sseEvent);
        this.emit(sseEvent.type, sseEvent.data);
        this.handleMessage(sseEvent);
      };

      this.eventSource.onerror = (error: any) => {
        this.isConnecting = false;
        // Enrich error details for better diagnostics
        const details: any = {
          message: error?.message,
          status: error?.status ?? error?.statusCode ?? error?.response?.status,
          readyState: this.eventSource?.readyState,
        };
        try {
          if (error?.response?.headers) details.headers = error.response.headers;
        } catch {}

        console.error(colors.error(`❌ SSE error`), details);
        this.emit('error', details);
        
        if (this.shouldReconnect && this.retryCount < this.maxRetries) {
          this.scheduleReconnect();
        } else {
          console.error(colors.error('❌ Max reconnection attempts reached'));
          this.emit('disconnect');
        }
      };

      // Listen for thread-specific events
      this.setupThreadEventListeners();

    } catch (error) {
      this.isConnecting = false;
      this.emit('error', error);
      if (this.shouldReconnect && this.retryCount < this.maxRetries) {
        this.scheduleReconnect();
      }
    }
  }

  private setupThreadEventListeners(): void {
    if (!this.eventSource) return;

    // Helper: safely parse event data, fall back to text/raw without throwing
    const safeParse = (raw: any): any => {
      if (raw == null) return { raw: null };
      if (typeof raw !== 'string') return raw;
      const t = raw.trim();
      if (!t) return { raw: '' };
      if (t.startsWith('{') || t.startsWith('[')) {
        try { return JSON.parse(t); } catch { return { raw: raw }; }
      }
      return { text: raw };
    };

    // Listen for thread-specific events (based on actual server events)
    const eventTypes = [
      // Actual events sent by the backend
      'start',
      'message.created', 
      'heartbeat',
      // Legacy/fallback event types
      'thread.state.changed',
      'thread.message.added',
      'thread.participant.joined',
      'thread.participant.left',
      'thread.updated',
      'agent.message',
      'agent.joined',
      'thread.completed',
      'message.complete',
      'message.completed',
      'message.chunk'
    ];

    eventTypes.forEach(eventType => {
      this.eventSource!.addEventListener(eventType, (event: any) => {
        const parsed = safeParse(event.data);
        const sseEvent: SSEEvent = {
          type: eventType,
          data: parsed,
          id: event.lastEventId
        };
        this.emit('message', sseEvent);
        this.emit(eventType, parsed);
        this.handleMessage(sseEvent);
      });
    });
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;

    this.retryCount++;
    const delay = this.retryDelay * Math.pow(this.backoffMultiplier, this.retryCount - 1);
    
    console.log(colors.warning(`🔄 Reconnecting in ${delay / 1000}s... (attempt ${this.retryCount}/${this.maxRetries})`));
    this.emit('reconnecting', { attempt: this.retryCount, delay });
    
    setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect();
      }
    }, delay);
  }

  private handleMessage(event: SSEEvent): void {
    switch (event.type) {
      case 'start':
        console.log(colors.success(`🚀 Stream started for thread ${event.data.threadId} (state: ${event.data.state})`));
        break;
      case 'message.created':
        if (event.data.participant_type === 'agent') {
          const agentName = event.data.metadata?.agent_name || 'Agent';
          console.log(colors.agent(`🤖 ${agentName}:`), colors.message(event.data.content));
        } else if (event.data.participant_type === 'user') {
          console.log(colors.message(`👤 User: ${event.data.content}`));
        }
        break;
      case 'heartbeat':
        // Heartbeat events - just keep connection alive, no need to log
        break;
      case 'thread.state.changed':
        console.log(colors.info(`🔄 Thread state changed: ${event.data.previousState} → ${colors.success(event.data.currentState)}`));
        break;
      case 'thread.message.added':
        if (event.data.role === 'assistant') {
          console.log(colors.agent(`🤖 ${event.data.agent_name || 'Assistant'}:`), colors.message(event.data.content));
        } else {
          console.log(colors.message(event.data.content));
        }
        break;
      case 'thread.participant.joined':
        console.log(colors.success(`✨ ${event.data.agent_name} joined the thread`));
        break;
      case 'thread.participant.left':
        console.log(colors.warning(`👋 ${event.data.agent_name} left the thread`));
        break;
      case 'agent.message':
        console.log(colors.agent(`🤖 ${event.data.agent_name}:`), colors.message(event.data.content));
        break;
      case 'agent.joined':
        console.log(colors.success(`✨ ${event.data.agent_name} joined the thread`));
        break;
      case 'thread.completed':
        console.log(colors.success('✅ Thread work completed!'));
        this.disconnect();
        break;
      case 'error':
        console.log(colors.error(`❌ Error: ${event.data.message || JSON.stringify(event.data)}`));
        break;
      default:
        console.log(colors.info(`${event.type}: ${JSON.stringify(event.data)}`));
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.emit('disconnect');
  }

  // Legacy method for backward compatibility
  close(): void {
    this.disconnect();
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  getReadyState(): number {
    return this.eventSource?.readyState ?? EventSource.CLOSED;
  }
}

// Factory function for creating thread-specific SSE clients
export function createThreadSSEClient(threadId: string, baseUrl?: string): SSEClient {
  const apiUrl = baseUrl || process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz';
  const url = `${apiUrl}/internal/threads/${threadId}/stream`;
  
  return new SSEClient({
    url,
    maxRetries: 5,
    retryDelay: 1000,
    backoffMultiplier: 2
  });
}

// Legacy method for backward compatibility
export async function connectToStream(streamUrl: string, token: string): Promise<SSEClient> {
  const client = new SSEClient({
    url: streamUrl,
    maxRetries: 5,
    retryDelay: 1000,
    backoffMultiplier: 2
  });
  
  await client.connect();
  return client;
}