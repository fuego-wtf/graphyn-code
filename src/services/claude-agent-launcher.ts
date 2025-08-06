import { spawn, ChildProcess, exec as execCallback } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import type { AgentConfig } from './squad-storage.js';
import type { Task } from './claude-task-generator.js';
import { AgentPromptBuilder, AgentPromptContext } from './agent-prompt-builder.js';
import type { RepositoryContext } from './claude-task-generator.js';

const exec = promisify(execCallback);

export interface LaunchAgentParams {
  agent: AgentConfig;
  task: Task;
  workDir: string;
  repoContext: RepositoryContext;
  squadName: string;
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
  worktreePath?: string;
  branchName?: string;
}

export class ClaudeAgentLauncher {
  private promptBuilder: AgentPromptBuilder;
  private activeAgents: Map<string, AgentProcess>;
  private promptsDir: string;
  private worktreesBaseDir: string;

  constructor() {
    this.promptBuilder = new AgentPromptBuilder();
    this.activeAgents = new Map();
    
    // Create a directory for agent prompts
    this.promptsDir = join(tmpdir(), 'graphyn-cockpit-prompts');
    if (!existsSync(this.promptsDir)) {
      mkdirSync(this.promptsDir, { recursive: true });
    }
    
    // Create base directory for worktrees
    this.worktreesBaseDir = join(homedir(), '.graphyn', 'worktrees');
    if (!existsSync(this.worktreesBaseDir)) {
      mkdirSync(this.worktreesBaseDir, { recursive: true });
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
    const { agent, task, workDir, repoContext, squadName, allTasks, claudePath = 'claude', squadId } = params;
    
    // Create git worktree for this agent
    const worktreeInfo = await this.createGitWorktree(workDir, squadId || 'default', agent, task);
    
    // Build the agent prompt
    const promptContext: AgentPromptContext = {
      agent,
      task,
      repoContext,
      squadName,
      otherTasks: allTasks,
      workingDirectory: worktreeInfo.path
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
echo "📁 Working directory: ${worktreeInfo.path}"
echo "🌳 Git branch: ${worktreeInfo.branch}"
echo ""
echo "Launching Claude..."
echo "========================================"

# Change to worktree directory
cd "${worktreeInfo.path}"

# Run Claude with the prompt, capture both stdout and stderr
if cat "${promptFile}" | "${claudePath}" 2>&1; then
  echo ""
  echo "========================================"
  echo "✅ Task completed successfully"
else
  EXIT_CODE=$?
  echo ""
  echo "========================================"
  echo "❌ Claude exited with code: $EXIT_CODE"
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
      worktreePath: worktreeInfo.path,
      branchName: worktreeInfo.branch
    };
    
    // Store the agent process
    this.activeAgents.set(task.id, agentProcess);
    
    return command;
  }
  
  private async createGitWorktree(baseDir: string, squadId: string, agent: AgentConfig, task: Task): Promise<{ path: string; branch: string }> {
    const agentName = agent.name.toLowerCase().replace(/\s+/g, '-');
    const taskId = task.id.substring(0, 8);
    const branchName = `${squadId}/${agentName}-${taskId}`;
    const worktreePath = join(this.worktreesBaseDir, squadId, `${agentName}_${taskId}`);
    
    try {
      // Check if we're in a git repository
      const gitDirResult = await exec('git rev-parse --git-dir', { cwd: baseDir });
      console.log(`Git directory check: ${gitDirResult.stdout.trim()}`);
      
      // Check if we're already in a worktree
      const worktreeCheckResult = await exec('git rev-parse --show-toplevel', { cwd: baseDir });
      const topLevel = worktreeCheckResult.stdout.trim();
      console.log(`Current directory toplevel: ${topLevel}`);
      
      // Remove existing worktree if it exists
      try {
        await exec(`git worktree remove --force "${worktreePath}" 2>/dev/null || true`, { cwd: baseDir });
      } catch (e) {
        // Ignore errors - worktree might not exist
      }
      
      // Also ensure the directory is removed
      if (existsSync(worktreePath)) {
        await exec(`rm -rf "${worktreePath}"`);
      }
      
      // Check if branch already exists
      try {
        await exec(`git rev-parse --verify "${branchName}"`, { cwd: baseDir });
        // Branch exists, delete it
        await exec(`git branch -D "${branchName}"`, { cwd: baseDir });
      } catch (e) {
        // Branch doesn't exist, which is fine
      }
      
      // Create the worktree with a new branch
      const worktreeCmd = `git worktree add -b "${branchName}" "${worktreePath}"`;
      console.log(`Creating worktree with command: ${worktreeCmd}`);
      const worktreeResult = await exec(worktreeCmd, { cwd: baseDir });
      console.log(`Worktree creation output: ${worktreeResult.stdout}`);
      
      // Verify the worktree was created
      if (!existsSync(worktreePath)) {
        throw new Error(`Worktree directory was not created at ${worktreePath}`);
      }
      
      console.log(`✓ Created worktree for ${agent.name} at ${worktreePath} on branch ${branchName}`);
      
      return { path: worktreePath, branch: branchName };
    } catch (error) {
      console.error(`Failed to create worktree for ${agent.name}:`, error);
      console.error(`Error details: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Fallback to original directory if worktree creation fails
      console.warn(`⚠️  Falling back to main directory for ${agent.name}`);
      return { path: baseDir, branch: 'main' };
    }
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
  
  getWorktreeInfo(taskId: string): { path: string; branch: string } | undefined {
    const agent = this.activeAgents.get(taskId);
    if (agent && agent.worktreePath && agent.branchName) {
      return { path: agent.worktreePath, branch: agent.branchName };
    }
    return undefined;
  }
}