import { spawn, ChildProcess } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import type { AgentConfig } from './squad-storage.js';
import type { Task } from './claude-task-generator.js';
import { AgentPromptBuilder, AgentPromptContext } from './agent-prompt-builder.js';
import type { RepositoryContext } from './claude-task-generator.js';

export interface LaunchAgentParams {
  agent: AgentConfig;
  task: Task;
  workDir: string;
  repoContext: RepositoryContext;
  squadName: string;
  allTasks: Task[];
  claudePath?: string;
}

export interface AgentProcess {
  process: ChildProcess;
  agentId: string;
  taskId: string;
  promptFile: string;
  startTime: Date;
}

export class ClaudeAgentLauncher {
  private promptBuilder: AgentPromptBuilder;
  private activeAgents: Map<string, AgentProcess>;
  private promptsDir: string;

  constructor() {
    this.promptBuilder = new AgentPromptBuilder();
    this.activeAgents = new Map();
    
    // Create a directory for agent prompts
    this.promptsDir = join(tmpdir(), 'graphyn-cockpit-prompts');
    if (!existsSync(this.promptsDir)) {
      mkdirSync(this.promptsDir, { recursive: true });
    }
  }

  async launchAgent(params: LaunchAgentParams): Promise<AgentProcess> {
    const { agent, task, workDir, repoContext, squadName, allTasks, claudePath = 'claude' } = params;
    
    // Build the agent prompt with task context
    const promptContext: AgentPromptContext = {
      agent,
      task,
      repoContext,
      squadName,
      otherTasks: allTasks,
      workingDirectory: workDir
    };
    
    const prompt = this.promptBuilder.buildAgentPrompt(promptContext);
    
    // Write prompt to a file
    const promptFileName = `${agent.name.toLowerCase().replace(/\s+/g, '-')}-${task.id}-${uuidv4()}.txt`;
    const promptFile = join(this.promptsDir, promptFileName);
    writeFileSync(promptFile, prompt, 'utf-8');
    
    // Launch Claude with the prompt file
    const claudeProcess = spawn(claudePath, [], {
      cwd: workDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GRAPHYN_AGENT_NAME: agent.name,
        GRAPHYN_TASK_ID: task.id
      }
    });
    
    // Write the prompt to stdin
    claudeProcess.stdin.write(prompt);
    claudeProcess.stdin.end();
    
    // Create agent process tracking
    const agentProcess: AgentProcess = {
      process: claudeProcess,
      agentId: agent.id,
      taskId: task.id,
      promptFile,
      startTime: new Date()
    };
    
    // Store the agent process
    this.activeAgents.set(task.id, agentProcess);
    
    // Handle process events
    claudeProcess.on('exit', (code, signal) => {
      console.log(`Agent ${agent.name} (Task ${task.id}) exited with code ${code}`);
      this.activeAgents.delete(task.id);
    });
    
    claudeProcess.on('error', (err) => {
      console.error(`Agent ${agent.name} (Task ${task.id}) error:`, err);
      this.activeAgents.delete(task.id);
    });
    
    return agentProcess;
  }

  async launchAgentInTmuxPane(params: LaunchAgentParams, tmuxSession: string, paneIndex: number): Promise<string> {
    const { agent, task, workDir, repoContext, squadName, allTasks, claudePath = 'claude' } = params;
    
    // Build the agent prompt
    const promptContext: AgentPromptContext = {
      agent,
      task,
      repoContext,
      squadName,
      otherTasks: allTasks,
      workingDirectory: workDir
    };
    
    const prompt = this.promptBuilder.buildAgentPrompt(promptContext);
    
    // Write prompt to a file
    const promptFileName = `${agent.name.toLowerCase().replace(/\s+/g, '-')}-${task.id}-${uuidv4()}.txt`;
    const promptFile = join(this.promptsDir, promptFileName);
    writeFileSync(promptFile, prompt, 'utf-8');
    
    // Create the command to run in TMUX pane
    // We'll use a wrapper script to properly handle the Claude invocation
    const command = `cd "${workDir}" && cat "${promptFile}" | "${claudePath}"`;
    
    return command;
  }

  getActiveAgents(): AgentProcess[] {
    return Array.from(this.activeAgents.values());
  }

  getAgentByTaskId(taskId: string): AgentProcess | undefined {
    return this.activeAgents.get(taskId);
  }

  async stopAgent(taskId: string): Promise<void> {
    const agentProcess = this.activeAgents.get(taskId);
    if (agentProcess) {
      agentProcess.process.kill('SIGTERM');
      this.activeAgents.delete(taskId);
    }
  }

  async stopAllAgents(): Promise<void> {
    for (const [taskId, agentProcess] of this.activeAgents) {
      agentProcess.process.kill('SIGTERM');
    }
    this.activeAgents.clear();
  }

  cleanup(): void {
    // Clean up prompt files
    // Note: In production, we might want to keep these for debugging
    this.stopAllAgents();
  }
}