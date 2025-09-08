/**
 * REV-073: Task Planner - Task Decomposition and Agent Assignment
 * 
 * Integrates with existing task-planning-algorithms to provide intelligent
 * task breakdown and agent assignment for the approval workflow.
 */

import { EventEmitter } from 'events';
import { TaskDecomposition, Task, TaskStatus, TaskPriority, RiskFactor } from '../ui/split-screen/ApprovalWorkflowPanel.js';

export interface ExecutionContext {
  workingDirectory: string;
  repositoryContext?: RepositoryContext;
  availableAgents: AgentCapability[];
  userPreferences?: UserPreferences;
}

export interface RepositoryContext {
  projectType: string;
  framework?: string[];
  mainLanguages: string[];
  hasTests: boolean;
  hasDocumentation: boolean;
  packageManager?: string;
}

export interface AgentCapability {
  name: string;
  specialties: string[];
  supportedLanguages: string[];
  supportedFrameworks: string[];
  estimatedSpeed: number; // tasks per hour
  reliability: number; // 0-1 score
}

export interface UserPreferences {
  preferredAgents?: string[];
  maxParallelTasks?: number;
  riskTolerance: 'low' | 'medium' | 'high';
  timePreference: 'speed' | 'quality' | 'balanced';
}

export interface TaskPlanningRequest {
  query: string;
  repositoryContext?: RepositoryContext;
  availableAgents: AgentCapability[];
  constraints?: PlanningConstraints;
}

export interface PlanningConstraints {
  maxTasks?: number;
  maxDuration?: number;
  requiredAgents?: string[];
  excludedAgents?: string[];
  prioritizeSpeed?: boolean;
}

export interface TaskPlanningResult {
  tasks: PlannedTask[];
  totalEstimatedTime: number;
  confidence: number;
  riskFactors: RiskFactor[];
  agentUtilization: Map<string, number>;
  dependencyGraph: TaskDependency[];
}

export interface PlannedTask {
  title: string;
  description: string;
  suggestedAgent: string;
  estimatedDuration: number;
  dependencies: string[];
  priority: TaskPriority;
  complexity: 'low' | 'medium' | 'high';
  tools: string[];
  expectedOutputs: string[];
}

export interface TaskDependency {
  fromTask: string;
  toTask: string;
  type: 'blocking' | 'preferred' | 'data';
}

export class TaskPlanner extends EventEmitter {
  private agentCapabilities = new Map<string, AgentCapability>();
  private planningHistory: TaskPlanningResult[] = [];
  private maxHistorySize = 100;

  constructor() {
    super();
    this.initializeDefaultAgents();
  }

  /**
   * Initialize default agent capabilities
   */
  private initializeDefaultAgents(): void {
    const defaultAgents: AgentCapability[] = [
      {
        name: 'architect',
        specialties: ['system-design', 'architecture', 'planning', 'analysis'],
        supportedLanguages: ['javascript', 'typescript', 'python', 'go', 'rust'],
        supportedFrameworks: ['react', 'vue', 'angular', 'express', 'fastify', 'nest'],
        estimatedSpeed: 2.0,
        reliability: 0.95
      },
      {
        name: 'backend',
        specialties: ['api-development', 'database', 'server', 'auth', 'security'],
        supportedLanguages: ['javascript', 'typescript', 'python', 'go', 'rust'],
        supportedFrameworks: ['express', 'fastify', 'nest', 'django', 'flask'],
        estimatedSpeed: 2.5,
        reliability: 0.90
      },
      {
        name: 'frontend',
        specialties: ['ui-components', 'styling', 'user-experience', 'responsive-design'],
        supportedLanguages: ['javascript', 'typescript', 'html', 'css'],
        supportedFrameworks: ['react', 'vue', 'angular', 'svelte'],
        estimatedSpeed: 2.2,
        reliability: 0.88
      },
      {
        name: 'tester',
        specialties: ['unit-testing', 'integration-testing', 'e2e-testing', 'test-automation'],
        supportedLanguages: ['javascript', 'typescript', 'python'],
        supportedFrameworks: ['jest', 'vitest', 'cypress', 'playwright'],
        estimatedSpeed: 1.8,
        reliability: 0.92
      },
      {
        name: 'devops',
        specialties: ['deployment', 'ci-cd', 'docker', 'kubernetes', 'monitoring'],
        supportedLanguages: ['bash', 'yaml', 'javascript', 'python'],
        supportedFrameworks: ['docker', 'kubernetes', 'github-actions'],
        estimatedSpeed: 1.5,
        reliability: 0.85
      },
      {
        name: 'security',
        specialties: ['security-audit', 'vulnerability-scan', 'auth', 'encryption'],
        supportedLanguages: ['javascript', 'typescript', 'python', 'go'],
        supportedFrameworks: ['oauth', 'jwt', 'bcrypt'],
        estimatedSpeed: 1.2,
        reliability: 0.98
      },
      {
        name: 'data',
        specialties: ['data-analysis', 'database-design', 'migration', 'optimization'],
        supportedLanguages: ['python', 'sql', 'javascript'],
        supportedFrameworks: ['pandas', 'postgresql', 'mongodb'],
        estimatedSpeed: 1.6,
        reliability: 0.87
      },
      {
        name: 'docs',
        specialties: ['documentation', 'api-docs', 'readme', 'guides'],
        supportedLanguages: ['markdown', 'javascript', 'typescript'],
        supportedFrameworks: ['jsdoc', 'openapi', 'storybook'],
        estimatedSpeed: 3.0,
        reliability: 0.90
      }
    ];

    defaultAgents.forEach(agent => {
      this.agentCapabilities.set(agent.name, agent);
    });
  }

  /**
   * Add or update agent capability
   */
  addAgentCapability(agent: AgentCapability): void {
    this.agentCapabilities.set(agent.name, agent);
    this.emit('agentCapabilityAdded', agent);
  }

  /**
   * Get available agents
   */
  async getAvailableAgents(): Promise<AgentCapability[]> {
    return Array.from(this.agentCapabilities.values());
  }

  /**
   * Decompose query into tasks with agent assignments
   */
  async decomposeQuery(query: string, context: ExecutionContext): Promise<TaskDecomposition> {
    const planningRequest: TaskPlanningRequest = {
      query,
      repositoryContext: context.repositoryContext,
      availableAgents: context.availableAgents
    };

    // Generate task plan using intelligent algorithms
    const planningResult = await this.generateTaskPlan(planningRequest);
    
    // Convert to TaskDecomposition format
    const decomposition: TaskDecomposition = {
      id: `task-decomp-${Date.now()}`,
      originalQuery: query,
      tasks: planningResult.tasks.map((task, index) => ({
        id: `task-${index}-${Date.now()}`,
        title: task.title,
        description: task.description,
        assignedAgent: task.suggestedAgent,
        estimatedDuration: task.estimatedDuration,
        dependencies: task.dependencies,
        status: TaskStatus.PENDING,
        priority: task.priority,
        tools: task.tools,
        expectedOutputs: task.expectedOutputs
      })),
      estimatedTotalDuration: planningResult.totalEstimatedTime,
      confidence: planningResult.confidence,
      riskFactors: planningResult.riskFactors
    };

    // Store in history
    this.addToHistory(planningResult);
    
    this.emit('taskDecompositionGenerated', decomposition);
    return decomposition;
  }

  /**
   * Generate detailed task plan using intelligent algorithms
   */
  private async generateTaskPlan(request: TaskPlanningRequest): Promise<TaskPlanningResult> {
    const tasks: PlannedTask[] = [];
    let totalEstimatedTime = 0;
    const riskFactors: RiskFactor[] = [];
    const agentUtilization = new Map<string, number>();
    
    // Analyze query to determine task categories
    const taskCategories = this.analyzeQueryForTaskCategories(request.query, request.repositoryContext);
    
    // Generate tasks for each category
    for (const category of taskCategories) {
      const categoryTasks = await this.generateTasksForCategory(category, request);
      tasks.push(...categoryTasks);
    }

    // Assign agents based on capabilities and load balancing
    const assignedTasks = await this.assignAgentsToTasks(tasks, request.availableAgents);
    
    // Calculate dependencies
    const dependencies = this.calculateTaskDependencies(assignedTasks);
    
    // Update tasks with dependencies
    assignedTasks.forEach(task => {
      const taskDeps = dependencies
        .filter(dep => dep.toTask === task.title)
        .map(dep => dep.fromTask);
      task.dependencies = taskDeps;
    });

    // Calculate total time considering parallelization
    totalEstimatedTime = this.calculateParallelExecutionTime(assignedTasks, dependencies);
    
    // Calculate agent utilization
    assignedTasks.forEach(task => {
      const current = agentUtilization.get(task.suggestedAgent) || 0;
      agentUtilization.set(task.suggestedAgent, current + task.estimatedDuration);
    });

    // Assess risks
    const calculatedRiskFactors = this.assessRisks(assignedTasks, request);
    
    // Calculate confidence based on agent reliability and task complexity
    const confidence = this.calculateConfidence(assignedTasks, calculatedRiskFactors);

    return {
      tasks: assignedTasks,
      totalEstimatedTime,
      confidence,
      riskFactors: calculatedRiskFactors,
      agentUtilization,
      dependencyGraph: dependencies
    };
  }

  /**
   * Analyze query to determine what types of tasks are needed
   */
  private analyzeQueryForTaskCategories(query: string, context?: RepositoryContext): string[] {
    const categories: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Architecture/Planning
    if (lowerQuery.includes('design') || lowerQuery.includes('architecture') || lowerQuery.includes('plan')) {
      categories.push('architecture');
    }

    // Backend Development
    if (lowerQuery.includes('api') || lowerQuery.includes('server') || lowerQuery.includes('backend') || 
        lowerQuery.includes('database') || lowerQuery.includes('auth')) {
      categories.push('backend');
    }

    // Frontend Development
    if (lowerQuery.includes('ui') || lowerQuery.includes('frontend') || lowerQuery.includes('component') ||
        lowerQuery.includes('interface') || lowerQuery.includes('react') || lowerQuery.includes('vue')) {
      categories.push('frontend');
    }

    // Testing
    if (lowerQuery.includes('test') || lowerQuery.includes('testing') || lowerQuery.includes('spec')) {
      categories.push('testing');
    }

    // Documentation
    if (lowerQuery.includes('document') || lowerQuery.includes('readme') || lowerQuery.includes('docs')) {
      categories.push('documentation');
    }

    // Security
    if (lowerQuery.includes('security') || lowerQuery.includes('auth') || lowerQuery.includes('permission')) {
      categories.push('security');
    }

    // Deployment/DevOps
    if (lowerQuery.includes('deploy') || lowerQuery.includes('ci') || lowerQuery.includes('docker') ||
        lowerQuery.includes('build')) {
      categories.push('devops');
    }

    // Default to architecture if no specific categories found
    if (categories.length === 0) {
      categories.push('architecture', 'backend');
    }

    return categories;
  }

  /**
   * Generate specific tasks for a category
   */
  private async generateTasksForCategory(category: string, request: TaskPlanningRequest): Promise<PlannedTask[]> {
    const tasks: PlannedTask[] = [];
    const query = request.query;
    
    switch (category) {
      case 'architecture':
        tasks.push({
          title: 'Analyze requirements and design system architecture',
          description: `Review the request "${query}" and create a comprehensive architectural plan`,
          suggestedAgent: 'architect',
          estimatedDuration: 15,
          dependencies: [],
          priority: TaskPriority.HIGH,
          complexity: 'medium',
          tools: ['analysis', 'design-patterns', 'documentation'],
          expectedOutputs: ['architecture-diagram', 'component-specifications', 'api-design']
        });
        break;

      case 'backend':
        tasks.push({
          title: 'Implement backend API endpoints',
          description: 'Create server-side logic and API endpoints based on architectural specifications',
          suggestedAgent: 'backend',
          estimatedDuration: 25,
          dependencies: ['Analyze requirements and design system architecture'],
          priority: TaskPriority.HIGH,
          complexity: 'medium',
          tools: ['api-development', 'database', 'testing'],
          expectedOutputs: ['api-endpoints', 'database-schema', 'server-configuration']
        });
        break;

      case 'frontend':
        tasks.push({
          title: 'Build user interface components',
          description: 'Create responsive UI components and integrate with backend APIs',
          suggestedAgent: 'frontend',
          estimatedDuration: 20,
          dependencies: ['Implement backend API endpoints'],
          priority: TaskPriority.NORMAL,
          complexity: 'medium',
          tools: ['component-development', 'styling', 'state-management'],
          expectedOutputs: ['ui-components', 'styles', 'integration-layer']
        });
        break;

      case 'testing':
        tasks.push({
          title: 'Create comprehensive test suite',
          description: 'Develop unit, integration, and e2e tests for all components',
          suggestedAgent: 'tester',
          estimatedDuration: 18,
          dependencies: ['Build user interface components', 'Implement backend API endpoints'],
          priority: TaskPriority.NORMAL,
          complexity: 'medium',
          tools: ['unit-testing', 'integration-testing', 'e2e-testing'],
          expectedOutputs: ['test-files', 'test-reports', 'coverage-reports']
        });
        break;

      case 'documentation':
        tasks.push({
          title: 'Create project documentation',
          description: 'Generate comprehensive documentation including API docs and user guides',
          suggestedAgent: 'docs',
          estimatedDuration: 10,
          dependencies: ['Implement backend API endpoints', 'Build user interface components'],
          priority: TaskPriority.LOW,
          complexity: 'low',
          tools: ['documentation', 'api-docs', 'guides'],
          expectedOutputs: ['readme', 'api-documentation', 'user-guides']
        });
        break;

      case 'security':
        tasks.push({
          title: 'Security audit and implementation',
          description: 'Review and implement security best practices and vulnerability fixes',
          suggestedAgent: 'security',
          estimatedDuration: 12,
          dependencies: ['Implement backend API endpoints'],
          priority: TaskPriority.HIGH,
          complexity: 'high',
          tools: ['security-audit', 'vulnerability-scan', 'auth'],
          expectedOutputs: ['security-report', 'auth-implementation', 'security-fixes']
        });
        break;

      case 'devops':
        tasks.push({
          title: 'Setup deployment and CI/CD',
          description: 'Configure deployment pipeline and continuous integration',
          suggestedAgent: 'devops',
          estimatedDuration: 15,
          dependencies: ['Create comprehensive test suite'],
          priority: TaskPriority.NORMAL,
          complexity: 'medium',
          tools: ['deployment', 'ci-cd', 'docker'],
          expectedOutputs: ['deployment-config', 'ci-pipeline', 'docker-files']
        });
        break;
    }

    return tasks;
  }

  /**
   * Assign agents to tasks based on capabilities and load balancing
   */
  private async assignAgentsToTasks(tasks: PlannedTask[], availableAgents: AgentCapability[]): Promise<PlannedTask[]> {
    const assignedTasks = [...tasks];
    const agentWorkload = new Map<string, number>();

    // Initialize workload tracking
    availableAgents.forEach(agent => {
      agentWorkload.set(agent.name, 0);
    });

    // Assign agents based on specialties and current workload
    for (const task of assignedTasks) {
      const suitableAgents = availableAgents.filter(agent => {
        // Check if agent has relevant specialties
        return agent.specialties.some(specialty => 
          task.tools.some(tool => tool.includes(specialty) || specialty.includes(tool))
        );
      });

      if (suitableAgents.length > 0) {
        // Select agent with lowest workload and best fit
        const bestAgent = suitableAgents.reduce((best, current) => {
          const currentLoad = agentWorkload.get(current.name) || 0;
          const bestLoad = agentWorkload.get(best.name) || 0;
          
          // Consider both workload and reliability
          const currentScore = current.reliability - (currentLoad * 0.1);
          const bestScore = best.reliability - (bestLoad * 0.1);
          
          return currentScore > bestScore ? current : best;
        });

        task.suggestedAgent = bestAgent.name;
        
        // Update workload
        const currentLoad = agentWorkload.get(bestAgent.name) || 0;
        agentWorkload.set(bestAgent.name, currentLoad + task.estimatedDuration);
        
        // Adjust estimated duration based on agent speed
        task.estimatedDuration = Math.ceil(task.estimatedDuration / bestAgent.estimatedSpeed);
      }
    }

    return assignedTasks;
  }

  /**
   * Calculate task dependencies based on logical workflow
   */
  private calculateTaskDependencies(tasks: PlannedTask[]): TaskDependency[] {
    const dependencies: TaskDependency[] = [];
    
    // Architecture should come first
    const architectureTask = tasks.find(t => t.suggestedAgent === 'architect');
    if (architectureTask) {
      tasks.forEach(task => {
        if (task !== architectureTask && ['backend', 'frontend'].includes(task.suggestedAgent)) {
          dependencies.push({
            fromTask: architectureTask.title,
            toTask: task.title,
            type: 'blocking'
          });
        }
      });
    }

    // Backend should come before frontend
    const backendTask = tasks.find(t => t.suggestedAgent === 'backend');
    const frontendTask = tasks.find(t => t.suggestedAgent === 'frontend');
    if (backendTask && frontendTask) {
      dependencies.push({
        fromTask: backendTask.title,
        toTask: frontendTask.title,
        type: 'preferred'
      });
    }

    // Testing should come after implementation
    const testingTask = tasks.find(t => t.suggestedAgent === 'tester');
    if (testingTask) {
      tasks.forEach(task => {
        if (['backend', 'frontend'].includes(task.suggestedAgent)) {
          dependencies.push({
            fromTask: task.title,
            toTask: testingTask.title,
            type: 'blocking'
          });
        }
      });
    }

    return dependencies;
  }

  /**
   * Calculate total execution time considering parallel execution
   */
  private calculateParallelExecutionTime(tasks: PlannedTask[], dependencies: TaskDependency[]): number {
    // Simple critical path calculation
    const taskMap = new Map<string, PlannedTask>();
    tasks.forEach(task => taskMap.set(task.title, task));
    
    // Find tasks with no dependencies (can start immediately)
    const independentTasks = tasks.filter(task => task.dependencies.length === 0);
    
    if (independentTasks.length === 0) {
      // Fallback: sum all tasks
      return tasks.reduce((total, task) => total + task.estimatedDuration, 0);
    }

    // Calculate critical path (simplified)
    let maxPath = 0;
    
    for (const startTask of independentTasks) {
      const pathLength = this.calculatePathLength(startTask, taskMap, dependencies);
      maxPath = Math.max(maxPath, pathLength);
    }
    
    return maxPath;
  }

  /**
   * Calculate the length of the longest path from a given task
   */
  private calculatePathLength(
    task: PlannedTask, 
    taskMap: Map<string, PlannedTask>,
    dependencies: TaskDependency[],
    visited: Set<string> = new Set()
  ): number {
    if (visited.has(task.title)) {
      return 0; // Avoid cycles
    }
    
    visited.add(task.title);
    
    const dependentTasks = dependencies
      .filter(dep => dep.fromTask === task.title)
      .map(dep => taskMap.get(dep.toTask))
      .filter(Boolean) as PlannedTask[];
    
    let maxDependentPath = 0;
    for (const dependentTask of dependentTasks) {
      const pathLength = this.calculatePathLength(dependentTask, taskMap, dependencies, new Set(visited));
      maxDependentPath = Math.max(maxDependentPath, pathLength);
    }
    
    return task.estimatedDuration + maxDependentPath;
  }

  /**
   * Assess risks in the task plan
   */
  private assessRisks(tasks: PlannedTask[], request: TaskPlanningRequest): RiskFactor[] {
    const risks: RiskFactor[] = [];
    
    // Check for high complexity tasks
    const highComplexityTasks = tasks.filter(t => t.complexity === 'high');
    if (highComplexityTasks.length > 0) {
      risks.push({
        type: 'complexity',
        description: `${highComplexityTasks.length} high-complexity tasks may require additional time`,
        severity: 'medium'
      });
    }
    
    // Check for dependency chains
    const maxDependencies = Math.max(...tasks.map(t => t.dependencies.length));
    if (maxDependencies > 2) {
      risks.push({
        type: 'dependency',
        description: 'Complex dependency chains may cause delays if tasks are blocked',
        severity: 'medium'
      });
    }
    
    // Check for resource constraints
    const agentUtilization = new Map<string, number>();
    tasks.forEach(task => {
      const current = agentUtilization.get(task.suggestedAgent) || 0;
      agentUtilization.set(task.suggestedAgent, current + 1);
    });
    
    const overloadedAgents = Array.from(agentUtilization.entries()).filter(([, count]) => count > 3);
    if (overloadedAgents.length > 0) {
      risks.push({
        type: 'resource',
        description: `${overloadedAgents.length} agents have heavy workloads`,
        severity: 'low'
      });
    }
    
    return risks;
  }

  /**
   * Calculate confidence score for the task plan
   */
  private calculateConfidence(tasks: PlannedTask[], risks: RiskFactor[]): number {
    let baseConfidence = 0.8;
    
    // Adjust based on task complexity
    const complexityPenalty = tasks.filter(t => t.complexity === 'high').length * 0.05;
    baseConfidence -= complexityPenalty;
    
    // Adjust based on risks
    const riskPenalty = risks.reduce((penalty, risk) => {
      switch (risk.severity) {
        case 'high': return penalty + 0.15;
        case 'medium': return penalty + 0.1;
        case 'low': return penalty + 0.05;
        default: return penalty;
      }
    }, 0);
    baseConfidence -= riskPenalty;
    
    // Ensure confidence is between 0 and 1
    return Math.max(0.3, Math.min(1.0, baseConfidence));
  }

  /**
   * Add planning result to history
   */
  private addToHistory(result: TaskPlanningResult): void {
    this.planningHistory.push(result);
    
    if (this.planningHistory.length > this.maxHistorySize) {
      this.planningHistory = this.planningHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get planning history
   */
  getPlanningHistory(): TaskPlanningResult[] {
    return [...this.planningHistory];
  }

  /**
   * Clear planning history
   */
  clearHistory(): void {
    this.planningHistory = [];
    this.emit('historyCleared');
  }

  /**
   * Get agent utilization statistics
   */
  getAgentUtilizationStats(): Map<string, { tasks: number; totalDuration: number; avgDuration: number }> {
    const stats = new Map();
    
    this.planningHistory.forEach(result => {
      result.agentUtilization.forEach((duration, agentName) => {
        const current = stats.get(agentName) || { tasks: 0, totalDuration: 0, avgDuration: 0 };
        current.tasks++;
        current.totalDuration += duration;
        current.avgDuration = current.totalDuration / current.tasks;
        stats.set(agentName, current);
      });
    });
    
    return stats;
  }
}