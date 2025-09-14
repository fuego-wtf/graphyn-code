/**
 * TaskDecomposer - Breaks down complex queries into parallelizable tasks
 * Uses proper TypeScript naming conventions throughout
 */

import {
  TaskNode,
  TaskStatus,
  TaskPriority,
  TaskComplexity,
  ExecutionGraph,
  TaskMetadata
} from './types.js';
import { AGENT_ROLES, AGENT_ROLE_CONSTANTS } from './constants.js';

/**
 * Advanced task decomposition with DAG analysis
 * Class name: PascalCase without prefix
 */
export class TaskDecomposer {
  private readonly taskTemplates: Map<string, TaskTemplate>;
  private taskCounter = 0;

  constructor() {
    this.taskTemplates = this.initializeTaskTemplates();
  }

  /**
   * Main decomposition method - analyzes query and creates execution graph
   * Method name: camelCase
   */
  public async decomposeQuery(userQuery: string): Promise<ExecutionGraph> {
    // Analyze query intent and complexity
    const queryAnalysis = this.analyzeQuery(userQuery);

    // Generate tasks based on patterns
    const tasks = this.generateTasks(queryAnalysis);

    // Build dependency graph
    const dependencyGraph = this.buildDependencyGraph(tasks);

    // Calculate critical path
    const criticalPath = this.calculateCriticalPath(dependencyGraph);

    return {
      nodes: tasks,
      totalEstimatedTimeMinutes: this.calculateTotalTime(tasks),
      maxConcurrency: this.calculateMaxConcurrency(tasks),
      parallelizable: this.isParallelizable(dependencyGraph),
      criticalPath
    };
  }

  /**
   * Analyze user query to determine intent and complexity
   */
  private analyzeQuery(query: string): QueryAnalysis {
    const normalizedQuery = query.toLowerCase();

    // Pattern matching for different intents
    const patterns = {
      build: /build|create|implement|add|develop/i,
      fix: /fix|debug|resolve|repair/i,
      test: /test|verify|validate|check/i,
      optimize: /optimize|improve|enhance|performance/i,
      document: /document|explain|comment|readme/i,
      deploy: /deploy|release|publish|production/i
    };

    let intent: QueryIntent = QueryIntent.BUILD;
    let complexity: TaskComplexity = TaskComplexity.MEDIUM;

    // Determine intent
    for (const [intentType, pattern] of Object.entries(patterns)) {
      if (pattern.test(normalizedQuery)) {
        intent = intentType as QueryIntent;
        break;
      }
    }

    // Determine complexity based on keywords
    const complexityIndicators = {
      simple: /simple|basic|quick|small/i,
      medium: /feature|component|service/i,
      high: /system|architecture|complex|enterprise/i,
      critical: /urgent|critical|production|security/i
    };

    for (const [level, pattern] of Object.entries(complexityIndicators)) {
      if (pattern.test(normalizedQuery)) {
        complexity = level.toUpperCase() as TaskComplexity;
        break;
      }
    }

    return {
      originalQuery: query,
      intent,
      complexity,
      keywords: this.extractKeywords(query),
      estimatedScope: this.estimateScope(query)
    };
  }

  /**
   * Generate tasks based on query analysis
   */
  private generateTasks(analysis: QueryAnalysis): TaskNode[] {
    const tasks: TaskNode[] = [];
    const baseId = `task-${Date.now()}`;

    switch (analysis.intent) {
      case QueryIntent.BUILD:
        tasks.push(...this.generateBuildTasks(analysis, baseId));
        break;
      case QueryIntent.FIX:
        tasks.push(...this.generateFixTasks(analysis, baseId));
        break;
      case QueryIntent.TEST:
        tasks.push(...this.generateTestTasks(analysis, baseId));
        break;
      default:
        tasks.push(...this.generateDefaultTasks(analysis, baseId));
    }

    return tasks;
  }

  /**
   * Generate tasks for building features
   */
  private generateBuildTasks(analysis: QueryAnalysis, baseId: string): TaskNode[] {
    return [
      this.createTask({
        id: `${baseId}-architect`,
        title: 'System Architecture Planning',
        description: `Analyze requirements and design system architecture for: ${analysis.originalQuery}`,
        assignedAgent: AGENT_ROLE_CONSTANTS.ARCHITECT,
        complexity: TaskComplexity.MEDIUM,
        estimatedDuration: 10,
        dependencies: [],
        tools: ['system-design', 'documentation'],
        expectedOutputs: ['Architecture diagram', 'Technical specifications']
      }),
      this.createTask({
        id: `${baseId}-backend`,
        title: 'Backend Implementation',
        description: `Implement backend services and APIs for: ${analysis.originalQuery}`,
        assignedAgent: AGENT_ROLE_CONSTANTS.BACKEND,
        complexity: analysis.complexity,
        estimatedDuration: 20,
        dependencies: [`${baseId}-architect`],
        tools: ['typescript', 'node.js', 'database'],
        expectedOutputs: ['API endpoints', 'Database schemas', 'Service logic']
      }),
      this.createTask({
        id: `${baseId}-frontend`,
        title: 'Frontend Implementation',
        description: `Create user interface components for: ${analysis.originalQuery}`,
        assignedAgent: AGENT_ROLE_CONSTANTS.FRONTEND,
        complexity: analysis.complexity,
        estimatedDuration: 15,
        dependencies: [`${baseId}-architect`],
        tools: ['react', 'typescript', 'css'],
        expectedOutputs: ['UI components', 'State management', 'User workflows']
      }),
      this.createTask({
        id: `${baseId}-tester`,
        title: 'Quality Assurance Testing',
        description: `Test the implemented feature: ${analysis.originalQuery}`,
        assignedAgent: AGENT_ROLE_CONSTANTS.TESTER,
        complexity: TaskComplexity.MEDIUM,
        estimatedDuration: 10,
        dependencies: [`${baseId}-backend`, `${baseId}-frontend`],
        tools: ['vitest', 'playwright', 'testing-library'],
        expectedOutputs: ['Unit tests', 'Integration tests', 'Test reports']
      })
    ];
  }

  /**
   * Generate tasks for fixing issues
   */
  private generateFixTasks(analysis: QueryAnalysis, baseId: string): TaskNode[] {
    return [
      this.createTask({
        id: `${baseId}-analyze`,
        title: 'Problem Analysis',
        description: `Analyze and identify root cause of: ${analysis.originalQuery}`,
        assignedAgent: AGENT_ROLE_CONSTANTS.RESEARCHER,
        complexity: TaskComplexity.MEDIUM,
        estimatedDuration: 8,
        dependencies: [],
        tools: ['debugging', 'log-analysis', 'code-review'],
        expectedOutputs: ['Problem diagnosis', 'Root cause analysis', 'Fix strategy']
      }),
      this.createTask({
        id: `${baseId}-implement`,
        title: 'Fix Implementation',
        description: `Implement solution for: ${analysis.originalQuery}`,
        assignedAgent: this.selectFixAgent(analysis),
        complexity: analysis.complexity,
        estimatedDuration: 15,
        dependencies: [`${baseId}-analyze`],
        tools: ['code-editor', 'testing', 'debugging'],
        expectedOutputs: ['Code fixes', 'Updated tests', 'Validation results']
      }),
      this.createTask({
        id: `${baseId}-verify`,
        title: 'Fix Verification',
        description: `Verify fix resolves: ${analysis.originalQuery}`,
        assignedAgent: AGENT_ROLE_CONSTANTS.TESTER,
        complexity: TaskComplexity.LOW,
        estimatedDuration: 5,
        dependencies: [`${baseId}-implement`],
        tools: ['testing', 'validation'],
        expectedOutputs: ['Verification tests', 'Fix confirmation']
      })
    ];
  }

  private generateTestTasks(analysis: QueryAnalysis, baseId: string): TaskNode[] {
    return [
      this.createTask({
        id: `${baseId}-test-plan`,
        title: 'Test Planning',
        description: `Create comprehensive test plan for: ${analysis.originalQuery}`,
        assignedAgent: AGENT_ROLE_CONSTANTS.TESTER,
        complexity: TaskComplexity.MEDIUM,
        estimatedDuration: 12,
        dependencies: [],
        tools: ['test-planning', 'coverage-analysis'],
        expectedOutputs: ['Test plan', 'Test cases', 'Coverage requirements']
      })
    ];
  }

  private generateDefaultTasks(analysis: QueryAnalysis, baseId: string): TaskNode[] {
    return [
      this.createTask({
        id: `${baseId}-research`,
        title: 'Research and Analysis',
        description: `Research and analyze: ${analysis.originalQuery}`,
        assignedAgent: AGENT_ROLE_CONSTANTS.RESEARCHER,
        complexity: analysis.complexity,
        estimatedDuration: 10,
        dependencies: [],
        tools: ['research', 'documentation'],
        expectedOutputs: ['Research findings', 'Recommendations']
      })
    ];
  }

  /**
   * Helper method to create properly formatted TaskNode
   */
  private createTask(params: TaskCreationParams): TaskNode {
    return {
      id: params.id,
      title: params.title,
      description: params.description,
      assignedAgent: params.assignedAgent,
      estimatedDuration: params.estimatedDuration,
      dependencies: params.dependencies,
      status: TaskStatus.PENDING,
      priority: TaskPriority.NORMAL,
      tools: params.tools,
      expectedOutputs: params.expectedOutputs,
      createdAt: new Date(),
      metadata: {
        priority: 5,
        tags: [params.assignedAgent, params.complexity],
        gitBranch: null,
        worktreePath: null
      }
    };
  }

  private selectFixAgent(analysis: QueryAnalysis): string {
    // Select appropriate agent based on keywords
    const keywords = analysis.keywords.join(' ').toLowerCase();

    if (keywords.includes('frontend') || keywords.includes('ui') || keywords.includes('component')) {
      return AGENT_ROLE_CONSTANTS.FRONTEND;
    }
    if (keywords.includes('backend') || keywords.includes('api') || keywords.includes('server')) {
      return AGENT_ROLE_CONSTANTS.BACKEND;
    }
    if (keywords.includes('security')) {
      return AGENT_ROLE_CONSTANTS.SECURITY;
    }
    if (keywords.includes('deploy') || keywords.includes('infrastructure')) {
      return AGENT_ROLE_CONSTANTS.DEVOPS;
    }

    return AGENT_ROLE_CONSTANTS.BACKEND; // Default
  }

  private buildDependencyGraph(tasks: TaskNode[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const task of tasks) {
      graph.set(task.id, [...task.dependencies]);
    }

    return graph;
  }

  private calculateCriticalPath(graph: Map<string, string[]>): string[] {
    // Simplified critical path calculation
    // In a real implementation, would use topological sort and longest path algorithm
    const nodes = Array.from(graph.keys());
    return nodes.filter(nodeId => {
      const dependencies = graph.get(nodeId) || [];
      return dependencies.length > 0;
    });
  }

  private calculateTotalTime(tasks: TaskNode[]): number {
    return tasks.reduce((total, task) => total + task.estimatedDuration, 0);
  }

  private calculateMaxConcurrency(tasks: TaskNode[]): number {
    // Simple calculation - count tasks without dependencies
    const independentTasks = tasks.filter(task => task.dependencies.length === 0);
    return Math.min(independentTasks.length, 8);
  }

  private isParallelizable(graph: Map<string, string[]>): boolean {
    // Check if any tasks can run in parallel
    const independentTasks = Array.from(graph.entries()).filter(([_, deps]) => deps.length === 0);
    return independentTasks.length > 1;
  }

  private extractKeywords(query: string): string[] {
    // Simple keyword extraction
    return query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'been'].includes(word));
  }

  private estimateScope(query: string): number {
    // Estimate scope based on query length and complexity indicators
    const baseScope = query.split(' ').length;
    const complexityMultiplier = query.includes('system') || query.includes('architecture') ? 2 : 1;
    return baseScope * complexityMultiplier;
  }

  private initializeTaskTemplates(): Map<string, TaskTemplate> {
    // Initialize with common task templates
    return new Map();
  }
}

// Supporting types with proper naming conventions
interface QueryAnalysis {
  readonly originalQuery: string;
  readonly intent: QueryIntent;
  readonly complexity: TaskComplexity;
  readonly keywords: readonly string[];
  readonly estimatedScope: number;
}

enum QueryIntent {
  BUILD = 'BUILD',
  FIX = 'FIX',
  TEST = 'TEST',
  OPTIMIZE = 'OPTIMIZE',
  DOCUMENT = 'DOCUMENT',
  DEPLOY = 'DEPLOY'
}

interface TaskTemplate {
  readonly id: string;
  readonly pattern: RegExp;
  readonly generator: (query: string, context: any) => TaskNode[];
}

interface TaskCreationParams {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly assignedAgent: string;
  readonly complexity: TaskComplexity;
  readonly estimatedDuration: number;
  readonly dependencies: readonly string[];
  readonly tools: readonly string[];
  readonly expectedOutputs: readonly string[];
}