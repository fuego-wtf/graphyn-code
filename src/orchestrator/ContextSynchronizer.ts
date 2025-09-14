/**
 * Context Synchronizer for Multi-Agent Orchestration
 * 
 * Manages shared context across Claude Code sessions through file-based
 * communication, progress tracking, and execution plan management.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { spawn, exec } from 'child_process';
import { AgentType, TaskExecution, ExecutionPlan, AgentExecutionContext } from './types';

/**
 * Context files managed by the synchronizer
 */
export interface ContextFiles {
  readonly planPath: string;
  readonly contextPath: string; 
  readonly progressPath: string;
  readonly sharedPath: string;
}

/**
 * Progress update for multi-agent coordination
 */
export interface ProgressUpdate {
  readonly taskId: string;
  readonly agentType: AgentType;
  readonly status: 'started' | 'progress' | 'completed' | 'failed';
  readonly timestamp: Date;
  readonly message?: string;
  readonly data?: Record<string, unknown>;
}

/**
 * Shared context data between agents
 */
export interface SharedContext {
  readonly executionId: string;
  readonly startTime: Date;
  readonly tasks: readonly TaskExecution[];
  readonly activeAgents: readonly AgentType[];
  readonly completedTasks: readonly string[];
  readonly failedTasks: readonly string[];
  readonly repositoryContext: RepositoryContext;
  readonly progress: readonly ProgressUpdate[];
  readonly metadata: Record<string, unknown>;
}

/**
 * Repository context for agents
 */
export interface RepositoryContext {
  readonly rootPath: string;
  readonly packageJson?: Record<string, unknown>;
  readonly readme?: string;
  readonly structure: DirectoryStructure;
  readonly gitBranch?: string;
  readonly gitCommit?: string;
}

/**
 * Directory structure representation
 */
export interface DirectoryStructure {
  readonly name: string;
  readonly type: 'file' | 'directory';
  readonly path: string;
  children?: readonly DirectoryStructure[];
  readonly size?: number;
  readonly modified?: Date;
}

/**
 * Manages context synchronization across multi-agent sessions
 */
export class ContextSynchronizer {
  private readonly workingDir: string;
  private readonly contextFiles: ContextFiles;
  private sharedContext?: SharedContext;

  constructor(workingDir: string = process.cwd()) {
    this.workingDir = workingDir;
    this.contextFiles = {
      planPath: join(workingDir, '.graphyn', 'execution-plan.md'),
      contextPath: join(workingDir, '.graphyn', 'agent-context.md'), 
      progressPath: join(workingDir, '.graphyn', 'progress.json'),
      sharedPath: join(workingDir, '.graphyn', 'shared-context.json')
    };
  }

  /**
   * Initialize context synchronization for new execution
   */
  async initialize(executionId: string, tasks: readonly TaskExecution[]): Promise<void> {
    // Ensure .graphyn directory exists
    await this.ensureDirectoryExists(dirname(this.contextFiles.planPath));

    // Build repository context
    const repositoryContext = await this.buildRepositoryContext();

    // Create shared context
    this.sharedContext = {
      executionId,
      startTime: new Date(),
      tasks,
      activeAgents: [],
      completedTasks: [],
      failedTasks: [],
      repositoryContext,
      progress: [],
      metadata: {}
    };

    // Write initial context files
    await this.writeSharedContext();
    await this.createPlanMd(tasks);
    await this.updateContextMd(repositoryContext);
    await this.writeProgressJson([]);
  }

  /**
   * Create markdown execution plan for agents
   */
  async createPlanMd(tasks: readonly TaskExecution[]): Promise<void> {
    const planContent = this.generateExecutionPlan(tasks);
    await fs.writeFile(this.contextFiles.planPath, planContent, 'utf8');
  }

  /**
   * Update repository context markdown for agents
   */
  async updateContextMd(repositoryContext: RepositoryContext): Promise<void> {
    const contextContent = this.generateContextMarkdown(repositoryContext);
    await fs.writeFile(this.contextFiles.contextPath, contextContent, 'utf8');
  }

  /**
   * Write progress JSON for real-time tracking
   */
  async writeProgressJson(progress: readonly ProgressUpdate[]): Promise<void> {
    const progressData = {
      lastUpdated: new Date().toISOString(),
      totalTasks: this.sharedContext?.tasks.length || 0,
      completedTasks: this.sharedContext?.completedTasks.length || 0,
      failedTasks: this.sharedContext?.failedTasks.length || 0,
      activeAgents: this.sharedContext?.activeAgents || [],
      progress: progress.map(p => ({
        ...p,
        timestamp: p.timestamp.toISOString()
      }))
    };

    await fs.writeFile(this.contextFiles.progressPath, JSON.stringify(progressData, null, 2), 'utf8');
  }

  /**
   * Add progress update and synchronize across agents
   */
  async addProgressUpdate(update: ProgressUpdate): Promise<void> {
    if (!this.sharedContext) {
      throw new Error('Context not initialized');
    }

    // Update shared context
    const updatedProgress = [...this.sharedContext.progress, update];
    
    // Update task status tracking
    const updatedContext = { ...this.sharedContext };
    
    if (update.status === 'started' && !updatedContext.activeAgents.includes(update.agentType)) {
      updatedContext.activeAgents = [...updatedContext.activeAgents, update.agentType];
    }
    
    if (update.status === 'completed' && !updatedContext.completedTasks.includes(update.taskId)) {
      updatedContext.completedTasks = [...updatedContext.completedTasks, update.taskId];
      updatedContext.activeAgents = updatedContext.activeAgents.filter(a => a !== update.agentType);
    }
    
    if (update.status === 'failed' && !updatedContext.failedTasks.includes(update.taskId)) {
      updatedContext.failedTasks = [...updatedContext.failedTasks, update.taskId];
      updatedContext.activeAgents = updatedContext.activeAgents.filter(a => a !== update.agentType);
    }

    updatedContext.progress = updatedProgress;
    this.sharedContext = updatedContext;

    // Write updates to files
    await Promise.all([
      this.writeProgressJson(updatedProgress),
      this.writeSharedContext()
    ]);
  }

  /**
   * Get current shared context
   */
  async getSharedContext(): Promise<SharedContext | undefined> {
    if (this.sharedContext) {
      return this.sharedContext;
    }

    try {
      const contextData = await fs.readFile(this.contextFiles.sharedPath, 'utf8');
      this.sharedContext = JSON.parse(contextData);
      
      // Convert date strings back to Date objects
      if (this.sharedContext) {
        this.sharedContext = {
          ...this.sharedContext,
          startTime: new Date(this.sharedContext.startTime),
          progress: this.sharedContext.progress.map(p => ({
            ...p,
            timestamp: new Date(p.timestamp)
          }))
        };
      }
      
      return this.sharedContext;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get agent-specific context with current state
   */
  async getAgentContext(agentType: AgentType): Promise<AgentExecutionContext> {
    const sharedContext = await this.getSharedContext();
    if (!sharedContext) {
      throw new Error('Shared context not available');
    }

    // Get tasks assigned to this agent
    const agentTasks = sharedContext.tasks.filter(task => task.agent === agentType);
    const completedTasks = agentTasks.filter(task => 
      sharedContext.completedTasks.includes(task.id)
    );
    const failedTasks = agentTasks.filter(task => 
      sharedContext.failedTasks.includes(task.id)
    );
    const pendingTasks = agentTasks.filter(task => 
      !sharedContext.completedTasks.includes(task.id) && 
      !sharedContext.failedTasks.includes(task.id)
    );

    return {
      agentType,
      executionId: sharedContext.executionId,
      assignedTasks: agentTasks,
      completedTasks,
      failedTasks,
      pendingTasks,
      otherAgents: sharedContext.activeAgents.filter(a => a !== agentType),
      repositoryContext: sharedContext.repositoryContext,
      progress: sharedContext.progress.filter(p => p.agentType === agentType),
      contextFiles: this.contextFiles
    };
  }

  /**
   * Cleanup context files
   */
  async cleanup(): Promise<void> {
    const filesToClean = [
      this.contextFiles.planPath,
      this.contextFiles.contextPath,
      this.contextFiles.progressPath,
      this.contextFiles.sharedPath
    ];

    await Promise.allSettled(
      filesToClean.map(file => fs.unlink(file).catch(() => {}))
    );
  }

  // Private methods

  private async buildRepositoryContext(): Promise<RepositoryContext> {
    const rootPath = this.workingDir;
    
    // Read package.json if it exists
    let packageJson: Record<string, unknown> | undefined;
    try {
      const packageContent = await fs.readFile(join(rootPath, 'package.json'), 'utf8');
      packageJson = JSON.parse(packageContent);
    } catch (error) {
      // package.json doesn't exist or is invalid
    }

    // Read README if it exists
    let readme: string | undefined;
    const readmeFiles = ['README.md', 'readme.md', 'README.txt', 'readme.txt'];
    for (const readmeFile of readmeFiles) {
      try {
        readme = await fs.readFile(join(rootPath, readmeFile), 'utf8');
        break;
      } catch (error) {
        // Try next README file
      }
    }

    // Build directory structure
    const structure = await this.buildDirectoryStructure(rootPath);

    // Get git information if available
    let gitBranch: string | undefined;
    let gitCommit: string | undefined;
    
    try {
      gitBranch = await this.execGitCommand('git rev-parse --abbrev-ref HEAD');
      gitCommit = await this.execGitCommand('git rev-parse HEAD');
    } catch (error) {
      // Git not available or not a git repository
    }

    return {
      rootPath,
      packageJson,
      readme,
      structure,
      gitBranch: gitBranch?.trim(),
      gitCommit: gitCommit?.trim()
    };
  }

  private async buildDirectoryStructure(dirPath: string, maxDepth: number = 3, currentDepth: number = 0): Promise<DirectoryStructure> {
    const stats = await fs.stat(dirPath);
    const name = dirname(dirPath) === dirPath ? dirPath : dirPath.split('/').pop() || '';

    if (stats.isFile()) {
      return {
        name,
        type: 'file',
        path: dirPath,
        size: stats.size,
        modified: stats.mtime
      };
    }

    const structure: DirectoryStructure = {
      name,
      type: 'directory',
      path: dirPath,
      modified: stats.mtime
    };

    // Limit recursion depth and skip certain directories
    if (currentDepth >= maxDepth || this.shouldSkipDirectory(name)) {
      return structure;
    }

    try {
      const entries = await fs.readdir(dirPath);
      const children = await Promise.all(
        entries
          .filter(entry => !this.shouldSkipDirectory(entry))
          .slice(0, 20) // Limit entries to prevent huge structures
          .map(async entry => {
            try {
              return await this.buildDirectoryStructure(
                join(dirPath, entry), 
                maxDepth, 
                currentDepth + 1
              );
            } catch (error) {
              // Skip entries that can't be read
              return null;
            }
          })
      );

      structure.children = children.filter((child): child is DirectoryStructure => child !== null);
    } catch (error) {
      // Directory can't be read
    }

    return structure;
  }

  private shouldSkipDirectory(name: string): boolean {
    const skipPatterns = [
      'node_modules',
      '.git',
      '.DS_Store',
      'dist',
      'build',
      'coverage',
      '.nyc_output',
      '.cache',
      'tmp',
      'temp'
    ];

    return skipPatterns.some(pattern => name.includes(pattern));
  }

  private generateExecutionPlan(tasks: readonly TaskExecution[]): string {
    let content = `# Execution Plan\n\n`;
    content += `Generated: ${new Date().toISOString()}\n`;
    content += `Total Tasks: ${tasks.length}\n\n`;

    // Group tasks by agent
    const tasksByAgent = new Map<AgentType, TaskExecution[]>();
    for (const task of tasks) {
      const agent = task.agent as AgentType;
      if (agent && !tasksByAgent.has(agent)) {
        tasksByAgent.set(agent, []);
      }
      if (agent) {
        tasksByAgent.get(agent)!.push(task);
      }
    }

    content += `## Tasks by Agent\n\n`;
    
    tasksByAgent.forEach((agentTasks, agentType) => {
      content += `### ${agentType}\n\n`;
      
      for (const task of agentTasks) {
        content += `- **${task.id}**: ${task.description}\n`;
        if ((task.dependencies || []).length > 0) {
          content += `  - Dependencies: ${(task.dependencies || []).join(', ')}\n`;
        }
        content += `  - Priority: ${task.priority}\n`;
        if (task.estimatedDuration) {
          content += `  - Estimated Duration: ${task.estimatedDuration}s\n`;
        }
        content += '\n';
      }
    });

    // Task dependencies graph
    content += `## Dependencies\n\n`;
    content += '```mermaid\n';
    content += 'graph TD;\n';
    
    for (const task of tasks) {
      for (const depId of (task.dependencies || [])) {
        content += `  ${depId} --> ${task.id};\n`;
      }
    }
    
    content += '```\n\n';

    return content;
  }

  private generateContextMarkdown(context: RepositoryContext): string {
    let content = `# Repository Context\n\n`;
    content += `Root Path: \`${context.rootPath}\`\n`;
    
    if (context.gitBranch) {
      content += `Git Branch: \`${context.gitBranch}\`\n`;
    }
    
    if (context.gitCommit) {
      content += `Git Commit: \`${context.gitCommit?.substring(0, 8)}\`\n`;
    }
    
    content += '\n';

    // Package.json information
    if (context.packageJson) {
      content += `## Package Information\n\n`;
      content += `- **Name**: ${context.packageJson.name || 'Unknown'}\n`;
      content += `- **Version**: ${context.packageJson.version || 'Unknown'}\n`;
      
      if (context.packageJson.description) {
        content += `- **Description**: ${context.packageJson.description}\n`;
      }
      
      if (context.packageJson.scripts) {
        const scripts = context.packageJson.scripts as Record<string, string>;
        content += `- **Scripts**: ${Object.keys(scripts).join(', ')}\n`;
      }
      
      content += '\n';
    }

    // README content (truncated)
    if (context.readme) {
      content += `## README\n\n`;
      const readmePreview = context.readme.length > 500 
        ? context.readme.substring(0, 500) + '...' 
        : context.readme;
      content += readmePreview + '\n\n';
    }

    // Directory structure
    content += `## Directory Structure\n\n`;
    content += '```\n';
    content += this.renderDirectoryStructure(context.structure, 0);
    content += '```\n\n';

    return content;
  }

  private renderDirectoryStructure(structure: DirectoryStructure, indent: number): string {
    const prefix = '  '.repeat(indent);
    let result = `${prefix}${structure.name}\n`;
    
    if (structure.children) {
      for (const child of structure.children) {
        result += this.renderDirectoryStructure(child, indent + 1);
      }
    }
    
    return result;
  }

  private async writeSharedContext(): Promise<void> {
    if (!this.sharedContext) {
      return;
    }

    const contextData = {
      ...this.sharedContext,
      startTime: this.sharedContext.startTime.toISOString(),
      progress: this.sharedContext.progress.map(p => ({
        ...p,
        timestamp: p.timestamp.toISOString()
      }))
    };

    await fs.writeFile(this.contextFiles.sharedPath, JSON.stringify(contextData, null, 2), 'utf8');
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private async execGitCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, { cwd: this.workingDir }, (error: any, stdout: string, stderr: string) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }
}