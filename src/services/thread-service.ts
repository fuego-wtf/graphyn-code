import { apiClient, ThreadState } from '../api/client.js';
import { RepositoryContextExtractor, ExtractedContext } from './repository-context-extractor.js';
import { RepositoryAnalyzerService } from './repository-analyzer.js';
import { createThreadSSEClient, SSEClient } from '../utils/sse-client.js';
import chalk from 'chalk';

export interface ThreadRequest {
  query: string;
  repositoryContext: ExtractedContext;
  workDir: string;
}

export interface ThreadResponse {
  threadId: string;
  threadName: string;
  state: ThreadState;
  streamUrl: string;
  message: string;
}

export class ThreadService {
  private contextExtractor: RepositoryContextExtractor;

  constructor() {
    const analyzer = new RepositoryAnalyzerService();
    this.contextExtractor = new RepositoryContextExtractor(analyzer);
  }

  async processQuery(query: string, workDir: string = process.cwd()): Promise<ThreadResponse> {
    console.log(chalk.blue('\\n🧠 Creating AI development thread...\\n'));
    
    try {
      // Step 1: Extract repository context
      console.log(chalk.gray('📊 Analyzing your codebase...'));
      const context = await this.contextExtractor.extractContext(query, workDir);
      
      // Step 2: Create thread with repository context
      console.log(chalk.gray('🔄 Creating thread in building state...'));
      const thread = await apiClient.createThread({
        name: this.generateThreadName(query),
        state: 'building',
        metadata: {
          repository: context,
          created_by: 'cli',
          query: query,
          work_directory: workDir
        }
      });

      // Step 3: Send initial message to the thread
      console.log(chalk.gray('💬 Sending your request to the thread...'));
      await apiClient.sendMessage(thread.id, query);

      // Step 4: Return thread info for streaming
      const streamUrl = apiClient.getThreadStreamUrl(thread.id);
      
      console.log(chalk.green('\\n✅ Thread created successfully!'));
      console.log(chalk.gray(`Thread ID: ${thread.id}`));
      console.log(chalk.gray(`State: ${thread.state}`));
      
      return {
        threadId: thread.id,
        threadName: thread.name,
        state: thread.state,
        streamUrl,
        message: 'Thread created and initial message sent. Ready for streaming.'
      };
      
    } catch (error) {
      // Handle specific error cases with user-friendly messages
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        if (axiosError.response?.status === 404) {
          throw new Error(
            'Thread service is not available yet. ' +
            'Please contact support or try again later.'
          );
        }
        if (axiosError.response?.status === 401) {
          throw new Error(
            'Authentication failed. Please run \"graphyn auth\" to re-authenticate.'
          );
        }
        if (axiosError.response?.status >= 500) {
          throw new Error(
            'The thread service is temporarily unavailable. Please try again in a few minutes.'
          );
        }
      }
      
      // Generic network or unknown error
      throw new Error(
        'Unable to create thread. Please check your internet connection and try again.'
      );
    }
  }

  async streamThread(threadId: string): Promise<SSEClient> {
    console.log(chalk.blue('\\n📡 Connecting to thread stream...\\n'));
    
    const sseClient = createThreadSSEClient(threadId);
    
    // Add error handling for stream connection
    sseClient.on('error', (error) => {
      console.error(chalk.red('❌ Stream error:'), error.message);
    });

    sseClient.on('connect', () => {
      console.log(chalk.green('✅ Connected to thread stream'));
    });

    sseClient.on('disconnect', () => {
      console.log(chalk.yellow('⚠️ Disconnected from thread stream'));
    });

    await sseClient.connect();
    return sseClient;
  }

  async getThread(threadId: string) {
    return apiClient.getThread(threadId);
  }

  async listThreads(state?: ThreadState) {
    return apiClient.listThreads({ state });
  }

  async updateThreadState(threadId: string, state: ThreadState) {
    return apiClient.updateThreadState(threadId, state);
  }

  private generateThreadName(query: string): string {
    // Generate a concise thread name from the query
    const words = query.split(' ').slice(0, 4); // Take first 4 words
    const name = words.join(' ');
    
    // If too short, add a fallback
    if (name.length < 10) {
      return `Development Task: ${name}`;
    }
    
    // Truncate if too long
    if (name.length > 50) {
      return name.substring(0, 47) + '...';
    }
    
    return name;
  }

  private displayThreadInfo(response: ThreadResponse): void {
    console.log(chalk.green('\\n✨ Thread Ready!\\n'));
    
    console.log(chalk.bold('🎯 Thread Details:'));
    console.log(`Name: ${response.threadName}`);
    console.log(`ID: ${response.threadId}`);
    console.log(`State: ${response.state}`);
    console.log();
    
    console.log(chalk.bold('📡 Next Steps:'));
    console.log('• Stream will start automatically');
    console.log('• Watch for AI responses in real-time');
    console.log('• Thread will transition through states as work progresses');
    console.log();
  }

  async processWithStream(query: string, workDir: string = process.cwd()): Promise<void> {
    try {
      // Create the thread
      const response = await this.processQuery(query, workDir);
      
      // Display thread information
      this.displayThreadInfo(response);
      
      // Start streaming
      const sseClient = await this.streamThread(response.threadId);
      
      // Set up graceful shutdown
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\\n⚠️ Disconnecting from thread...'));
        sseClient.disconnect();
        process.exit(0);
      });
      
      // Keep the process alive for streaming
      return new Promise((resolve) => {
        sseClient.on('thread.completed', () => {
          console.log(chalk.green('\\n✅ Thread completed successfully!'));
          sseClient.disconnect();
          resolve();
        });
        
        sseClient.on('disconnect', () => {
          resolve();
        });
      });
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to process query:'), error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}