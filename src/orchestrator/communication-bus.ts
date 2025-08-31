/**
 * Inter-Agent Communication Bus
 * Enables agents to communicate, share context, and coordinate work
 */
import { EventEmitter } from 'events';
import { debug } from '../utils/debug.js';

export interface AgentMessage {
  id: string;
  from: string; // Agent session ID
  to: string | 'broadcast'; // Target agent session ID or broadcast
  type: 'task_result' | 'context_share' | 'dependency_request' | 'status_update' | 'error' | 'question';
  payload: any;
  timestamp: number;
  correlationId?: string; // Link related messages
}

export interface MessageHandler {
  agentId: string;
  messageTypes: string[];
  handler: (message: AgentMessage) => Promise<void> | void;
}

export interface AgentContext {
  sessionId: string;
  agent: string;
  workspaceId: string;
  currentTask?: string;
  sharedData: Record<string, any>;
  lastActivity: number;
}

export class InterAgentCommunicationBus extends EventEmitter {
  private messageHandlers = new Map<string, MessageHandler[]>();
  private agentContexts = new Map<string, AgentContext>();
  private messageHistory = new Map<string, AgentMessage[]>();
  private pendingRequests = new Map<string, { 
    resolve: (value: any) => void; 
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor() {
    super();
    this.setupInternalHandlers();
  }

  /**
   * Register an agent with the communication bus
   */
  registerAgent(sessionId: string, agent: string, workspaceId: string): void {
    debug('Registering agent with communication bus:', sessionId, agent);
    
    const context: AgentContext = {
      sessionId,
      agent,
      workspaceId,
      sharedData: {},
      lastActivity: Date.now()
    };

    this.agentContexts.set(sessionId, context);
    this.messageHistory.set(sessionId, []);
    
    this.emit('agent_registered', { sessionId, agent, workspaceId });
  }

  /**
   * Unregister an agent from the communication bus
   */
  unregisterAgent(sessionId: string): void {
    debug('Unregistering agent from communication bus:', sessionId);
    
    this.agentContexts.delete(sessionId);
    this.messageHandlers.delete(sessionId);
    this.messageHistory.delete(sessionId);
    
    // Cancel any pending requests from this agent
    for (const [requestId, request] of this.pendingRequests) {
      if (requestId.startsWith(sessionId)) {
        clearTimeout(request.timeout);
        request.reject(new Error('Agent disconnected'));
        this.pendingRequests.delete(requestId);
      }
    }
    
    this.emit('agent_unregistered', { sessionId });
  }

  /**
   * Subscribe an agent to specific message types
   */
  subscribe(sessionId: string, messageTypes: string[], handler: (message: AgentMessage) => Promise<void> | void): void {
    const handlers = this.messageHandlers.get(sessionId) || [];
    
    const messageHandler: MessageHandler = {
      agentId: sessionId,
      messageTypes,
      handler
    };
    
    handlers.push(messageHandler);
    this.messageHandlers.set(sessionId, handlers);
    
    debug('Agent subscribed to messages:', sessionId, messageTypes);
  }

  /**
   * Send a message to another agent or broadcast
   */
  async sendMessage(message: Omit<AgentMessage, 'id' | 'timestamp'>): Promise<void> {
    const fullMessage: AgentMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: Date.now()
    };

    debug('Sending message:', fullMessage.from, '->', fullMessage.to, fullMessage.type);
    
    // Store in message history
    const fromHistory = this.messageHistory.get(message.from) || [];
    fromHistory.push(fullMessage);
    this.messageHistory.set(message.from, fromHistory);
    
    // Update sender activity
    const senderContext = this.agentContexts.get(message.from);
    if (senderContext) {
      senderContext.lastActivity = Date.now();
    }

    // Route message
    if (message.to === 'broadcast') {
      await this.broadcastMessage(fullMessage);
    } else {
      await this.routeMessage(fullMessage);
    }

    this.emit('message_sent', fullMessage);
  }

  /**
   * Send a message and wait for a response
   */
  async sendMessageWithResponse<T = any>(
    message: Omit<AgentMessage, 'id' | 'timestamp'>, 
    timeoutMs: number = 30000
  ): Promise<T> {
    const correlationId = this.generateCorrelationId();
    const messageWithCorrelation = {
      ...message,
      correlationId
    };

    return new Promise((resolve, reject) => {
      const requestId = `${message.from}_${correlationId}`;
      
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Message timeout: No response within ${timeoutMs}ms`));
      }, timeoutMs);

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Send the message
      this.sendMessage(messageWithCorrelation).catch(reject);
    });
  }

  /**
   * Reply to a message
   */
  async replyToMessage(originalMessage: AgentMessage, replyPayload: any): Promise<void> {
    const reply: Omit<AgentMessage, 'id' | 'timestamp'> = {
      from: originalMessage.to as string, // Swap from/to
      to: originalMessage.from,
      type: 'task_result', // Default reply type
      payload: replyPayload,
      correlationId: originalMessage.correlationId
    };

    await this.sendMessage(reply);
  }

  /**
   * Share data between agents in the same workspace
   */
  async shareContext(sessionId: string, key: string, data: any): Promise<void> {
    const context = this.agentContexts.get(sessionId);
    if (!context) {
      throw new Error(`Agent ${sessionId} not registered`);
    }

    context.sharedData[key] = data;
    context.lastActivity = Date.now();

    // Broadcast context update to other agents in the same workspace
    const workspaceAgents = Array.from(this.agentContexts.values())
      .filter(c => c.workspaceId === context.workspaceId && c.sessionId !== sessionId);

    for (const agent of workspaceAgents) {
      await this.sendMessage({
        from: sessionId,
        to: agent.sessionId,
        type: 'context_share',
        payload: { key, data, agent: context.agent }
      });
    }

    this.emit('context_shared', { sessionId, key, data });
  }

  /**
   * Get shared context from an agent
   */
  getSharedContext(sessionId: string, key?: string): any {
    const context = this.agentContexts.get(sessionId);
    if (!context) return null;

    if (key) {
      return context.sharedData[key];
    }
    return context.sharedData;
  }

  /**
   * Get all agents in a workspace
   */
  getWorkspaceAgents(workspaceId: string): AgentContext[] {
    return Array.from(this.agentContexts.values())
      .filter(context => context.workspaceId === workspaceId);
  }

  /**
   * Get message history for an agent
   */
  getMessageHistory(sessionId: string, limit?: number): AgentMessage[] {
    const history = this.messageHistory.get(sessionId) || [];
    if (limit) {
      return history.slice(-limit);
    }
    return [...history];
  }

  /**
   * Check if an agent is active (recent activity)
   */
  isAgentActive(sessionId: string, timeoutMs: number = 300000): boolean { // 5 minutes default
    const context = this.agentContexts.get(sessionId);
    if (!context) return false;

    return (Date.now() - context.lastActivity) < timeoutMs;
  }

  /**
   * Get communication stats
   */
  getStats(): {
    activeAgents: number;
    totalMessages: number;
    pendingRequests: number;
    workspaces: string[];
  } {
    const totalMessages = Array.from(this.messageHistory.values())
      .reduce((sum, history) => sum + history.length, 0);
    
    const workspaces = [...new Set(
      Array.from(this.agentContexts.values()).map(c => c.workspaceId)
    )];

    return {
      activeAgents: this.agentContexts.size,
      totalMessages,
      pendingRequests: this.pendingRequests.size,
      workspaces
    };
  }

  private async routeMessage(message: AgentMessage): Promise<void> {
    // Check if target agent exists
    const targetContext = this.agentContexts.get(message.to as string);
    if (!targetContext) {
      debug('Target agent not found:', message.to);
      this.emit('message_delivery_failed', { 
        message, 
        reason: 'Target agent not found' 
      });
      return;
    }

    // Update target activity
    targetContext.lastActivity = Date.now();

    // Store in target's message history
    const targetHistory = this.messageHistory.get(message.to as string) || [];
    targetHistory.push(message);
    this.messageHistory.set(message.to as string, targetHistory);

    // Handle response messages (messages with correlationId)
    if (message.correlationId) {
      const requestId = `${message.to}_${message.correlationId}`;
      const pendingRequest = this.pendingRequests.get(requestId);
      
      if (pendingRequest) {
        clearTimeout(pendingRequest.timeout);
        pendingRequest.resolve(message.payload);
        this.pendingRequests.delete(requestId);
        return;
      }
    }

    // Deliver to handlers
    const handlers = this.messageHandlers.get(message.to as string) || [];
    const matchingHandlers = handlers.filter(h => 
      h.messageTypes.includes(message.type) || h.messageTypes.includes('*')
    );

    for (const handler of matchingHandlers) {
      try {
        await handler.handler(message);
      } catch (error) {
        debug('Error in message handler:', error);
        this.emit('handler_error', { handler: handler.agentId, message, error });
      }
    }

    this.emit('message_delivered', { message, handlersCount: matchingHandlers.length });
  }

  private async broadcastMessage(message: AgentMessage): Promise<void> {
    const senderContext = this.agentContexts.get(message.from);
    if (!senderContext) return;

    // Broadcast to all agents in the same workspace except sender
    const workspaceAgents = Array.from(this.agentContexts.values())
      .filter(c => c.workspaceId === senderContext.workspaceId && c.sessionId !== message.from);

    const deliveryPromises = workspaceAgents.map(async (agent) => {
      const broadcastMessage = {
        ...message,
        to: agent.sessionId
      };
      await this.routeMessage(broadcastMessage);
    });

    await Promise.all(deliveryPromises);
    this.emit('message_broadcast', { message, recipientCount: workspaceAgents.length });
  }

  private setupInternalHandlers(): void {
    // Handle cleanup of old messages
    setInterval(() => {
      this.cleanupOldMessages();
    }, 300000); // Clean up every 5 minutes

    // Handle cleanup of old pending requests
    setInterval(() => {
      this.cleanupOldRequests();
    }, 60000); // Check every minute
  }

  private cleanupOldMessages(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const cutoff = Date.now() - maxAge;

    for (const [sessionId, history] of this.messageHistory) {
      const filteredHistory = history.filter(msg => msg.timestamp > cutoff);
      if (filteredHistory.length !== history.length) {
        this.messageHistory.set(sessionId, filteredHistory);
        debug(`Cleaned up ${history.length - filteredHistory.length} old messages for ${sessionId}`);
      }
    }
  }

  private cleanupOldRequests(): void {
    // Pending requests are cleaned up by their timeout handlers
    // This is just for extra safety
    const staleRequests = [];
    for (const [requestId, request] of this.pendingRequests) {
      // If request is older than 5 minutes, force cleanup
      if (Date.now() - parseInt(requestId.split('_')[1]) > 300000) {
        staleRequests.push(requestId);
      }
    }

    for (const requestId of staleRequests) {
      const request = this.pendingRequests.get(requestId);
      if (request) {
        clearTimeout(request.timeout);
        request.reject(new Error('Request expired'));
        this.pendingRequests.delete(requestId);
      }
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}