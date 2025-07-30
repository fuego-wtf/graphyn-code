import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { SquadTask } from '../types/squad.js';
import { generateAgentTaskFile, generateSystemPromptFile } from './task-file-generator.js';
import type { LocalSquad } from '../services/squad-storage.js';
import type { Task } from '../services/claude-task-generator.js';

const exec = promisify(execCallback);

export interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  systemPrompt?: string;
}

export interface ExecutionPlan {
  squad: LocalSquad;
  tasks: Task[];
  workspace: string;
}

export class TmuxLayoutManager {
  private sessionName: string;
  
  constructor(sessionId: string) {
    // Create a unique session name using first 8 chars of session ID
    this.sessionName = `graphyn_${sessionId.substring(0, 8)}`;
  }
  
  async executeSquadPlan(plan: ExecutionPlan) {
    const { squad, tasks, workspace } = plan;
    
    // Convert Task[] to SquadTask[] format
    const squadTasks: SquadTask[] = tasks.map(task => ({
      id: task.id,
      session_id: squad.id,
      title: task.title,
      description: task.description,
      assigned_agent_id: task.assigned_agent_id || '',
      assigned_agent_name: task.assigned_agent,
      status: 'pending',
      dependencies: task.dependencies || [],
      created_at: new Date().toISOString()
    }));
    
    // Convert agents to the expected format
    const agents: Agent[] = squad.agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      emoji: agent.emoji || '🤖',
      role: agent.role,
      systemPrompt: agent.systemPrompt
    }));
    
    // Create TMUX layout with agents and tasks
    await this.createSquadLayout(agents, squadTasks);
  }

  async createSquadLayout(agents: Agent[], tasks: SquadTask[]) {
    try {
      // Kill existing session if it exists (ignore errors)
      await this.exec(`tmux kill-session -t ${this.sessionName} 2>/dev/null || true`);
      
      // Create new session with first window for squad overview
      await this.exec(`tmux new-session -d -s ${this.sessionName} -n "🎯 Squad Overview"`);
      
      // Set up the squad overview pane
      await this.setupSquadOverviewPane(agents, tasks);
      
      // Create layout based on number of agents
      if (agents.length <= 2) {
        await this.createHorizontalLayout(agents, tasks);
      } else if (agents.length <= 4) {
        await this.create2x2Layout(agents, tasks);
      } else if (agents.length <= 6) {
        await this.create2x3Layout(agents, tasks);
      } else {
        await this.createGridLayout(agents, tasks);
      }
      
      // Add cockpit window
      await this.addCockpitWindow();
      
      // Switch back to first window
      await this.exec(`tmux select-window -t ${this.sessionName}:0`);
      
      // Attach to session
      await this.attachSession();
      
    } catch (error) {
      console.error('Error creating TMUX layout:', error);
      throw error;
    }
  }

  private async setupSquadOverviewPane(agents: Agent[], tasks: SquadTask[]) {
    // Display squad summary in the first pane
    const summary = [
      `echo "🎯 Squad Session: ${this.sessionName}"`,
      `echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"`,
      `echo ""`,
      `echo "📋 Total Tasks: ${tasks.length}"`,
      `echo "👥 Active Agents: ${agents.length}"`,
      `echo ""`,
      `echo "Agents:"`,
      ...agents.map((agent, idx) => 
        `echo "  ${idx + 1}. ${agent.emoji} ${agent.name} - ${tasks.filter(t => t.assigned_agent_id === agent.id).length} tasks"`
      ),
      `echo ""`,
      `echo 'Press Ctrl+B then a number (1-${agents.length}) to switch to an agent pane'`,
      `echo 'Press Ctrl+B then c to open cockpit dashboard'`,
      `echo ""`
    ];
    
    for (const cmd of summary) {
      await this.exec(`tmux send-keys -t ${this.sessionName}:0.0 "${cmd}" Enter`);
    }
  }

  private async createHorizontalLayout(agents: Agent[], tasks: SquadTask[]) {
    // Create a new window for agents
    await this.exec(`tmux new-window -t ${this.sessionName} -n "👥 Agents"`);
    
    // First agent already has pane 0
    await this.setupAgentPane(1, 0, agents[0], tasks);
    
    if (agents.length > 1) {
      // Split horizontally for second agent
      await this.exec(`tmux split-window -h -t ${this.sessionName}:1`);
      await this.setupAgentPane(1, 1, agents[1], tasks);
      
      // Balance panes
      await this.exec(`tmux select-layout -t ${this.sessionName}:1 even-horizontal`);
    }
  }

  private async create2x2Layout(agents: Agent[], tasks: SquadTask[]) {
    // Create a new window for agents
    await this.exec(`tmux new-window -t ${this.sessionName} -n "👥 Agents"`);
    
    // Setup first agent (top-left)
    await this.setupAgentPane(1, 0, agents[0], tasks);
    
    // Split vertically for top-right
    if (agents.length > 1) {
      await this.exec(`tmux split-window -h -t ${this.sessionName}:1.0`);
      await this.setupAgentPane(1, 1, agents[1], tasks);
    }
    
    // Select first pane and split horizontally for bottom-left
    if (agents.length > 2) {
      await this.exec(`tmux select-pane -t ${this.sessionName}:1.0`);
      await this.exec(`tmux split-window -v -t ${this.sessionName}:1.0`);
      await this.setupAgentPane(1, 2, agents[2], tasks);
    }
    
    // Select second pane and split horizontally for bottom-right
    if (agents.length > 3) {
      await this.exec(`tmux select-pane -t ${this.sessionName}:1.1`);
      await this.exec(`tmux split-window -v -t ${this.sessionName}:1.1`);
      await this.setupAgentPane(1, 3, agents[3], tasks);
    }
    
    // Balance all panes
    await this.exec(`tmux select-layout -t ${this.sessionName}:1 tiled`);
  }

  private async create2x3Layout(agents: Agent[], tasks: SquadTask[]) {
    // Create a new window for agents
    await this.exec(`tmux new-window -t ${this.sessionName} -n "👥 Agents"`);
    
    // Create 3 columns first
    await this.setupAgentPane(1, 0, agents[0], tasks);
    
    if (agents.length > 1) {
      await this.exec(`tmux split-window -h -t ${this.sessionName}:1`);
      await this.setupAgentPane(1, 1, agents[1], tasks);
    }
    
    if (agents.length > 2) {
      await this.exec(`tmux split-window -h -t ${this.sessionName}:1.1`);
      await this.setupAgentPane(1, 2, agents[2], tasks);
    }
    
    // Now split each column vertically for bottom row
    if (agents.length > 3) {
      await this.exec(`tmux select-pane -t ${this.sessionName}:1.0`);
      await this.exec(`tmux split-window -v -t ${this.sessionName}:1.0`);
      await this.setupAgentPane(1, 3, agents[3], tasks);
    }
    
    if (agents.length > 4) {
      await this.exec(`tmux select-pane -t ${this.sessionName}:1.1`);
      await this.exec(`tmux split-window -v -t ${this.sessionName}:1.1`);
      await this.setupAgentPane(1, 4, agents[4], tasks);
    }
    
    if (agents.length > 5) {
      await this.exec(`tmux select-pane -t ${this.sessionName}:1.2`);
      await this.exec(`tmux split-window -v -t ${this.sessionName}:1.2`);
      await this.setupAgentPane(1, 5, agents[5], tasks);
    }
    
    // Balance layout
    await this.exec(`tmux select-layout -t ${this.sessionName}:1 tiled`);
  }

  private async createGridLayout(agents: Agent[], tasks: SquadTask[]) {
    // For more than 6 agents, create multiple windows
    const agentsPerWindow = 6;
    const windowCount = Math.ceil(agents.length / agentsPerWindow);
    
    for (let w = 0; w < windowCount; w++) {
      const windowAgents = agents.slice(w * agentsPerWindow, (w + 1) * agentsPerWindow);
      const windowName = windowCount > 1 ? `👥 Agents ${w + 1}` : "👥 Agents";
      
      await this.exec(`tmux new-window -t ${this.sessionName} -n "${windowName}"`);
      const windowIndex = w + 1;
      
      // Create 2x3 layout for this window
      for (let i = 0; i < windowAgents.length && i < 6; i++) {
        if (i === 0) {
          await this.setupAgentPane(windowIndex, 0, windowAgents[0], tasks);
        } else if (i === 1) {
          await this.exec(`tmux split-window -h -t ${this.sessionName}:${windowIndex}`);
          await this.setupAgentPane(windowIndex, 1, windowAgents[1], tasks);
        } else if (i === 2) {
          await this.exec(`tmux split-window -h -t ${this.sessionName}:${windowIndex}.1`);
          await this.setupAgentPane(windowIndex, 2, windowAgents[2], tasks);
        } else if (i === 3) {
          await this.exec(`tmux select-pane -t ${this.sessionName}:${windowIndex}.0`);
          await this.exec(`tmux split-window -v -t ${this.sessionName}:${windowIndex}.0`);
          await this.setupAgentPane(windowIndex, 3, windowAgents[3], tasks);
        } else if (i === 4) {
          await this.exec(`tmux select-pane -t ${this.sessionName}:${windowIndex}.1`);
          await this.exec(`tmux split-window -v -t ${this.sessionName}:${windowIndex}.1`);
          await this.setupAgentPane(windowIndex, 4, windowAgents[4], tasks);
        } else if (i === 5) {
          await this.exec(`tmux select-pane -t ${this.sessionName}:${windowIndex}.2`);
          await this.exec(`tmux split-window -v -t ${this.sessionName}:${windowIndex}.2`);
          await this.setupAgentPane(windowIndex, 5, windowAgents[5], tasks);
        }
      }
      
      // Balance layout
      await this.exec(`tmux select-layout -t ${this.sessionName}:${windowIndex} tiled`);
    }
  }

  private async setupAgentPane(windowIndex: number, paneIndex: number, agent: Agent, tasks: SquadTask[]) {
    const agentTasks = tasks.filter(t => t.assigned_agent_id === agent.id);
    
    // Set pane title (requires tmux 2.3+)
    try {
      await this.exec(`tmux select-pane -t ${this.sessionName}:${windowIndex}.${paneIndex} -T "${agent.emoji} ${agent.name}"`);
    } catch (e) {
      // Ignore if pane titles not supported
    }
    
    // Generate task file for this agent
    const taskFile = await generateAgentTaskFile(
      {
        id: agent.id,
        name: agent.name,
        emoji: agent.emoji,
        role: agent.role,
        systemPrompt: agent.systemPrompt || `You are ${agent.name}, a ${agent.role} expert.`
      },
      agentTasks,
      this.sessionName,
      'Squad Session'
    );
    
    // Generate system prompt file
    const systemPromptFile = await generateSystemPromptFile(
      {
        id: agent.id,
        name: agent.name,
        emoji: agent.emoji,
        role: agent.role,
        systemPrompt: agent.systemPrompt || `You are ${agent.name}, a ${agent.role} expert.`
      },
      this.sessionName
    );
    
    // Display agent header
    const headerCommands = [
      `echo "════════════════════════════════════════"`,
      `echo "${agent.emoji} ${agent.name}"`,
      `echo "${agent.role}"`,
      `echo "════════════════════════════════════════"`,
      `echo ""`,
      `echo "📋 Assigned Tasks: ${agentTasks.length}"`,
      `echo "📄 Task File: ${taskFile}"`,
      `echo ""`,
      `echo "Starting Claude Code with agent prompt..."`,
      `echo ""`,
    ];
    
    for (const cmd of headerCommands) {
      await this.exec(`tmux send-keys -t ${this.sessionName}:${windowIndex}.${paneIndex} "${cmd}" Enter`);
    }
    
    // Launch Claude Code with the agent's system prompt and task file
    const claudeCommand = `claude --session "${this.sessionName}_${agent.id}" --system-prompt-file "${systemPromptFile}" "${taskFile}"`;
    
    // Send the command to start Claude Code
    await this.exec(`tmux send-keys -t ${this.sessionName}:${windowIndex}.${paneIndex} "${claudeCommand}" Enter`);
  }

  private async addCockpitWindow() {
    // Create cockpit window at the end
    const windowCount = await this.getWindowCount();
    await this.exec(`tmux new-window -t ${this.sessionName} -n "🎮 Cockpit"`);
    
    // Display cockpit placeholder
    const cockpitCommands = [
      `echo "🎮 SQUAD COCKPIT - Real-time Dashboard"`,
      `echo "════════════════════════════════════════════════════════════════"`,
      `echo ""`,
      `echo "📊 Task Progress:"`,
      `echo "  Total: ${this.sessionName}"`,
      `echo "  Pending: -"`,
      `echo "  In Progress: -"`,
      `echo "  Completed: -"`,
      `echo ""`,
      `echo "🔄 Activity Feed:"`,
      `echo "  Waiting for squad activity..."`,
      `echo ""`,
      `echo "Navigation:"`,
      `echo "  • Ctrl+B then 0-${windowCount} to switch windows"`,
      `echo "  • Ctrl+B then arrow keys to switch panes"`,
      `echo "  • Ctrl+B then d to detach from session"`,
      `echo ""`,
      `# graphyn cockpit --session ${this.sessionName}`
    ];
    
    for (const cmd of cockpitCommands) {
      await this.exec(`tmux send-keys -t ${this.sessionName}:${windowCount} "${cmd}" Enter`);
    }
  }

  private async getWindowCount(): Promise<number> {
    try {
      const { stdout } = await exec(`tmux list-windows -t ${this.sessionName} | wc -l`);
      return parseInt(stdout.trim(), 10);
    } catch (error) {
      return 1;
    }
  }

  private async attachSession() {
    // Check if we're already in tmux
    const inTmux = process.env.TMUX;
    
    try {
      if (inTmux) {
        // If in tmux, switch to the new session
        await this.exec(`tmux switch-client -t ${this.sessionName}`);
      } else {
        // If not in tmux, attach to the new session
        // This will take over the current terminal
        process.stdout.write(`\nAttaching to TMUX session: ${this.sessionName}\n`);
        process.stdout.write(`To detach: Press Ctrl+B then d\n\n`);
        
        // Use spawn instead of exec for interactive tmux
        const { spawn } = require('child_process');
        const tmux = spawn('tmux', ['attach-session', '-t', this.sessionName], {
          stdio: 'inherit'
        });
        
        tmux.on('exit', (code: number) => {
          process.exit(code);
        });
      }
    } catch (error) {
      console.error('Error attaching to TMUX session:', error);
      console.log(`\nManually attach with: tmux attach-session -t ${this.sessionName}`);
    }
  }

  private async exec(command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await exec(command);
      return result;
    } catch (error: any) {
      // Ignore errors for kill-session command
      if (command.includes('kill-session')) {
        return { stdout: '', stderr: '' };
      }
      throw error;
    }
  }

  public getSessionName(): string {
    return this.sessionName;
  }
  
  private groupTasksByAgent(tasks: Task[]): Map<string, Task[]> {
    const grouped = new Map<string, Task[]>();
    
    for (const task of tasks) {
      const agentName = task.assigned_agent;
      if (!grouped.has(agentName)) {
        grouped.set(agentName, []);
      }
      grouped.get(agentName)!.push(task);
    }
    
    return grouped;
  }
}