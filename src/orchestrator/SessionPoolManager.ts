/**
 * Session Pool Manager for Multi-Agent Orchestration
 * 
 * Manages a pool of Claude Code sessions for different agent types,
 * providing load balancing, session reuse, and queue management.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { AgentType, TaskExecution } from './types';

/**
 * Claude Code session representation
 */
export interface ClaudeSession {
  readonly id: string;
  readonly agentType: AgentType;
  readonly process: ChildProcess;
  readonly createdAt: Date;
  status: SessionStatus;
  currentTask?: string;
  completedTasks: number;
  lastActivity: Date;
  output: string;
  error: string;
}

/**
 * Session lifecycle states
 */
export type SessionStatus = 
  | 'initializing'
  | 'available' 
  | 'busy'
  | 'completed'
  | 'failed'
  | 'timeout';

/**
 * Session creation options
 */
export interface SessionCreateOptions {
  readonly agentType: AgentType;
  readonly context?: string;
  readonly timeout?: number;
  readonly maxTasks?: number;
}

/**
 * Session pool statistics
 */
export interface PoolStatistics {
  readonly totalSessions: number;
  readonly availableSessions: number;
  readonly busySessions: number;
  readonly failedSessions: number;
  readonly queuedRequests: number;
  readonly averageWaitTime: number;
}

/**
 * Session queue request
 */
interface SessionRequest {
  readonly agentType: AgentType;
  readonly taskId: string;
  readonly requestTime: Date;
  readonly resolve: (session: ClaudeSession) => void;
  readonly reject: (error: Error) => void;
}

/**
 * Manages pool of Claude Code sessions for multi-agent orchestration
 */
export class SessionPoolManager extends EventEmitter {
  private readonly sessions = new Map<string, ClaudeSession>();
  private readonly sessionsByAgent = new Map<AgentType, Set<string>>();
  private readonly requestQueue: SessionRequest[] = [];
  private sessionCounter = 0;

  // Configuration
  private readonly maxSessionsPerAgent = 3;
  private readonly sessionTimeout = 300000; // 5 minutes
  private readonly maxTasksPerSession = 10;
  private readonly queueTimeout = 60000; // 1 minute

  /**
   * Create a new Claude Code session for specific agent type
   */
  async createSession(agentType: AgentType, options: Partial<SessionCreateOptions> = {}): Promise<ClaudeSession> {
    const sessionId = this.generateSessionId(agentType);
    
    // Check session limits
    const existingSessions = this.sessionsByAgent.get(agentType) || new Set();
    if (existingSessions.size >= this.maxSessionsPerAgent) {
      throw new Error(`Maximum sessions reached for agent type: ${agentType}`);
    }

    try {
      // Build context prompt for agent  
      const contextPrompt = this.buildAgentContext(agentType, options.context);
      
      // Spawn Claude Code process using direct path to avoid shell issues
      const claudeProcess = spawn('/Users/resatugurulu/.claude/local/claude', ['-p', contextPrompt], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: options.timeout || this.sessionTimeout
      });

      // Create session object
      const session: ClaudeSession = {
        id: sessionId,
        agentType,
        process: claudeProcess,
        createdAt: new Date(),
        status: 'initializing',
        completedTasks: 0,
        lastActivity: new Date(),
        output: '',
        error: ''
      };

      // Set up process event handlers
      this.setupSessionHandlers(session);

      // Register session
      this.sessions.set(sessionId, session);
      if (!this.sessionsByAgent.has(agentType)) {
        this.sessionsByAgent.set(agentType, new Set());
      }
      this.sessionsByAgent.get(agentType)!.add(sessionId);

      // Wait for initialization
      await this.waitForSessionReady(session);

      this.emit('sessionCreated', session);
      return session;

    } catch (error) {
      this.emit('sessionCreateFailed', { agentType, error });
      throw new Error(`Failed to create session for ${agentType}: ${error}`);
    }
  }

  /**
   * Get available session from pool or create new one
   */
  async getAvailableSession(agentType: AgentType, taskId: string): Promise<ClaudeSession> {
    // First, try to find available session of same type
    const availableSession = this.findAvailableSession(agentType);
    if (availableSession) {
      availableSession.status = 'busy';
      availableSession.currentTask = taskId;
      availableSession.lastActivity = new Date();
      return availableSession;
    }

    // Try to create new session
    try {
      const newSession = await this.createSession(agentType);
      newSession.status = 'busy';
      newSession.currentTask = taskId;
      return newSession;
    } catch (error) {
      // If creation fails, queue the request
      return this.queueSessionRequest(agentType, taskId);
    }
  }

  /**
   * Release session back to available pool
   */
  releaseSession(sessionId: string, completed: boolean = false): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (completed) {
      session.completedTasks++;
    }

    session.currentTask = undefined;
    session.lastActivity = new Date();

    // Check if session should be retired
    if (session.completedTasks >= this.maxTasksPerSession) {
      this.terminateSession(sessionId);
      return;
    }

    session.status = 'available';
    this.emit('sessionReleased', session);

    // Process queue
    this.processQueue();
  }

  /**
   * Terminate session and clean up resources
   */
  terminateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // Kill process
    if (session.process && !session.process.killed) {
      session.process.kill('SIGTERM');
    }

    // Clean up tracking
    this.sessions.delete(sessionId);
    const agentSessions = this.sessionsByAgent.get(session.agentType);
    if (agentSessions) {
      agentSessions.delete(sessionId);
      if (agentSessions.size === 0) {
        this.sessionsByAgent.delete(session.agentType);
      }
    }

    this.emit('sessionTerminated', session);
  }

  /**
   * Get pool statistics
   */
  getStatistics(): PoolStatistics {
    const total = this.sessions.size;
    let available = 0;
    let busy = 0;
    let failed = 0;

    this.sessions.forEach((session) => {
      switch (session.status) {
        case 'available':
          available++;
          break;
        case 'busy':
          busy++;
          break;
        case 'failed':
        case 'timeout':
          failed++;
          break;
      }
    });

    const totalWaitTime = this.requestQueue.reduce((sum, req) => {
      return sum + (Date.now() - req.requestTime.getTime());
    }, 0);

    const averageWaitTime = this.requestQueue.length > 0 
      ? totalWaitTime / this.requestQueue.length 
      : 0;

    return {
      totalSessions: total,
      availableSessions: available,
      busySessions: busy,
      failedSessions: failed,
      queuedRequests: this.requestQueue.length,
      averageWaitTime
    };
  }

  /**
   * Clean up expired sessions and process queue
   */
  cleanup(): void {
    const now = Date.now();

    // Clean up expired sessions
    this.sessions.forEach((session, sessionId) => {
      const elapsed = now - session.lastActivity.getTime();
      if (elapsed > this.sessionTimeout) {
        this.terminateSession(sessionId);
      }
    });

    // Clean up expired queue requests
    const expiredRequests = this.requestQueue.filter(req => {
      return (now - req.requestTime.getTime()) > this.queueTimeout;
    });

    for (const request of expiredRequests) {
      const index = this.requestQueue.indexOf(request);
      if (index !== -1) {
        this.requestQueue.splice(index, 1);
        request.reject(new Error('Queue request timeout'));
      }
    }

    this.processQueue();
  }

  /**
   * Shutdown all sessions
   */
  async shutdown(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    
    // Terminate all sessions
    for (const sessionId of sessionIds) {
      this.terminateSession(sessionId);
    }

    // Reject all queued requests
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;
      request.reject(new Error('Pool shutting down'));
    }

    this.emit('shutdown');
  }

  // Private methods

  private generateSessionId(agentType: AgentType): string {
    return `${agentType}-${Date.now()}-${++this.sessionCounter}`;
  }

  private buildAgentContext(agentType: AgentType, additionalContext?: string): string {
    const baseContext = `You are a ${agentType} agent in a multi-agent orchestration system. 
Work collaboratively with other agents to complete tasks efficiently.
Focus on your specialized role and communicate clearly about your progress.`;

    if (additionalContext) {
      return `${baseContext}\n\nAdditional Context:\n${additionalContext}`;
    }

    return baseContext;
  }

  private setupSessionHandlers(session: ClaudeSession): void {
    let isReady = false;

    session.process.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      session.output += output;
      session.lastActivity = new Date();

      // Check if Claude is ready (it starts outputting immediately)
      if (!isReady && session.status === 'initializing') {
        isReady = true;
        session.status = 'available';
        this.emit('sessionReady', session);
      }

      this.emit('sessionOutput', { sessionId: session.id, data: output });
    });

    session.process.stderr?.on('data', (data: Buffer) => {
      const error = data.toString();
      session.error += error;

      // If we get stderr during initialization, consider it failed
      if (session.status === 'initializing') {
        session.status = 'failed';
      }

      this.emit('sessionError', { sessionId: session.id, error });
    });

    session.process.on('exit', (code) => {
      if (code === 0) {
        session.status = 'completed';
      } else {
        session.status = 'failed';
      }
      this.emit('sessionExit', { sessionId: session.id, code });
    });

    // If the process fails to start, mark as failed
    session.process.on('error', (error) => {
      session.status = 'failed';
      session.error += `Process error: ${error.message}`;
      this.emit('sessionError', { sessionId: session.id, error: error.message });
    });


    // Set session as available after brief initialization period
    setTimeout(() => {
      if (session.status === 'initializing') {
        session.status = 'available';
      }
    }, 2000);
  }

  private async waitForSessionReady(session: ClaudeSession): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Session initialization timeout: ${session.id}`));
      }, 10000);

      const checkStatus = () => {
        if (session.status === 'available') {
          clearTimeout(timeout);
          resolve();
        } else if (session.status === 'failed') {
          clearTimeout(timeout);
          reject(new Error(`Session failed to initialize: ${session.id}`));
        } else {
          setTimeout(checkStatus, 100);
        }
      };

      checkStatus();
    });
  }

  private findAvailableSession(agentType: AgentType): ClaudeSession | undefined {
    const agentSessions = this.sessionsByAgent.get(agentType);
    if (!agentSessions) {
      return undefined;
    }

    for (const sessionId of Array.from(agentSessions)) {
      const session = this.sessions.get(sessionId);
      if (session?.status === 'available') {
        return session;
      }
    }

    return undefined;
  }

  private async queueSessionRequest(agentType: AgentType, taskId: string): Promise<ClaudeSession> {
    return new Promise((resolve, reject) => {
      const request: SessionRequest = {
        agentType,
        taskId,
        requestTime: new Date(),
        resolve,
        reject
      };

      this.requestQueue.push(request);
      this.emit('sessionQueued', request);

      // Set timeout for queue request
      setTimeout(() => {
        const index = this.requestQueue.indexOf(request);
        if (index !== -1) {
          this.requestQueue.splice(index, 1);
          reject(new Error(`Queue timeout for task: ${taskId}`));
        }
      }, this.queueTimeout);
    });
  }

  private processQueue(): void {
    if (this.requestQueue.length === 0) {
      return;
    }

    // Group requests by agent type
    const requestsByAgent = new Map<AgentType, SessionRequest[]>();
    for (const request of this.requestQueue) {
      if (!requestsByAgent.has(request.agentType)) {
        requestsByAgent.set(request.agentType, []);
      }
      requestsByAgent.get(request.agentType)!.push(request);
    }

    // Process each agent type
    requestsByAgent.forEach((requests, agentType) => {
      const availableSession = this.findAvailableSession(agentType);
      if (availableSession && requests.length > 0) {
        const request = requests.shift()!;
        const queueIndex = this.requestQueue.indexOf(request);
        if (queueIndex !== -1) {
          this.requestQueue.splice(queueIndex, 1);
        }

        availableSession.status = 'busy';
        availableSession.currentTask = request.taskId;
        availableSession.lastActivity = new Date();

        request.resolve(availableSession);
      }
    });
  }
}