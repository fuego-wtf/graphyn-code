import { GraphynAPIClient } from '../api-client.js';
import EventEmitter from 'events';

export interface TaskExecutor extends EventEmitter {
  on(event: 'taskComplete', listener: (taskId: string, result: any) => void): this;
  on(event: 'taskFailed', listener: (taskId: string, error: Error) => void): this;
  on(event: 'taskProgress', listener: (taskId: string, progress: number) => void): this;
  on(event: 'agentDestroyed', listener: (agentId: string) => void): this;
}

export class TaskExecutor extends EventEmitter {
  private client: GraphynAPIClient;
  private activeAgents: Map<string, { threadId: string; taskId: string }> = new Map();
  private completedTasks: Set<string> = new Set();

  constructor(client: GraphynAPIClient) {
    super();
    this.client = client;
  }

  async executeTask(task: any, threadId?: string, organizationId?: string): Promise<any> {
    // Support both old and new signatures
    let taskId: string;
    let agentId: string;
    let taskPrompt: string;
    
    if (typeof task === 'string') {
      // Old signature: executeTask(taskId, agentId, taskPrompt)
      taskId = task;
      agentId = threadId!;
      taskPrompt = organizationId!;
    } else {
      // New signature: executeTask(task, threadId, organizationId)
      taskId = task.id;
      agentId = task.agentId || task.assigned_agent;
      taskPrompt = `Task: ${task.title}\nDescription: ${task.description}`;
    }
    try {
      // Create a thread for this specific task
      const thread = await this.client.createThread({
        name: `Task: ${taskId}`,
        type: 'testing' as const
      });

      this.activeAgents.set(agentId, { threadId: thread.id, taskId });

      // Send the task prompt
      await this.client.sendMessage(thread.id, {
        role: 'user',
        content: taskPrompt
      });

      // Stream the response
      const eventSource = this.client.streamThread(thread.id);
      let result = '';

      await new Promise<void>((resolve, reject) => {
        eventSource.onmessage = (event: any) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'message_delta') {
              result += data.content;
            } else if (data.type === 'message_complete') {
              // Task completed successfully
              this.completedTasks.add(taskId);
              this.emit('taskComplete', taskId, result);
              eventSource.close();
              resolve();
              
              // Self-destruct the agent
              this.destroyAgent(agentId);
            }
          } catch (err) {
            eventSource.close();
            reject(err);
          }
        };

        eventSource.onerror = (error: any) => {
          eventSource.close();
          reject(new Error('Stream error: ' + error.message));
        };
      });
    } catch (error) {
      this.emit('taskFailed', taskId, error as Error);
      
      // Still destroy the agent on failure
      if (this.activeAgents.has(agentId)) {
        await this.destroyAgent(agentId);
      }
    }
  }

  // Overloaded method for backward compatibility
  async executeTaskOld(taskId: string, agentId: string, taskPrompt: string): Promise<void> {
    return this.executeTask(taskId, agentId, taskPrompt);
  }

  private async destroyAgent(agentId: string): Promise<void> {
    const agentInfo = this.activeAgents.get(agentId);
    if (!agentInfo) return;

    try {
      // Delete the thread to clean up resources
      await this.client.deleteThread(agentInfo.threadId);
      
      // Remove from active agents
      this.activeAgents.delete(agentId);
      
      // Emit destruction event
      this.emit('agentDestroyed', agentId);
    } catch (error) {
      console.error(`Failed to destroy agent ${agentId}:`, error);
    }
  }

  async destroyAllAgents(): Promise<void> {
    const agentIds = Array.from(this.activeAgents.keys());
    await Promise.all(agentIds.map(id => this.destroyAgent(id)));
  }

  getActiveAgentCount(): number {
    return this.activeAgents.size;
  }

  getCompletedTaskCount(): number {
    return this.completedTasks.size;
  }

  isTaskCompleted(taskId: string): boolean {
    return this.completedTasks.has(taskId);
  }
}