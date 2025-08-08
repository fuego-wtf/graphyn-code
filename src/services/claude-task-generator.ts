import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { TaskPromptBuilder } from './task-prompt-builder.js';
import { ClaudeOutputParser } from './claude-output-parser.js';
import { detectClaude } from '../utils/claude-detector.js';
import type { AgentConfig } from '../types/agent.js';
import chalk from 'chalk';

export interface Task {
  id: string;
  title: string;
  description: string;
  assigned_agent: string;
  assigned_agent_id?: string;
  dependencies: string[];
  estimated_complexity: 'low' | 'medium' | 'high';
  acceptance_criteria: string[];
  status?: 'pending' | 'in_progress' | 'completed';
}

export interface RepositoryContext {
  framework?: string;
  language?: string;
  dependencies?: Record<string, string>;
  detected_stack?: string[];
  patterns?: string[];
  structure?: {
    hasTests?: boolean;
    hasCI?: boolean;
    hasDocs?: boolean;
  };
}

export interface TaskGenerationParams {
  userQuery: string;
  agents: AgentConfig[];
  repoContext: RepositoryContext;
}

export class ClaudeTaskGenerator {
  private promptBuilder: TaskPromptBuilder;
  private outputParser: ClaudeOutputParser;

  constructor() {
    this.promptBuilder = new TaskPromptBuilder();
    this.outputParser = new ClaudeOutputParser();
  }

  async generateTasks(params: TaskGenerationParams): Promise<Task[]> {
    console.log(chalk.gray('📝 Building task generation prompt...'));
    
    // Build the prompt
    const prompt = this.promptBuilder.buildPrompt(params);
    
    // Check if Claude is available - try to use it directly first
    let claudePath = 'claude';
    
    try {
      // Try using claude directly (it might be in PATH)
      await this.testClaude(claudePath);
    } catch {
      // If that fails, check known installation paths
      const knownPaths = [
        `${process.env.HOME}/.claude/local/claude`,
        '/usr/local/bin/claude',
        '/usr/bin/claude',
        `${process.env.HOME}/.local/bin/claude`,
        '/opt/claude/bin/claude'
      ];
      
      let found = false;
      for (const path of knownPaths) {
        try {
          await this.testClaude(path);
          claudePath = path;
          found = true;
          break;
        } catch {
          // Continue checking
        }
      }
      
      if (!found) {
        throw new Error('Claude Code is not installed or not found in PATH. Please install it first.');
      }
    }
    
    console.log(chalk.gray('🤖 Calling Claude to generate tasks...'));
    
    // Call Claude
    const claudeOutput = await this.callClaude(prompt, claudePath);
    
    console.log(chalk.gray('📊 Parsing Claude response...'));
    
    try {
      // Parse the output
      const tasks = this.outputParser.parseTasks(claudeOutput, params.agents);
      
      console.log(chalk.green(`✓ Generated ${tasks.length} tasks`));
      
      return tasks;
    } catch (error) {
      console.error(chalk.red('❌ Failed to parse Claude\'s task output'));
      console.error(chalk.gray('This usually means Claude didn\'t return properly formatted JSON.'));
      console.error(chalk.gray('Please try again or check Claude\'s response format.'));
      throw error;
    }
  }

  private async callClaude(prompt: string, claudePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';
      
      // Write prompt to a temporary file to avoid shell escaping issues
      const tempFile = join(tmpdir(), `claude-prompt-${Date.now()}.txt`);
      try {
        writeFileSync(tempFile, prompt, 'utf-8');
      } catch (err) {
        reject(new Error(`Failed to write prompt to temp file: ${err}`));
        return;
      }
      
      // Read prompt from file and pass to Claude with proper flags
      const promptContent = `cat ${tempFile}`;
      
      // Spawn Claude process with print flag and json output
      const claude = spawn('/bin/sh', ['-c', `cat "${tempFile}" | "${claudePath}" --print --output-format json`], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
        }
      });
      
      // Capture stdout
      claude.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      // Capture stderr
      claude.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      // Handle process exit
      claude.on('close', (code) => {
        // Clean up temp file
        try {
          unlinkSync(tempFile);
        } catch (err) {
          // Ignore cleanup errors
        }
        
        if (code !== 0) {
          reject(new Error(`Claude process exited with code ${code}: ${errorOutput}`));
        } else {
          resolve(output);
        }
      });
      
      // Handle process error
      claude.on('error', (err) => {
        // Clean up temp file
        try {
          unlinkSync(tempFile);
        } catch (err) {
          // Ignore cleanup errors
        }
        reject(new Error(`Failed to spawn Claude: ${err.message}`));
      });
      
      // Set timeout - increased to 5 minutes for complex task generation
      setTimeout(() => {
        // Clean up temp file
        try {
          unlinkSync(tempFile);
        } catch (err) {
          // Ignore cleanup errors
        }
        claude.kill();
        reject(new Error('Claude task generation timed out after 5 minutes'));
      }, 300000);
    });
  }

  private async testClaude(claudePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const test = spawn(claudePath, ['--version'], {
        stdio: 'pipe'
      });
      
      test.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Claude test failed with code ${code}`));
        }
      });
      
      test.on('error', () => {
        reject(new Error('Failed to spawn Claude'));
      });
      
      // Quick timeout for testing
      setTimeout(() => {
        test.kill();
        reject(new Error('Claude test timed out'));
      }, 5000);
    });
  }

  async regenerateTasks(params: TaskGenerationParams, feedback?: string): Promise<Task[]> {
    console.log(chalk.gray('🔄 Regenerating tasks with feedback...'));
    
    // Modify the prompt to include feedback
    const modifiedParams = {
      ...params,
      userQuery: feedback 
        ? `${params.userQuery}\n\nAdditional requirements based on feedback: ${feedback}`
        : params.userQuery
    };
    
    return this.generateTasks(modifiedParams);
  }

  async validateTasks(tasks: Task[], agents: AgentConfig[]): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const agentNames = agents.map(a => a.name.toLowerCase());
    
    for (const task of tasks) {
      // Check if assigned agent exists
      if (!agentNames.includes(task.assigned_agent.toLowerCase())) {
        errors.push(`Task "${task.title}" assigned to unknown agent "${task.assigned_agent}"`);
      }
      
      // Check for circular dependencies
      if (task.dependencies.includes(task.id)) {
        errors.push(`Task "${task.title}" has circular dependency on itself`);
      }
      
      // Check if dependencies exist
      const taskIds = tasks.map(t => t.id);
      for (const dep of task.dependencies) {
        if (!taskIds.includes(dep)) {
          errors.push(`Task "${task.title}" depends on unknown task "${dep}"`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}