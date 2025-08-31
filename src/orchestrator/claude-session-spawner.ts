/**
 * Claude Session Spawner
 * Spawns and manages claude -p processes for parallel agent execution
 */
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface ClaudeSession {
  id: string;
  agentType: string;
  process: ChildProcess;
  status: 'initializing' | 'running' | 'completed' | 'failed' | 'timeout';
  output: string;
  error: string;
  toolUses: number;
  tokens: number;
  startTime: number;
  endTime?: number;
}

export interface SpawnOptions {
  agentType: string;
  prompt: string;
  timeout?: number;
  maxTokens?: number;
  outputFormat?: 'json' | 'text';
}

export class ClaudeSessionSpawner extends EventEmitter {
  private sessions: Map<string, ClaudeSession> = new Map();
  private sessionCounter = 0;

  /**
   * Spawn a new Claude session with enhanced prompt
   */
  async spawnSession(options: SpawnOptions): Promise<ClaudeSession> {
    const sessionId = this.generateSessionId(options.agentType);
    
    // Build claude command arguments
    const args = ['-p', options.prompt];
    
    if (options.outputFormat === 'json') {
      args.push('--output-format', 'json');
    }
    
    if (options.maxTokens) {
      args.push('--max-tokens', options.maxTokens.toString());
    }

    // Spawn claude process
    const claudeProcess = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY
      }
    });

    const session: ClaudeSession = {
      id: sessionId,
      agentType: options.agentType,
      process: claudeProcess,
      status: 'initializing',
      output: '',
      error: '',
      toolUses: 0,
      tokens: 0,
      startTime: Date.now()
    };

    this.sessions.set(sessionId, session);
    this.setupSessionMonitoring(session, options.timeout);

    console.log(`⏺ ${options.agentType}(${sessionId}) spawned`);
    console.log(`  ⎿  Initializing...`);

    return session;
  }

  /**
   * Setup monitoring for a Claude session
   */
  private setupSessionMonitoring(session: ClaudeSession, timeout = 300000): void {
    const { process, id } = session;

    // Monitor stdout
    if (process.stdout) {
      process.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        session.output += chunk;
        
        // Update session status
        if (session.status === 'initializing') {
          session.status = 'running';
          console.log(`  ⎿  ${session.agentType}: Running...`);
        }

        // Track tool usage (approximate)
        const toolMatches = chunk.match(/tool_use|function_call|claude_tool/gi);
        if (toolMatches) {
          session.toolUses += toolMatches.length;
        }

        // Estimate token usage (rough approximation: 1 token ≈ 4 characters)
        session.tokens += Math.floor(chunk.length / 4);

        this.emit('session_output', {
          sessionId: id,
          chunk,
          toolUses: session.toolUses,
          tokens: session.tokens
        });
      });
    }

    // Monitor stderr
    if (process.stderr) {
      process.stderr.on('data', (data: Buffer) => {
        const errorChunk = data.toString();
        session.error += errorChunk;
        
        console.log(`❌ ${session.agentType}(${id}) error: ${errorChunk}`);
        
        this.emit('session_error', {
          sessionId: id,
          error: errorChunk
        });
      });
    }

    // Handle process completion
    process.on('close', (code: number | null) => {
      session.endTime = Date.now();
      
      if (code === 0) {
        session.status = 'completed';
        console.log(`✅ ${session.agentType}(${id}) completed in ${this.getElapsedTime(session)}s`);
        
        this.emit('session_completed', {
          sessionId: id,
          output: session.output,
          toolUses: session.toolUses,
          tokens: session.tokens,
          duration: session.endTime - session.startTime
        });
      } else {
        session.status = 'failed';
        console.log(`❌ ${session.agentType}(${id}) failed with code ${code}`);
        
        this.emit('session_failed', {
          sessionId: id,
          code,
          error: session.error
        });
      }
    });

    // Setup timeout
    const timeoutHandle = setTimeout(() => {
      if (session.status === 'running' || session.status === 'initializing') {
        session.status = 'timeout';
        process.kill('SIGTERM');
        
        console.log(`⏰ ${session.agentType}(${id}) timed out after ${timeout/1000}s`);
        
        this.emit('session_timeout', {
          sessionId: id,
          timeout: timeout
        });
      }
    }, timeout);

    // Clear timeout on completion
    process.on('close', () => {
      clearTimeout(timeoutHandle);
    });
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ClaudeSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): ClaudeSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get sessions by status
   */
  getSessionsByStatus(status: ClaudeSession['status']): ClaudeSession[] {
    return this.getAllSessions().filter(session => session.status === status);
  }

  /**
   * Terminate a session
   */
  terminateSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (session.status === 'running' || session.status === 'initializing') {
      session.process.kill('SIGTERM');
      session.status = 'failed';
      session.endTime = Date.now();
      
      console.log(`🛑 ${session.agentType}(${sessionId}) terminated`);
      
      this.emit('session_terminated', { sessionId });
      return true;
    }
    
    return false;
  }

  /**
   * Terminate all active sessions
   */
  terminateAllSessions(): void {
    const activeSessions = this.getSessionsByStatus('running')
      .concat(this.getSessionsByStatus('initializing'));
    
    activeSessions.forEach(session => {
      this.terminateSession(session.id);
    });
    
    console.log(`🛑 Terminated ${activeSessions.length} active sessions`);
  }

  /**
   * Check if Claude is available
   */
  async checkClaudeAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const testProcess = spawn('claude', ['--version'], { stdio: 'pipe' });
      
      testProcess.on('close', (code) => {
        resolve(code === 0);
      });
      
      testProcess.on('error', () => {
        resolve(false);
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        testProcess.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(agentType: string): string {
    this.sessionCounter++;
    return `${agentType}_${Date.now()}_${this.sessionCounter}`;
  }

  /**
   * Get elapsed time for a session
   */
  private getElapsedTime(session: ClaudeSession): string {
    const endTime = session.endTime || Date.now();
    const elapsed = (endTime - session.startTime) / 1000;
    return elapsed.toFixed(1);
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    total: number;
    running: number;
    completed: number;
    failed: number;
    totalTokens: number;
    totalTools: number;
  } {
    const sessions = this.getAllSessions();
    
    return {
      total: sessions.length,
      running: this.getSessionsByStatus('running').length,
      completed: this.getSessionsByStatus('completed').length,
      failed: this.getSessionsByStatus('failed').length,
      totalTokens: sessions.reduce((sum, s) => sum + s.tokens, 0),
      totalTools: sessions.reduce((sum, s) => sum + s.toolUses, 0)
    };
  }

  /**
   * Clean up completed sessions
   */
  cleanup(): void {
    this.terminateAllSessions();
    this.sessions.clear();
    this.sessionCounter = 0;
    console.log('🧹 Claude sessions cleaned up');
  }
}