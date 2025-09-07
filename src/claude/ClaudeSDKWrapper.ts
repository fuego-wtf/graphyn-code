/**
 * Claude SDK Wrapper
 * 
 * Integrates with existing spawn() pattern from Mission Control
 * Provides session management and Claude API interaction
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { EventEmitter } from 'events';

export interface ClaudeSession {
  id: string;
  process?: ChildProcess;
  status: 'initializing' | 'active' | 'busy' | 'error' | 'terminated';
  agentPrompt?: string;
  context: string[];
  createdAt: number;
  lastActivity: number;
}

export interface ClaudeSDKConfig {
  claudePath?: string;
  maxSessions: number;
  sessionTimeout: number;
  enableLogging: boolean;
}

export interface ClaudeResponse {
  sessionId: string;
  output: string;
  error?: string;
  completed: boolean;
  timestamp: number;
}

/**
 * Claude SDK Wrapper using spawn() pattern
 * Based on successful Mission Control implementation
 */
export class ClaudeSDKWrapper extends EventEmitter {
  private sessions: Map<string, ClaudeSession> = new Map();
  private config: ClaudeSDKConfig;
  private claudePath?: string;

  constructor(config?: Partial<ClaudeSDKConfig>) {
    super();
    
    this.config = {
      claudePath: config?.claudePath,
      maxSessions: config?.maxSessions || 5,
      sessionTimeout: config?.sessionTimeout || 30 * 60 * 1000, // 30 minutes
      enableLogging: config?.enableLogging || true
    };
    
    this.initializeSDK();
  }

  /**
   * Initialize SDK and detect Claude CLI
   */
  private async initializeSDK(): Promise<void> {
    try {
      // First try to find claude in PATH
      const claudePath = await this.findClaudeBinary();
      if (claudePath) {
        this.claudePath = claudePath;
        this.log('✅ Claude CLI detected at:', claudePath);
        return;
      }
      
      // If not found, provide installation guidance
      this.log('⚠️  Claude CLI not found in PATH');
      this.log('Please install Claude CLI: https://claude.ai/cli');
      
    } catch (error: any) {
      this.log('❌ Failed to initialize Claude SDK:', error.message);
    }
  }

  /**
   * Find Claude binary in system PATH
   */
  private async findClaudeBinary(): Promise<string | null> {
    return new Promise((resolve) => {
      const which = process.platform === 'win32' ? 'where' : 'which';
      
      const child = spawn(which, ['claude'], { stdio: 'pipe' });
      let output = '';
      
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 && output.trim()) {
          resolve(output.trim().split('\n')[0]);
        } else {
          resolve(null);
        }
      });
      
      child.on('error', () => {
        resolve(null);
      });
    });
  }

  /**
   * Create new Claude session
   */
  async createSession(agentPrompt?: string, context: string[] = []): Promise<string> {
    if (!this.claudePath) {
      throw new Error('Claude CLI not available. Please install it first.');
    }
    
    if (this.sessions.size >= this.config.maxSessions) {
      // Clean up old sessions
      await this.cleanupOldSessions();
      
      if (this.sessions.size >= this.config.maxSessions) {
        throw new Error(`Maximum sessions (${this.config.maxSessions}) reached`);
      }
    }
    
    const sessionId = this.generateSessionId();
    
    const session: ClaudeSession = {
      id: sessionId,
      status: 'initializing',
      agentPrompt,
      context,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };
    
    this.sessions.set(sessionId, session);
    this.log(`📝 Created session ${sessionId}`);
    
    // Initialize the session
    await this.initializeSession(sessionId);
    
    return sessionId;
  }

  /**
   * Initialize Claude session with spawn
   */
  private async initializeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    try {
      // Build command arguments based on Mission Control pattern
      const args: string[] = [];
      
      if (session.agentPrompt) {
        args.push('-p', session.agentPrompt);
      }
      
      // Add context if provided
      if (session.context.length > 0) {
        const contextPrompt = this.buildContextPrompt(session.context);
        if (session.agentPrompt) {
          args[1] = `${session.agentPrompt}\n\n${contextPrompt}`;
        } else {
          args.push('-p', contextPrompt);
        }
      }
      
      this.log(`🚀 Starting Claude session ${sessionId} with args:`, args);
      
      // Spawn Claude process
      const claude = spawn(this.claudePath!, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        env: {
          ...process.env,
          CLAUDE_SESSION_ID: sessionId
        }
      });
      
      session.process = claude;
      session.status = 'active';
      session.lastActivity = Date.now();
      
      // Set up event handlers
      this.setupProcessHandlers(sessionId, claude);
      
      this.log(`✅ Session ${sessionId} initialized successfully`);
      this.emit('sessionCreated', { sessionId, status: 'active' });
      
    } catch (error: any) {
      session.status = 'error';
      this.log(`❌ Failed to initialize session ${sessionId}:`, error.message);
      this.emit('sessionError', { sessionId, error: error.message });
      throw error;
    }
  }

  /**
   * Set up process event handlers
   */
  private setupProcessHandlers(sessionId: string, process: ChildProcess): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    // Handle stdout
    process.stdout?.on('data', (data) => {
      const output = data.toString();
      session.lastActivity = Date.now();
      
      this.emit('output', {
        sessionId,
        output,
        completed: false,
        timestamp: Date.now()
      } as ClaudeResponse);
      
      this.log(`📤 Session ${sessionId} output:`, output.substring(0, 100) + '...');
    });
    
    // Handle stderr
    process.stderr?.on('data', (data) => {
      const error = data.toString();
      session.lastActivity = Date.now();
      
      this.emit('error', {
        sessionId,
        output: '',
        error,
        completed: false,
        timestamp: Date.now()
      } as ClaudeResponse);
      
      this.log(`🚨 Session ${sessionId} error:`, error);
    });
    
    // Handle process exit
    process.on('close', (code) => {
      session.status = 'terminated';
      
      this.emit('sessionEnded', {
        sessionId,
        output: '',
        completed: true,
        timestamp: Date.now()
      } as ClaudeResponse);
      
      this.log(`🔚 Session ${sessionId} ended with code ${code}`);
      
      // Clean up session after a delay
      setTimeout(() => {
        this.sessions.delete(sessionId);
      }, 5000);
    });
    
    // Handle process error
    process.on('error', (error) => {
      session.status = 'error';
      
      this.emit('sessionError', {
        sessionId,
        error: error.message
      });
      
      this.log(`💥 Session ${sessionId} process error:`, error.message);
    });
  }

  /**
   * Send input to Claude session
   */
  async sendToSession(sessionId: string, input: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    if (!session.process || session.status !== 'active') {
      throw new Error(`Session ${sessionId} is not active`);
    }
    
    try {
      session.process.stdin?.write(input + '\n');
      session.lastActivity = Date.now();
      session.status = 'busy';
      
      this.log(`📥 Sent to session ${sessionId}:`, input.substring(0, 100) + '...');
      
      // Reset to active after a delay
      setTimeout(() => {
        const currentSession = this.sessions.get(sessionId);
        if (currentSession && currentSession.status === 'busy') {
          currentSession.status = 'active';
        }
      }, 1000);
      
    } catch (error: any) {
      session.status = 'error';
      throw new Error(`Failed to send input to session ${sessionId}: ${error.message}`);
    }
  }

  /**
   * Destroy Claude session
   */
  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    try {
      if (session.process && !session.process.killed) {
        session.process.kill('SIGTERM');
        
        // Force kill after 5 seconds if not terminated
        setTimeout(() => {
          if (session.process && !session.process.killed) {
            session.process.kill('SIGKILL');
          }
        }, 5000);
      }
      
      session.status = 'terminated';
      this.sessions.delete(sessionId);
      
      this.log(`🗑️  Destroyed session ${sessionId}`);
      this.emit('sessionDestroyed', { sessionId });
      
    } catch (error: any) {
      this.log(`❌ Error destroying session ${sessionId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): ClaudeSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * List all active sessions
   */
  listSessions(): ClaudeSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Build context prompt from provided context array
   */
  private buildContextPrompt(context: string[]): string {
    const contextItems = context.map(item => {
      if (fs.existsSync(item)) {
        // If it's a file path, read the file
        try {
          const content = fs.readFileSync(item, 'utf8');
          return `File: ${item}\n---\n${content}\n---`;
        } catch (error) {
          return `File: ${item} (could not read)`;
        }
      }
      // Otherwise treat as direct context
      return item;
    });
    
    return `Context:\n${contextItems.join('\n\n')}`;
  }

  /**
   * Clean up old inactive sessions
   */
  private async cleanupOldSessions(): Promise<void> {
    const now = Date.now();
    const sessionsToDestroy: string[] = [];
    
    for (const [sessionId, session] of this.sessions) {
      const inactiveTime = now - session.lastActivity;
      
      if (inactiveTime > this.config.sessionTimeout) {
        sessionsToDestroy.push(sessionId);
      }
    }
    
    for (const sessionId of sessionsToDestroy) {
      try {
        await this.destroySession(sessionId);
      } catch (error) {
        this.log(`⚠️  Failed to cleanup session ${sessionId}`);
      }
    }
    
    if (sessionsToDestroy.length > 0) {
      this.log(`🧹 Cleaned up ${sessionsToDestroy.length} inactive sessions`);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `claude-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Logging utility
   */
  private log(...args: any[]): void {
    if (this.config.enableLogging) {
      console.log(`[ClaudeSDK]`, ...args);
    }
  }

  /**
   * Shutdown all sessions and cleanup
   */
  async shutdown(): Promise<void> {
    this.log('🔄 Shutting down Claude SDK...');
    
    const destroyPromises = Array.from(this.sessions.keys()).map(sessionId => 
      this.destroySession(sessionId).catch(error => 
        this.log(`⚠️  Error destroying session ${sessionId}:`, error.message)
      )
    );
    
    await Promise.all(destroyPromises);
    
    this.log('✅ Claude SDK shutdown complete');
  }

  /**
   * Health check for Claude CLI availability
   */
  async healthCheck(): Promise<{ available: boolean; version?: string; path?: string }> {
    if (!this.claudePath) {
      return { available: false };
    }
    
    return new Promise((resolve) => {
      const child = spawn(this.claudePath!, ['--version'], { stdio: 'pipe' });
      let output = '';
      
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            available: true,
            version: output.trim(),
            path: this.claudePath
          });
        } else {
          resolve({ available: false });
        }
      });
      
      child.on('error', () => {
        resolve({ available: false });
      });
    });
  }
}