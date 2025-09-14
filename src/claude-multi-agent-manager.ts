/**
 * Claude Code Multi-Agent Manager
 * 
 * Specialized manager that spawns multiple Claude Code instances using tmux/git 
 * worktree isolation patterns from claude-squad, manages sessions, handles 
 * concurrent execution, and provides real-time coordination for 5-8 agents.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { ClaudeSDKWrapper, ClaudeSession, ClaudeResponse } from './claude/ClaudeSDKWrapper.js';
import { AgentTask, AgentExecutionResult } from './figma-api.js';

export interface AgentWorktree {
  agentId: string;
  agentType: string;
  worktreePath: string;
  tmuxSession: string;
  gitBranch: string;
  status: 'initializing' | 'ready' | 'busy' | 'paused' | 'error' | 'terminated';
  claudeProcess?: ChildProcess;
  claudeSession?: ClaudeSession;
  currentTask?: AgentTask;
  createdAt: Date;
  lastActivity: Date;
}

export interface MultiAgentConfig {
  maxConcurrentAgents: number;
  sessionTimeout: number;
  worktreeBaseDir: string;
  tmuxSessionPrefix: string;
  enableGitWorktrees: boolean;
  enableTmuxIsolation: boolean;
  claudeCodePath?: string;
  workspaceRoot?: string;
}

export interface AgentExecutionEvent {
  type: 'agent_started' | 'agent_progress' | 'agent_completed' | 'agent_failed' | 'agent_paused';
  agentId: string;
  agentType: string;
  taskId?: string;
  message?: string;
  output?: string;
  progress?: number;
  timestamp: Date;
}

export class ClaudeMultiAgentManager extends EventEmitter {
  private agents: Map<string, AgentWorktree> = new Map();
  private claudeSDK: ClaudeSDKWrapper;
  private config: MultiAgentConfig;
  private workspaceRoot: string;
  private isInitialized: boolean = false;
  
  constructor(config?: Partial<MultiAgentConfig>) {
    super();
    
    this.config = {
      maxConcurrentAgents: config?.maxConcurrentAgents || 8,
      sessionTimeout: config?.sessionTimeout || 30 * 60 * 1000, // 30 minutes
      worktreeBaseDir: config?.worktreeBaseDir || path.join(os.tmpdir(), 'claude-agents'),
      tmuxSessionPrefix: config?.tmuxSessionPrefix || 'claude-agent',
      enableGitWorktrees: config?.enableGitWorktrees ?? true,
      enableTmuxIsolation: config?.enableTmuxIsolation ?? true,
      claudeCodePath: config?.claudeCodePath,
      workspaceRoot: config?.workspaceRoot || process.cwd()
    };
    
    this.workspaceRoot = this.config.workspaceRoot!;
    this.claudeSDK = new ClaudeSDKWrapper({
      maxSessions: this.config.maxConcurrentAgents,
      sessionTimeout: this.config.sessionTimeout,
      enableLogging: true
    });
  }

  /**
   * Initialize the multi-agent manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log(chalk.cyan('🚀 Initializing Claude Multi-Agent Manager...'));

    try {
      // Ensure base directories exist
      await this.ensureDirectories();

      // Check for required tools
      await this.validateEnvironment();

      // Initialize Claude SDK
      await this.initializeClaudeSDK();

      this.isInitialized = true;
      console.log(chalk.green(`✅ Multi-Agent Manager initialized (max ${this.config.maxConcurrentAgents} agents)`));

    } catch (error: any) {
      console.error(chalk.red('❌ Failed to initialize Multi-Agent Manager:'), error.message);
      throw error;
    }
  }

  /**
   * Spawn a new agent with isolated environment
   */
  async spawnAgent(
    agentType: string,
    task: AgentTask,
    agentPrompt: string,
    progressCallback?: (event: AgentExecutionEvent) => void
  ): Promise<string> {
    if (this.agents.size >= this.config.maxConcurrentAgents) {
      throw new Error(`Maximum number of agents (${this.config.maxConcurrentAgents}) already spawned`);
    }

    const agentId = this.generateAgentId(agentType);
    console.log(chalk.blue(`🤖 Spawning ${agentType} agent: ${agentId}`));

    try {
      // Create isolated environment
      const worktree = await this.createAgentWorktree(agentId, agentType);
      
      // Set up tmux session if enabled
      if (this.config.enableTmuxIsolation) {
        await this.createTmuxSession(worktree);
      }

      // Create Claude session
      const claudeSessionId = await this.claudeSDK.createSession(agentPrompt, []);
      const claudeSession = this.claudeSDK.getSessionStatus(claudeSessionId);

      if (!claudeSession) {
        throw new Error(`Failed to create Claude session for agent ${agentId}`);
      }

      worktree.claudeSession = claudeSession;
      worktree.currentTask = task;
      worktree.status = 'ready';

      this.agents.set(agentId, worktree);

      // Emit agent started event
      const event: AgentExecutionEvent = {
        type: 'agent_started',
        agentId,
        agentType,
        taskId: task.id,
        message: `Agent ${agentId} spawned and ready`,
        timestamp: new Date()
      };

      this.emit('agentEvent', event);
      progressCallback?.(event);

      console.log(chalk.green(`✅ Agent ${agentId} spawned successfully`));
      return agentId;

    } catch (error: any) {
      console.error(chalk.red(`❌ Failed to spawn agent ${agentId}:`), error.message);
      
      // Cleanup on failure
      await this.terminateAgent(agentId);
      throw error;
    }
  }

  /**
   * Execute a task with the specified agent
   */
  async executeTaskWithAgent(
    agentId: string,
    task: AgentTask,
    progressCallback?: (event: AgentExecutionEvent) => void
  ): Promise<AgentExecutionResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (agent.status !== 'ready') {
      throw new Error(`Agent ${agentId} is not ready (status: ${agent.status})`);
    }

    const startTime = Date.now();
    agent.status = 'busy';
    agent.currentTask = task;
    agent.lastActivity = new Date();

    console.log(chalk.yellow(`⚙️  Agent ${agentId} executing task: ${task.title}`));

    try {
      // Build task execution command
      const taskCommand = this.buildTaskCommand(task, agent);

      // Send task to Claude session
      await this.claudeSDK.sendToSession(agent.claudeSession!.id, taskCommand);

      // Monitor execution with progress updates
      const result = await this.monitorTaskExecution(agent, task, progressCallback);

      const executionTime = Date.now() - startTime;

      // Update agent status
      agent.status = 'ready';
      agent.currentTask = undefined;
      agent.lastActivity = new Date();

      const executionResult: AgentExecutionResult = {
        taskId: task.id,
        agentType: agent.agentType,
        success: true,
        output: result.output || 'Task completed successfully',
        files: result.files || [],
        executionTimeMs: executionTime
      };

      // Emit completion event
      const event: AgentExecutionEvent = {
        type: 'agent_completed',
        agentId,
        agentType: agent.agentType,
        taskId: task.id,
        message: `Task completed in ${executionTime}ms`,
        timestamp: new Date()
      };

      this.emit('agentEvent', event);
      progressCallback?.(event);

      console.log(chalk.green(`✅ Agent ${agentId} completed task in ${executionTime}ms`));
      return executionResult;

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      agent.status = 'error';
      agent.lastActivity = new Date();

      const executionResult: AgentExecutionResult = {
        taskId: task.id,
        agentType: agent.agentType,
        success: false,
        error: error.message,
        output: error.output || '',
        files: [],
        executionTimeMs: executionTime
      };

      // Emit failure event
      const event: AgentExecutionEvent = {
        type: 'agent_failed',
        agentId,
        agentType: agent.agentType,
        taskId: task.id,
        message: `Task failed: ${error.message}`,
        timestamp: new Date()
      };

      this.emit('agentEvent', event);
      progressCallback?.(event);

      console.error(chalk.red(`❌ Agent ${agentId} failed task:`, error.message));
      return executionResult;
    }
  }

  /**
   * Pause agent execution
   */
  async pauseAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (agent.status === 'busy') {
      agent.status = 'paused';
      
      // Pause tmux session if enabled
      if (this.config.enableTmuxIsolation && agent.tmuxSession) {
        await this.runCommand(`tmux suspend-session -t ${agent.tmuxSession}`);
      }

      const event: AgentExecutionEvent = {
        type: 'agent_paused',
        agentId,
        agentType: agent.agentType,
        message: 'Agent execution paused',
        timestamp: new Date()
      };

      this.emit('agentEvent', event);
      console.log(chalk.yellow(`⏸️  Agent ${agentId} paused`));
    }
  }

  /**
   * Resume agent execution
   */
  async resumeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (agent.status === 'paused') {
      agent.status = 'busy';
      agent.lastActivity = new Date();

      // Resume tmux session if enabled
      if (this.config.enableTmuxIsolation && agent.tmuxSession) {
        await this.runCommand(`tmux resume-session -t ${agent.tmuxSession}`);
      }

      console.log(chalk.green(`▶️  Agent ${agentId} resumed`));
    }
  }

  /**
   * Terminate an agent and cleanup its environment
   */
  async terminateAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return; // Agent doesn't exist, nothing to cleanup
    }

    console.log(chalk.gray(`🧹 Terminating agent ${agentId}...`));

    try {
      // Destroy Claude session
      if (agent.claudeSession) {
        await this.claudeSDK.destroySession(agent.claudeSession.id);
      }

      // Kill Claude process if running
      if (agent.claudeProcess && !agent.claudeProcess.killed) {
        agent.claudeProcess.kill('SIGTERM');
      }

      // Cleanup tmux session
      if (this.config.enableTmuxIsolation && agent.tmuxSession) {
        await this.runCommand(`tmux kill-session -t ${agent.tmuxSession}`);
      }

      // Cleanup git worktree
      if (this.config.enableGitWorktrees && agent.worktreePath) {
        await this.cleanupWorktree(agent);
      }

      // Remove from agents map
      this.agents.delete(agentId);

      console.log(chalk.gray(`✅ Agent ${agentId} terminated and cleaned up`));

    } catch (error: any) {
      console.error(chalk.red(`⚠️  Error terminating agent ${agentId}:`), error.message);
    }
  }

  /**
   * Get status of all agents
   */
  getAgentsStatus(): AgentWorktree[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get specific agent status
   */
  getAgentStatus(agentId: string): AgentWorktree | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Shutdown all agents and cleanup
   */
  async shutdown(): Promise<void> {
    console.log(chalk.cyan('🔄 Shutting down Multi-Agent Manager...'));

    const agentIds = Array.from(this.agents.keys());
    const terminatePromises = agentIds.map(agentId => 
      this.terminateAgent(agentId).catch(error => 
        console.warn(chalk.yellow(`⚠️  Error terminating agent ${agentId}:`), error.message)
      )
    );

    await Promise.all(terminatePromises);

    // Shutdown Claude SDK
    await this.claudeSDK.shutdown();

    console.log(chalk.green('✅ Multi-Agent Manager shutdown complete'));
  }

  // ===============================================
  // PRIVATE IMPLEMENTATION METHODS
  // ===============================================

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    const dirs = [
      this.config.worktreeBaseDir,
      path.join(this.config.worktreeBaseDir, 'logs'),
      path.join(this.config.worktreeBaseDir, 'temp')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Validate required tools are available
   */
  private async validateEnvironment(): Promise<void> {
    const requiredTools = [];

    if (this.config.enableGitWorktrees) {
      requiredTools.push({ name: 'git', command: 'git --version' });
    }

    if (this.config.enableTmuxIsolation) {
      requiredTools.push({ name: 'tmux', command: 'tmux -V' });
    }

    for (const tool of requiredTools) {
      try {
        await this.runCommand(tool.command);
      } catch (error) {
        throw new Error(`Required tool '${tool.name}' is not available`);
      }
    }
  }

  /**
   * Initialize Claude SDK
   */
  private async initializeClaudeSDK(): Promise<void> {
    // SDK is already initialized in constructor
    const healthCheck = await this.claudeSDK.healthCheck();
    if (!healthCheck.available) {
      throw new Error('Claude CLI not available. Please install Claude CLI first.');
    }

    console.log(chalk.green(`✅ Claude CLI available: ${healthCheck.version}`));
  }

  /**
   * Create isolated git worktree for agent
   */
  private async createAgentWorktree(agentId: string, agentType: string): Promise<AgentWorktree> {
    const worktreePath = path.join(this.config.worktreeBaseDir, agentId);
    const gitBranch = `agent/${agentId}`;
    const tmuxSession = `${this.config.tmuxSessionPrefix}-${agentId}`;

    const worktree: AgentWorktree = {
      agentId,
      agentType,
      worktreePath,
      tmuxSession,
      gitBranch,
      status: 'initializing',
      createdAt: new Date(),
      lastActivity: new Date()
    };

    if (this.config.enableGitWorktrees) {
      try {
        // Create new branch from current branch
        await this.runCommand(`git checkout -b ${gitBranch}`, this.workspaceRoot);

        // Create worktree
        await this.runCommand(
          `git worktree add ${worktreePath} ${gitBranch}`,
          this.workspaceRoot
        );

        console.log(chalk.gray(`📁 Created worktree: ${worktreePath}`));

      } catch (error: any) {
        console.warn(chalk.yellow(`⚠️  Git worktree creation failed: ${error.message}`));
        // Fallback to simple directory copy
        await this.createDirectoryCopy(worktreePath);
      }
    } else {
      await this.createDirectoryCopy(worktreePath);
    }

    return worktree;
  }

  /**
   * Create directory copy as fallback
   */
  private async createDirectoryCopy(targetPath: string): Promise<void> {
    await fs.mkdir(targetPath, { recursive: true });
    
    // Copy essential files for agent operation
    const essentialFiles = [
      'package.json',
      'tsconfig.json',
      '.env.example'
    ];

    for (const file of essentialFiles) {
      const sourcePath = path.join(this.workspaceRoot, file);
      const targetFilePath = path.join(targetPath, file);
      
      try {
        await fs.copyFile(sourcePath, targetFilePath);
      } catch (error) {
        // File might not exist, continue
      }
    }

    console.log(chalk.gray(`📂 Created directory copy: ${targetPath}`));
  }

  /**
   * Create tmux session for agent
   */
  private async createTmuxSession(worktree: AgentWorktree): Promise<void> {
    try {
      // Create new tmux session
      await this.runCommand(
        `tmux new-session -d -s ${worktree.tmuxSession} -c ${worktree.worktreePath}`
      );

      console.log(chalk.gray(`🖥️  Created tmux session: ${worktree.tmuxSession}`));

    } catch (error: any) {
      console.warn(chalk.yellow(`⚠️  Tmux session creation failed: ${error.message}`));
      // Continue without tmux isolation
    }
  }

  /**
   * Build task execution command
   */
  private buildTaskCommand(task: AgentTask, agent: AgentWorktree): string {
    const contextInfo = {
      taskId: task.id,
      agentType: agent.agentType,
      workspacePath: agent.worktreePath,
      ...task.context
    };

    return `
You are executing a task in an isolated environment:

Task: ${task.title}
Description: ${task.description}
Priority: ${task.priority}
Estimated Time: ${task.estimatedTimeMinutes} minutes

Working Directory: ${agent.worktreePath}
Agent Type: ${agent.agentType}

Context:
${JSON.stringify(contextInfo, null, 2)}

Please complete this task step by step, providing regular progress updates. 
Use the working directory for any file operations. Report completion with a summary of generated files.
`;
  }

  /**
   * Monitor task execution with progress updates
   */
  private async monitorTaskExecution(
    agent: AgentWorktree,
    task: AgentTask,
    progressCallback?: (event: AgentExecutionEvent) => void
  ): Promise<{ output: string; files: string[] }> {
    return new Promise((resolve, reject) => {
      let output = '';
      const files: string[] = [];
      let lastProgress = 0;

      // Set timeout for task execution
      const timeout = setTimeout(() => {
        reject(new Error(`Task execution timeout (${task.estimatedTimeMinutes} minutes)`));
      }, task.estimatedTimeMinutes * 60 * 1000);

      // Listen for Claude SDK events
      const handleOutput = (response: ClaudeResponse) => {
        if (response.sessionId === agent.claudeSession!.id) {
          output += response.output;

          // Simulate progress tracking (in real implementation, parse Claude output)
          const progress = Math.min(lastProgress + Math.random() * 20, 95);
          if (progress > lastProgress + 10) {
            lastProgress = progress;

            const event: AgentExecutionEvent = {
              type: 'agent_progress',
              agentId: agent.agentId,
              agentType: agent.agentType,
              taskId: task.id,
              message: `Progress: ${Math.round(progress)}%`,
              progress,
              output: response.output,
              timestamp: new Date()
            };

            this.emit('agentEvent', event);
            progressCallback?.(event);
          }

          // Check if task is completed
          if (response.completed) {
            clearTimeout(timeout);
            resolve({ output, files });
          }
        }
      };

      const handleError = (response: ClaudeResponse) => {
        if (response.sessionId === agent.claudeSession!.id) {
          clearTimeout(timeout);
          reject(new Error(response.error || 'Unknown execution error'));
        }
      };

      // Attach event listeners
      this.claudeSDK.on('output', handleOutput);
      this.claudeSDK.on('error', handleError);

      // Cleanup listeners when done
      const cleanup = () => {
        this.claudeSDK.off('output', handleOutput);
        this.claudeSDK.off('error', handleError);
      };

      // Ensure cleanup on both resolve and reject
      const originalResolve = resolve;
      const originalReject = reject;
      
      resolve = (value: any) => {
        cleanup();
        originalResolve(value);
      };

      reject = (reason: any) => {
        cleanup();
        originalReject(reason);
      };
    });
  }

  /**
   * Cleanup agent worktree
   */
  private async cleanupWorktree(agent: AgentWorktree): Promise<void> {
    try {
      if (this.config.enableGitWorktrees) {
        // Remove git worktree
        await this.runCommand(
          `git worktree remove ${agent.worktreePath} --force`,
          this.workspaceRoot
        );

        // Delete the branch
        await this.runCommand(
          `git branch -D ${agent.gitBranch}`,
          this.workspaceRoot
        );
      } else {
        // Remove directory
        await fs.rm(agent.worktreePath, { recursive: true, force: true });
      }

      console.log(chalk.gray(`🗑️  Cleaned up worktree: ${agent.worktreePath}`));

    } catch (error: any) {
      console.warn(chalk.yellow(`⚠️  Worktree cleanup failed: ${error.message}`));
    }
  }

  /**
   * Generate unique agent ID
   */
  private generateAgentId(agentType: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `${agentType}-${timestamp}-${random}`;
  }

  /**
   * Run shell command with optional working directory
   */
  private async runCommand(command: string, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', command], {
        cwd: cwd || process.cwd(),
        stdio: 'pipe'
      });

      let output = '';
      let error = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        error += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Command failed (${code}): ${error || output}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }
}

// Export singleton instance
export const claudeMultiAgentManager = new ClaudeMultiAgentManager();
