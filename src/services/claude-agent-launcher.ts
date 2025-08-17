import { spawn, ChildProcess, exec as execCallback } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import type { AgentConfig } from '../types/agent.js';
import type { Task } from './claude-task-generator.js';
import { AgentPromptBuilder, AgentPromptContext } from './agent-prompt-builder.js';
import type { RepositoryContext } from './claude-task-generator.js';
import { GitWorktreeManager, type WorktreeInfo } from '../utils/git-worktree-manager.js';

const exec = promisify(execCallback);

export interface LaunchAgentParams {
  agent: AgentConfig;
  task: Task;
  workDir: string;
  repoContext: RepositoryContext;
  agentGroupName: string;
  allTasks: Task[];
  claudePath?: string;
  squadId?: string;
}

export interface AgentProcess {
  process: ChildProcess;
  agentId: string;
  taskId: string;
  promptFile: string;
  startTime: Date;
  worktreeInfo?: WorktreeInfo;
}

export class ClaudeAgentLauncher {
  private promptBuilder: AgentPromptBuilder;
  private activeAgents: Map<string, AgentProcess>;
  private promptsDir: string;
  private worktreeManager: GitWorktreeManager;

  constructor() {
    this.promptBuilder = new AgentPromptBuilder();
    this.activeAgents = new Map();
    
    // Create a directory for agent prompts
    this.promptsDir = join(tmpdir(), 'graphyn-cockpit-prompts');
    if (!existsSync(this.promptsDir)) {
      mkdirSync(this.promptsDir, { recursive: true });
    }
    
    // Initialize git worktree manager
    this.worktreeManager = new GitWorktreeManager();
  }

  async launchAgent(params: LaunchAgentParams): Promise<AgentProcess> {
    const { agent, task, workDir, repoContext, agentGroupName, allTasks, claudePath = 'claude', squadId } = params;
    
    // Create git worktree for this agent
    let worktreeInfo: WorktreeInfo | undefined;
    let actualWorkDir = workDir;
    
    try {
      worktreeInfo = await this.worktreeManager.createWorktree(workDir, {
        agentId: agent.id,
        taskId: task.id,
        agentName: agent.name,
        squadId: squadId || 'default'
      });
      actualWorkDir = worktreeInfo.path;
    } catch (error) {
      console.warn(`Failed to create worktree for agent ${agent.name}, using main directory:`, error);
      // Continue with original workDir if worktree creation fails
    }
    
    // Build the agent prompt with task context
    const promptContext: AgentPromptContext = {
      agent,
      task,
      repoContext,
      agentGroupName,
      otherTasks: allTasks,
      workingDirectory: actualWorkDir
    };
    
    const prompt = this.promptBuilder.buildAgentPrompt(promptContext);
    
    // Write prompt to a file
    const promptFileName = `${agent.name.toLowerCase().replace(/\s+/g, '-')}-${task.id}-${uuidv4()}.txt`;
    const promptFile = join(this.promptsDir, promptFileName);
    writeFileSync(promptFile, prompt, 'utf-8');
    
    // Launch Claude with the prompt file
    const claudeProcess = spawn(claudePath, [], {
      cwd: actualWorkDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GRAPHYN_AGENT_NAME: agent.name,
        GRAPHYN_TASK_ID: task.id,
        GRAPHYN_WORKTREE_PATH: worktreeInfo?.path || '',
        GRAPHYN_WORKTREE_BRANCH: worktreeInfo?.branch || ''
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
      startTime: new Date(),
      worktreeInfo
    };
    
    // Store the agent process
    this.activeAgents.set(task.id, agentProcess);
    
    // Handle process events
    claudeProcess.on('exit', async (code, signal) => {
      console.log(`Agent ${agent.name} (Task ${task.id}) exited with code ${code}`);
      
      // Clean up worktree if it was created
      if (worktreeInfo) {
        try {
          await this.worktreeManager.removeWorktree(task.id);
        } catch (cleanupError) {
          console.warn(`Failed to cleanup worktree for task ${task.id}:`, cleanupError);
        }
      }
      
      this.activeAgents.delete(task.id);
    });
    
    claudeProcess.on('error', async (err) => {
      console.error(`Agent ${agent.name} (Task ${task.id}) error:`, err);
      
      // Clean up worktree if it was created
      if (worktreeInfo) {
        try {
          await this.worktreeManager.removeWorktree(task.id, true); // Force cleanup on error
        } catch (cleanupError) {
          console.warn(`Failed to cleanup worktree for task ${task.id}:`, cleanupError);
        }
      }
      
      this.activeAgents.delete(task.id);
    });
    
    return agentProcess;
  }

  async launchAgentInTmuxPane(params: LaunchAgentParams, tmuxSession: string, paneIndex: number): Promise<string> {
    const { agent, task, workDir, repoContext, agentGroupName, allTasks, claudePath = 'claude', squadId } = params;
    
    // Create git worktree for this agent
    let worktreeInfo: WorktreeInfo | undefined;
    let actualWorkDir = workDir;
    
    try {
      worktreeInfo = await this.worktreeManager.createWorktree(workDir, {
        agentId: agent.id,
        taskId: task.id,
        agentName: agent.name,
        squadId: squadId || 'default'
      });
      actualWorkDir = worktreeInfo.path;
    } catch (error) {
      console.warn(`Failed to create worktree for agent ${agent.name}, using main directory:`, error);
      // Continue with original workDir if worktree creation fails
    }
    
    // Build the agent prompt
    const promptContext: AgentPromptContext = {
      agent,
      task,
      repoContext,
      agentGroupName,
      otherTasks: allTasks,
      workingDirectory: actualWorkDir
    };
    
    const prompt = this.promptBuilder.buildAgentPrompt(promptContext);
    
    // Write prompt to a file
    const promptFileName = `${agent.name.toLowerCase().replace(/\s+/g, '-')}-${task.id}-${uuidv4()}.txt`;
    const promptFile = join(this.promptsDir, promptFileName);
    writeFileSync(promptFile, prompt, 'utf-8');
    
    // Create a wrapper script that will keep the pane alive and log errors
    const wrapperScript = `#!/bin/bash
set -e
echo "🤖 Starting Claude agent: ${agent.name}"
echo "📋 Task: ${task.title}"
echo "📁 Working directory: ${actualWorkDir}"
${worktreeInfo ? `echo "🌳 Git branch: ${worktreeInfo.branch}"` : 'echo "🌳 Git branch: main (no worktree)"'}
echo ""
echo "Launching Claude..."
echo "========================================"

# Change to working directory
cd "${actualWorkDir}"

# Set environment variables for Claude
export GRAPHYN_AGENT_NAME="${agent.name}"
export GRAPHYN_TASK_ID="${task.id}"
${worktreeInfo ? `export GRAPHYN_WORKTREE_PATH="${worktreeInfo.path}"` : ''}
${worktreeInfo ? `export GRAPHYN_WORKTREE_BRANCH="${worktreeInfo.branch}"` : ''}

# Run Claude with the prompt, capture both stdout and stderr
if cat "${promptFile}" | "${claudePath}" 2>&1; then
  echo ""
  echo "========================================"
  echo "✅ Task completed successfully"
  
  # If we have a worktree, clean it up
  ${worktreeInfo ? `echo "🧹 Cleaning up worktree..."` : ''}
else
  EXIT_CODE=$?
  echo ""
  echo "========================================"
  echo "❌ Claude exited with code: $EXIT_CODE"
  
  # If we have a worktree, clean it up
  ${worktreeInfo ? `echo "🧹 Cleaning up worktree..."` : ''}
fi

# Keep the pane alive for a moment to show the final status
echo ""
echo "Press Enter to close this pane..."
read -r
`;
    
    const wrapperFile = join(this.promptsDir, `wrapper-${task.id}.sh`);
    writeFileSync(wrapperFile, wrapperScript, { mode: 0o755 });
    
    // Create the command to run the wrapper script
    const command = `bash "${wrapperFile}"`;
    
    // Create a placeholder process for TMUX tracking
    const agentProcess: AgentProcess = {
      process: {} as ChildProcess, // Placeholder since we're using TMUX
      agentId: agent.id,
      taskId: task.id,
      promptFile,
      startTime: new Date(),
      worktreeInfo
    };
    
    // Store the agent process
    this.activeAgents.set(task.id, agentProcess);
    
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
      // Kill the process if it exists and has a kill method
      if (agentProcess.process && typeof agentProcess.process.kill === 'function') {
        agentProcess.process.kill('SIGTERM');
      }
      
      // Clean up worktree if it exists
      if (agentProcess.worktreeInfo) {
        try {
          await this.worktreeManager.removeWorktree(taskId);
        } catch (error) {
          console.warn(`Failed to cleanup worktree for task ${taskId}:`, error);
        }
      }
      
      this.activeAgents.delete(taskId);
    }
  }

  async stopAllAgents(): Promise<void> {
    for (const [taskId, agentProcess] of this.activeAgents) {
      // Only kill if process exists and has a kill method
      if (agentProcess.process && typeof agentProcess.process.kill === 'function') {
        agentProcess.process.kill('SIGTERM');
      }
      
      // Clean up worktree if it exists
      if (agentProcess.worktreeInfo) {
        try {
          await this.worktreeManager.removeWorktree(taskId);
        } catch (error) {
          console.warn(`Failed to cleanup worktree for task ${taskId}:`, error);
        }
      }
    }
    this.activeAgents.clear();
  }

  async cleanup(): Promise<void> {
    // Clean up all agents and their worktrees
    await this.stopAllAgents();
    
    // Clean up any remaining worktrees managed by the worktree manager
    try {
      await this.worktreeManager.cleanupAllWorktrees(true); // Force cleanup
    } catch (error) {
      console.warn('Failed to cleanup remaining worktrees:', error);
    }
  }
  
  getWorktreeInfo(taskId: string): WorktreeInfo | undefined {
    const agent = this.activeAgents.get(taskId);
    return agent?.worktreeInfo;
  }
  
  /**
   * Get the git worktree manager instance
   */
  getWorktreeManager(): GitWorktreeManager {
    return this.worktreeManager;
  }
}