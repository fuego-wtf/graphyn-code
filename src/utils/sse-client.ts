import EventSource from 'eventsource';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import { OAuthManager } from '../auth/oauth.js';

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
  private oauthManager: OAuthManager;

  constructor(options: SSEClientOptions) {
    super();
    this.url = options.url;
    this.maxRetries = options.maxRetries ?? 5;
    this.retryDelay = options.retryDelay ?? 1000;
    this.backoffMultiplier = options.backoffMultiplier ?? 2;
    this.headers = options.headers ?? {};
    this.oauthManager = new OAuthManager();
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.eventSource?.readyState === EventSource.OPEN) {
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    try {
      // Get Bearer token for authentication
      const token = await this.oauthManager.getValidToken();
      
      // For EventSource, we need to pass the token as a query parameter
      // since EventSource doesn't support custom headers in the browser
      const urlWithAuth = token 
        ? `${this.url}?token=${encodeURIComponent(`Bearer ${token}`)}`
        : this.url;

      this.eventSource = new EventSource(urlWithAuth);

      this.eventSource.onopen = () => {
        this.isConnecting = false;
        this.retryCount = 0;
        console.log(colors.success('✓ Connected to thread stream\n'));
        this.emit('connect');
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const sseEvent: SSEEvent = {
            type: event.type || 'message',
            data,
            id: event.lastEventId
          };
          this.emit('message', sseEvent);
          this.emit(sseEvent.type, sseEvent.data);
          this.handleMessage(sseEvent);
        } catch (error) {
          // If it's not JSON, treat as plain text message
          console.log(colors.message(event.data));
        }
      };

      this.eventSource.onerror = (error) => {
        this.isConnecting = false;
        this.emit('error', error);
        
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

    // Listen for thread-specific events
    const eventTypes = [
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
      'message.chunk',
      'error'
    ];

    eventTypes.forEach(eventType => {
      this.eventSource!.addEventListener(eventType, (event: any) => {
        try {
          const data = JSON.parse(event.data);
          const sseEvent: SSEEvent = {
            type: eventType,
            data,
            id: event.lastEventId
          };
          this.emit('message', sseEvent);
          this.emit(eventType, data);
          this.handleMessage(sseEvent);
        } catch (error) {
          this.emit('error', new Error(`Failed to parse ${eventType} event: ${error}`));
        }
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
  const url = `${apiUrl}/api/threads/${threadId}/stream`;
  
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