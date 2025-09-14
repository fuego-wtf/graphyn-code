/**
 * Claude Prompt Builder
 * 
 * Builds sophisticated prompts for agent sessions with context and tasks
 * Integrates with the orchestration system for multi-agent coordination
 */

import fs from 'fs';
import path from 'path';
import { TaskExecution, AgentType } from '../orchestrator/types';

export interface PromptContext {
  type: 'file' | 'directory' | 'text' | 'url' | 'data';
  source: string;
  content?: string;
  metadata?: Record<string, any>;
}

export interface PromptTask {
  id: string;
  description: string;
  priority: number;
  dependencies: string[];
  expectedOutput: string;
  context: string[];
  estimatedDuration?: number;
}

export interface AgentPromptConfig {
  role: AgentType;
  expertise: string[];
  constraints: string[];
  outputFormat: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Claude Prompt Builder for Agent Sessions
 */
export class ClaudePromptBuilder {
  private contexts: Map<string, PromptContext> = new Map();
  private tasks: PromptTask[] = [];
  private agentConfig?: AgentPromptConfig;

  constructor(agentConfig?: AgentPromptConfig) {
    this.agentConfig = agentConfig;
  }

  /**
   * Build comprehensive agent prompt
   */
  buildAgentPrompt(): string {
    const sections: string[] = [];
    
    // Add role and expertise section
    if (this.agentConfig) {
      sections.push(this.buildRoleSection());
    }
    
    // Add context section
    if (this.contexts.size > 0) {
      sections.push(this.buildContextSection());
    }
    
    // Add tasks section
    if (this.tasks.length > 0) {
      sections.push(this.buildTasksSection());
    }
    
    // Add instructions and constraints
    sections.push(this.buildInstructionsSection());
    
    return sections.join('\n\n');
  }

  /**
   * Add context from various sources
   */
  addContext(type: PromptContext['type'], source: string, content?: string, metadata?: Record<string, any>): void {
    const contextId = `${type}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    
    let processedContent = content;
    
    // Auto-load content for files and directories
    if (type === 'file' && !content) {
      processedContent = this.loadFileContent(source);
    } else if (type === 'directory' && !content) {
      processedContent = this.loadDirectoryContent(source);
    }
    
    this.contexts.set(contextId, {
      type,
      source,
      content: processedContent,
      metadata
    });
  }

  /**
   * Add task to the prompt
   */
  addTask(task: PromptTask | TaskExecution): void {
    let promptTask: PromptTask;
    
    // Convert TaskExecution to PromptTask if needed
    if ('status' in task) {
      promptTask = {
        id: task.id,
        description: task.description || 'No description provided',
        priority: task.priority || 1,
        dependencies: task.dependencies ? Array.from(task.dependencies) : [],
        expectedOutput: 'Complete the task successfully',
        context: task.tags ? Array.from(task.tags) : [],
        estimatedDuration: task.estimatedDuration
      };
    } else {
      promptTask = task as PromptTask;
    }
    
    this.tasks.push(promptTask);
  }

  /**
   * Build role and expertise section
   */
  private buildRoleSection(): string {
    if (!this.agentConfig) return '';
    
    const { role, expertise, constraints } = this.agentConfig;
    
    const sections = [
      `# Agent Role: ${role}`,
      '',
      'You are a specialized AI agent with the following expertise:',
      ...expertise.map(skill => `- ${skill}`),
    ];
    
    if (constraints.length > 0) {
      sections.push('');
      sections.push('## Constraints:');
      sections.push(...constraints.map(constraint => `- ${constraint}`));
    }
    
    return sections.join('\n');
  }

  /**
   * Build context section
   */
  private buildContextSection(): string {
    const sections = [
      '# Context Information',
      '',
      'The following context is provided for your tasks:'
    ];
    
    let contextIndex = 1;
    for (const [contextId, context] of this.contexts) {
      sections.push('');
      sections.push(`## Context ${contextIndex}: ${context.type.toUpperCase()}`);
      sections.push(`Source: ${context.source}`);
      
      if (context.metadata) {
        sections.push(`Metadata: ${JSON.stringify(context.metadata, null, 2)}`);
      }
      
      if (context.content) {
        sections.push('');
        sections.push('```');
        sections.push(context.content);
        sections.push('```');
      }
      
      contextIndex++;
    }
    
    return sections.join('\n');
  }

  /**
   * Build tasks section
   */
  private buildTasksSection(): string {
    const sections = [
      '# Tasks to Complete',
      '',
      `You have ${this.tasks.length} task${this.tasks.length > 1 ? 's' : ''} to complete:`
    ];
    
    // Sort tasks by priority
    const sortedTasks = [...this.tasks].sort((a, b) => b.priority - a.priority);
    
    sortedTasks.forEach((task, index) => {
      sections.push('');
      sections.push(`## Task ${index + 1}: ${task.id}`);
      sections.push(`**Description:** ${task.description}`);
      sections.push(`**Priority:** ${task.priority}/10`);
      sections.push(`**Expected Output:** ${task.expectedOutput}`);
      
      if (task.dependencies.length > 0) {
        sections.push(`**Dependencies:** ${task.dependencies.join(', ')}`);
      }
      
      if (task.context.length > 0) {
        sections.push(`**Required Context:** ${task.context.join(', ')}`);
      }
      
      if (task.estimatedDuration) {
        sections.push(`**Estimated Duration:** ${task.estimatedDuration} seconds`);
      }
    });
    
    // Add task sequencing guidance
    if (sortedTasks.length > 1) {
      sections.push('');
      sections.push('### Task Execution Order:');
      sections.push('Complete tasks in priority order, respecting dependencies.');
      
      const hasBlocking = sortedTasks.some(task => task.dependencies.length > 0);
      if (hasBlocking) {
        sections.push('Some tasks have dependencies - ensure prerequisites are completed first.');
      }
    }
    
    return sections.join('\n');
  }

  /**
   * Build instructions and constraints section
   */
  private buildInstructionsSection(): string {
    const sections = [
      '# Instructions',
      '',
      'Please follow these guidelines:',
      '',
      '1. **Quality First:** Ensure all work meets high standards',
      '2. **Context Aware:** Use provided context to inform your decisions', 
      '3. **Task Focus:** Complete each task thoroughly before moving to the next',
      '4. **Communication:** Explain your reasoning and approach',
      '5. **Error Handling:** Report issues clearly and suggest alternatives'
    ];
    
    if (this.agentConfig?.outputFormat) {
      sections.push('');
      sections.push(`## Output Format:`);
      sections.push(this.agentConfig.outputFormat);
    }
    
    // Add coordination instructions for multi-agent scenarios
    if (this.tasks.length > 1 || this.hasMultiAgentTasks()) {
      sections.push('');
      sections.push('## Multi-Agent Coordination:');
      sections.push('- Share progress updates for dependent tasks');
      sections.push('- Communicate blockers or issues immediately');
      sections.push('- Coordinate with other agents through the orchestration system');
    }
    
    return sections.join('\n');
  }

  /**
   * Load file content safely
   */
  private loadFileContent(filePath: string): string {
    try {
      if (!fs.existsSync(filePath)) {
        return `File not found: ${filePath}`;
      }
      
      const stats = fs.statSync(filePath);
      if (stats.size > 1024 * 1024) { // 1MB limit
        return `File too large: ${filePath} (${Math.round(stats.size / 1024)}KB)`;
      }
      
      return fs.readFileSync(filePath, 'utf8');
    } catch (error: any) {
      return `Error reading file ${filePath}: ${error.message}`;
    }
  }

  /**
   * Load directory content (file listing)
   */
  private loadDirectoryContent(dirPath: string): string {
    try {
      if (!fs.existsSync(dirPath)) {
        return `Directory not found: ${dirPath}`;
      }
      
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      const listing = files.map(file => {
        const type = file.isDirectory() ? 'DIR' : 
                    file.isFile() ? 'FILE' : 'OTHER';
        return `${type}  ${file.name}`;
      });
      
      return `Directory listing for ${dirPath}:\n${listing.join('\n')}`;
    } catch (error: any) {
      return `Error reading directory ${dirPath}: ${error.message}`;
    }
  }

  /**
   * Check if tasks involve multiple agents
   */
  private hasMultiAgentTasks(): boolean {
    return this.tasks.some(task => task.dependencies.length > 0);
  }

  /**
   * Add repository context automatically
   */
  addRepositoryContext(repoPath: string): void {
    // Add package.json if exists
    const packageJsonPath = path.join(repoPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      this.addContext('file', packageJsonPath, undefined, { type: 'package-config' });
    }
    
    // Add README if exists
    const readmeVariants = ['README.md', 'README.txt', 'README'];
    for (const readme of readmeVariants) {
      const readmePath = path.join(repoPath, readme);
      if (fs.existsSync(readmePath)) {
        this.addContext('file', readmePath, undefined, { type: 'documentation' });
        break;
      }
    }
    
    // Add .gitignore for project understanding
    const gitignorePath = path.join(repoPath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      this.addContext('file', gitignorePath, undefined, { type: 'config' });
    }
    
    // Add directory structure (top level only)
    this.addContext('directory', repoPath, undefined, { type: 'project-structure' });
  }

  /**
   * Add agent coordination context
   */
  addCoordinationContext(agentRoles: AgentType[], currentRole: AgentType): void {
    const coordinationInfo = [
      `Current Agent Role: ${currentRole}`,
      `Other Active Agents: ${agentRoles.filter(role => role !== currentRole).join(', ')}`,
      '',
      'Coordination Guidelines:',
      '- Communicate through task updates and progress reports',
      '- Respect other agents\' expertise domains',
      '- Share relevant findings that may impact other agents\' work',
      '- Request assistance when encountering blockers outside your expertise'
    ].join('\n');
    
    this.addContext('text', 'agent-coordination', coordinationInfo, { 
      type: 'coordination',
      agentCount: agentRoles.length 
    });
  }

  /**
   * Generate task-specific prompt for individual task execution
   */
  buildTaskPrompt(taskId: string): string {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    const sections = [
      `# Task Execution: ${task.id}`,
      '',
      `**Description:** ${task.description}`,
      `**Priority:** ${task.priority}/10`,
      `**Expected Output:** ${task.expectedOutput}`
    ];
    
    if (task.dependencies.length > 0) {
      sections.push(`**Dependencies:** ${task.dependencies.join(', ')}`);
      sections.push('**Note:** Ensure all dependencies are completed before proceeding.');
    }
    
    // Add relevant context
    const relevantContexts = Array.from(this.contexts.values())
      .filter(context => 
        task.context.includes(context.source) || 
        task.context.some(req => context.source.includes(req))
      );
    
    if (relevantContexts.length > 0) {
      sections.push('');
      sections.push('## Relevant Context:');
      
      relevantContexts.forEach((context, index) => {
        sections.push('');
        sections.push(`### Context ${index + 1}: ${context.source}`);
        if (context.content) {
          sections.push('```');
          sections.push(context.content);
          sections.push('```');
        }
      });
    }
    
    sections.push('');
    sections.push('## Instructions:');
    sections.push('1. Focus solely on this task');
    sections.push('2. Use the provided context to inform your approach');
    sections.push('3. Deliver the expected output format');
    sections.push('4. Report completion status clearly');
    
    return sections.join('\n');
  }

  /**
   * Clear all contexts and tasks
   */
  clear(): void {
    this.contexts.clear();
    this.tasks = [];
  }

  /**
   * Get summary of current prompt configuration
   */
  getSummary(): {
    role?: string;
    contextCount: number;
    taskCount: number;
    totalEstimatedDuration: number;
  } {
    const totalDuration = this.tasks.reduce((sum, task) => 
      sum + (task.estimatedDuration || 0), 0
    );
    
    return {
      role: this.agentConfig?.role,
      contextCount: this.contexts.size,
      taskCount: this.tasks.length,
      totalEstimatedDuration: totalDuration
    };
  }
}