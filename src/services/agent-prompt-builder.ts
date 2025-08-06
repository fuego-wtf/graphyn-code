import type { Task } from './claude-task-generator.js';
import type { AgentConfig } from './squad-storage.js';
import type { RepositoryContext } from './claude-task-generator.js';

export interface AgentPromptContext {
  agent: AgentConfig;
  task: Task;
  repoContext: RepositoryContext;
  squadName: string;
  otherTasks?: Task[];
  workingDirectory: string;
}

export class AgentPromptBuilder {
  buildAgentPrompt(context: AgentPromptContext): string {
    const { agent, task, repoContext, squadName, otherTasks = [], workingDirectory } = context;
    
    // Start with the agent's custom prompt from Graphyn
    let prompt = '';
    
    // Add the agent's custom system prompt if available
    if (agent.systemPrompt) {
      prompt = agent.systemPrompt + '\n\n';
    }
    
    // Add task-specific context
    prompt += `# Current Task Assignment

You are working as part of the "${squadName}" squad.

## Task Details
**Task ID**: ${task.id}
**Title**: ${task.title}
**Description**: ${task.description}

## Acceptance Criteria
${task.acceptance_criteria.map((criteria, i) => `${i + 1}. ${criteria}`).join('\n')}

## Task Complexity
Estimated complexity: ${task.estimated_complexity}

${this.formatDependencies(task, otherTasks)}

## Repository Context
${this.formatRepoContext(repoContext)}

## Working Directory
You are working in: ${workingDirectory}

## Git Worktree Information
You are working in your own Git worktree branch. This means:
- You have an isolated workspace separate from other agents
- All your changes are automatically tracked in your branch
- You can make commits without affecting other agents' work
- Your branch will be reviewed and merged after completion

## Task-Specific Instructions
1. Focus on completing this specific task according to the acceptance criteria
2. Follow the existing code patterns and conventions in the repository
3. Ensure your work integrates well with the overall project structure
4. If you have dependencies on other tasks, assume they will be completed by other agents
5. Test your implementation to ensure it meets the acceptance criteria
6. Make frequent commits as you progress to track your work
7. When you complete the task, summarize what was accomplished

Let's begin working on your task.`;

    return prompt;
  }

  private formatDependencies(task: Task, otherTasks: Task[]): string {
    if (!task.dependencies || task.dependencies.length === 0) {
      return '\n## Dependencies\nThis task has no dependencies on other tasks.';
    }

    const depTasks = task.dependencies
      .map(depId => otherTasks.find(t => t.id === depId))
      .filter(Boolean);

    if (depTasks.length === 0) {
      return '\n## Dependencies\nThis task has no dependencies on other tasks.';
    }

    const depList = depTasks.map(dep => 
      `- **${dep!.id}**: ${dep!.title} (assigned to ${dep!.assigned_agent})`
    ).join('\n');

    return `\n## Dependencies\nThis task depends on the following tasks:\n${depList}\n\nAssume these tasks will be completed by their assigned agents.`;
  }

  private formatRepoContext(context: RepositoryContext): string {
    const sections: string[] = [];
    
    if (context.framework) {
      sections.push(`**Framework**: ${context.framework}`);
    }
    
    if (context.language) {
      sections.push(`**Language**: ${context.language}`);
    }
    
    if (context.detected_stack && context.detected_stack.length > 0) {
      sections.push(`**Tech Stack**: ${context.detected_stack.join(', ')}`);
    }
    
    if (context.dependencies && Object.keys(context.dependencies).length > 0) {
      const majorDeps = Object.entries(context.dependencies)
        .slice(0, 5)
        .map(([name, version]) => `${name}@${version}`)
        .join(', ');
      sections.push(`**Key Dependencies**: ${majorDeps}`);
    }
    
    if (context.patterns && context.patterns.length > 0) {
      sections.push(`**Code Patterns**: ${context.patterns.join(', ')}`);
    }
    
    if (context.structure) {
      const structureItems = [];
      if (context.structure.hasTests) structureItems.push('Has tests');
      if (context.structure.hasCI) structureItems.push('Has CI/CD');
      if (context.structure.hasDocs) structureItems.push('Has documentation');
      
      if (structureItems.length > 0) {
        sections.push(`**Project Structure**: ${structureItems.join(', ')}`);
      }
    }
    
    return sections.length > 0 
      ? sections.join('\n')
      : 'No specific repository context available.';
  }

  buildInitialGreeting(agent: AgentConfig): string {
    // If agent has a custom prompt, use it as the initial greeting
    if (agent.systemPrompt) {
      return agent.systemPrompt;
    }
    
    // Otherwise, use a generic greeting
    return `You are ${agent.name}, a ${agent.role} agent. Waiting for task assignment...`;
  }
}