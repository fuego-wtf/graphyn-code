/**
 * Agent Session Manager - Manages Claude Code sessions with Git worktree isolation
 *
 * Features:
 * - Git worktree isolation for parallel agent execution
 * - Session lifecycle management with heartbeat monitoring
 * - Resource cleanup and error recovery
 * - Professional agent persona integration
 * - Performance tracking and optimization
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import {
  AgentSession,
  AgentPersona,
  AgentState,
  GitWorktreeInfo,
  TaskResult,
  TaskExecution
} from './types.js';
import {
  SESSION_HEARTBEAT_INTERVAL_MS,
  SESSION_TIMEOUT_MS,
  SESSION_INITIALIZATION_TIMEOUT_MS,
  MAX_SESSION_RETRIES,
  WORKTREE_BASE_PATH,
  MAX_WORKTREES,
  WORKTREE_CLEANUP_TIMEOUT_MS,
  AGENT_PERSONAS
} from './constants.js';

/**
 * Session metrics for monitoring and performance analysis
 */
export interface SessionMetrics {
  totalSessionsCreated: number;
  activeSessionsCount: number;
  averageSessionDurationMs: number;
  successfulSessionsCount: number;
  failedSessionsCount: number;
  worktreesCreated: number;
  worktreesCleanedUp: number;
  memoryUsageMb: number;
  cpuUsagePercent: number;
}

/**
 * Configuration for Agent Session Manager
 */
export interface AgentSessionManagerConfig {
  readonly maxSessions?: number;
  readonly sessionTimeoutMs?: number;
  readonly enableWorktrees?: boolean;
  readonly workingDirectory?: string;
  readonly enableHeartbeat?: boolean;
  readonly retryAttempts?: number;
}

/**
 * Session creation options
 */
export interface SessionCreationOptions {
  readonly agentPersona: AgentPersona;
  readonly initialContext?: string;
  readonly workingDirectory?: string;
  readonly enableWorktree?: boolean;
  readonly priority?: number;
}

/**
 * Session statistics for monitoring
 */
export interface SessionStatistics {
  readonly totalSessions: number;
  readonly activeSessions: number;
  readonly idleSessions: number;
  readonly errorSessions: number;
  readonly worktreesActive: number;
  readonly memoryUsageMb: number;
  readonly avgSessionAgeMs: number;
}

/**
 * Agent Session Manager - Coordinates agent sessions with isolation
 */
export class AgentSessionManager extends EventEmitter {
  private readonly config: Required<AgentSessionManagerConfig>;
  private readonly sessions = new Map<string, AgentSession>();
  private readonly worktrees = new Map<string, GitWorktreeInfo>();
  private readonly heartbeatInterval: NodeJS.Timeout | null = null;

  private sessionCounter = 0;
  private worktreeCounter = 0;
  private isShuttingDown = false;

  constructor(config: AgentSessionManagerConfig = {}) {
    super();

    this.config = {
      maxSessions: config.maxSessions || 8,
      sessionTimeoutMs: config.sessionTimeoutMs || SESSION_TIMEOUT_MS,
      enableWorktrees: config.enableWorktrees ?? true,
      workingDirectory: config.workingDirectory || process.cwd(),
      enableHeartbeat: config.enableHeartbeat ?? true,
      retryAttempts: config.retryAttempts || MAX_SESSION_RETRIES
    };

    if (this.config.enableHeartbeat) {
      this.startHeartbeatMonitoring();
    }

    // Cleanup on process exit
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * Create agent sessions for given personas
   */
  async createSessions(agentIds: string[]): Promise<AgentSession[]> {
    if (this.isShuttingDown) {
      throw new Error('Session manager is shutting down');
    }

    const sessions: AgentSession[] = [];
    const creationPromises = agentIds.map(async (agentId) => {
      const persona = AGENT_PERSONAS.find(p => p.id === agentId);
      if (!persona) {
        throw new Error(`Agent persona not found: ${agentId}`);
      }

      const session = await this.createSession({ agentPersona: persona });
      return session;
    });

    try {
      const createdSessions = await Promise.allSettled(creationPromises);

      for (const result of createdSessions) {
        if (result.status === 'fulfilled') {
          sessions.push(result.value);
        } else {
          this.emit('sessionCreationFailed', {
            error: result.reason,
            timestamp: new Date()
          });
        }
      }

      if (sessions.length === 0) {
        throw new Error('Failed to create any agent sessions');
      }

      return sessions;

    } catch (error) {
      this.emit('sessionCreationError', { error, agentIds });
      throw new Error(`Failed to create agent sessions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a single agent session with optional Git worktree
   */
  async createSession(options: SessionCreationOptions): Promise<AgentSession> {
    if (this.sessions.size >= this.config.maxSessions) {
      throw new Error(`Maximum sessions limit reached: ${this.config.maxSessions}`);
    }

    const sessionId = this.generateSessionId(options.agentPersona.id);
    let worktreePath: string | null = null;
    let gitBranch: string | null = null;

    try {
      // Create Git worktree for isolation if enabled
      if (this.config.enableWorktrees && options.enableWorktree !== false) {
        const worktreeInfo = await this.createWorktree(sessionId, options.agentPersona.id);
        worktreePath = worktreeInfo.path;
        gitBranch = worktreeInfo.branch;

        this.emit('worktreeCreated', {
          sessionId,
          path: worktreePath,
          branch: gitBranch
        });
      }

      // Create session object
      const session: AgentSession = {
        id: sessionId,
        agentPersona: options.agentPersona,
        state: AgentState.IDLE,
        currentTask: null,
        startTime: new Date(),
        lastHeartbeat: new Date(),
        processId: null,
        worktreePath,
        gitBranch
      };

      // Register session
      this.sessions.set(sessionId, session);

      // Start heartbeat monitoring for this session
      this.updateHeartbeat(sessionId);

      this.emit('sessionCreated', session);

      return session;

    } catch (error) {
      // Cleanup on failure
      if (worktreePath) {
        await this.cleanupWorktree(sessionId).catch(() => {
          // Ignore cleanup errors during creation failure
        });
      }

      this.emit('sessionCreationFailed', {
        agentPersona: options.agentPersona,
        error,
        timestamp: new Date()
      });

      throw new Error(`Failed to create session for ${options.agentPersona.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute task with specific agent session
   */
  async executeTaskWithSession(
    sessionId: string,
    task: TaskExecution,
    contextPrompt: string
  ): Promise<TaskResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.state !== AgentState.IDLE) {
      throw new Error(`Session ${sessionId} is not idle (current state: ${session.state})`);
    }

    const startTime = Date.now();

    try {
      // Update session state
      session.state = AgentState.BUSY;
      session.currentTask = task.id;
      this.updateHeartbeat(sessionId);

      this.emit('taskStarted', { sessionId, taskId: task.id });

      // Execute with Claude Code in the session's worktree
      const result = await this.executeClaude(
        session,
        contextPrompt,
        task
      );

      // Mark task as completed
      session.state = AgentState.IDLE;
      session.currentTask = null;
      this.updateHeartbeat(sessionId);

      this.emit('taskCompleted', { sessionId, taskId: task.id, result });

      return {
        taskId: task.id,
        agentType: session.agentPersona.id,
        success: true,
        output: result.output,
        result: result.result,
        duration: Date.now() - startTime,
        artifacts: result.artifacts || [],
        filesModified: result.filesModified || [],
        timeElapsedMs: Date.now() - startTime
      };

    } catch (error) {
      // Handle execution error
      session.state = AgentState.ERROR;
      session.currentTask = null;
      this.updateHeartbeat(sessionId);

      this.emit('taskFailed', { sessionId, taskId: task.id, error });

      return {
        taskId: task.id,
        agentType: session.agentPersona.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        timeElapsedMs: Date.now() - startTime
      };
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): AgentSession[] {
    return Array.from(this.sessions.values()).filter(s =>
      s.state === AgentState.IDLE || s.state === AgentState.BUSY
    );
  }

  /**
   * Get sessions for specific agent type
   */
  getSessionsByAgent(agentId: string): AgentSession[] {
    return Array.from(this.sessions.values()).filter(s =>
      s.agentPersona.id === agentId
    );
  }

  /**
   * Get session statistics
   */
  getStatistics(): SessionStatistics {
    const sessions = Array.from(this.sessions.values());
    const now = Date.now();

    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(s => s.state === AgentState.BUSY).length;
    const idleSessions = sessions.filter(s => s.state === AgentState.IDLE).length;
    const errorSessions = sessions.filter(s => s.state === AgentState.ERROR).length;
    const worktreesActive = this.worktrees.size;

    const totalAge = sessions.reduce((sum, session) => {
      return sum + (now - session.startTime.getTime());
    }, 0);
    const avgSessionAgeMs = totalSessions > 0 ? totalAge / totalSessions : 0;

    return {
      totalSessions,
      activeSessions,
      idleSessions,
      errorSessions,
      worktreesActive,
      memoryUsageMb: this.getMemoryUsage(),
      avgSessionAgeMs
    };
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.getActiveSessions().length;
  }

  /**
   * Terminate specific session
   */
  async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      // Kill any running process
      if (session.processId) {
        try {
          process.kill(session.processId, 'SIGTERM');
        } catch (error) {
          // Process might already be terminated
        }
      }

      // Clean up worktree
      if (session.worktreePath) {
        await this.cleanupWorktree(sessionId);
      }

      // Remove from tracking
      this.sessions.delete(sessionId);

      this.emit('sessionTerminated', session);

    } catch (error) {
      this.emit('sessionTerminationError', { sessionId, error });
    }
  }

  /**
   * Terminate all sessions
   */
  async terminateAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());

    const terminationPromises = sessionIds.map(id =>
      this.terminateSession(id).catch(error => {
        this.emit('sessionTerminationError', { sessionId: id, error });
      })
    );

    await Promise.allSettled(terminationPromises);
  }

  /**
   * Cleanup resources and shutdown
   */
  async cleanup(): Promise<void> {
    await this.terminateAllSessions();

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  /**
   * Full shutdown with cleanup
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    try {
      await this.cleanup();
      this.emit('shutdown');
    } catch (error) {
      this.emit('shutdownError', error);
    }
  }

  // Private methods

  /**
   * Execute Claude Code with session context
   */
  private async executeClaude(
    session: AgentSession,
    contextPrompt: string,
    task: TaskExecution
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      let output = '';
      let error = '';

      const workingDir = session.worktreePath || this.config.workingDirectory;

      // Spawn Claude Code process
      const claudeProcess = spawn('claude', ['-p', contextPrompt], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: workingDir,
        timeout: this.config.sessionTimeoutMs
      });

      // Update session with process ID
      session.processId = claudeProcess.pid || null;

      claudeProcess.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        output += chunk;
        this.updateHeartbeat(session.id);

        this.emit('sessionOutput', {
          sessionId: session.id,
          taskId: task.id,
          chunk
        });
      });

      claudeProcess.stderr?.on('data', (data: Buffer) => {
        error += data.toString();
        this.emit('sessionError', {
          sessionId: session.id,
          taskId: task.id,
          error: data.toString()
        });
      });

      claudeProcess.on('exit', (code) => {
        session.processId = null;

        if (code === 0) {
          resolve({
            output,
            result: this.parseClaudeOutput(output),
            artifacts: this.extractArtifacts(output),
            filesModified: this.extractFilesModified(output)
          });
        } else {
          reject(new Error(`Claude process exited with code ${code}: ${error}`));
        }
      });

      claudeProcess.on('error', (err) => {
        session.processId = null;
        reject(new Error(`Claude process error: ${err.message}`));
      });

      // Set timeout
      setTimeout(() => {
        if (!claudeProcess.killed) {
          claudeProcess.kill('SIGTERM');
          reject(new Error('Claude execution timeout'));
        }
      }, this.config.sessionTimeoutMs);
    });
  }

  /**
   * Create Git worktree for agent isolation
   */
  private async createWorktree(sessionId: string, agentId: string): Promise<GitWorktreeInfo> {
    const branchName = `graphyn-agent-${agentId}-${++this.worktreeCounter}`;
    const worktreePath = resolve(this.config.workingDirectory, WORKTREE_BASE_PATH, sessionId);

    try {
      // Create worktree directory
      await fs.mkdir(worktreePath, { recursive: true });

      // Create Git worktree
      const { spawn } = await import('child_process');

      await new Promise<void>((resolve, reject) => {
        const gitProcess = spawn('git', [
          'worktree', 'add',
          '-b', branchName,
          worktreePath,
          'HEAD'
        ], {
          cwd: this.config.workingDirectory,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let error = '';
        gitProcess.stderr?.on('data', (data) => {
          error += data.toString();
        });

        gitProcess.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Git worktree creation failed: ${error}`));
          }
        });
      });

      // Get commit hash
      const commitHash = await this.getCurrentCommitHash(worktreePath);

      const worktreeInfo: GitWorktreeInfo = {
        path: worktreePath,
        branch: branchName,
        commitHash,
        isClean: true
      };

      this.worktrees.set(sessionId, worktreeInfo);

      return worktreeInfo;

    } catch (error) {
      // Cleanup on failure
      try {
        await fs.rmdir(worktreePath, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }

      throw new Error(`Failed to create worktree: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Cleanup Git worktree
   */
  private async cleanupWorktree(sessionId: string): Promise<void> {
    const worktreeInfo = this.worktrees.get(sessionId);
    if (!worktreeInfo) {
      return;
    }

    try {
      // Remove Git worktree
      await new Promise<void>((resolve, reject) => {
        const gitProcess = spawn('git', [
          'worktree', 'remove', '--force', worktreeInfo.path
        ], {
          cwd: this.config.workingDirectory,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let error = '';
        gitProcess.stderr?.on('data', (data) => {
          error += data.toString();
        });

        gitProcess.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Git worktree removal failed: ${error}`));
          }
        });

        // Set timeout for cleanup
        setTimeout(() => {
          gitProcess.kill('SIGTERM');
          reject(new Error('Worktree cleanup timeout'));
        }, WORKTREE_CLEANUP_TIMEOUT_MS);
      });

      // Remove from tracking
      this.worktrees.delete(sessionId);

      this.emit('worktreeCleanedUp', { sessionId, path: worktreeInfo.path });

    } catch (error) {
      this.emit('worktreeCleanupError', { sessionId, error });
      // Still remove from tracking to prevent memory leaks
      this.worktrees.delete(sessionId);
    }
  }

  /**
   * Get current Git commit hash
   */
  private async getCurrentCommitHash(workingDir: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const gitProcess = spawn('git', ['rev-parse', 'HEAD'], {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let error = '';

      gitProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      gitProcess.stderr?.on('data', (data) => {
        error += data.toString();
      });

      gitProcess.on('exit', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Failed to get commit hash: ${error}`));
        }
      });
    });
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeatMonitoring(): void {
    setInterval(() => {
      this.checkSessionHealth();
    }, SESSION_HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Check health of all sessions
   */
  private checkSessionHealth(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      const timeSinceHeartbeat = now - session.lastHeartbeat.getTime();

      if (timeSinceHeartbeat > this.config.sessionTimeoutMs) {
        expiredSessions.push(sessionId);
        this.emit('sessionTimeout', { sessionId, age: timeSinceHeartbeat });
      }
    }

    // Terminate expired sessions
    for (const sessionId of expiredSessions) {
      this.terminateSession(sessionId).catch(error => {
        this.emit('sessionTerminationError', { sessionId, error });
      });
    }
  }

  /**
   * Update session heartbeat
   */
  private updateHeartbeat(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastHeartbeat = new Date();
    }
  }

  /**
   * Parse Claude output for structured results
   */
  private parseClaudeOutput(output: string): any {
    try {
      const jsonMatches = output.match(/```json\n(.*?)\n```/s);
      if (jsonMatches) {
        return JSON.parse(jsonMatches[1]);
      }
    } catch (error) {
      // Fallback to summary
    }

    return { summary: output.slice(0, 500) };
  }

  /**
   * Extract artifacts from Claude output
   */
  private extractArtifacts(output: string): string[] {
    const artifacts: string[] = [];
    const artifactRegex = /Created:\s*([^\n]+)/gi;
    let match;

    while ((match = artifactRegex.exec(output)) !== null) {
      artifacts.push(match[1].trim());
    }

    return artifacts;
  }

  /**
   * Extract modified files from Claude output
   */
  private extractFilesModified(output: string): string[] {
    const files: string[] = [];
    const fileRegex = /(?:Modified|Updated|Created):\s*([^\s]+\.[a-zA-Z0-9]+)/gi;
    let match;

    while ((match = fileRegex.exec(output)) !== null) {
      files.push(match[1]);
    }

    return files;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(agentId: string): string {
    return `${agentId}_session_${Date.now()}_${++this.sessionCounter}`;
  }

  /**
   * Get current memory usage estimate
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    }
    return 0;
  }
}