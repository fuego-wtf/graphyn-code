/**
 * Local Orchestrator - TO-BE Architecture Implementation
 * 
 * Bridges the gap between simple CLI and sophisticated orchestration
 * Works locally without requiring backend API
 */
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { debug } from '../utils/debug.js';
import { findClaude } from '../utils/claude-detector.js';
import { RepositoryAnalyzer } from '../services/repository-analyzer.js';
import chalk from 'chalk';

export interface LocalTask {
  id: string;
  title: string;
  description: string;
  agent: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  prompt: string;
  dependencies: string[];
  result?: any;
  error?: string;
  estimated_time?: string;
}

export interface OrchestratorConfig {
  parallelism: number;
  maxRetries: number;
  defaultBranch: string;
  autoMerge: boolean;
}

export interface ExecutionContext {
  repository: string;
  query: string;
  framework?: string;
  language?: string;
  mode: 'sequential' | 'parallel' | 'adaptive';
}

export interface OrchestratorResult {
  taskId: string;
  status: 'running' | 'completed' | 'failed';
  tasks: LocalTask[];
  progress: {
    completed: number;
    total: number;
    currentStage: string;
  };
  results: Record<string, any>;
  errors: string[];
}

export class LocalOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private activeTasks = new Map<string, LocalTask[]>();
  private taskResults = new Map<string, any>();
  private runningProcesses = new Map<string, ChildProcess>();

  constructor(config: Partial<OrchestratorConfig> = {}) {
    super();
    
    this.config = {
      parallelism: 3,
      maxRetries: 3,
      defaultBranch: 'main',
      autoMerge: false,
      ...config
    };
  }

  /**
   * Main orchestration entry point - TO-BE interface
   */
  async orchestrate(context: ExecutionContext): Promise<string> {
    const taskId = this.generateTaskId();
    debug('Starting local orchestration:', taskId, context);

    try {
      // Ensure state directories exist
      await this.ensureStateDirs(context.repository);

      // 1. Analyze repository context
      const repoAnalyzer = new RepositoryAnalyzer();
      const repoContext = await repoAnalyzer.analyze(context.repository);
      
      // 2. Generate task decomposition
      const tasks = await this.decomposeQuery(context, repoContext);
      this.activeTasks.set(taskId, tasks);

      // Persist initial task state
      await this.saveTasksState(context.repository, taskId, tasks);
      await this.updateCoordination(context.repository, {
        sessionId: taskId,
        status: 'planning',
        activeAgents: Array.from(new Set(tasks.map(t => t.agent)))
      });

      // 3. Execute tasks based on mode
      await this.executeTasks(taskId, tasks, context);

      this.emit('orchestration_started', { taskId, tasks, context });
      return taskId;

    } catch (error: any) {
      debug('Orchestration error:', taskId, error);
      this.emit('orchestration_error', { taskId, error });
      throw error;
    }
  }

  /**
   * Task decomposition using local Claude
   */
  private async decomposeQuery(context: ExecutionContext, repoContext: any): Promise<LocalTask[]> {
    const claudeResult = await findClaude();
    if (!claudeResult.found || !claudeResult.path) {
      throw new Error('Claude Code not found - required for orchestration');
    }

    const decompositionPrompt = this.buildDecompositionPrompt(context, repoContext);
    
    return new Promise((resolve, reject) => {
      const claudePath = claudeResult.path as string;
      const claude: any = spawn(claudePath, ['-p', decompositionPrompt], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false
      });

      let output = '';
      let errorOutput = '';

      claude.stdout?.on('data', (data: any) => {
        output += data.toString();
      });

      claude.stderr?.on('data', (data: any) => {
        errorOutput += data.toString();
      });

      claude.on('close', (code: any) => {
        if (code === 0) {
          try {
            const tasks = this.parseTaskOutput(output);
            resolve(tasks);
          } catch (error: any) {
            reject(new Error(`Failed to parse tasks: ${error.message}`));
          }
        } else {
          reject(new Error(`Claude failed: ${errorOutput}`));
        }
      });

      claude.on('error', (err: any) => reject(err));
    });
  }

  /**
   * Execute tasks with dependency resolution and parallelism
   */
  private async executeTasks(taskId: string, tasks: LocalTask[], context: ExecutionContext): Promise<void> {
    const completedTasks = new Set<string>();
    const failedTasks = new Set<string>();
    const inProgressTasks = new Set<string>();

    while (completedTasks.size + failedTasks.size < tasks.length) {
      // Find tasks ready to execute
      const readyTasks = tasks.filter(task => 
        task.status === 'pending' && 
        !inProgressTasks.has(task.id) &&
        task.dependencies.every(dep => completedTasks.has(dep))
      );

      // Execute tasks based on mode
      if (context.mode === 'sequential') {
        // Sequential: one task at a time
        if (readyTasks.length > 0 && inProgressTasks.size === 0) {
          const task = readyTasks[0];
          inProgressTasks.add(task.id);
          try {
            await this.executeTask(taskId, task, context);
            task.status = 'completed';
            this.emit('task_completed', { taskId, task });
            completedTasks.add(task.id);
            await this.saveTasksState(context.repository, taskId, tasks);
          } catch (error: any) {
            task.status = 'failed';
            task.error = error.message;
            this.emit('task_failed', { taskId, task, error: error.message });
            failedTasks.add(task.id);
            await this.saveTasksState(context.repository, taskId, tasks);
          } finally {
            inProgressTasks.delete(task.id);
          }
        }
      } else {
        // Parallel/Adaptive: respect parallelism limit
        const slotsAvailable = this.config.parallelism - inProgressTasks.size;
        const tasksToStart = readyTasks.slice(0, slotsAvailable);
        
        for (const task of tasksToStart) {
          inProgressTasks.add(task.id);
          this.executeTask(taskId, task, context)
            .then(async () => {
              completedTasks.add(task.id);
              inProgressTasks.delete(task.id);
              task.status = 'completed';
              this.emit('task_completed', { taskId, task });
              await this.saveTasksState(context.repository, taskId, tasks);
            })
            .catch(async (error) => {
              failedTasks.add(task.id);
              inProgressTasks.delete(task.id);
              task.status = 'failed';
              task.error = (error as any).message;
              this.emit('task_failed', { taskId, task, error: (error as any).message });
              await this.saveTasksState(context.repository, taskId, tasks);
            });
        }
      }

      // Wait before next iteration
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Update coordination on completion
    await this.updateCoordination(context.repository, {
      status: failedTasks.size > 0 ? 'failed' : 'completed'
    });
  }

  /**
   * Execute individual task with Claude
   */
  private async executeTask(taskId: string, task: LocalTask, context: ExecutionContext): Promise<void> {
    const claudeResult = await findClaude();
    if (!claudeResult.found || !claudeResult.path) {
      throw new Error('Claude Code not found');
    }

    task.status = 'in_progress';
    this.emit('task_started', { taskId, task });

    return new Promise<void>((resolve, reject) => {
      const claudePath = claudeResult.path as string;
      const claude: any = spawn(claudePath, ['-p', task.prompt], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        cwd: context.repository
      });

      this.runningProcesses.set(task.id, claude);

      let output = '';
      let errorOutput = '';

      claude.stdout?.on('data', (data: any) => {
        const chunk = data.toString();
        output += chunk;
        this.emit('task_output', { sessionId: taskId, taskId: task.id, chunk });
        this.appendAgentLog(context.repository, taskId, task.id, chunk).catch(() => {});
      });

      claude.stderr?.on('data', (data: any) => {
        errorOutput += data.toString();
      });

      claude.on('close', (code: any) => {
        this.runningProcesses.delete(task.id);
        
        if (code === 0) {
          task.result = output;
          resolve();
        } else {
          reject(new Error(`Task failed: ${errorOutput}`));
        }
      });

      claude.on('error', (error: any) => {
        this.runningProcesses.delete(task.id);
        reject(error);
      });
    });
  }

  /**
   * Build decomposition prompt for task generation
   */
  private buildDecompositionPrompt(context: ExecutionContext, repoContext: any): string {
    return `# Task Decomposition Request

**Query**: ${context.query}
**Repository**: ${path.basename(context.repository)}
**Language**: ${repoContext.language || 'Unknown'}
**Framework**: ${repoContext.framework || 'None detected'}
**Mode**: ${context.mode}

## Repository Context
${JSON.stringify(repoContext, null, 2)}

## Instructions
Break down the query into 3-7 actionable tasks for specialized agents. Create tasks that can be executed ${context.mode}ly.

Each task should be specific, measurable, and include:
- Clear title and description
- Assigned agent type (architect, backend, frontend, test-writer, design, cli)
- Executable prompt for Claude
- Dependencies (task IDs)
- Estimated time

**Return JSON format:**
\`\`\`json
[
  {
    "id": "task-001",
    "title": "Brief task title",
    "description": "Detailed description",
    "agent": "backend",
    "prompt": "Specific Claude prompt with context",
    "dependencies": [],
    "estimated_time": "30 minutes"
  }
]
\`\`\`

Focus on practical, implementable tasks that move toward completing: "${context.query}"`;
  }

  /**
   * Parse Claude output for task list
   */
  private parseTaskOutput(output: string): LocalTask[] {
    // Extract JSON from Claude's response
    const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/) || output.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude output');
    }

    const jsonString = jsonMatch[1] || jsonMatch[0];
    const rawTasks = JSON.parse(jsonString);

    if (!Array.isArray(rawTasks)) {
      throw new Error('Expected array of tasks');
    }

    return rawTasks.map(task => ({
      id: task.id || `task-${Date.now()}`,
      title: task.title || 'Untitled Task',
      description: task.description || '',
      agent: task.agent || 'backend',
      status: 'pending' as const,
      prompt: task.prompt || task.description,
      dependencies: task.dependencies || [],
      estimated_time: task.estimated_time
    }));
  }

  /**
   * Get status of orchestration
   */
  getStatus(taskId: string): OrchestratorResult | null {
    const tasks = this.activeTasks.get(taskId);
    if (!tasks) return null;

    const completed = tasks.filter(t => t.status === 'completed');
    const failed = tasks.filter(t => t.status === 'failed');
    const errors = failed.map(t => t.error).filter(Boolean) as string[];

    return {
      taskId,
      status: this.determineOverallStatus(tasks),
      tasks,
      progress: {
        completed: completed.length,
        total: tasks.length,
        currentStage: this.getCurrentStage(tasks)
      },
      results: this.taskResults.get(taskId) || {},
      errors
    };
  }

  /**
   * Cancel running orchestration
   */
  async cancel(taskId: string): Promise<void> {
    const tasks = this.activeTasks.get(taskId);
    if (!tasks) return;

    // Kill running processes
    for (const task of tasks) {
      const process = this.runningProcesses.get(task.id);
      if (process) {
        process.kill('SIGTERM');
        this.runningProcesses.delete(task.id);
      }
      
      if (task.status === 'in_progress' || task.status === 'pending') {
        task.status = 'failed';
        task.error = 'Cancelled by user';
      }
    }

    this.activeTasks.delete(taskId);
    this.taskResults.delete(taskId);
    this.emit('orchestration_cancelled', { taskId });
  }

  private determineOverallStatus(tasks: LocalTask[]): 'running' | 'completed' | 'failed' {
    const hasRunning = tasks.some(t => t.status === 'in_progress' || t.status === 'pending');
    const hasFailed = tasks.some(t => t.status === 'failed');
    const allCompleted = tasks.every(t => t.status === 'completed');

    if (hasFailed) return 'failed';
    if (allCompleted) return 'completed';
    return 'running';
  }

  private getCurrentStage(tasks: LocalTask[]): string {
    const inProgress = tasks.find(t => t.status === 'in_progress');
    if (inProgress) return `Executing: ${inProgress.title}`;
    
    const pending = tasks.find(t => t.status === 'pending');
    if (pending) return `Pending: ${pending.title}`;
    
    return 'Complete';
  }

  private generateTaskId(): string {
    return `local_orch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Ensure state directories exist
   */
  private async ensureStateDirs(repoPath: string): Promise<void> {
    const stateDirs = [
      path.join(repoPath, 'state'),
      path.join(repoPath, 'state', 'agent_logs'),
      path.join(repoPath, 'memory'),
      path.join(repoPath, 'hooks')
    ];

    for (const dir of stateDirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        // Directory might already exist - that's OK
      }
    }
  }

  /**
   * Save tasks state to file system
   */
  private async saveTasksState(repoPath: string, taskId: string, tasks: LocalTask[]): Promise<void> {
    const tasksFile = path.join(repoPath, 'state', 'tasks.json');
    const taskData = {
      sessionId: taskId,
      tasks,
      updatedAt: new Date().toISOString()
    };
    
    try {
      await fs.writeFile(tasksFile, JSON.stringify(taskData, null, 2));
    } catch (error: any) {
      debug('Failed to save tasks state:', error.message);
    }
  }

  /**
   * Update coordination state
   */
  private async updateCoordination(repoPath: string, updates: any): Promise<void> {
    const coordFile = path.join(repoPath, 'state', 'coordination.json');
    
    try {
      let coordination = {
        activeAgents: [],
        sharedArtifacts: {},
        communicationLog: [],
        sessionId: '',
        startTime: new Date().toISOString(),
        status: 'ready'
      };

      try {
        const existing = await fs.readFile(coordFile, 'utf8');
        coordination = { ...coordination, ...JSON.parse(existing) };
      } catch {
        // File doesn't exist yet - use defaults
      }

      coordination = { ...coordination, ...updates };
      await fs.writeFile(coordFile, JSON.stringify(coordination, null, 2));
    } catch (error: any) {
      debug('Failed to update coordination:', error.message);
    }
  }

  /**
   * Append agent output to log file
   */
  private async appendAgentLog(repoPath: string, sessionId: string, taskId: string, content: string): Promise<void> {
    const logFile = path.join(repoPath, 'state', 'agent_logs', `${taskId}.log`);
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${content}\n`;
    
    try {
      await fs.appendFile(logFile, logEntry);
    } catch (error: any) {
      debug('Failed to append agent log:', error.message);
    }
  }
}
