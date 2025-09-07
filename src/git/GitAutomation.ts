/**
 * Git Automation System
 * 
 * Automates Git operations for agent-driven development
 * Includes branch creation, commits, and PR management
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export interface GitConfig {
  repoPath: string;
  defaultBranch: string;
  commitPrefix?: string;
  enableAutoCommit: boolean;
  enableAutoPR: boolean;
}

export interface BranchInfo {
  name: string;
  created: boolean;
  baseBranch: string;
  commitCount: number;
}

export interface CommitInfo {
  hash: string;
  message: string;
  timestamp: string;
  files: string[];
}

export interface PRInfo {
  number: number;
  url: string;
  title: string;
  description: string;
  branch: string;
  baseBranch: string;
}

/**
 * Git Automation for Agent Workflows
 */
export class GitAutomation {
  private config: GitConfig;

  constructor(config: GitConfig) {
    this.config = config;
  }

  /**
   * Create new branch for agent work
   */
  async createBranch(branchName: string, baseBranch?: string): Promise<BranchInfo> {
    const base = baseBranch || this.config.defaultBranch;
    
    try {
      // Ensure we're on the base branch and it's up to date
      await this.checkoutBranch(base);
      await this.pullBranch(base);
      
      // Create new branch
      await execAsync(`git checkout -b ${branchName}`, { cwd: this.config.repoPath });
      
      // Get commit count
      const { stdout } = await execAsync(`git rev-list --count HEAD`, { cwd: this.config.repoPath });
      const commitCount = parseInt(stdout.trim());
      
      console.log(`✅ Created branch: ${branchName} (from ${base})`);
      
      return {
        name: branchName,
        created: true,
        baseBranch: base,
        commitCount
      };
      
    } catch (error: any) {
      throw new Error(`Failed to create branch ${branchName}: ${error.message}`);
    }
  }

  /**
   * Commit changes with automated message generation
   */
  async commitChanges(
    files: string[], 
    message: string, 
    description?: string
  ): Promise<CommitInfo> {
    try {
      // Add files
      if (files.length === 0) {
        // Stage all changes if no specific files provided
        await execAsync(`git add .`, { cwd: this.config.repoPath });
      } else {
        for (const file of files) {
          await execAsync(`git add "${file}"`, { cwd: this.config.repoPath });
        }
      }
      
      // Check if there are changes to commit
      const { stdout: status } = await execAsync(`git status --porcelain --cached`, { 
        cwd: this.config.repoPath 
      });
      
      if (!status.trim()) {
        throw new Error('No changes to commit');
      }
      
      // Build commit message
      const fullMessage = this.buildCommitMessage(message, description);
      
      // Commit
      await execAsync(`git commit -m "${fullMessage}"`, { cwd: this.config.repoPath });
      
      // Get commit info
      const { stdout: hashOutput } = await execAsync(`git rev-parse HEAD`, { 
        cwd: this.config.repoPath 
      });
      const hash = hashOutput.trim();
      
      // Get commit timestamp
      const { stdout: timestampOutput } = await execAsync(
        `git show -s --format=%ci ${hash}`, 
        { cwd: this.config.repoPath }
      );
      
      // Get changed files in this commit
      const { stdout: filesOutput } = await execAsync(
        `git show --name-only --format="" ${hash}`, 
        { cwd: this.config.repoPath }
      );
      const changedFiles = filesOutput.trim().split('\n').filter(f => f);
      
      console.log(`✅ Committed changes: ${hash.substring(0, 8)} - ${message}`);
      console.log(`   Files: ${changedFiles.join(', ')}`);
      
      return {
        hash,
        message: fullMessage,
        timestamp: timestampOutput.trim(),
        files: changedFiles
      };
      
    } catch (error: any) {
      throw new Error(`Failed to commit changes: ${error.message}`);
    }
  }

  /**
   * Create pull request
   */
  async createPR(
    title: string,
    description: string,
    baseBranch?: string,
    labels?: string[]
  ): Promise<PRInfo> {
    const base = baseBranch || this.config.defaultBranch;
    
    try {
      // Get current branch
      const { stdout: currentBranch } = await execAsync(
        `git branch --show-current`, 
        { cwd: this.config.repoPath }
      );
      const branch = currentBranch.trim();
      
      // Push current branch
      await execAsync(`git push -u origin ${branch}`, { cwd: this.config.repoPath });
      
      // Build GitHub CLI command
      let ghCommand = `gh pr create --title "${title}" --body "${description}" --base ${base}`;
      
      if (labels && labels.length > 0) {
        ghCommand += ` --label "${labels.join(',')}"`;
      }
      
      // Create PR using GitHub CLI
      const { stdout: prOutput } = await execAsync(ghCommand, { cwd: this.config.repoPath });
      
      // Extract PR URL from output
      const prUrlMatch = prOutput.match(/https:\/\/github\.com\/[^\s]+/);
      const prUrl = prUrlMatch ? prUrlMatch[0] : '';
      
      // Extract PR number from URL
      const prNumberMatch = prUrl.match(/\/pull\/(\d+)/);
      const prNumber = prNumberMatch ? parseInt(prNumberMatch[1]) : 0;
      
      console.log(`✅ Created PR #${prNumber}: ${title}`);
      console.log(`   URL: ${prUrl}`);
      
      return {
        number: prNumber,
        url: prUrl,
        title,
        description,
        branch,
        baseBranch: base
      };
      
    } catch (error: any) {
      throw new Error(`Failed to create PR: ${error.message}`);
    }
  }

  /**
   * Check repository status
   */
  async getStatus(): Promise<{
    branch: string;
    staged: string[];
    unstaged: string[];
    untracked: string[];
    ahead: number;
    behind: number;
  }> {
    try {
      // Get current branch
      const { stdout: branchOutput } = await execAsync(
        `git branch --show-current`, 
        { cwd: this.config.repoPath }
      );
      const branch = branchOutput.trim();
      
      // Get status
      const { stdout: statusOutput } = await execAsync(
        `git status --porcelain`, 
        { cwd: this.config.repoPath }
      );
      
      const staged: string[] = [];
      const unstaged: string[] = [];
      const untracked: string[] = [];
      
      statusOutput.split('\n').forEach(line => {
        if (!line.trim()) return;
        
        const status = line.substring(0, 2);
        const file = line.substring(3);
        
        if (status[0] !== ' ' && status[0] !== '?') {
          staged.push(file);
        }
        if (status[1] !== ' ' && status[1] !== '?') {
          unstaged.push(file);
        }
        if (status === '??') {
          untracked.push(file);
        }
      });
      
      // Get ahead/behind info
      let ahead = 0;
      let behind = 0;
      
      try {
        const { stdout: aheadBehind } = await execAsync(
          `git status --porcelain -b`, 
          { cwd: this.config.repoPath }
        );
        
        const branchLine = aheadBehind.split('\n')[0];
        const aheadMatch = branchLine.match(/ahead (\d+)/);
        const behindMatch = branchLine.match(/behind (\d+)/);
        
        if (aheadMatch) ahead = parseInt(aheadMatch[1]);
        if (behindMatch) behind = parseInt(behindMatch[1]);
      } catch (error) {
        // Ignore errors getting ahead/behind info
      }
      
      return {
        branch,
        staged,
        unstaged,
        untracked,
        ahead,
        behind
      };
      
    } catch (error: any) {
      throw new Error(`Failed to get git status: ${error.message}`);
    }
  }

  /**
   * Generate automated commit message
   */
  private buildCommitMessage(message: string, description?: string): string {
    let fullMessage = message;
    
    if (this.config.commitPrefix) {
      fullMessage = `${this.config.commitPrefix}: ${message}`;
    }
    
    if (description) {
      fullMessage += `\n\n${description}`;
    }
    
    return fullMessage;
  }

  /**
   * Checkout branch
   */
  private async checkoutBranch(branchName: string): Promise<void> {
    try {
      await execAsync(`git checkout ${branchName}`, { cwd: this.config.repoPath });
    } catch (error: any) {
      throw new Error(`Failed to checkout branch ${branchName}: ${error.message}`);
    }
  }

  /**
   * Pull latest changes
   */
  private async pullBranch(branchName: string): Promise<void> {
    try {
      await execAsync(`git pull origin ${branchName}`, { cwd: this.config.repoPath });
    } catch (error: any) {
      // Don't throw on pull errors - branch might not exist on remote yet
      console.warn(`Warning: Could not pull ${branchName}: ${error.message}`);
    }
  }

  /**
   * Check if repository is clean
   */
  async isClean(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`git status --porcelain`, { 
        cwd: this.config.repoPath 
      });
      return stdout.trim() === '';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync(`git branch --show-current`, { 
        cwd: this.config.repoPath 
      });
      return stdout.trim();
    } catch (error: any) {
      throw new Error(`Failed to get current branch: ${error.message}`);
    }
  }

  /**
   * Check if branch exists
   */
  async branchExists(branchName: string): Promise<boolean> {
    try {
      await execAsync(`git show-ref --verify --quiet refs/heads/${branchName}`, { 
        cwd: this.config.repoPath 
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete branch
   */
  async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
    try {
      const flag = force ? '-D' : '-d';
      await execAsync(`git branch ${flag} ${branchName}`, { cwd: this.config.repoPath });
      console.log(`✅ Deleted branch: ${branchName}`);
    } catch (error: any) {
      throw new Error(`Failed to delete branch ${branchName}: ${error.message}`);
    }
  }

  /**
   * Generate branch name from task
   */
  generateBranchName(taskId: string, description: string, agentRole?: string): string {
    // Sanitize description for branch name
    const sanitizedDesc = description
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);
    
    const parts = [taskId, sanitizedDesc];
    
    if (agentRole) {
      parts.unshift(agentRole.toLowerCase());
    }
    
    return parts.join('-');
  }

  /**
   * Get commit history for current branch
   */
  async getCommitHistory(limit: number = 10): Promise<CommitInfo[]> {
    try {
      const { stdout } = await execAsync(
        `git log --oneline -n ${limit} --format="%H|%s|%ci"`, 
        { cwd: this.config.repoPath }
      );
      
      return stdout.trim().split('\n').map(line => {
        const [hash, message, timestamp] = line.split('|');
        return {
          hash,
          message,
          timestamp,
          files: [] // Would need separate call to get files per commit
        };
      });
      
    } catch (error: any) {
      throw new Error(`Failed to get commit history: ${error.message}`);
    }
  }

  /**
   * Stash current changes
   */
  async stashChanges(message?: string): Promise<void> {
    try {
      const stashMessage = message || `Auto-stash at ${new Date().toISOString()}`;
      await execAsync(`git stash push -m "${stashMessage}"`, { cwd: this.config.repoPath });
      console.log(`✅ Stashed changes: ${stashMessage}`);
    } catch (error: any) {
      throw new Error(`Failed to stash changes: ${error.message}`);
    }
  }

  /**
   * Pop stashed changes
   */
  async popStash(): Promise<void> {
    try {
      await execAsync(`git stash pop`, { cwd: this.config.repoPath });
      console.log(`✅ Popped stashed changes`);
    } catch (error: any) {
      throw new Error(`Failed to pop stash: ${error.message}`);
    }
  }
}