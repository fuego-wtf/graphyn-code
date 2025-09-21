/**
 * Base Claude Code Agent - Foundation for all specialized agents
 * Provides real Claude CLI integration with process spawning and session management
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import type { Agent, Task } from '@graphyn/core';
import { bootstrapWorkspace } from '../utils/WorkspaceBootstrap.js';
import type { WorkspaceBootstrapOptions } from '../utils/WorkspaceBootstrap.js';

export interface AgentConfig {
  id: string;
  type: string;
  specialization: string;
  capabilities: string[];
  tools?: string[];
  workspaceDir?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface TaskExecution {
  taskId: string;
  agentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  output?: string;
  error?: string;
  metrics?: {
    tokensUsed?: number;
    duration?: number;
    toolsUsed?: string[];
  };
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ClaudeResponse {
  success: boolean;
  content?: string;
  error?: string;
  tokensUsed?: number;
  toolsUsed?: string[];
  duration?: number;
}

/**
 * Base Claude Code Agent class
 * Handles real Claude CLI integration with proper process management
 */
export class ClaudeCodeAgent extends EventEmitter {
  public readonly config: AgentConfig;
  private currentTask: TaskExecution | null = null;
  private claudeProcess: ChildProcess | null = null;
  private messageHistory: ClaudeMessage[] = [];
  private sessionId: string;
  private workspaceReady = false;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private executionTimer: NodeJS.Timeout | null = null;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.sessionId = `${config.id}-${Date.now()}`;
  }

  /**
   * Initialize the agent workspace and prepare for task execution
   */
  async initialize(options?: Partial<WorkspaceBootstrapOptions>): Promise<void> {
    try {
      if (this.config.workspaceDir) {
        await bootstrapWorkspace({
          agentId: this.config.id,
          agentType: this.config.type,
          sessionId: options?.sessionId || 'unknown-session',
          baseDir: path.dirname(this.config.workspaceDir),
          taskDescription: options?.taskDescription || 'Unspecified task',
          dependencies: options?.dependencies || [],
        });
      }

      this.workspaceReady = true;
      this.emit('initialized', { agentId: this.config.id, workspaceDir: this.config.workspaceDir });
      
    } catch (error) {
      const err = error as Error;
      this.emit('error', { 
        agentId: this.config.id, 
        error: `Initialization failed: ${err.message}` 
      });
      throw error;
    }
  }

  /**
   * Execute a task using Claude Code CLI
   */
  async executeTask(
    task: Task,
    bootstrapOptions: Partial<WorkspaceBootstrapOptions> = {},
  ): Promise<TaskExecution> {
    if (!this.workspaceReady) {
      await this.initialize({
        sessionId: bootstrapOptions.sessionId,
        taskDescription: bootstrapOptions.taskDescription || task.description,
        dependencies: bootstrapOptions.dependencies || task.dependencies,
      });
    }

    const execution: TaskExecution = {
      taskId: task.id,
      agentId: this.config.id,
      status: 'pending',
      startTime: new Date(),
    };

    this.currentTask = execution;
    this.emit('taskStarted', execution);

    try {
      execution.status = 'running';
      this.emit('taskProgress', { ...execution, status: 'running' });

      const prompt = this.buildTaskPrompt(task);
      const response = await this.invokeClaude(prompt, task.config?.tools || this.config.tools || []);

      if (response.success) {
        execution.status = 'completed';
        execution.output = response.content;
        execution.metrics = {
          tokensUsed: response.tokensUsed,
          duration: response.duration,
          toolsUsed: response.toolsUsed,
        };
      } else {
        execution.status = 'failed';
        execution.error = response.error;
        this.emit('error', {
          agentId: this.config.id,
          taskId: task.id,
          error: response.error,
        });
      }
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      this.emit('error', { agentId: this.config.id, taskId: task.id, error: execution.error });
    } finally {
      execution.endTime = new Date();
      this.currentTask = null;
      this.emit('taskCompleted', execution);
    }

    return execution;
  }

  /**
   * Execute streaming task with real-time output
   */
  async *executeTaskStream(task: Task): AsyncGenerator<{type: 'progress' | 'output' | 'error' | 'completed', data: any}> {
    if (!this.workspaceReady) {
      await this.initialize();
    }

    const execution: TaskExecution = {
      taskId: task.id,
      agentId: this.config.id,
      status: 'running',
      startTime: new Date()
    };

    this.currentTask = execution;
    yield { type: 'progress', data: { status: 'started', agentId: this.config.id } };

    try {
      const prompt = this.buildTaskPrompt(task);
      
      // Use streaming Claude CLI execution
      for await (const chunk of this.executeStreamingClaudeCLI(prompt, task.config?.tools || this.config.tools)) {
        yield { type: 'output', data: chunk };
      }

      execution.status = 'completed';
      execution.endTime = new Date();
      yield { type: 'completed', data: execution };

    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      execution.endTime = new Date();
      yield { type: 'error', data: execution };
    } finally {
      this.currentTask = null;
    }
  }

  /**
   * Execute prompt with Claude CLI using single-shot mode
   */
  private async invokeClaude(prompt: string, tools: string[]): Promise<ClaudeResponse> {
    const process = spawn(this.getClaudeBinary(), this.buildClaudeArgs(prompt, tools, 'json'), {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: this.buildProcessEnv(),
    });

    this.claudeProcess = process;
    this.emit('process', {
      type: 'spawn',
      agentId: this.config.id,
      pid: process.pid,
      format: 'json',
    });

    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    process.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      this.emit('log', { level: 'debug', agentId: this.config.id, message: text });
    });

    process.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      this.emit('log', { level: 'debug', agentId: this.config.id, message: text });
    });

    return await new Promise<ClaudeResponse>((resolve) => {
      const finalize = (response: ClaudeResponse) => {
        this.clearExecutionTimeout();
        this.claudeProcess = null;
        resolve(response);
      };

      process.on('error', (error) => {
        finalize({
          success: false,
          error: `Failed to spawn Claude CLI: ${error.message}`,
          duration: Date.now() - startTime,
        });
      });

      process.on('close', (code) => {
        const duration = Date.now() - startTime;
        this.emit('process', {
          type: 'exit',
          agentId: this.config.id,
          code,
        });

        if (code === 0) {
          finalize(this.parseClaudeJson(stdout, duration));
        } else {
          finalize({
            success: false,
            error: stderr || `Claude CLI exited with code ${code}`,
            duration,
          });
        }
      });

      this.setExecutionTimeout(() => {
        process.kill('SIGTERM');
        finalize({
          success: false,
          error: `Claude CLI timed out after ${this.getExecutionTimeout()}ms`,
          duration: Date.now() - startTime,
        });
      });
    });
  }

  /**
   * Execute streaming Claude CLI with real-time output
   */
  private async *executeStreamingClaudeCLI(
    prompt: string,
    tools: string[] = [],
  ): AsyncGenerator<string> {
    const claudeProcess = spawn(
      this.getClaudeBinary(),
      this.buildClaudeArgs(prompt, tools, 'stream-json'),
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: this.buildProcessEnv(),
      },
    );

    this.claudeProcess = claudeProcess;
    this.emit('process', {
      type: 'spawn',
      agentId: this.config.id,
      pid: claudeProcess.pid,
      format: 'stream-json',
    });

    let buffer = '';

    const closePromise = new Promise<void>((resolve, reject) => {
      claudeProcess.on('close', (code) => {
        this.clearExecutionTimeout();
        this.emit('process', {
          type: 'exit',
          agentId: this.config.id,
          code,
        });
        resolve();
      });

      claudeProcess.on('error', (error) => {
        this.clearExecutionTimeout();
        reject(error);
      });
    });

    claudeProcess.stderr?.on('data', (chunk) => {
      this.emit('log', { level: 'debug', agentId: this.config.id, message: chunk.toString() });
    });

    this.setExecutionTimeout(() => {
      claudeProcess.kill('SIGTERM');
      this.emit('process', {
        type: 'timeout',
        agentId: this.config.id,
      });
    });

    for await (const chunk of claudeProcess.stdout!) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.content) {
              this.emit('taskProgress', {
                taskId: this.currentTask?.taskId,
                agentId: this.config.id,
                status: 'running',
                output: data.content,
              });
              yield data.content;
            }
          } catch {
            // ignore malformed segments
          }
        }
      }
    }

    await closePromise;
    this.claudeProcess = null;

    if (buffer.trim()) {
      yield buffer;
    }
  }

  /**
   * Build a specialized prompt for the task
   * Protected to allow specialized agents to override
   */
  protected buildTaskPrompt(task: Task): string {
    const context = this.generateAgentContext();
    
    return `${context}

# Current Task
**Task ID:** ${task.id}
**Description:** ${task.description}
**Priority:** ${task.priority}
${task.workingDirectory ? `**Workspace:** ${task.workingDirectory}` : ''}

# Instructions
${task.description}

Please execute this task according to your specialization and capabilities. Use the appropriate tools and provide detailed output about your progress and results.`;
  }

  /**
   * Generate agent-specific context for Claude
   */
  private generateAgentContext(): string {
    return `# ${this.config.specialization} Agent Context

**Agent ID:** ${this.config.id}
**Type:** ${this.config.type}
**Specialization:** ${this.config.specialization}

## Capabilities
${this.config.capabilities.map(cap => `- ${cap}`).join('\n')}

## Available Tools
${(this.config.tools || []).map(tool => `- ${tool}`).join('\n')}

## Working Directory
${this.config.workspaceDir || process.cwd()}

## Session ID
${this.sessionId}

---

You are a specialized AI agent with expertise in ${this.config.specialization}. Use your capabilities and available tools to complete tasks efficiently and accurately. Always provide clear progress updates and detailed results.`;
  }

  /**
   * Get current agent status
   */
  getStatus(): Agent {
    return {
      id: this.config.id,
      type: this.config.type,
      status: this.currentTask ? 'busy' : 'idle',
      capabilities: this.config.capabilities,
      metadata: {
        specialization: this.config.specialization,
        workspaceDir: this.config.workspaceDir,
        sessionId: this.sessionId,
        workspaceReady: this.workspaceReady
      },
      lastActive: new Date(),
      currentTask: this.currentTask?.taskId
    };
  }

  /**
   * Clean up agent resources
   */
  async cleanup(): Promise<void> {
    if (this.claudeProcess && !this.claudeProcess.killed) {
      this.claudeProcess.kill();
    }
    this.clearExecutionTimeout();
    
    this.messageHistory = [];
    this.currentTask = null;
    this.workspaceReady = false;
    
    this.emit('cleanup', { agentId: this.config.id });
  }

  /**
   * Get current task execution
   */
  protected getCurrentTaskExecution(): TaskExecution | null {
    return this.currentTask;
  }

  /**
   * Check if agent is currently busy
   */
  isBusy(): boolean {
    return this.currentTask !== null;
  }

  /**
   * Get current task (for backward compatibility)
   */
  getCurrentTask(): TaskExecution | null {
    return this.currentTask;
  }

  /**
   * Check if agent can handle a specific task
   */
  canHandleTask(task: Task): boolean {
    // Check if agent type matches or is general
    if (this.config.type !== task.type && this.config.type !== 'general') {
      return false;
    }

    // Check if agent is available
    if (this.currentTask) {
      return false;
    }

    // Additional capability matching could be added here
    return true;
  }

  /**
   * Get Claude CLI binary path
   */
  private getClaudeBinary(): string {
    return process.env.CLAUDE_CLI_PATH || 'claude';
  }

  /**
   * Build Claude CLI arguments
   */
  private buildClaudeArgs(prompt: string, tools: string[], format: string): string[] {
    const args = [
      '-p', prompt,
      '--output-format', format,
      '--verbose'
    ];

    if (tools.length > 0) {
      args.push('--allowedTools', tools.join(','));
    }

    if (this.config.workspaceDir) {
      args.push('--cwd', this.config.workspaceDir);
    }

    return args;
  }

  /**
   * Build process environment
   */
  private buildProcessEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || ''
    };
  }

  /**
   * Parse Claude JSON response
   */
  private parseClaudeJson(stdout: string, duration: number): ClaudeResponse {
    try {
      const parsed = JSON.parse(stdout);
      return {
        success: true,
        content: parsed.content || stdout,
        tokensUsed: parsed.tokensUsed || 0,
        toolsUsed: parsed.toolsUsed || [],
        duration
      };
    } catch {
      return {
        success: true,
        content: stdout,
        duration
      };
    }
  }

  /**
   * Set execution timeout
   */
  private setExecutionTimeout(callback: () => void): void {
    this.executionTimer = setTimeout(callback, this.config.timeout || 300000);
  }

  /**
   * Clear execution timeout
   */
  private clearExecutionTimeout(): void {
    if (this.executionTimer) {
      clearTimeout(this.executionTimer);
      this.executionTimer = null;
    }
  }

  /**
   * Get execution timeout value
   */
  private getExecutionTimeout(): number {
    return this.config.timeout || 300000;
  }
}
