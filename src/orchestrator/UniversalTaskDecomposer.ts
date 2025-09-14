/**
 * Universal Task Decomposer - Project-Agnostic Task Planning
 * 
 * Breaks down natural language requests into actionable tasks based on
 * project context, available agents, and architectural patterns.
 */

import { analyzeProjectContext, type ProjectContext } from '../context/context7-integration.js';
import { QueryProcessor } from './QueryProcessor.js';
import { TaskDependencyGraph } from './TaskDependencyGraph.js';
import { 
  TaskDefinition, 
  TaskExecution, 
  AgentType,
  TaskStatus,
  ExecutionGraph 
} from './types.js';

export interface TaskDecompositionOptions {
  maxTasks?: number;
  maxDepth?: number;
  preferredAgents?: AgentType[];
  executionMode?: 'sequential' | 'parallel' | 'adaptive';
  complexity?: 'simple' | 'moderate' | 'complex';
}

export interface DecompositionResult {
  tasks: TaskDefinition[];
  executionGraph: ExecutionGraph;
  estimatedTime: number;
  recommendedAgents: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  parallelizable: boolean;
}

export interface TaskTemplate {
  pattern: RegExp;
  category: string;
  complexity: 'simple' | 'moderate' | 'complex';
  generator: (match: string[], context: ProjectContext) => TaskDefinition[];
}

export class UniversalTaskDecomposer {
  private projectContext?: ProjectContext;
  private queryProcessor: QueryProcessor;
  private taskGraph: TaskDependencyGraph;
  private taskTemplates: TaskTemplate[];
  
  constructor() {
    this.queryProcessor = new QueryProcessor();
    this.taskGraph = new TaskDependencyGraph();
    this.initializeTaskTemplates();
  }
  
  /**
   * Initialize with project context for intelligent decomposition
   */
  async initialize(rootPath: string): Promise<void> {
    console.log('🔍 Initializing universal task decomposer...');
    this.projectContext = await analyzeProjectContext(rootPath);
    console.log(`✅ Project context loaded: ${this.projectContext.name} (${this.projectContext.architecture.type})`);
  }
  
  /**
   * Decompose natural language request into actionable tasks
   */
  async decomposeRequest(
    request: string, 
    options: TaskDecompositionOptions = {}
  ): Promise<DecompositionResult> {
    if (!this.projectContext) {
      throw new Error('Task decomposer not initialized. Call initialize() first.');
    }
    
    console.log(`🎯 Decomposing request: "${request}"`);
    
    // Phase 1: Parse query and assess complexity
    const queryAnalysis = this.queryProcessor.parseQuery(request);
    const complexity = this.assessRequestComplexity(request, queryAnalysis);
    
    // Phase 2: Match against task templates
    const matchedTemplates = this.matchTaskTemplates(request);
    
    // Phase 3: Generate initial task set
    let tasks: TaskDefinition[] = [];
    
    if (matchedTemplates.length > 0) {
      // Use template-based decomposition
      tasks = this.generateTasksFromTemplates(matchedTemplates, request);
    } else {
      // Use intelligent decomposition based on context
      tasks = await this.intelligentDecomposition(request, queryAnalysis);
    }
    
    // Phase 4: Apply context-aware optimization
    tasks = this.optimizeTasksForContext(tasks);
    
    // Phase 5: Build execution graph
    const executionGraph = this.buildExecutionGraph(tasks);
    
    // Phase 6: Estimate execution time
    const estimatedTime = this.estimateExecutionTime(tasks);
    
    // Phase 7: Extract agent recommendations
    const recommendedAgents = Array.from(new Set(tasks.map(t => t.agent)));
    
    const result: DecompositionResult = {
      tasks,
      executionGraph,
      estimatedTime,
      recommendedAgents,
      complexity,
      parallelizable: executionGraph.parallelizable
    };
    
    console.log(`✅ Decomposed into ${tasks.length} tasks (${complexity} complexity)`);
    return result;
  }
  
  /**
   * Initialize task templates for common patterns
   */
  private initializeTaskTemplates(): void {
    this.taskTemplates = [
      // Feature development patterns
      {
        pattern: /(?:create|build|add|implement)\s+(?:a\s+)?(.+?)\s+(?:feature|component|page|api|endpoint)/i,
        category: 'feature_development',
        complexity: 'moderate',
        generator: (matches, context) => this.generateFeatureTasks(matches[1], context)
      },
      
      // Bug fixing patterns
      {
        pattern: /(?:fix|resolve|debug)\s+(.+?)(?:\s+(?:bug|issue|problem|error))?/i,
        category: 'bug_fixing',
        complexity: 'simple',
        generator: (matches, context) => this.generateBugFixTasks(matches[1], context)
      },
      
      // Refactoring patterns
      {
        pattern: /(?:refactor|restructure|reorganize|optimize)\s+(.+)/i,
        category: 'refactoring',
        complexity: 'complex',
        generator: (matches, context) => this.generateRefactorTasks(matches[1], context)
      },
      
      // Testing patterns
      {
        pattern: /(?:test|add tests for|write tests)\s+(.+)/i,
        category: 'testing',
        complexity: 'simple',
        generator: (matches, context) => this.generateTestTasks(matches[1], context)
      },
      
      // Infrastructure patterns
      {
        pattern: /(?:setup|configure|deploy|add)\s+(.+?)(?:\s+(?:infrastructure|deployment|ci\/cd|pipeline))?/i,
        category: 'infrastructure',
        complexity: 'complex',
        generator: (matches, context) => this.generateInfrastructureTasks(matches[1], context)
      },
      
      // Authentication patterns
      {
        pattern: /(?:add|implement|setup)\s+(?:authentication|auth|login|security)/i,
        category: 'authentication',
        complexity: 'complex',
        generator: (matches, context) => this.generateAuthTasks(context)
      },
      
      // Database patterns
      {
        pattern: /(?:add|create|setup|migrate)\s+(?:database|db|schema|model|table)\s*(.+)?/i,
        category: 'database',
        complexity: 'moderate',
        generator: (matches, context) => this.generateDatabaseTasks(matches[1] || '', context)
      },
      
      // Performance patterns
      {
        pattern: /(?:optimize|improve|speed up|performance)\s+(.+)/i,
        category: 'performance',
        complexity: 'complex',
        generator: (matches, context) => this.generatePerformanceTasks(matches[1], context)
      },
      
      // Architecture patterns
      {
        pattern: /(?:design|architect|restructure)\s+(?:system|architecture|structure)\s*(.+)?/i,
        category: 'architecture',
        complexity: 'complex',
        generator: (matches, context) => this.generateArchitectureTasks(matches[1] || '', context)
      }
    ];
  }
  
  /**
   * Match request against task templates
   */
  private matchTaskTemplates(request: string): Array<{template: TaskTemplate, matches: string[]}> {
    const matches: Array<{template: TaskTemplate, matches: string[]}> = [];
    
    for (const template of this.taskTemplates) {
      const match = request.match(template.pattern);
      if (match) {
        matches.push({ template, matches: match });
      }
    }
    
    return matches;
  }
  
  /**
   * Generate tasks from matched templates
   */
  private generateTasksFromTemplates(
    matchedTemplates: Array<{template: TaskTemplate, matches: string[]}>,
    request: string
  ): TaskDefinition[] {
    const tasks: TaskDefinition[] = [];
    
    for (const { template, matches } of matchedTemplates) {
      const generatedTasks = template.generator(matches, this.projectContext!);
      tasks.push(...generatedTasks);
    }
    
    return tasks;
  }
  
  /**
   * Intelligent decomposition for complex or unmatched requests
   */
  private async intelligentDecomposition(
    request: string,
    queryAnalysis: any
  ): Promise<TaskDefinition[]> {
    const tasks: TaskDefinition[] = [];
    const context = this.projectContext!;
    
    // Analyze request intent and context
    const intents = this.extractIntents(request);
    const scope = this.determineScope(request, context);
    
    // Generate tasks based on intents
    for (const intent of intents) {
      switch (intent.type) {
        case 'create':
          tasks.push(...this.generateCreationTasks(intent.target, scope, context));
          break;
        case 'modify':
          tasks.push(...this.generateModificationTasks(intent.target, scope, context));
          break;
        case 'analyze':
          tasks.push(...this.generateAnalysisTasks(intent.target, scope, context));
          break;
        case 'integrate':
          tasks.push(...this.generateIntegrationTasks(intent.target, scope, context));
          break;
        default:
          // Fallback to generic task
          tasks.push(this.createGenericTask(request, context));
      }
    }
    
    return tasks;
  }
  
  /**
   * Task template generators
   */
  
  private generateFeatureTasks(featureName: string, context: ProjectContext): TaskDefinition[] {
    const tasks: TaskDefinition[] = [];
    const architecture = context.architecture;
    
    // Base task ID
    const baseId = `feature-${featureName.replace(/\s+/g, '-').toLowerCase()}`;
    
    // 1. Architecture planning (if complex project)
    if (architecture.type === 'microservices' || architecture.services.length > 2) {
      tasks.push({
        id: `${baseId}-arch`,
        title: `Architecture for ${featureName}`,
        description: `Design architecture for ${featureName} feature`,
        agentType: 'architect',
        agent: 'architect',
        complexity: 'medium',
        estimatedDuration: 15,
        dependencies: [],
        tools: ['architecture-design', 'system-analysis'],
        priority: 1,
        estimatedMinutes: 15
      });
    }
    
    // 2. Backend tasks (if backend exists)
    const hasBackend = context.recommendedAgents.some(a => a.type === 'backend');
    if (hasBackend) {
      tasks.push({
        id: `${baseId}-backend`,
        title: `Backend for ${featureName}`,
        description: `Implement ${featureName} backend logic`,
        agentType: 'backend',
        agent: 'backend',
        complexity: 'high',
        estimatedDuration: 45,
        dependencies: architecture.type === 'microservices' ? [`${baseId}-arch`] : [],
        tools: ['backend-development', 'api-design'],
        priority: 2,
        estimatedMinutes: 45
      });
      
      // Database tasks if needed
      if (context.techStack.databases.length > 0) {
        tasks.push({
          id: `${baseId}-db`,
          title: `Database schema for ${featureName}`,
          description: `Update database schema for ${featureName}`,
          agentType: 'backend',
          agent: 'backend',
          complexity: 'medium',
          estimatedDuration: 20,
          dependencies: [],
          tools: ['database-design', 'schema-migration'],
          priority: 1,
          estimatedMinutes: 20
        });
      }
    }
    
    // 3. Frontend tasks (if frontend exists)
    const hasFrontend = context.recommendedAgents.some(a => a.type === 'frontend');
    if (hasFrontend) {
      tasks.push({
        id: `${baseId}-frontend`,
        title: `Frontend for ${featureName}`,
        description: `Create ${featureName} UI components`,
        agentType: 'frontend',
        agent: 'frontend',
        complexity: 'high',
        estimatedDuration: 60,
        dependencies: hasBackend ? [`${baseId}-backend`] : [],
        tools: ['component-development', 'ui-design'],
        priority: 2,
        estimatedMinutes: 60
      });
    }
    
    // 4. Testing tasks
    if (context.workflow.testingStrategy !== 'unit') {
      tasks.push({
        id: `${baseId}-test`,
        title: `Tests for ${featureName}`,
        description: `Write tests for ${featureName} feature`,
        agentType: 'test-writer',
        agent: 'test-writer',
        complexity: 'medium',
        estimatedDuration: 30,
        dependencies: [
          ...(hasBackend ? [`${baseId}-backend`] : []),
          ...(hasFrontend ? [`${baseId}-frontend`] : [])
        ],
        tools: ['test-writing', 'test-automation'],
        priority: 3,
        estimatedMinutes: 30
      });
    }
    
    return tasks;
  }
  
  private generateBugFixTasks(issue: string, context: ProjectContext): TaskDefinition[] {
    return [
      {
        id: `bugfix-${Date.now()}`,
        title: `Fix ${issue}`,
        description: `Investigate and fix: ${issue}`,
        agentType: this.selectBestAgent(issue, context),
        agent: this.selectBestAgent(issue, context),
        complexity: 'medium',
        estimatedDuration: 30,
        dependencies: [],
        tools: ['debugging', 'code-analysis'],
        priority: 1,
        estimatedMinutes: 30
      },
      {
        id: `bugfix-test-${Date.now()}`,
        title: `Test for ${issue}`,
        description: `Add regression test for: ${issue}`,
        agentType: 'test-writer',
        agent: 'test-writer',
        complexity: 'low',
        estimatedDuration: 15,
        dependencies: [`bugfix-${Date.now()}`],
        tools: ['test-writing', 'test-automation'],
        priority: 2,
        estimatedMinutes: 15
      }
    ];
  }
  
  private generateRefactorTasks(target: string, context: ProjectContext): TaskDefinition[] {
    const tasks: TaskDefinition[] = [];
    
    // Analysis phase
    tasks.push({
      id: `refactor-analyze-${Date.now()}`,
      title: `Analyze ${target}`,
      description: `Analyze current ${target} structure`,
      agentType: 'architect',
      agent: 'architect',
      complexity: 'medium',
      estimatedDuration: 20,
      dependencies: [],
      tools: ['code-analysis', 'architecture-review'],
      priority: 1,
      estimatedMinutes: 20
    });
    
    // Planning phase
    tasks.push({
      id: `refactor-plan-${Date.now()}`,
      title: `Plan ${target} refactoring`,
      description: `Create refactoring plan for ${target}`,
      agentType: 'architect',
      agent: 'architect',
      complexity: 'medium',
      estimatedDuration: 15,
      dependencies: [`refactor-analyze-${Date.now()}`],
      tools: ['architecture-design', 'planning'],
      priority: 2,
      estimatedMinutes: 15
    });
    
    // Implementation phase
    tasks.push({
      id: `refactor-implement-${Date.now()}`,
      title: `Implement ${target} refactoring`,
      description: `Implement ${target} refactoring`,
      agentType: this.selectBestAgent(target, context),
      agent: this.selectBestAgent(target, context),
      complexity: 'high',
      estimatedDuration: 90,
      dependencies: [`refactor-plan-${Date.now()}`],
      tools: ['code-refactoring', 'development'],
      priority: 3,
      estimatedMinutes: 90
    });
    
    // Testing phase
    tasks.push({
      id: `refactor-test-${Date.now()}`,
      title: `Test refactored ${target}`,
      description: `Verify refactored ${target} functionality`,
      agentType: 'test-writer',
      agent: 'test-writer',
      complexity: 'medium',
      estimatedDuration: 30,
      dependencies: [`refactor-implement-${Date.now()}`],
      tools: ['test-writing', 'verification'],
      priority: 4,
      estimatedMinutes: 30
    });
    
    return tasks;
  }
  
  private generateTestTasks(target: string, context: ProjectContext): TaskDefinition[] {
    const strategy = context.workflow.testingStrategy;
    
    const tasks: TaskDefinition[] = [
      {
        id: `test-unit-${Date.now()}`,
        description: `Write unit tests for ${target}`,
        agent: 'test-writer',
        dependencies: [],
        priority: 1,
        estimatedMinutes: 25
      }
    ];
    
    if (strategy === 'integration' || strategy === 'mixed') {
      tasks.push({
        id: `test-integration-${Date.now()}`,
        description: `Write integration tests for ${target}`,
        agent: 'test-writer',
        dependencies: [`test-unit-${Date.now()}`],
        priority: 2,
        estimatedMinutes: 35
      });
    }
    
    if (strategy === 'e2e' || strategy === 'mixed') {
      tasks.push({
        id: `test-e2e-${Date.now()}`,
        description: `Write end-to-end tests for ${target}`,
        agent: 'test-writer',
        dependencies: tasks.length > 1 ? [`test-integration-${Date.now()}`] : [`test-unit-${Date.now()}`],
        priority: 3,
        estimatedMinutes: 45
      });
    }
    
    return tasks;
  }
  
  private generateInfrastructureTasks(infrastructure: string, context: ProjectContext): TaskDefinition[] {
    const tasks: TaskDefinition[] = [];
    
    if (infrastructure.includes('ci') || infrastructure.includes('pipeline')) {
      tasks.push({
        id: `infra-ci-${Date.now()}`,
        description: `Setup CI/CD pipeline`,
        agent: 'devops',
        dependencies: [],
        priority: 1,
        estimatedMinutes: 60
      });
    }
    
    if (infrastructure.includes('docker') || context.workflow.deploymentPattern === 'container') {
      tasks.push({
        id: `infra-docker-${Date.now()}`,
        description: `Configure Docker containerization`,
        agent: 'devops',
        dependencies: [],
        priority: 2,
        estimatedMinutes: 30
      });
    }
    
    if (infrastructure.includes('monitor')) {
      tasks.push({
        id: `infra-monitoring-${Date.now()}`,
        description: `Setup monitoring and alerting`,
        agent: 'devops',
        dependencies: [],
        priority: 3,
        estimatedMinutes: 45
      });
    }
    
    return tasks;
  }
  
  private generateAuthTasks(context: ProjectContext): TaskDefinition[] {
    const tasks: TaskDefinition[] = [];
    const hasBackend = context.recommendedAgents.some(a => a.type === 'backend');
    const hasFrontend = context.recommendedAgents.some(a => a.type === 'frontend');
    
    // Architecture planning
    tasks.push({
      id: `auth-design-${Date.now()}`,
      description: 'Design authentication architecture',
      agent: 'architect',
      dependencies: [],
      priority: 1,
      estimatedMinutes: 20
    });
    
    // Backend authentication
    if (hasBackend) {
      tasks.push({
        id: `auth-backend-${Date.now()}`,
        description: 'Implement authentication backend',
        agent: 'backend',
        dependencies: [`auth-design-${Date.now()}`],
        priority: 2,
        estimatedMinutes: 90
      });
    }
    
    // Frontend authentication
    if (hasFrontend) {
      tasks.push({
        id: `auth-frontend-${Date.now()}`,
        description: 'Implement authentication UI',
        agent: 'frontend',
        dependencies: hasBackend ? [`auth-backend-${Date.now()}`] : [`auth-design-${Date.now()}`],
        priority: 3,
        estimatedMinutes: 60
      });
    }
    
    // Security review
    tasks.push({
      id: `auth-security-${Date.now()}`,
      description: 'Security review of authentication implementation',
      agent: 'security',
      dependencies: [
        ...(hasBackend ? [`auth-backend-${Date.now()}`] : []),
        ...(hasFrontend ? [`auth-frontend-${Date.now()}`] : [])
      ],
      priority: 4,
      estimatedMinutes: 30
    });
    
    return tasks;
  }
  
  private generateDatabaseTasks(schema: string, context: ProjectContext): TaskDefinition[] {
    const dbType = context.techStack.databases[0]?.type || 'sql';
    
    return [
      {
        id: `db-design-${Date.now()}`,
        description: `Design database schema ${schema ? 'for ' + schema : ''}`,
        agent: 'backend',
        dependencies: [],
        priority: 1,
        estimatedMinutes: 25
      },
      {
        id: `db-migrate-${Date.now()}`,
        description: `Create database migration ${schema ? 'for ' + schema : ''}`,
        agent: 'backend',
        dependencies: [`db-design-${Date.now()}`],
        priority: 2,
        estimatedMinutes: 20
      },
      {
        id: `db-test-${Date.now()}`,
        description: `Test database operations ${schema ? 'for ' + schema : ''}`,
        agent: 'test-writer',
        dependencies: [`db-migrate-${Date.now()}`],
        priority: 3,
        estimatedMinutes: 15
      }
    ];
  }
  
  private generatePerformanceTasks(target: string, context: ProjectContext): TaskDefinition[] {
    return [
      {
        id: `perf-analyze-${Date.now()}`,
        description: `Analyze performance bottlenecks in ${target}`,
        agent: 'performance',
        dependencies: [],
        priority: 1,
        estimatedMinutes: 30
      },
      {
        id: `perf-optimize-${Date.now()}`,
        description: `Optimize ${target} performance`,
        agent: this.selectBestAgent(target, context),
        dependencies: [`perf-analyze-${Date.now()}`],
        priority: 2,
        estimatedMinutes: 60
      },
      {
        id: `perf-measure-${Date.now()}`,
        description: `Measure performance improvements in ${target}`,
        agent: 'performance',
        dependencies: [`perf-optimize-${Date.now()}`],
        priority: 3,
        estimatedMinutes: 20
      }
    ];
  }
  
  private generateArchitectureTasks(system: string, context: ProjectContext): TaskDefinition[] {
    return [
      {
        id: `arch-analyze-${Date.now()}`,
        description: `Analyze current architecture ${system ? 'for ' + system : ''}`,
        agent: 'architect',
        dependencies: [],
        priority: 1,
        estimatedMinutes: 45
      },
      {
        id: `arch-design-${Date.now()}`,
        description: `Design improved architecture ${system ? 'for ' + system : ''}`,
        agent: 'architect',
        dependencies: [`arch-analyze-${Date.now()}`],
        priority: 2,
        estimatedMinutes: 60
      },
      {
        id: `arch-plan-${Date.now()}`,
        description: `Create implementation plan for new architecture`,
        agent: 'architect',
        dependencies: [`arch-design-${Date.now()}`],
        priority: 3,
        estimatedMinutes: 30
      }
    ];
  }
  
  // Helper methods
  private selectBestAgent(target: string, context: ProjectContext): AgentType {
    const targetLower = target.toLowerCase();
    
    if (targetLower.includes('ui') || targetLower.includes('frontend') || targetLower.includes('component')) {
      return 'frontend';
    }
    if (targetLower.includes('api') || targetLower.includes('backend') || targetLower.includes('server')) {
      return 'backend';
    }
    if (targetLower.includes('test')) {
      return 'test-writer';
    }
    if (targetLower.includes('deploy') || targetLower.includes('infra')) {
      return 'devops';
    }
    if (targetLower.includes('design') || targetLower.includes('ui')) {
      return 'design';
    }
    
    // Default based on project type
    const frontendAgent = context.recommendedAgents.find(a => a.type === 'frontend');
    const backendAgent = context.recommendedAgents.find(a => a.type === 'backend');
    
    if (frontendAgent && backendAgent) {
      return 'architect'; // Complex project needs coordination
    } else if (frontendAgent) {
      return 'frontend';
    } else if (backendAgent) {
      return 'backend';
    }
    
    return 'architect'; // Fallback
  }
  
  private assessRequestComplexity(request: string, queryAnalysis: any): 'simple' | 'moderate' | 'complex' {
    const complexKeywords = ['architecture', 'refactor', 'migrate', 'scale', 'performance', 'security', 'infrastructure'];
    const moderateKeywords = ['feature', 'integration', 'auth', 'database', 'api'];
    
    const requestLower = request.toLowerCase();
    
    if (complexKeywords.some(keyword => requestLower.includes(keyword))) {
      return 'complex';
    }
    if (moderateKeywords.some(keyword => requestLower.includes(keyword))) {
      return 'moderate';
    }
    
    return 'simple';
  }
  
  private optimizeTasksForContext(tasks: TaskDefinition[]): TaskDefinition[] {
    // Remove duplicates
    const uniqueTasks = tasks.filter((task, index, self) => 
      index === self.findIndex(t => t.id === task.id)
    );
    
    // Optimize for project capabilities
    return uniqueTasks.map(task => {
      // Adjust estimates based on project complexity
      if (this.projectContext?.architecture.type === 'microservices') {
        task.estimatedMinutes = Math.ceil((task.estimatedMinutes || 30) * 1.2);
      }
      
      return task;
    });
  }
  
  private buildExecutionGraph(tasks: TaskDefinition[]): ExecutionGraph {
    this.taskGraph.clear();
    
    // Add all tasks to graph
    for (const task of tasks) {
      this.taskGraph.addTask(task);
    }
    
    // Build execution order
    const executionOrder = this.taskGraph.topologicalSort();
    
    return {
      nodes: tasks.map(t => ({
        ...t,
        status: 'pending' as TaskStatus,
        progress: 0,
        logs: [],
        retryCount: 0,
        maxRetries: 3
      })),
      edges: this.buildTaskEdges(tasks),
      ...executionOrder
    };
  }
  
  private buildTaskEdges(tasks: TaskDefinition[]): Array<{from: string, to: string, type: 'dependency' | 'sequence'}> {
    const edges: Array<{from: string, to: string, type: 'dependency' | 'sequence'}> = [];
    
    for (const task of tasks) {
      for (const dep of task.dependencies) {
        edges.push({
          from: dep,
          to: task.id,
          type: 'dependency'
        });
      }
    }
    
    return edges;
  }
  
  private estimateExecutionTime(tasks: TaskDefinition[]): number {
    return tasks.reduce((total, task) => total + (task.estimatedMinutes || 30), 0);
  }
  
  private extractIntents(request: string): Array<{type: string, target: string}> {
    // Simplified intent extraction - could be enhanced with NLP
    const intents: Array<{type: string, target: string}> = [];
    
    const createPattern = /(?:create|build|add|implement)\s+(.+)/i;
    const modifyPattern = /(?:modify|update|change|fix)\s+(.+)/i;
    const analyzePattern = /(?:analyze|review|check)\s+(.+)/i;
    const integratePattern = /(?:integrate|connect|link)\s+(.+)/i;
    
    let match = request.match(createPattern);
    if (match) intents.push({ type: 'create', target: match[1] });
    
    match = request.match(modifyPattern);
    if (match) intents.push({ type: 'modify', target: match[1] });
    
    match = request.match(analyzePattern);
    if (match) intents.push({ type: 'analyze', target: match[1] });
    
    match = request.match(integratePattern);
    if (match) intents.push({ type: 'integrate', target: match[1] });
    
    return intents.length > 0 ? intents : [{ type: 'generic', target: request }];
  }
  
  private determineScope(request: string, context: ProjectContext): string {
    if (request.toLowerCase().includes('entire') || request.toLowerCase().includes('whole')) {
      return 'full';
    }
    if (context.architecture.type === 'microservices') {
      return 'service';
    }
    return 'component';
  }
  
  private generateCreationTasks(target: string, scope: string, context: ProjectContext): TaskDefinition[] {
    // Generic creation task generation
    return [{
      id: `create-${target.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
      description: `Create ${target}`,
      agent: this.selectBestAgent(target, context),
      dependencies: [],
      priority: 1,
      estimatedMinutes: scope === 'full' ? 90 : 45
    }];
  }
  
  private generateModificationTasks(target: string, scope: string, context: ProjectContext): TaskDefinition[] {
    // Generic modification task generation
    return [{
      id: `modify-${target.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
      description: `Modify ${target}`,
      agent: this.selectBestAgent(target, context),
      dependencies: [],
      priority: 1,
      estimatedMinutes: scope === 'full' ? 60 : 30
    }];
  }
  
  private generateAnalysisTasks(target: string, scope: string, context: ProjectContext): TaskDefinition[] {
    // Generic analysis task generation
    return [{
      id: `analyze-${target.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
      description: `Analyze ${target}`,
      agent: 'architect',
      dependencies: [],
      priority: 1,
      estimatedMinutes: scope === 'full' ? 45 : 20
    }];
  }
  
  private generateIntegrationTasks(target: string, scope: string, context: ProjectContext): TaskDefinition[] {
    // Generic integration task generation
    return [{
      id: `integrate-${target.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
      description: `Integrate ${target}`,
      agent: 'architect',
      dependencies: [],
      priority: 1,
      estimatedMinutes: scope === 'full' ? 75 : 40
    }];
  }
  
  private createGenericTask(request: string, context: ProjectContext): TaskDefinition {
    return {
      id: `generic-${Date.now()}`,
      description: request,
      agent: 'architect',
      dependencies: [],
      priority: 1,
      estimatedMinutes: 45
    };
  }
}

// Export default instance
export const universalTaskDecomposer = new UniversalTaskDecomposer();
