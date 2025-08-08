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

  constructor() {
    super(`graphyn-cockpit-${Date.now()}`);
    this.agentLauncher = new ClaudeAgentLauncher();
    this.paneMap = new Map();
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
    spawn('tmux', ['attach-session', '-t', this.getSessionName()], {
      stdio: 'inherit'
    });
  }

  async launchCockpit(config: CockpitConfig): Promise<void> {
    const { tasks, agents, repoContext, workDir, claudePath } = config;
    
    console.log(chalk.blue('\n🚀 Launching Graphyn Cockpit...'));
    
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
    
    // Launch Claude instances for each agent with their tasks
    let paneIndex = 1;
    for (const [agentId, agentTasks] of tasksByAgent) {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) continue;
      
      for (const task of agentTasks) {
        await this.launchAgentInPane(
          agent,
          task,
          paneIndex,
          { tasks, repoContext, workDir, claudePath }
        );
        paneIndex++;
      }
    }
    
    // Attach to the TMUX session
    await this.attachToSession();
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
    this.agentLauncher.cleanup();
    await this.killSession();
    
    // Clean up temporary files
    try {
      const fs = await import('fs/promises');
      await fs.unlink(`/tmp/graphyn_tasks_${this.getSessionName()}.json`).catch(() => {});
      await fs.unlink(`/tmp/graphyn_agents_${this.getSessionName()}.json`).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  }
}