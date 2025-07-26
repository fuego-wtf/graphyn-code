import EventSource from 'eventsource';
import chalk from 'chalk';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  agent: chalk.cyan,
  message: chalk.white
};

interface SSEMessage {
  type: string;
  data: any;
}

export class SSEClient {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds

  async connect(streamUrl: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(colors.info('\n📡 Connecting to your AI development squad...\n'));

      // Add token to URL
      const url = new URL(streamUrl);
      url.searchParams.set('token', token);

      this.eventSource = new EventSource(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      this.eventSource.onopen = () => {
        console.log(colors.success('✓ Connected to squad\n'));
        this.reconnectAttempts = 0;
        resolve();
      };

      this.eventSource.onmessage = (event) => {
        try {
          const message: SSEMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.log(colors.message(event.data));
        }
      };

      this.eventSource.onerror = (error) => {
        console.error(colors.error('\n❌ Connection error'));
        this.eventSource?.close();
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
          console.log(colors.warning(`\n🔄 Reconnecting in ${delay / 1000}s... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`));
          
          setTimeout(() => {
            this.connect(streamUrl, token)
              .then(resolve)
              .catch(reject);
          }, delay);
        } else {
          reject(new Error('Max reconnection attempts reached. Please check your connection and try again.'));
        }
      };

      // Handle specific event types
      this.eventSource.addEventListener('agent.message', (event) => {
        const data = JSON.parse(event.data);
        console.log(colors.agent(`\n🤖 ${data.agent_name}:`), colors.message(data.content));
      });

      this.eventSource.addEventListener('agent.joined', (event) => {
        const data = JSON.parse(event.data);
        console.log(colors.success(`\n✨ ${data.agent_name} joined the squad`));
      });

      this.eventSource.addEventListener('thread.completed', (event) => {
        console.log(colors.success('\n✅ Squad work completed!'));
        this.close();
      });

      // Timeout if no connection in 30 seconds
      setTimeout(() => {
        if (this.eventSource?.readyState === EventSource.CONNECTING) {
          this.eventSource.close();
          reject(new Error('Connection timeout'));
        }
      }, 30000);
    });
  }

  private handleMessage(message: SSEMessage) {
    switch (message.type) {
      case 'agent_message':
        console.log(colors.agent(`\n🤖 ${message.data.agent}:`), colors.message(message.data.content));
        break;
      case 'status':
        console.log(colors.info(`\n📊 Status: ${message.data.message}`));
        break;
      case 'error':
        console.log(colors.error(`\n❌ Error: ${message.data.message}`));
        break;
      default:
        console.log(colors.info(`\n${message.type}: ${JSON.stringify(message.data)}`));
    }
  }

  close() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}