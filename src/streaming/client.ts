import EventSource from 'eventsource';
import { createInterface } from 'readline';

import { config } from '../config.js';

export interface StreamEvent {
  type: 'chunk' | 'complete' | 'error' | 'connection' | 'feedback_request';
  data?: any;
  id?: string;
}

export interface StreamOptions {
  onMessage?: (event: StreamEvent) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface FeedbackRequest {
  id: string;
  prompt: string;
  type: 'text' | 'choice' | 'confirm';
  options?: string[];
  timeout?: number;
}

export class StreamingClient {
  private apiUrl: string;
  private eventSource?: EventSource;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    this.apiUrl = process.env.GRAPHYN_API_URL || config.apiBaseUrl || 'https://api.graphyn.xyz';
  }

  /**
   * Stream a message to a thread and get real-time response
   */
  async streamMessage(
    threadId: string, 
    message: string, 
    options: StreamOptions = {}
  ): Promise<void> {
    const token = await null;
    if (!token) {
      throw new Error('Authentication required. Please run `graphyn auth login`');
    }

    // Use POST to send message with streaming response
    try {
      const response = await fetch(`${this.apiUrl}/api/threads/${threadId}/stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({ message, metadata: { source: 'cli' } })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Stream failed: ${response.status} ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body stream available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      options.onConnect?.();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          options.onDisconnect?.();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const event: StreamEvent = {
                type: data.type || 'chunk',
                data: data,
                id: data.id
              };

              // Handle feedback requests
              if (event.type === 'feedback_request') {
                const response = await this.handleFeedbackRequest(data as FeedbackRequest);
                await this.sendFeedback(threadId, data.id, response);
              } else {
                options.onMessage?.(event);
              }
            } catch (error) {
              console.debug('Failed to parse SSE event:', line);
            }
          }
        }
      }

    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  /**
   * Handle interactive feedback requests from the server
   */
  private async handleFeedbackRequest(feedback: FeedbackRequest): Promise<any> {
    console.log(`\n${feedback.prompt}`);

    if (feedback.type === 'choice' && feedback.options) {
      // Display options
      feedback.options.forEach((option, index) => {
        console.log(`${index + 1}. ${option}`);
      });

      // Get user input
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout
      });

      return new Promise((resolve) => {
        rl.question('Choose option (number): ', (answer) => {
          const choice = parseInt(answer) - 1;
          const selectedOption = feedback.options?.[choice];
          rl.close();
          resolve({ choice: choice, value: selectedOption });
        });
      });
    } else if (feedback.type === 'confirm') {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout
      });

      return new Promise((resolve) => {
        rl.question('(y/n): ', (answer) => {
          rl.close();
          resolve({ confirmed: answer.toLowerCase().startsWith('y') });
        });
      });
    } else {
      // Text input
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout
      });

      return new Promise((resolve) => {
        rl.question('> ', (answer) => {
          rl.close();
          resolve({ text: answer });
        });
      });
    }
  }

  /**
   * Send feedback response to the server
   */
  async sendFeedback(threadId: string, feedbackId: string, response: any): Promise<void> {
    const token = await null;
    if (!token) {
      throw new Error('Authentication required');
    }

    try {
      const result = await fetch(`${this.apiUrl}/api/threads/${threadId}/feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: feedbackId,
          rating: 5, // Default positive rating for interactive feedback
          feedback: JSON.stringify(response),
          tags: ['interactive', 'cli']
        })
      });

      if (!result.ok) {
        console.warn(`Failed to send feedback: ${result.status}`);
      }
    } catch (error) {
      console.debug('Failed to send feedback:', error);
    }
  }

  /**
   * Connect to thread stream for real-time updates (read-only)
   */
  async connectToThread(threadId: string, options: StreamOptions = {}): Promise<void> {
    const token = await null;
    if (!token) {
      throw new Error('Authentication required. Please run `graphyn auth login`');
    }

    const streamUrl = `${this.apiUrl}/api/threads/${threadId}/stream?token=${encodeURIComponent(token)}`;
    
    this.eventSource = new EventSource(streamUrl);

    this.eventSource.onopen = () => {
      console.debug('Connected to thread stream');
      this.reconnectAttempts = 0;
      options.onConnect?.();
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const streamEvent: StreamEvent = {
          type: data.type || 'message',
          data: data,
          id: event.lastEventId
        };
        options.onMessage?.(streamEvent);
      } catch (error) {
        console.debug('Failed to parse stream event:', event.data);
      }
    };

    this.eventSource.onerror = (error) => {
      console.debug('Stream error:', error);
      options.onError?.(new Error('Stream connection error'));
      
      // Attempt reconnection
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        console.debug(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
          this.connectToThread(threadId, options);
        }, delay);
      }
    };

    // Handle named events
    this.eventSource.addEventListener('connection', (event) => {
      console.debug('Connection event:', event.data);
    });

    this.eventSource.addEventListener('message.chunk', (event) => {
      try {
        const data = JSON.parse(event.data);
        options.onMessage?.({
          type: 'chunk',
          data: data,
          id: event.lastEventId
        });
      } catch (error) {
        console.debug('Failed to parse chunk event:', event.data);
      }
    });

    this.eventSource.addEventListener('message.complete', (event) => {
      try {
        const data = JSON.parse(event.data);
        options.onMessage?.({
          type: 'complete',
          data: data,
          id: event.lastEventId
        });
      } catch (error) {
        console.debug('Failed to parse complete event:', event.data);
      }
    });
  }

  /**
   * Disconnect from stream
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
  }

  /**
   * Check if currently connected to a stream
   */
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}