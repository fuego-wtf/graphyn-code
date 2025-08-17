/**
 * Agent File Generator for Multi-Claude Orchestration
 * 
 * Generates minimal .claude/agents/*.md files based on backend /ask responses.
 * Each agent gets a focused task with clear context and dependencies.
 */

import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  successCriteria: string[];
  dependencies?: string[];
  tools?: string[];
  context?: Record<string, any>;
}

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  model?: string;
  tasks: AgentTask[];
  prompt?: string;
  dependencies?: string[];
  mcpTools?: string[];
}

export interface AgentFileGeneratorOptions {
  projectRoot?: string;
  userInstructions?: string;
  repositoryContext?: {
    name?: string;
    frameworks?: string[];
    language?: string;
    database?: string;
  };
}

export class AgentFileGenerator {
  private projectRoot: string;
  private claudeDir: string;
  private agentsDir: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.claudeDir = path.join(this.projectRoot, '.claude');
    this.agentsDir = path.join(this.claudeDir, 'agents');
  }

  /**
   * Generate agent files from backend response
   */
  async generateAgentFiles(
    agents: AgentConfig[],
    options: AgentFileGeneratorOptions = {}
  ): Promise<string[]> {
    // Ensure directories exist
    await this.ensureDirectories();

    const generatedFiles: string[] = [];

    for (const agent of agents) {
      const filePath = await this.generateAgentFile(agent, options);
      generatedFiles.push(filePath);
    }

    return generatedFiles;
  }

  /**
   * Generate a single agent file
   */
  private async generateAgentFile(
    agent: AgentConfig,
    options: AgentFileGeneratorOptions
  ): Promise<string> {
    const filename = `${agent.id}.md`;
    const filePath = path.join(this.agentsDir, filename);

    const content = this.buildAgentMarkdown(agent, options);
    await fs.writeFile(filePath, content, 'utf-8');

    return filePath;
  }

  /**
   * Build the markdown content for an agent
   */
  private buildAgentMarkdown(
    agent: AgentConfig,
    options: AgentFileGeneratorOptions
  ): string {
    const lines: string[] = [];

    // Frontmatter
    lines.push('---');
    lines.push(`name: ${agent.id}`);
    lines.push(`role: ${agent.role}`);
    if (agent.model) {
      lines.push(`model: ${agent.model}`);
    }
    lines.push('---');
    lines.push('');

    // Agent role description
    lines.push(`# ${agent.name}`);
    lines.push('');
    lines.push(`You are ${agent.role}.`);
    lines.push('');

    // Current tasks (MINIMAL - just what they need to do NOW)
    if (agent.tasks.length > 0) {
      lines.push('## Your Current Task');
      lines.push('');
      
      // Focus on the FIRST task (agents work sequentially)
      const currentTask = agent.tasks[0];
      lines.push(`**${currentTask.title}**`);
      lines.push('');
      if (currentTask.description) {
        lines.push(currentTask.description);
        lines.push('');
      }

      // Success criteria
      if (currentTask.successCriteria && currentTask.successCriteria.length > 0) {
        lines.push('### Success Criteria');
        currentTask.successCriteria.forEach(criterion => {
          lines.push(`- [ ] ${criterion}`);
        });
        lines.push('');
      }

      // Show other tasks as "upcoming" (for context)
      if (agent.tasks.length > 1) {
        lines.push('### Upcoming Tasks');
        agent.tasks.slice(1).forEach(task => {
          lines.push(`- ${task.title}`);
        });
        lines.push('');
      }
    }

    // Repository context (if provided)
    if (options.repositoryContext) {
      lines.push('## Repository Context');
      lines.push('');
      const ctx = options.repositoryContext;
      
      if (ctx.name) {
        lines.push(`- **Project**: ${ctx.name}`);
      }
      if (ctx.frameworks && ctx.frameworks.length > 0) {
        lines.push(`- **Frameworks**: ${ctx.frameworks.join(', ')}`);
      }
      if (ctx.language) {
        lines.push(`- **Language**: ${ctx.language}`);
      }
      if (ctx.database) {
        lines.push(`- **Database**: ${ctx.database}`);
      }
      lines.push('');
    }

    // MCP Tools available
    if (agent.mcpTools && agent.mcpTools.length > 0) {
      lines.push('## Available MCP Tools');
      lines.push('');
      agent.mcpTools.forEach(tool => {
        lines.push(`- **${tool}**: ${this.getToolDescription(tool)}`);
      });
      lines.push('');
    }

    // Dependencies on other agents
    if (agent.dependencies && agent.dependencies.length > 0) {
      lines.push('## Dependencies');
      lines.push('');
      lines.push('Wait for the following agents to complete their tasks:');
      agent.dependencies.forEach(dep => {
        lines.push(`- ${dep}`);
      });
      lines.push('');
    }

    // User instructions (if any)
    if (options.userInstructions) {
      lines.push('## Additional Instructions from User');
      lines.push('');
      lines.push(options.userInstructions);
      lines.push('');
    }

    // Important reminders
    lines.push('## Important');
    lines.push('');
    lines.push('- Focus on your current task only');
    lines.push('- Coordinate with other agents via shared state');
    lines.push('- Test your changes before marking complete');
    lines.push('- Follow the existing code style and conventions');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Get description for MCP tools
   */
  private getToolDescription(tool: string): string {
    const descriptions: Record<string, string> = {
      'filesystem': 'Read and write project files',
      'github': 'Git operations and GitHub API access',
      'graphyn-mcp': 'Graphyn platform APIs and coordination',
      'postgres-mcp': 'PostgreSQL database operations',
      'docker-mcp': 'Docker container management',
      'figma-mcp': 'Figma design extraction',
      'next-mcp': 'Next.js specific tools',
      'python-mcp': 'Python environment tools',
    };

    return descriptions[tool] || 'Tool for specific operations';
  }

  /**
   * Ensure .claude/agents/ directories exist
   */
  private async ensureDirectories(): Promise<void> {
    if (!existsSync(this.claudeDir)) {
      await fs.mkdir(this.claudeDir, { recursive: true });
    }
    if (!existsSync(this.agentsDir)) {
      await fs.mkdir(this.agentsDir, { recursive: true });
    }
  }

  /**
   * Clean up old agent files
   */
  async cleanupOldAgents(): Promise<void> {
    if (existsSync(this.agentsDir)) {
      const files = await fs.readdir(this.agentsDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          await fs.unlink(path.join(this.agentsDir, file));
        }
      }
    }
  }

  /**
   * Read existing agent files
   */
  async readAgentFiles(): Promise<Map<string, string>> {
    const agents = new Map<string, string>();
    
    if (!existsSync(this.agentsDir)) {
      return agents;
    }

    const files = await fs.readdir(this.agentsDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const content = await fs.readFile(
          path.join(this.agentsDir, file),
          'utf-8'
        );
        const agentId = path.basename(file, '.md');
        agents.set(agentId, content);
      }
    }

    return agents;
  }

  /**
   * Update a specific agent's task
   */
  async updateAgentTask(
    agentId: string,
    task: AgentTask,
    markCurrentComplete: boolean = false
  ): Promise<void> {
    const filePath = path.join(this.agentsDir, `${agentId}.md`);
    
    if (!existsSync(filePath)) {
      throw new Error(`Agent file not found: ${agentId}.md`);
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Find and update the current task section
    const taskStartIndex = lines.findIndex(line => line === '## Your Current Task');
    
    if (taskStartIndex === -1) {
      throw new Error('Could not find task section in agent file');
    }

    // If marking current as complete, move to next task
    if (markCurrentComplete) {
      // This would be more complex - tracking completed tasks
      // For now, just replace the current task
    }

    // Find the end of the current task section
    let taskEndIndex = taskStartIndex + 1;
    while (taskEndIndex < lines.length && !lines[taskEndIndex].startsWith('##')) {
      taskEndIndex++;
    }

    // Build new task content
    const newTaskLines: string[] = [
      '## Your Current Task',
      '',
      `**${task.title}**`,
      '',
    ];

    if (task.description) {
      newTaskLines.push(task.description);
      newTaskLines.push('');
    }

    if (task.successCriteria && task.successCriteria.length > 0) {
      newTaskLines.push('### Success Criteria');
      task.successCriteria.forEach(criterion => {
        newTaskLines.push(`- [ ] ${criterion}`);
      });
      newTaskLines.push('');
    }

    // Replace the task section
    lines.splice(
      taskStartIndex,
      taskEndIndex - taskStartIndex,
      ...newTaskLines
    );

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
  }
}

export default AgentFileGenerator;