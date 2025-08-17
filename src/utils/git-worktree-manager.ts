import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { join, basename } from 'path';
import { existsSync } from 'fs';
import { mkdir, rm } from 'fs/promises';
import chalk from 'chalk';

const exec = promisify(execCallback);

export interface WorktreeInfo {
  path: string;
  branch: string;
  agentId: string;
  taskId: string;
  timestamp: string;
  parentRepo: string;
}

export interface WorktreeCreateOptions {
  agentId: string;
  taskId: string;
  agentName: string;
  squadId?: string;
  baseBranch?: string;
}

export class GitWorktreeManager {
  private readonly worktreesBaseDir: string;
  private readonly activeWorktrees: Map<string, WorktreeInfo> = new Map();

  constructor(baseDir?: string) {
    this.worktreesBaseDir = baseDir || join(process.cwd(), '.worktrees');
  }

  /**
   * Create a new git worktree for an agent
   */
  async createWorktree(
    repoPath: string,
    options: WorktreeCreateOptions
  ): Promise<WorktreeInfo> {
    const { agentId, taskId, agentName, squadId = 'default', baseBranch = 'HEAD' } = options;
    
    // Validate git repository
    await this.validateGitRepo(repoPath);
    
    // Generate unique identifiers
    const timestamp = Date.now().toString();
    const sanitizedAgentName = agentName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const shortTaskId = taskId.substring(0, 8);
    
    // Create branch and directory names
    const branchName = `agent/${squadId}/${sanitizedAgentName}-${shortTaskId}-${timestamp}`;
    const worktreeDirName = `agent-${agentId}-${timestamp}`;
    const worktreePath = join(this.worktreesBaseDir, squadId, worktreeDirName);
    
    try {
      // Ensure base directory exists
      await mkdir(join(this.worktreesBaseDir, squadId), { recursive: true });
      
      // Clean up any existing worktree with the same path
      await this.cleanupWorktreeByPath(worktreePath, repoPath);
      
      // Get current branch/commit for worktree base
      const baseRef = await this.resolveBaseRef(repoPath, baseBranch);
      
      // Create the worktree
      const createCmd = `git worktree add -b "${branchName}" "${worktreePath}" "${baseRef}"`;
      console.log(chalk.blue(`Creating worktree: ${createCmd}`));
      
      const result = await exec(createCmd, { cwd: repoPath });
      
      if (result.stderr && !result.stderr.includes('Switched to a new branch')) {
        console.warn(chalk.yellow(`Worktree creation warning: ${result.stderr}`));
      }
      
      // Verify worktree was created
      if (!existsSync(worktreePath)) {
        throw new Error(`Worktree directory was not created at ${worktreePath}`);
      }
      
      // Get the parent repository path
      const parentRepo = await this.getParentRepo(repoPath);
      
      const worktreeInfo: WorktreeInfo = {
        path: worktreePath,
        branch: branchName,
        agentId,
        taskId,
        timestamp,
        parentRepo
      };
      
      // Track the worktree
      this.activeWorktrees.set(taskId, worktreeInfo);
      
      console.log(chalk.green(`✓ Created worktree for agent ${agentName}`));
      console.log(chalk.gray(`  Path: ${worktreePath}`));
      console.log(chalk.gray(`  Branch: ${branchName}`));
      
      return worktreeInfo;
      
    } catch (error) {
      console.error(chalk.red(`Failed to create worktree for agent ${agentName}:`));
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      
      // Clean up any partial creation
      await this.cleanupWorktreeByPath(worktreePath, repoPath);
      
      throw error;
    }
  }

  /**
   * Remove a worktree by task ID
   */
  async removeWorktree(taskId: string, force = false): Promise<void> {
    const worktreeInfo = this.activeWorktrees.get(taskId);
    if (!worktreeInfo) {
      console.warn(chalk.yellow(`No worktree found for task ${taskId}`));
      return;
    }

    await this.cleanupWorktree(worktreeInfo, force);
    this.activeWorktrees.delete(taskId);
  }

  /**
   * Remove a worktree by path
   */
  async removeWorktreeByPath(worktreePath: string, repoPath: string, force = false): Promise<void> {
    await this.cleanupWorktreeByPath(worktreePath, repoPath, force);
    
    // Remove from tracking if exists
    for (const [taskId, info] of this.activeWorktrees.entries()) {
      if (info.path === worktreePath) {
        this.activeWorktrees.delete(taskId);
        break;
      }
    }
  }

  /**
   * Get worktree information by task ID
   */
  getWorktreeInfo(taskId: string): WorktreeInfo | undefined {
    return this.activeWorktrees.get(taskId);
  }

  /**
   * List all active worktrees
   */
  getActiveWorktrees(): WorktreeInfo[] {
    return Array.from(this.activeWorktrees.values());
  }

  /**
   * Clean up all active worktrees
   */
  async cleanupAllWorktrees(force = false): Promise<void> {
    console.log(chalk.blue('Cleaning up all active worktrees...'));
    
    const worktrees = Array.from(this.activeWorktrees.values());
    for (const worktree of worktrees) {
      try {
        await this.cleanupWorktree(worktree, force);
      } catch (error) {
        console.warn(chalk.yellow(`Failed to cleanup worktree ${worktree.path}: ${error}`));
      }
    }
    
    this.activeWorktrees.clear();
    console.log(chalk.green('✓ All worktrees cleaned up'));
  }

  /**
   * List git worktrees from git command
   */
  async listGitWorktrees(repoPath: string): Promise<Array<{ path: string; branch: string; bare?: boolean }>> {
    try {
      const result = await exec('git worktree list --porcelain', { cwd: repoPath });
      const lines = result.stdout.trim().split('\n');
      
      const worktrees: Array<{ path: string; branch: string; bare?: boolean }> = [];
      let currentWorktree: Partial<{ path: string; branch: string; bare?: boolean }> = {};
      
      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          if (currentWorktree.path) {
            worktrees.push(currentWorktree as { path: string; branch: string; bare?: boolean });
          }
          currentWorktree = { path: line.substring(9) };
        } else if (line.startsWith('branch ')) {
          currentWorktree.branch = line.substring(7);
        } else if (line === 'bare') {
          currentWorktree.bare = true;
        } else if (line === '') {
          if (currentWorktree.path) {
            worktrees.push(currentWorktree as { path: string; branch: string; bare?: boolean });
            currentWorktree = {};
          }
        }
      }
      
      // Add the last worktree if exists
      if (currentWorktree.path) {
        worktrees.push(currentWorktree as { path: string; branch: string; bare?: boolean });
      }
      
      return worktrees;
    } catch (error) {
      console.warn(chalk.yellow(`Failed to list git worktrees: ${error}`));
      return [];
    }
  }

  /**
   * Validate that a directory is a git repository
   */
  private async validateGitRepo(repoPath: string): Promise<void> {
    try {
      await exec('git rev-parse --git-dir', { cwd: repoPath });
    } catch (error) {
      throw new Error(`Directory ${repoPath} is not a git repository`);
    }
  }

  /**
   * Resolve base reference for worktree creation
   */
  private async resolveBaseRef(repoPath: string, baseBranch: string): Promise<string> {
    try {
      const result = await exec(`git rev-parse ${baseBranch}`, { cwd: repoPath });
      return result.stdout.trim();
    } catch (error) {
      console.warn(chalk.yellow(`Failed to resolve ${baseBranch}, using HEAD`));
      return 'HEAD';
    }
  }

  /**
   * Get parent repository path
   */
  private async getParentRepo(repoPath: string): Promise<string> {
    try {
      const result = await exec('git rev-parse --show-toplevel', { cwd: repoPath });
      return result.stdout.trim();
    } catch (error) {
      return repoPath;
    }
  }

  /**
   * Clean up a specific worktree
   */
  private async cleanupWorktree(worktreeInfo: WorktreeInfo, force = false): Promise<void> {
    const { path: worktreePath, branch: branchName, parentRepo } = worktreeInfo;
    
    try {
      // Remove the worktree
      const removeCmd = force 
        ? `git worktree remove --force "${worktreePath}"`
        : `git worktree remove "${worktreePath}"`;
        
      console.log(chalk.blue(`Removing worktree: ${removeCmd}`));
      await exec(removeCmd, { cwd: parentRepo });
      
      // Remove the branch if it exists
      try {
        await exec(`git branch -D "${branchName}"`, { cwd: parentRepo });
        console.log(chalk.gray(`  Deleted branch: ${branchName}`));
      } catch (error) {
        console.warn(chalk.yellow(`  Failed to delete branch ${branchName}: ${error}`));
      }
      
      // Ensure directory is removed
      if (existsSync(worktreePath)) {
        await rm(worktreePath, { recursive: true, force: true });
        console.log(chalk.gray(`  Removed directory: ${worktreePath}`));
      }
      
      console.log(chalk.green(`✓ Cleaned up worktree: ${basename(worktreePath)}`));
      
    } catch (error) {
      console.error(chalk.red(`Failed to cleanup worktree ${worktreePath}: ${error}`));
      
      // Try to forcefully remove the directory
      if (existsSync(worktreePath)) {
        try {
          await rm(worktreePath, { recursive: true, force: true });
          console.log(chalk.yellow(`  Force removed directory: ${worktreePath}`));
        } catch (dirError) {
          console.error(chalk.red(`  Failed to remove directory: ${dirError}`));
        }
      }
      
      if (!force) {
        throw error;
      }
    }
  }

  /**
   * Clean up worktree by path
   */
  private async cleanupWorktreeByPath(worktreePath: string, repoPath: string, force = false): Promise<void> {
    if (!existsSync(worktreePath)) {
      return;
    }

    try {
      // Try to remove via git worktree command
      const removeCmd = force 
        ? `git worktree remove --force "${worktreePath}"`
        : `git worktree remove "${worktreePath}"`;
        
      await exec(removeCmd, { cwd: repoPath });
      console.log(chalk.gray(`  Removed existing worktree: ${worktreePath}`));
    } catch (error) {
      // If git worktree remove fails, try to remove directory directly
      console.warn(chalk.yellow(`  Git worktree remove failed, removing directory directly`));
      try {
        await rm(worktreePath, { recursive: true, force: true });
        
        // Try to prune worktrees to clean up git's internal state
        await exec('git worktree prune', { cwd: repoPath }).catch(() => {
          // Ignore prune errors
        });
      } catch (dirError) {
        console.error(chalk.red(`  Failed to remove directory ${worktreePath}: ${dirError}`));
        if (!force) {
          throw dirError;
        }
      }
    }
  }
}