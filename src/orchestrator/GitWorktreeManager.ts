/**
 * GitWorktreeManager - Manages isolated Git worktrees for agent safety
 * Uses proper TypeScript naming conventions throughout
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdir, access, readdir, rm } from 'fs/promises';
import { join, resolve } from 'path';
import { GitWorktreeInfo } from './types.js';
import { WORKTREE_PREFIX, BRANCH_PREFIX, MAIN_BRANCH, COMMIT_MESSAGE_PREFIX } from './constants.js';

const execAsync = promisify(exec);

/**
 * Manages Git worktrees for agent isolation
 * Class name: PascalCase
 */
export class GitWorktreeManager {
  private readonly repositoryRoot: string;
  private readonly worktreeBaseDir: string;
  private readonly activeWorktrees: Set<string> = new Set();

  constructor(repositoryRoot?: string) {
    this.repositoryRoot = repositoryRoot || process.cwd();
    this.worktreeBaseDir = join(this.repositoryRoot, '.worktrees');
  }

  /**
   * Create isolated worktree for agent task execution
   * Method names: camelCase
   */
  public async createWorktree(taskId: string): Promise<GitWorktreeInfo> {
    await this.ensureWorktreeBaseDirectory();

    const worktreeName = `${WORKTREE_PREFIX}${taskId}`;
    const branchName = `${BRANCH_PREFIX}${taskId}`;
    const worktreePath = join(this.worktreeBaseDir, worktreeName);

    try {
      // Create new branch from main
      await this.createBranch(branchName);

      // Create worktree
      await this.executeGitCommand(
        `git worktree add "${worktreePath}" "${branchName}"`
      );

      // Get current commit hash
      const { stdout: commitHash } = await this.executeGitCommand(
        'git rev-parse HEAD',
        worktreePath
      );

      // Verify worktree is clean
      const isClean = await this.isWorktreeClean(worktreePath);

      const worktreeInfo: GitWorktreeInfo = {
        path: worktreePath,
        branch: branchName,
        commitHash: commitHash.trim(),
        isClean
      };

      this.activeWorktrees.add(worktreeName);
      return worktreeInfo;

    } catch (error) {
      // Cleanup on failure
      await this.cleanupWorktreeOnError(worktreePath, branchName);
      throw new Error(`Failed to create worktree: ${(error as Error).message}`);
    }
  }

  /**
   * Remove worktree and cleanup branch
   */
  public async removeWorktree(worktreeInfo: GitWorktreeInfo): Promise<void> {
    try {
      // Remove worktree
      await this.executeGitCommand(
        `git worktree remove "${worktreeInfo.path}" --force`
      );

      // Delete branch if it exists and is not main
      if (worktreeInfo.branch !== MAIN_BRANCH) {
        await this.deleteBranch(worktreeInfo.branch);
      }

      // Remove from active tracking
      const worktreeName = worktreeInfo.path.split('/').pop() || '';
      this.activeWorktrees.delete(worktreeName);

    } catch (error) {
      console.warn(`Failed to remove worktree ${worktreeInfo.path}:`, error);
      // Continue cleanup even if some operations fail
    }
  }

  /**
   * Commit changes in worktree
   */
  public async commitChanges(
    worktreeInfo: GitWorktreeInfo,
    commitMessage: string
  ): Promise<string> {
    const fullMessage = `${COMMIT_MESSAGE_PREFIX} ${commitMessage}`;

    try {
      // Stage all changes
      await this.executeGitCommand('git add -A', worktreeInfo.path);

      // Check if there are changes to commit
      const { stdout: statusOutput } = await this.executeGitCommand(
        'git status --porcelain',
        worktreeInfo.path
      );

      if (!statusOutput.trim()) {
        console.log('No changes to commit in worktree');
        return worktreeInfo.commitHash;
      }

      // Commit changes
      await this.executeGitCommand(
        `git commit -m "${fullMessage}"`,
        worktreeInfo.path
      );

      // Get new commit hash
      const { stdout: newCommitHash } = await this.executeGitCommand(
        'git rev-parse HEAD',
        worktreeInfo.path
      );

      return newCommitHash.trim();

    } catch (error) {
      throw new Error(`Failed to commit changes: ${(error as Error).message}`);
    }
  }

  /**
   * Merge worktree changes back to main branch
   */
  public async mergeToMain(worktreeInfo: GitWorktreeInfo): Promise<void> {
    try {
      // Switch to main branch in main repository
      await this.executeGitCommand(`git checkout ${MAIN_BRANCH}`);

      // Merge the agent branch
      await this.executeGitCommand(
        `git merge --no-ff ${worktreeInfo.branch} -m "Merge agent work: ${worktreeInfo.branch}"`
      );

    } catch (error) {
      throw new Error(`Failed to merge to main: ${(error as Error).message}`);
    }
  }

  /**
   * Get status of all active worktrees
   */
  public async getWorktreeStatus(): Promise<WorktreeStatus[]> {
    const status: WorktreeStatus[] = [];

    try {
      const { stdout } = await this.executeGitCommand('git worktree list --porcelain');
      const worktrees = this.parseWorktreeList(stdout);

      for (const worktree of worktrees) {
        if (this.activeWorktrees.has(worktree.name)) {
          const isClean = await this.isWorktreeClean(worktree.path);
          const commits = await this.getCommitCount(worktree.path, worktree.branch);

          status.push({
            name: worktree.name,
            path: worktree.path,
            branch: worktree.branch,
            isClean,
            commitCount: commits,
            isActive: true
          });
        }
      }

    } catch (error) {
      console.warn('Failed to get worktree status:', error);
    }

    return status;
  }

  /**
   * Cleanup all agent worktrees
   */
  public async cleanupAllWorktrees(): Promise<void> {
    const worktrees = await this.getWorktreeStatus();

    for (const worktree of worktrees) {
      if (worktree.name.startsWith(WORKTREE_PREFIX)) {
        try {
          const worktreeInfo: GitWorktreeInfo = {
            path: worktree.path,
            branch: worktree.branch,
            commitHash: '',
            isClean: worktree.isClean
          };

          await this.removeWorktree(worktreeInfo);
        } catch (error) {
          console.warn(`Failed to cleanup worktree ${worktree.name}:`, error);
        }
      }
    }
  }

  /**
   * Private helper methods
   */
  private async ensureWorktreeBaseDirectory(): Promise<void> {
    try {
      await access(this.worktreeBaseDir);
    } catch {
      await mkdir(this.worktreeBaseDir, { recursive: true });
    }
  }

  private async createBranch(branchName: string): Promise<void> {
    try {
      await this.executeGitCommand(`git checkout -b "${branchName}"`);
      await this.executeGitCommand(`git checkout ${MAIN_BRANCH}`);
    } catch (error) {
      // Branch might already exist, try to use it
      try {
        await this.executeGitCommand(`git checkout "${branchName}"`);
        await this.executeGitCommand(`git checkout ${MAIN_BRANCH}`);
      } catch {
        throw new Error(`Failed to create or access branch ${branchName}: ${(error as Error).message}`);
      }
    }
  }

  private async deleteBranch(branchName: string): Promise<void> {
    try {
      await this.executeGitCommand(`git branch -D "${branchName}"`);
    } catch (error) {
      console.warn(`Failed to delete branch ${branchName}:`, error);
    }
  }

  private async executeGitCommand(
    command: string,
    workingDirectory?: string
  ): Promise<{ stdout: string; stderr: string }> {
    const cwd = workingDirectory || this.repositoryRoot;
    return execAsync(command, { cwd });
  }

  private async isWorktreeClean(worktreePath: string): Promise<boolean> {
    try {
      const { stdout } = await this.executeGitCommand(
        'git status --porcelain',
        worktreePath
      );
      return stdout.trim() === '';
    } catch {
      return false;
    }
  }

  private async getCommitCount(
    worktreePath: string,
    branchName: string
  ): Promise<number> {
    try {
      const { stdout } = await this.executeGitCommand(
        `git rev-list --count ${branchName}`,
        worktreePath
      );
      return parseInt(stdout.trim(), 10) || 0;
    } catch {
      return 0;
    }
  }

  private parseWorktreeList(output: string): ParsedWorktree[] {
    const worktrees: ParsedWorktree[] = [];
    const lines = output.split('\n');
    let currentWorktree: Partial<ParsedWorktree> = {};

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        if (currentWorktree.path) {
          worktrees.push(currentWorktree as ParsedWorktree);
          currentWorktree = {};
        }
        continue;
      }

      if (trimmedLine.startsWith('worktree ')) {
        currentWorktree.path = trimmedLine.substring(9);
        currentWorktree.name = currentWorktree.path.split('/').pop() || '';
      } else if (trimmedLine.startsWith('branch ')) {
        currentWorktree.branch = trimmedLine.substring(7);
      }
    }

    // Add the last worktree if it exists
    if (currentWorktree.path) {
      worktrees.push(currentWorktree as ParsedWorktree);
    }

    return worktrees;
  }

  private async cleanupWorktreeOnError(
    worktreePath: string,
    branchName: string
  ): Promise<void> {
    try {
      // Try to remove worktree directory
      await rm(worktreePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    try {
      // Try to delete branch
      await this.deleteBranch(branchName);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Supporting interfaces with proper naming
 */
export interface WorktreeStatus {
  readonly name: string;
  readonly path: string;
  readonly branch: string;
  readonly isClean: boolean;
  readonly commitCount: number;
  readonly isActive: boolean;
}

interface ParsedWorktree {
  name: string;
  path: string;
  branch: string;
}