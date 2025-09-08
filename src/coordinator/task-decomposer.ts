/**
 * Task Decomposer - Breaks complex requests into agent-specific tasks with DAG execution
 */

import { TaskNode, ExecutionGraph, AgentProfile } from './types.js';
import { AgentRegistry } from './agent-registry.js';
import chalk from 'chalk';

export class TaskDecomposer {
  constructor(private agentRegistry: AgentRegistry) {}

  /**
   * Decompose a complex request into a DAG of tasks
   */
  async decomposeRequest(request: string): Promise<ExecutionGraph> {
    console.log(chalk.cyan('🧠 Analyzing request for task decomposition...'));
    console.log(chalk.gray(`Request: "${request}"`));

    const taskType = this.classifyRequest(request);
    const complexity = this.assessComplexity(request);
    
    let tasks: TaskNode[];
    
    switch (taskType) {
      case 'development':
        tasks = this.createDevelopmentTasks(request, complexity);
        break;
      case 'analysis':
        tasks = this.createAnalysisTasks(request, complexity);
        break;
      case 'architecture':
        tasks = this.createArchitectureTasks(request, complexity);
        break;
      case 'review':
        tasks = this.createReviewTasks(request, complexity);
        break;
      case 'deployment':
        tasks = this.createDeploymentTasks(request, complexity);
        break;
      default:
        tasks = this.createGenericTasks(request, complexity);
    }

    const graph = this.buildExecutionGraph(tasks);
    
    console.log(chalk.green(`📋 Created execution plan with ${tasks.length} tasks`));
    console.log(chalk.gray(`Estimated time: ${graph.totalEstimatedTime} minutes`));
    console.log(chalk.gray(`Max concurrency: ${graph.maxConcurrency} agents`));
    
    return graph;
  }

  /**
   * Classify the type of request
   */
  private classifyRequest(request: string): string {
    const lower = request.toLowerCase();
    
    if (lower.includes('implement') || lower.includes('build') || lower.includes('create') || lower.includes('develop')) {
      return 'development';
    }
    if (lower.includes('analyze') || lower.includes('investigate') || lower.includes('research') || lower.includes('understand')) {
      return 'analysis';
    }
    if (lower.includes('architecture') || lower.includes('design') || lower.includes('structure')) {
      return 'architecture';
    }
    if (lower.includes('review') || lower.includes('check') || lower.includes('audit') || lower.includes('test')) {
      return 'review';
    }
    if (lower.includes('deploy') || lower.includes('release') || lower.includes('publish')) {
      return 'deployment';
    }
    
    return 'generic';
  }

  /**
   * Assess complexity of the request
   */
  private assessComplexity(request: string): 'low' | 'medium' | 'high' {
    const lower = request.toLowerCase();
    
    // High complexity indicators
    const highComplexityKeywords = [
      'fullstack', 'multi-service', 'architecture', 'system design',
      'infrastructure', 'migration', 'refactor', 'performance optimization'
    ];
    
    // Medium complexity indicators  
    const mediumComplexityKeywords = [
      'integration', 'api', 'authentication', 'database', 'testing',
      'deployment', 'frontend', 'backend'
    ];

    for (const keyword of highComplexityKeywords) {
      if (lower.includes(keyword)) return 'high';
    }
    
    for (const keyword of mediumComplexityKeywords) {
      if (lower.includes(keyword)) return 'medium';
    }
    
    return 'low';
  }

  /**
   * Create tasks for development requests
   */
  private createDevelopmentTasks(request: string, complexity: 'low' | 'medium' | 'high'): TaskNode[] {
    const tasks: TaskNode[] = [];
    const lower = request.toLowerCase();
    
    // Always start with analysis
    tasks.push({
      id: 'analysis_1',
      description: `Analyze requirements for: ${request}`,
      type: 'analysis',
      complexity,
      estimatedTimeMinutes: complexity === 'high' ? 10 : 5,
      dependencies: [],
      status: 'pending'
    });

    // Add architecture task for complex requests
    if (complexity === 'high' || lower.includes('architecture') || lower.includes('system')) {
      tasks.push({
        id: 'architecture_1',
        description: 'Design system architecture and component boundaries',
        type: 'analysis',
        complexity,
        estimatedTimeMinutes: 15,
        dependencies: ['analysis_1'],
        status: 'pending'
      });
    }

    // Backend implementation if needed
    if (lower.includes('backend') || lower.includes('api') || lower.includes('service') || lower.includes('fullstack')) {
      tasks.push({
        id: 'backend_impl_1',
        description: 'Implement backend services and APIs',
        type: 'implementation',
        complexity,
        estimatedTimeMinutes: complexity === 'high' ? 20 : 15,
        dependencies: complexity === 'high' ? ['architecture_1'] : ['analysis_1'],
        status: 'pending'
      });
    }

    // Frontend implementation if needed
    if (lower.includes('frontend') || lower.includes('ui') || lower.includes('react') || lower.includes('fullstack')) {
      const dependencies = ['analysis_1'];
      if (tasks.find(t => t.id === 'backend_impl_1')) {
        dependencies.push('backend_impl_1');
      }
      
      tasks.push({
        id: 'frontend_impl_1',
        description: 'Implement frontend components and user interface',
        type: 'implementation',
        complexity,
        estimatedTimeMinutes: complexity === 'high' ? 20 : 15,
        dependencies,
        status: 'pending'
      });
    }

    // Testing task
    const implementationTasks = tasks.filter(t => t.type === 'implementation');
    if (implementationTasks.length > 0) {
      tasks.push({
        id: 'testing_1',
        description: 'Write and execute comprehensive tests',
        type: 'testing',
        complexity,
        estimatedTimeMinutes: 10,
        dependencies: implementationTasks.map(t => t.id),
        status: 'pending'
      });
    }

    // Code review task
    tasks.push({
      id: 'review_1',
      description: 'Conduct code review and quality assessment',
      type: 'review',
      complexity,
      estimatedTimeMinutes: 5,
      dependencies: tasks.filter(t => t.type !== 'review').map(t => t.id),
      status: 'pending'
    });

    return tasks;
  }

  /**
   * Create tasks for analysis requests
   */
  private createAnalysisTasks(request: string, complexity: 'low' | 'medium' | 'high'): TaskNode[] {
    const tasks: TaskNode[] = [];
    
    tasks.push({
      id: 'analysis_main',
      description: `Conduct primary analysis: ${request}`,
      type: 'analysis',
      complexity,
      estimatedTimeMinutes: complexity === 'high' ? 15 : 10,
      dependencies: [],
      status: 'pending'
    });

    if (complexity === 'high') {
      tasks.push({
        id: 'analysis_deep_dive',
        description: 'Perform deep dive technical analysis',
        type: 'analysis',
        complexity,
        estimatedTimeMinutes: 10,
        dependencies: ['analysis_main'],
        status: 'pending'
      });

      tasks.push({
        id: 'recommendations',
        description: 'Generate recommendations and next steps',
        type: 'documentation',
        complexity,
        estimatedTimeMinutes: 5,
        dependencies: ['analysis_deep_dive'],
        status: 'pending'
      });
    }

    return tasks;
  }

  /**
   * Create tasks for architecture requests
   */
  private createArchitectureTasks(request: string, complexity: 'low' | 'medium' | 'high'): TaskNode[] {
    const tasks: TaskNode[] = [
      {
        id: 'arch_analysis',
        description: 'Analyze current architecture and requirements',
        type: 'analysis',
        complexity,
        estimatedTimeMinutes: 10,
        dependencies: [],
        status: 'pending'
      },
      {
        id: 'arch_design',
        description: 'Design new architecture and component structure',
        type: 'analysis',
        complexity,
        estimatedTimeMinutes: 20,
        dependencies: ['arch_analysis'],
        status: 'pending'
      },
      {
        id: 'arch_documentation',
        description: 'Document architecture decisions and patterns',
        type: 'documentation',
        complexity,
        estimatedTimeMinutes: 10,
        dependencies: ['arch_design'],
        status: 'pending'
      }
    ];

    return tasks;
  }

  /**
   * Create tasks for review requests
   */
  private createReviewTasks(request: string, complexity: 'low' | 'medium' | 'high'): TaskNode[] {
    return [{
      id: 'review_main',
      description: `Conduct comprehensive review: ${request}`,
      type: 'review',
      complexity,
      estimatedTimeMinutes: complexity === 'high' ? 15 : 10,
      dependencies: [],
      status: 'pending'
    }];
  }

  /**
   * Create tasks for deployment requests
   */
  private createDeploymentTasks(request: string, complexity: 'low' | 'medium' | 'high'): TaskNode[] {
    return [
      {
        id: 'deploy_prep',
        description: 'Prepare deployment configuration and scripts',
        type: 'implementation',
        complexity,
        estimatedTimeMinutes: 10,
        dependencies: [],
        status: 'pending'
      },
      {
        id: 'deploy_execute',
        description: 'Execute deployment process',
        type: 'implementation',
        complexity,
        estimatedTimeMinutes: 5,
        dependencies: ['deploy_prep'],
        status: 'pending'
      }
    ];
  }

  /**
   * Create generic tasks
   */
  private createGenericTasks(request: string, complexity: 'low' | 'medium' | 'high'): TaskNode[] {
    return [{
      id: 'generic_task',
      description: request,
      type: 'analysis',
      complexity,
      estimatedTimeMinutes: complexity === 'high' ? 20 : complexity === 'medium' ? 15 : 10,
      dependencies: [],
      status: 'pending'
    }];
  }

  /**
   * Build execution graph from tasks
   */
  private buildExecutionGraph(tasks: TaskNode[]): ExecutionGraph {
    const totalTime = tasks.reduce((sum, task) => sum + task.estimatedTimeMinutes, 0);
    
    // Calculate max concurrency by finding maximum parallelizable tasks
    const maxConcurrency = this.calculateMaxConcurrency(tasks);
    
    return {
      nodes: tasks,
      totalEstimatedTime: totalTime,
      parallelizable: maxConcurrency > 1,
      maxConcurrency: Math.min(maxConcurrency, 8) // Limit to max 8 agents
    };
  }

  /**
   * Calculate maximum number of tasks that can run in parallel
   */
  private calculateMaxConcurrency(tasks: TaskNode[]): number {
    const dependencyLevels = new Map<string, number>();
    
    // Calculate dependency level for each task
    const calculateLevel = (taskId: string): number => {
      if (dependencyLevels.has(taskId)) {
        return dependencyLevels.get(taskId)!;
      }

      const task = tasks.find(t => t.id === taskId);
      if (!task) return 0;

      if (task.dependencies.length === 0) {
        dependencyLevels.set(taskId, 0);
        return 0;
      }

      const maxDepLevel = Math.max(...task.dependencies.map(calculateLevel));
      const level = maxDepLevel + 1;
      dependencyLevels.set(taskId, level);
      return level;
    };

    // Calculate level for all tasks
    tasks.forEach(task => calculateLevel(task.id));

    // Find maximum tasks at any single level
    const levelCounts = new Map<number, number>();
    for (const level of dependencyLevels.values()) {
      levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
    }

    return Math.max(...Array.from(levelCounts.values()));
  }
}