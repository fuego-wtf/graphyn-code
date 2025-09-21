/**
 * Agent Coordination Protocol
 *
 * Implements standardized communication protocols for inter-agent coordination
 * in multi-agent workflows. Provides message passing, task delegation, and
 * workflow synchronization capabilities.
 */

export interface AgentMessage {
  id: string;
  timestamp: number;
  from: string;
  to: string;
  type: 'request' | 'response' | 'notification' | 'delegation' | 'sync';
  content: any;
  correlationId?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, any>;
}

export interface TaskDelegation {
  taskId: string;
  fromAgent: string;
  toAgent: string;
  taskType: string;
  payload: any;
  deadline?: number;
  dependencies: string[];
  requirements: {
    capabilities: string[];
    resources: string[];
    constraints: Record<string, any>;
  };
}

export interface WorkflowSync {
  workflowId: string;
  phase: string;
  participants: string[];
  checkpoints: Array<{
    id: string;
    name: string;
    requiredParticipants: string[];
    completed: string[];
    data: any;
  }>;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface AgentCapability {
  name: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  dependencies: string[];
  performance: {
    averageLatency: number;
    throughput: number;
    reliability: number;
  };
}

export interface AgentCoordinationConfig {
  agentId: string;
  capabilities: AgentCapability[];
  messageBufferSize: number;
  timeoutMs: number;
  retryAttempts: number;
  enableLogging: boolean;
}

/**
 * Message routing and delivery system
 */
class MessageRouter {
  private routes = new Map<string, string[]>();
  private messageQueue = new Map<string, AgentMessage[]>();
  private deliveryCallbacks = new Map<string, (message: AgentMessage) => Promise<void>>();

  /**
   * Register agent for message delivery
   */
  registerAgent(agentId: string, callback: (message: AgentMessage) => Promise<void>): void {
    this.deliveryCallbacks.set(agentId, callback);
    if (!this.messageQueue.has(agentId)) {
      this.messageQueue.set(agentId, []);
    }
  }

  /**
   * Unregister agent
   */
  unregisterAgent(agentId: string): void {
    this.deliveryCallbacks.delete(agentId);
    this.messageQueue.delete(agentId);
  }

  /**
   * Route message to target agent
   */
  async routeMessage(message: AgentMessage): Promise<boolean> {
    const targetCallback = this.deliveryCallbacks.get(message.to);

    if (targetCallback) {
      try {
        await targetCallback(message);
        return true;
      } catch (error) {
        console.error(`Message delivery failed to ${message.to}:`, error);
        // Queue for retry
        const queue = this.messageQueue.get(message.to) || [];
        queue.push(message);
        this.messageQueue.set(message.to, queue);
        return false;
      }
    } else {
      // Agent not available, queue message
      const queue = this.messageQueue.get(message.to) || [];
      queue.push(message);
      this.messageQueue.set(message.to, queue);
      return false;
    }
  }

  /**
   * Flush queued messages for an agent
   */
  async flushQueuedMessages(agentId: string): Promise<void> {
    const queue = this.messageQueue.get(agentId);
    if (!queue || queue.length === 0) return;

    const callback = this.deliveryCallbacks.get(agentId);
    if (!callback) return;

    const messages = [...queue];
    this.messageQueue.set(agentId, []);

    for (const message of messages) {
      try {
        await callback(message);
      } catch (error) {
        console.error(`Failed to deliver queued message to ${agentId}:`, error);
        // Re-queue on failure
        queue.push(message);
      }
    }

    this.messageQueue.set(agentId, queue);
  }

  /**
   * Broadcast message to multiple agents
   */
  async broadcastMessage(message: Omit<AgentMessage, 'to'>, targets: string[]): Promise<void> {
    const promises = targets.map(target => {
      const targetMessage: AgentMessage = { ...message, to: target };
      return this.routeMessage(targetMessage);
    });

    await Promise.allSettled(promises);
  }
}

/**
 * Task delegation and management
 */
class TaskDelegationManager {
  private activeDelegations = new Map<string, TaskDelegation>();
  private completionCallbacks = new Map<string, (result: any) => void>();

  /**
   * Delegate task to another agent
   */
  async delegateTask(
    delegation: TaskDelegation,
    messageRouter: MessageRouter
  ): Promise<string> {
    const delegationId = `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.activeDelegations.set(delegationId, delegation);

    const message: AgentMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      from: delegation.fromAgent,
      to: delegation.toAgent,
      type: 'delegation',
      content: {
        delegationId,
        ...delegation
      },
      priority: 'normal'
    };

    await messageRouter.routeMessage(message);
    return delegationId;
  }

  /**
   * Accept task delegation
   */
  acceptDelegation(delegationId: string): TaskDelegation | null {
    return this.activeDelegations.get(delegationId) || null;
  }

  /**
   * Complete delegated task
   */
  async completeDelegation(
    delegationId: string,
    result: any,
    messageRouter: MessageRouter
  ): Promise<void> {
    const delegation = this.activeDelegations.get(delegationId);
    if (!delegation) return;

    const message: AgentMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      from: delegation.toAgent,
      to: delegation.fromAgent,
      type: 'response',
      content: {
        delegationId,
        result,
        status: 'completed'
      },
      correlationId: delegationId,
      priority: 'normal'
    };

    await messageRouter.routeMessage(message);
    this.activeDelegations.delete(delegationId);

    // Notify completion callback if registered
    const callback = this.completionCallbacks.get(delegationId);
    if (callback) {
      callback(result);
      this.completionCallbacks.delete(delegationId);
    }
  }

  /**
   * Register completion callback
   */
  onDelegationComplete(delegationId: string, callback: (result: any) => void): void {
    this.completionCallbacks.set(delegationId, callback);
  }

  /**
   * Get active delegations for agent
   */
  getActiveDelegations(agentId: string): TaskDelegation[] {
    return Array.from(this.activeDelegations.values())
      .filter(d => d.fromAgent === agentId || d.toAgent === agentId);
  }
}

/**
 * Workflow synchronization manager
 */
class WorkflowSynchronizer {
  private workflows = new Map<string, WorkflowSync>();
  private checkpointCallbacks = new Map<string, (checkpoint: any) => void>();

  /**
   * Create new workflow
   */
  createWorkflow(workflowId: string, participants: string[]): WorkflowSync {
    const workflow: WorkflowSync = {
      workflowId,
      phase: 'initialization',
      participants,
      checkpoints: [],
      status: 'pending'
    };

    this.workflows.set(workflowId, workflow);
    return workflow;
  }

  /**
   * Add checkpoint to workflow
   */
  addCheckpoint(
    workflowId: string,
    checkpoint: {
      id: string;
      name: string;
      requiredParticipants: string[];
      data?: any;
    }
  ): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.checkpoints.push({
      ...checkpoint,
      completed: [],
      data: checkpoint.data || {}
    });
  }

  /**
   * Mark checkpoint as completed by agent
   */
  async completeCheckpoint(
    workflowId: string,
    checkpointId: string,
    agentId: string,
    data?: any,
    messageRouter?: MessageRouter
  ): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    const checkpoint = workflow.checkpoints.find(c => c.id === checkpointId);
    if (!checkpoint) return false;

    // Add agent to completed list if not already there
    if (!checkpoint.completed.includes(agentId)) {
      checkpoint.completed.push(agentId);
    }

    // Merge data if provided
    if (data) {
      checkpoint.data = { ...checkpoint.data, [agentId]: data };
    }

    // Check if checkpoint is fully completed
    const isComplete = checkpoint.requiredParticipants.every(
      participant => checkpoint.completed.includes(participant)
    );

    if (isComplete) {
      // Notify all participants
      if (messageRouter) {
        const notification: AgentMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          from: 'coordinator',
          to: 'broadcast',
          type: 'notification',
          content: {
            type: 'checkpoint_completed',
            workflowId,
            checkpointId,
            data: checkpoint.data
          },
          priority: 'normal'
        };

        await messageRouter.broadcastMessage(notification, workflow.participants);
      }

      // Trigger callback if registered
      const callback = this.checkpointCallbacks.get(`${workflowId}:${checkpointId}`);
      if (callback) {
        callback(checkpoint);
      }
    }

    return isComplete;
  }

  /**
   * Register checkpoint completion callback
   */
  onCheckpointComplete(
    workflowId: string,
    checkpointId: string,
    callback: (checkpoint: any) => void
  ): void {
    this.checkpointCallbacks.set(`${workflowId}:${checkpointId}`, callback);
  }

  /**
   * Get workflow status
   */
  getWorkflow(workflowId: string): WorkflowSync | null {
    return this.workflows.get(workflowId) || null;
  }

  /**
   * Complete workflow
   */
  async completeWorkflow(workflowId: string, messageRouter?: MessageRouter): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'completed';

    if (messageRouter) {
      const notification: AgentMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        from: 'coordinator',
        to: 'broadcast',
        type: 'notification',
        content: {
          type: 'workflow_completed',
          workflowId
        },
        priority: 'normal'
      };

      await messageRouter.broadcastMessage(notification, workflow.participants);
    }
  }
}

/**
 * Main Agent Coordination Protocol implementation
 */
export class AgentCoordinationProtocol {
  private config: AgentCoordinationConfig;
  private messageRouter = new MessageRouter();
  private delegationManager = new TaskDelegationManager();
  private workflowSynchronizer = new WorkflowSynchronizer();
  private messageHandlers = new Map<string, (message: AgentMessage) => Promise<void>>();

  constructor(config: AgentCoordinationConfig) {
    this.config = config;
    this.setupDefaultHandlers();
    this.registerAgent();
  }

  /**
   * Register this agent with the coordination system
   */
  private registerAgent(): void {
    this.messageRouter.registerAgent(this.config.agentId, async (message) => {
      await this.handleIncomingMessage(message);
    });
  }

  /**
   * Setup default message handlers
   */
  private setupDefaultHandlers(): void {
    this.messageHandlers.set('delegation', async (message) => {
      const delegation = message.content as TaskDelegation;
      await this.handleTaskDelegation(delegation);
    });

    this.messageHandlers.set('response', async (message) => {
      if (message.content.delegationId) {
        // Handle delegation completion
        const { delegationId, result } = message.content;
        this.delegationManager.onDelegationComplete(delegationId, () => {
          console.log(`Delegation ${delegationId} completed with result:`, result);
        });
      }
    });

    this.messageHandlers.set('sync', async (message) => {
      const { workflowId, checkpointId, data } = message.content;
      await this.workflowSynchronizer.completeCheckpoint(
        workflowId,
        checkpointId,
        message.from,
        data,
        this.messageRouter
      );
    });
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(message: AgentMessage): Promise<void> {
    if (this.config.enableLogging) {
      console.log(`[${this.config.agentId}] Received message:`, message);
    }

    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      try {
        await handler(message);
      } catch (error) {
        console.error(`Error handling message ${message.id}:`, error);
      }
    } else {
      console.warn(`No handler for message type: ${message.type}`);
    }
  }

  /**
   * Send message to another agent
   */
  async sendMessage(
    to: string,
    type: AgentMessage['type'],
    content: any,
    priority: AgentMessage['priority'] = 'normal'
  ): Promise<string> {
    const message: AgentMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      from: this.config.agentId,
      to,
      type,
      content,
      priority
    };

    await this.messageRouter.routeMessage(message);
    return message.id;
  }

  /**
   * Delegate task to another agent
   */
  async delegateTask(
    toAgent: string,
    taskType: string,
    payload: any,
    requirements?: Partial<TaskDelegation['requirements']>
  ): Promise<string> {
    const delegation: TaskDelegation = {
      taskId: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromAgent: this.config.agentId,
      toAgent,
      taskType,
      payload,
      dependencies: [],
      requirements: {
        capabilities: [],
        resources: [],
        constraints: {},
        ...requirements
      }
    };

    return await this.delegationManager.delegateTask(delegation, this.messageRouter);
  }

  /**
   * Register custom message handler
   */
  registerMessageHandler(type: string, handler: (message: AgentMessage) => Promise<void>): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Handle task delegation (override in derived classes)
   */
  protected async handleTaskDelegation(delegation: TaskDelegation): Promise<void> {
    console.log(`[${this.config.agentId}] Received task delegation:`, delegation);
    // Default implementation - agents should override this
  }

  /**
   * Create workflow
   */
  createWorkflow(workflowId: string, participants: string[]): WorkflowSync {
    return this.workflowSynchronizer.createWorkflow(workflowId, participants);
  }

  /**
   * Add checkpoint to workflow
   */
  addCheckpoint(workflowId: string, checkpoint: { id: string; name: string; requiredParticipants: string[]; data?: any }): void {
    this.workflowSynchronizer.addCheckpoint(workflowId, checkpoint);
  }

  /**
   * Complete checkpoint
   */
  async completeCheckpoint(workflowId: string, checkpointId: string, data?: any): Promise<boolean> {
    return await this.workflowSynchronizer.completeCheckpoint(
      workflowId,
      checkpointId,
      this.config.agentId,
      data,
      this.messageRouter
    );
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): AgentCapability[] {
    return this.config.capabilities;
  }

  /**
   * Register another agent in the coordination system
   */
  registerOtherAgent(agentId: string, callback: (message: AgentMessage) => Promise<void>): void {
    this.messageRouter.registerAgent(agentId, callback);
  }

  /**
   * Shutdown coordination
   */
  async shutdown(): Promise<void> {
    this.messageRouter.unregisterAgent(this.config.agentId);
  }
}

/**
 * Factory function to create coordination protocol
 */
export function createAgentCoordinationProtocol(config: AgentCoordinationConfig): AgentCoordinationProtocol {
  return new AgentCoordinationProtocol(config);
}