import { TmuxLayoutManager } from './tmux-layout-manager.js';
import { ClaudeAgentLauncher } from '../services/claude-agent-launcher.js';
import type { Task } from '../services/claude-task-generator.js';
import type { AgentConfig } from '../types/agent.js';
import type { RepositoryContext } from '../services/claude-task-generator.js';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { join } from 'path';

const exec = promisify(execCallback);

export interface CockpitConfig {
  tasks: Task[];
  agents: AgentConfig[];
  repoContext: RepositoryContext;
  workDir: string;
  claudePath?: string;
}

export interface PaneInfo {
  paneId: string;
  paneIndex: number;
  agentName: string;
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export class TMUXCockpitOrchestrator extends TmuxLayoutManager {
  private agentLauncher: ClaudeAgentLauncher;
  private paneMap: Map<string, PaneInfo>;
  private isShuttingDown: boolean = false;

  constructor() {
    super(`graphyn-cockpit-${Date.now()}`);
    this.agentLauncher = new ClaudeAgentLauncher();
    this.paneMap = new Map();
    
    // Set up graceful shutdown handlers
    this.setupShutdownHandlers();
  }

  private setupShutdownHandlers(): void {
    const gracefulShutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      
      console.log(chalk.yellow(`\n⚠️  Received ${signal}, gracefully shutting down...`));
      
      try {
        await this.cleanup();
        console.log(chalk.green('✅ Graceful shutdown completed'));
        process.exit(0);
      } catch (error) {
        console.error(chalk.red('❌ Error during graceful shutdown:'), error);
        process.exit(1);
      }
    };

    // Handle various shutdown signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error(chalk.red('❌ Uncaught Exception:'), error);
      if (!this.isShuttingDown) {
        await gracefulShutdown('uncaughtException');
      }
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      console.error(chalk.red('❌ Unhandled Rejection at:'), promise, 'reason:', reason);
      if (!this.isShuttingDown) {
        await gracefulShutdown('unhandledRejection');
      }
    });
  }

  private async killSession(): Promise<void> {
    try {
      await exec(`tmux kill-session -t ${this.getSessionName()} 2>/dev/null || true`);
    } catch {
      // Ignore errors
    }
  }

  private async createSession(): Promise<void> {
    await exec(`tmux new-session -d -s ${this.getSessionName()} -n "🚀 Cockpit Monitor"`);
  }

  private async attachToSession(): Promise<void> {
    // Attach to the tmux session
    return new Promise((resolve, reject) => {
      const tmuxProcess = spawn('tmux', ['attach-session', '-t', this.getSessionName()], {
        stdio: 'inherit'
      });
      
      tmuxProcess.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`tmux exited with code ${code}`));
        }
      });
      
      tmuxProcess.on('error', (err) => {
        reject(err);
      });
    });
  }

  async launchCockpit(config: CockpitConfig): Promise<void> {
    const { tasks, agents, repoContext, workDir, claudePath } = config;
    
    try {
      console.log(chalk.blue('\n🚀 Launching Graphyn Cockpit...'));
      console.log(chalk.gray(`   Tasks: ${tasks.length}`));
      console.log(chalk.gray(`   Agents: ${agents.length}`));
      console.log(chalk.gray(`   Work Directory: ${workDir}`));
      
      // Kill any existing cockpit session
      await this.killSession();
      
      // Create new TMUX session
      await this.createSession();
      
      // Create the layout based on number of tasks
      await this.createCockpitLayout(tasks.length);
      
      // Launch the cockpit monitor in the main pane
      await this.launchCockpitMonitor(tasks, agents);
      
      // Group tasks by agent
      const tasksByAgent = this.groupTasksByAgentConfig(tasks, agents);
      
      // Validate that all tasks have matching agents
      const unassignedTasks = tasks.filter(task => 
        !agents.some(agent => agent.name.toLowerCase() === task.assigned_agent.toLowerCase())
      );
      
      if (unassignedTasks.length > 0) {
        console.warn(chalk.yellow(`⚠️  Found ${unassignedTasks.length} tasks without matching agents:`));
        unassignedTasks.forEach(task => {
          console.warn(chalk.yellow(`   - Task "${task.title}" assigned to "${task.assigned_agent}"`));
        });
      }
      
      // Launch Claude instances for each agent with their tasks
      let paneIndex = 1;
      const launchPromises: Promise<void>[] = [];
      
      for (const [agentId, agentTasks] of tasksByAgent) {
        const agent = agents.find(a => a.id === agentId);
        if (!agent) {
          console.warn(chalk.yellow(`⚠️  Agent with ID ${agentId} not found`));
          continue;
        }
        
        for (const task of agentTasks) {
          const launchPromise = this.launchAgentInPane(
            agent,
            task,
            paneIndex,
            { tasks, repoContext, workDir, claudePath }
          ).catch(error => {
            console.error(chalk.red(`❌ Failed to launch agent ${agent.name} for task ${task.title}:`), error);
            // Continue with other agents
          });
          
          launchPromises.push(launchPromise);
          paneIndex++;
        }
      }
      
      // Wait for all agents to be launched
      await Promise.allSettled(launchPromises);
      
      console.log(chalk.green(`✅ Cockpit launched with ${paneIndex - 1} agent panes`));
      
      // Attach to the TMUX session (this will block until the user detaches or exits)
      try {
        await this.attachToSession();
      } catch (error) {
        console.log(chalk.yellow('\n⚠️  Tmux session ended'));
      }
      
    } catch (error) {
      console.error(chalk.red('\n❌ Failed to launch cockpit:'), error);
      
      // Attempt cleanup if something went wrong
      try {
        await this.cleanup();
      } catch (cleanupError) {
        console.error(chalk.red('❌ Cleanup failed:'), cleanupError);
      }
      
      throw error;
    }
  }

  private async createCockpitLayout(taskCount: number): Promise<void> {
    // Create a layout with a larger monitor pane at the top
    // and agent panes below
    
    // First, create the monitor pane (takes up 30% of height)
    await exec(`tmux split-window -v -p 70 -t ${this.getSessionName()}:0`);
    
    // Create agent panes in a grid layout
    if (taskCount > 1) {
      // Calculate grid dimensions
      const cols = Math.ceil(Math.sqrt(taskCount));
      const rows = Math.ceil(taskCount / cols);
      
      // Create horizontal splits for rows
      for (let i = 1; i < rows; i++) {
        await exec(`tmux split-window -v -t ${this.getSessionName()}:0.1`);
      }
      
      // Create vertical splits for columns
      for (let row = 0; row < rows; row++) {
        const tasksInRow = Math.min(cols, taskCount - row * cols);
        for (let col = 1; col < tasksInRow; col++) {
          await exec(`tmux split-window -h -t ${this.getSessionName()}:0.${row + 1}`);
        }
      }
    }
    
    // Balance the panes
    await exec(`tmux select-layout -t ${this.getSessionName()}:0 tiled`);
    
    // Select the monitor pane
    await exec(`tmux select-pane -t ${this.getSessionName()}:0.0`);
  }

  private async launchCockpitMonitor(tasks: Task[], agents: AgentConfig[]): Promise<void> {
    // Get the path to the cockpit monitor script
    const monitorScript = join(process.cwd(), 'dist', 'ink', 'cockpit-monitor.js');
    
    // Write tasks and agents to temporary files to avoid shell escaping issues
    const fs = await import('fs/promises');
    const tasksFile = `/tmp/graphyn_tasks_${this.getSessionName()}.json`;
    const agentsFile = `/tmp/graphyn_agents_${this.getSessionName()}.json`;
    
    await fs.writeFile(tasksFile, JSON.stringify(tasks), 'utf-8');
    await fs.writeFile(agentsFile, JSON.stringify(agents), 'utf-8');
    
    // Create the monitor command using file paths
    const monitorCmd = `node "${monitorScript}" --tasks-file="${tasksFile}" --agents-file="${agentsFile}" --session="${this.getSessionName()}"`;
    
    // Send the command to the monitor pane
    await exec(`tmux send-keys -t ${this.getSessionName()}:0.0 "${monitorCmd}" Enter`);
  }

  private async launchAgentInPane(
    agent: AgentConfig,
    task: Task,
    paneIndex: number,
    context: {
      tasks: Task[];
      repoContext: RepositoryContext;
      workDir: string;
      claudePath?: string;
    }
  ): Promise<void> {
    const { tasks, repoContext, workDir, claudePath } = context;
    
    // Get the Claude command from the agent launcher
    const command = await this.agentLauncher.launchAgentInTmuxPane(
      {
        agent,
        task,
        workDir,
        repoContext,
        agentGroupName: 'Agent Team',
        allTasks: tasks,
        claudePath
      },
      this.getSessionName(),
      paneIndex
    );
    
    // Set pane title
    await exec(`tmux select-pane -t ${this.getSessionName()}:0.${paneIndex} -T "${agent.emoji || '🤖'} ${agent.name}: ${task.title}"`);
    
    // Send the command to the pane
    await exec(`tmux send-keys -t ${this.getSessionName()}:0.${paneIndex} "${command}" Enter`);
    
    // Store pane info
    const paneId = `${this.getSessionName()}:0.${paneIndex}`;
    this.paneMap.set(task.id, {
      paneId,
      paneIndex,
      agentName: agent.name,
      taskId: task.id,
      status: 'running'
    });
  }

  private groupTasksByAgentConfig(tasks: Task[], agents: AgentConfig[]): Map<string, Task[]> {
    const tasksByAgent = new Map<string, Task[]>();
    
    for (const task of tasks) {
      // Find the agent by name match
      const agent = agents.find(a => 
        a.name.toLowerCase() === task.assigned_agent.toLowerCase()
      );
      
      if (agent) {
        const agentTasks = tasksByAgent.get(agent.id) || [];
        agentTasks.push(task);
        tasksByAgent.set(agent.id, agentTasks);
      }
    }
    
    return tasksByAgent;
  }

  async getPaneStatus(taskId: string): Promise<'running' | 'completed' | 'failed'> {
    const paneInfo = this.paneMap.get(taskId);
    if (!paneInfo) return 'failed';
    
    try {
      // Check if the pane still has a running process
      const result = await exec(`tmux list-panes -t ${paneInfo.paneId} -F "#{pane_pid}"`);
      const pid = result.stdout.trim();
      
      if (pid) {
        // Check if the process is still running
        try {
          await exec(`ps -p ${pid}`);
          return 'running';
        } catch {
          return 'completed';
        }
      }
      
      return 'completed';
    } catch {
      return 'failed';
    }
  }

  async getAllPaneStatuses(): Promise<Map<string, 'running' | 'completed' | 'failed'>> {
    const statuses = new Map<string, 'running' | 'completed' | 'failed'>();
    
    for (const [taskId] of this.paneMap) {
      const status = await this.getPaneStatus(taskId);
      statuses.set(taskId, status);
    }
    
    return statuses;
  }

  async waitForCompletion(): Promise<void> {
    console.log(chalk.yellow('\n⏳ Waiting for all agents to complete their tasks...'));
    
    // Poll for completion
    const checkInterval = 5000; // 5 seconds
    while (true) {
      const statuses = await this.getAllPaneStatuses();
      const runningCount = Array.from(statuses.values()).filter(s => s === 'running').length;
      
      if (runningCount === 0) {
        console.log(chalk.green('\n✅ All agents have completed their tasks!'));
        break;
      }
      
      console.log(chalk.gray(`\n${runningCount} agents still working...`));
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }

  async cleanup(): Promise<void> {
    console.log(chalk.blue('\n🧹 Cleaning up Cockpit resources...'));
    
    // Clean up agent launcher (includes worktree cleanup)
    await this.agentLauncher.cleanup();
    
    // Kill TMUX session
    await this.killSession();
    
    // Clean up temporary files
    try {
      const fs = await import('fs/promises');
      await fs.unlink(`/tmp/graphyn_tasks_${this.getSessionName()}.json`).catch(() => {});
      await fs.unlink(`/tmp/graphyn_agents_${this.getSessionName()}.json`).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
    
    console.log(chalk.green('✅ Cockpit cleanup completed'));
  }

  /**
   * Get worktree information for a specific task
   */
  getWorktreeInfo(taskId: string) {
    return this.agentLauncher.getWorktreeInfo(taskId);
  }

  /**
   * Get all active worktrees
   */
  getActiveWorktrees() {
    return this.agentLauncher.getWorktreeManager().getActiveWorktrees();
  }

  /**
   * List git worktrees for debugging
   */
  async listGitWorktrees(repoPath: string) {
    return this.agentLauncher.getWorktreeManager().listGitWorktrees(repoPath);
  }

  /**
   * Force cleanup of a specific worktree
   */
  async cleanupWorktree(taskId: string, force = false) {
    try {
      await this.agentLauncher.getWorktreeManager().removeWorktree(taskId, force);
      console.log(chalk.green(`✅ Cleaned up worktree for task ${taskId}`));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to cleanup worktree for task ${taskId}:`), error);
    }
  }
}