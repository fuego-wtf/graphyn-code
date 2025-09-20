/**
 * Intelligent Task Graph Generator
 * 
 * Uses Claude to analyze goals and repository context to generate smart, actionable task graphs
 */

import { ClaudeAPIWrapper } from './claude-api-wrapper.js';
import { RepoAnalysis } from './repo-analyzer.js';

export interface Task {
  id: string;
  description: string;
  type: 'analysis' | 'implementation' | 'testing' | 'security' | 'deployment' | 'documentation' | 'backend_development' | 'security_analysis';
  dependencies: string[];
  workingDirectory: string;
  priority: number;
  estimatedDuration: number; // minutes
  requiredSkills: string[];
  deliverables: string[];
  acceptanceCriteria: string[];
  // Optional properties for agent compatibility
  requirements?: string[];
  config?: {
    tools?: string[];
  };
}

export interface TaskGraph {
  tasks: Task[];
  dependencies: Map<string, string[]>;
  criticalPath: string[];
  estimatedTotalDuration: number;
  parallelizationFactor: number;
}

export interface Goal {
  type: string;
  description: string;
  complexity: 'low' | 'medium' | 'high';
  urgency: 'low' | 'medium' | 'high';
  scope: 'feature' | 'refactor' | 'bugfix' | 'optimization' | 'migration';
  constraints: string[];
  requirements: string[];
}

export class IntelligentTaskGraphGenerator {
  private claudeAPI: ClaudeAPIWrapper;

  constructor(claudeAPI?: ClaudeAPIWrapper) {
    this.claudeAPI = claudeAPI || new ClaudeAPIWrapper({
      apiKey: process.env.ANTHROPIC_API_KEY || 'demo-key'
    });
  }

  async generateTaskGraph(
    goal: Goal,
    repoAnalysis: RepoAnalysis,
    workingDirectory: string
  ): Promise<TaskGraph> {
    try {
      // Use Claude to generate intelligent task breakdown
      const taskBreakdown = await this.generateIntelligentBreakdown(goal, repoAnalysis);
      
      // Convert to structured task graph
      const taskGraph = this.buildTaskGraph(taskBreakdown, workingDirectory);
      
      return taskGraph;
    } catch (error) {
      console.warn('Intelligent task generation failed, using fallback:', error);
      return this.generateFallbackTaskGraph(goal, repoAnalysis, workingDirectory);
    }
  }

  private async generateIntelligentBreakdown(goal: Goal, repoAnalysis: RepoAnalysis): Promise<any> {
    const systemPrompt = `You are an expert software architect and project manager. Your job is to break down development goals into specific, actionable tasks based on repository analysis.

    Guidelines:
    1. Create tasks that are specific and measurable
    2. Consider the existing codebase structure and patterns
    3. Ensure proper dependency ordering
    4. Include testing and security considerations
    5. Account for the technology stack in use
    6. Provide realistic time estimates
    7. Consider code review and documentation needs

    Return your response as a JSON object with this structure:
    {
      "tasks": [
        {
          "id": "unique-task-id",
          "title": "Task title",
          "description": "Detailed task description",
          "type": "analysis|implementation|testing|security|deployment|documentation",
          "dependencies": ["dependent-task-id"],
          "priority": 1-5,
          "estimatedHours": 1-8,
          "requiredSkills": ["skill1", "skill2"],
          "deliverables": ["deliverable1", "deliverable2"],
          "acceptanceCriteria": ["criteria1", "criteria2"]
        }
      ],
      "criticalPath": ["task-id-1", "task-id-2"],
      "riskFactors": ["risk1", "risk2"],
      "recommendations": ["rec1", "rec2"]
    }`;

    const userPrompt = `
    GOAL TO ACCOMPLISH:
    Type: ${goal.type}
    Description: ${goal.description}
    Complexity: ${goal.complexity}
    Urgency: ${goal.urgency}
    Scope: ${goal.scope}
    Constraints: ${goal.constraints.join(', ')}
    Requirements: ${goal.requirements.join(', ')}

    REPOSITORY CONTEXT:
    Technology Stack: ${repoAnalysis.technology.techStack}
    Primary Languages: ${repoAnalysis.technology.primaryLanguages.join(', ')}
    Frameworks: ${repoAnalysis.technology.frameworks.join(', ')}
    Architecture: ${repoAnalysis.patterns.architecture}
    Testing Strategy: ${repoAnalysis.patterns.testingStrategy}
    Codebase Size: ${repoAnalysis.structure.codebaseSize}
    Complexity Score: ${repoAnalysis.complexity.score}/10
    Project Type: ${repoAnalysis.context.projectType}

    EXISTING STRUCTURE:
    Key Directories: ${repoAnalysis.structure.directories.slice(0, 10).join(', ')}
    
    Please break down this goal into a comprehensive task graph that considers the repository context and follows software development best practices.
    `;

    const messages = [{
      role: 'user' as const,
      content: userPrompt
    }];

    // For now, simulate Claude response since we're using the demo version
    // In production, this would use real Claude API:
    /*
    const stream = this.claudeAPI.streamExecution(messages, [], systemPrompt);
    const response = await this.collectStreamResponse(stream);
    return JSON.parse(response);
    */

    // Fallback intelligent analysis based on goal and repo context
    return this.generateContextualTaskBreakdown(goal, repoAnalysis);
  }

  private generateContextualTaskBreakdown(goal: Goal, repoAnalysis: RepoAnalysis): any {
    const tasks: any[] = [];
    let taskCounter = 0;

    const generateId = () => `task-${++taskCounter}`;

    // Base tasks based on goal type
    if (goal.type.includes('auth') || goal.description.toLowerCase().includes('auth')) {
      // Authentication-specific tasks
      tasks.push({
        id: generateId(),
        title: 'Analyze Authentication Requirements',
        description: 'Analyze current authentication system and requirements for JWT implementation',
        type: 'analysis',
        dependencies: [],
        priority: 5,
        estimatedHours: 2,
        requiredSkills: ['Security Analysis', 'Authentication'],
        deliverables: ['Authentication Analysis Report'],
        acceptanceCriteria: ['Requirements documented', 'Security considerations identified']
      });

      tasks.push({
        id: generateId(),
        title: 'Design JWT Authentication System',
        description: 'Design JWT authentication system architecture and data flow',
        type: 'implementation',
        dependencies: ['task-1'],
        priority: 5,
        estimatedHours: 3,
        requiredSkills: ['Backend Development', 'JWT', repoAnalysis.technology.primaryLanguages[0]],
        deliverables: ['Authentication System Design', 'API Endpoints Specification'],
        acceptanceCriteria: ['Design approved', 'API contracts defined']
      });

      tasks.push({
        id: generateId(),
        title: 'Implement JWT Middleware',
        description: `Implement JWT authentication middleware in ${repoAnalysis.technology.primaryLanguages[0]}`,
        type: 'implementation',
        dependencies: ['task-2'],
        priority: 4,
        estimatedHours: 4,
        requiredSkills: ['Backend Development', repoAnalysis.technology.primaryLanguages[0]],
        deliverables: ['JWT Middleware', 'Authentication Routes'],
        acceptanceCriteria: ['Middleware tests pass', 'Authentication flow working']
      });

      if (repoAnalysis.patterns.testingStrategy !== 'Unknown') {
        tasks.push({
          id: generateId(),
          title: 'Create Authentication Tests',
          description: 'Create comprehensive tests for JWT authentication system',
          type: 'testing',
          dependencies: ['task-3'],
          priority: 3,
          estimatedHours: 3,
          requiredSkills: ['Testing', repoAnalysis.technology.primaryLanguages[0]],
          deliverables: ['Unit Tests', 'Integration Tests'],
          acceptanceCriteria: ['Test coverage > 80%', 'All authentication flows tested']
        });
      }
    }

    // Add general tasks based on scope
    if (goal.scope === 'feature') {
      tasks.push({
        id: generateId(),
        title: 'Documentation Updates',
        description: 'Update documentation to reflect new feature changes',
        type: 'documentation',
        dependencies: tasks.map(t => t.id),
        priority: 2,
        estimatedHours: 1,
        requiredSkills: ['Documentation'],
        deliverables: ['Updated README', 'API Documentation'],
        acceptanceCriteria: ['Documentation is complete and accurate']
      });
    }

    return {
      tasks,
      criticalPath: tasks.slice(0, 3).map(t => t.id),
      riskFactors: ['API Breaking Changes', 'Security Vulnerabilities'],
      recommendations: ['Implement gradual rollout', 'Add monitoring and alerting']
    };
  }

  private buildTaskGraph(breakdown: any, workingDirectory: string): TaskGraph {
    const tasks: Task[] = breakdown.tasks.map((task: any) => ({
      id: task.id,
      description: task.description || task.title,
      type: task.type,
      dependencies: task.dependencies || [],
      workingDirectory,
      priority: task.priority || 3,
      estimatedDuration: (task.estimatedHours || 2) * 60,
      requiredSkills: task.requiredSkills || [],
      deliverables: task.deliverables || [],
      acceptanceCriteria: task.acceptanceCriteria || []
    }));

    const dependencies = new Map<string, string[]>();
    tasks.forEach(task => {
      dependencies.set(task.id, task.dependencies);
    });

    const criticalPath = breakdown.criticalPath || tasks.slice(0, 3).map(t => t.id);
    const estimatedTotalDuration = tasks.reduce((total, task) => total + task.estimatedDuration, 0);
    const parallelizationFactor = this.calculateParallelization(tasks, dependencies);

    return {
      tasks,
      dependencies,
      criticalPath,
      estimatedTotalDuration,
      parallelizationFactor
    };
  }

  private generateFallbackTaskGraph(goal: Goal, repoAnalysis: RepoAnalysis, workingDirectory: string): TaskGraph {
    const fallbackBreakdown = this.generateContextualTaskBreakdown(goal, repoAnalysis);
    return this.buildTaskGraph(fallbackBreakdown, workingDirectory);
  }

  private calculateParallelization(tasks: Task[], dependencies: Map<string, string[]>): number {
    // Simple heuristic: ratio of tasks that can run in parallel
    const independentTasks = tasks.filter(task => task.dependencies.length === 0).length;
    return independentTasks / Math.max(tasks.length, 1);
  }
}

export default IntelligentTaskGraphGenerator;