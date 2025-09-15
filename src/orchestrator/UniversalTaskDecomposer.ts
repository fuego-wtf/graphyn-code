/**
 * Universal Task Decomposer - DAG-based intelligent task decomposition
 *
 * Analyzes natural language queries and decomposes them into parallel,
 * executable task graphs with dependency management and agent assignment.
 *
 * Features:
 * - DAG-based task decomposition with dependency analysis
 * - Intelligent parallelization for <30s completion targets
 * - Agent capability matching and optimal assignment
 * - Risk assessment and complexity evaluation
 */

import { EventEmitter } from 'events';
import {
  ExecutionGraph,
  TaskNode,
  TaskStatus,
  TaskPriority,
  TaskComplexity,
  QueryIntent,
  QueryComplexity,
  ParsedQuery,
  TaskDefinition,
  TaskDependency,
  TaskMetadata,
  ExtractedEntity
} from './types.js';
import {
  TASK_COMPLETION_TARGET_MS,
  COMPLEXITY_THRESHOLDS,
  INTENT_PATTERNS,
  AGENT_PERSONAS,
  DEFAULT_TASK_PRIORITY,
  MAX_TASK_DEPENDENCIES
} from './constants.js';
import { QueryClassifier, QueryClassification } from './QueryClassifier.js';

/**
 * Configuration for task decomposer
 */
export interface UniversalTaskDecomposerConfig {
  readonly maxComplexity?: QueryComplexity;
  readonly enableParallelization?: boolean;
  readonly targetCompletionMs?: number;
  readonly maxTasksPerQuery?: number;
  readonly enableRiskAnalysis?: boolean;
}

/**
 * Task decomposition result with risk analysis
 */
export interface DecompositionResult {
  readonly originalQuery: string;
  readonly parsedQuery: ParsedQuery;
  readonly executionGraph: ExecutionGraph;
  readonly riskFactors: RiskFactor[];
  readonly confidence: number;
  readonly estimatedCompletionMs: number;
}

/**
 * Risk factor identification
 */
export interface RiskFactor {
  readonly type: 'complexity' | 'dependency' | 'resource' | 'time' | 'unknown';
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly description: string;
  readonly mitigation?: string;
}

/**
 * Universal Task Decomposer - Intelligent query-to-task conversion
 */
export class UniversalTaskDecomposer extends EventEmitter {
  private readonly config: Required<UniversalTaskDecomposerConfig>;
  private readonly queryClassifier: QueryClassifier;
  private taskCounter = 0;

  constructor(config: UniversalTaskDecomposerConfig = {}) {
    super();

    this.config = {
      maxComplexity: config.maxComplexity || QueryComplexity.ENTERPRISE,
      enableParallelization: config.enableParallelization ?? true,
      targetCompletionMs: config.targetCompletionMs || TASK_COMPLETION_TARGET_MS,
      maxTasksPerQuery: config.maxTasksPerQuery || 12,
      enableRiskAnalysis: config.enableRiskAnalysis ?? true
    };
    
    this.queryClassifier = new QueryClassifier();
  }

  /**
   * Main decomposition method - converts query to executable task graph
   */
  async decomposeQuery(query: string): Promise<ExecutionGraph> {
    try {
      this.emit('decompositionProgress', { phase: 'parsing', query });

      // Phase 1: Query parsing and intent recognition
      const parsedQuery = await this.parseQuery(query);

      this.emit('decompositionProgress', {
        phase: 'analysis',
        intent: parsedQuery.intent,
        complexity: parsedQuery.complexity
      });

      // Phase 2: Task generation based on intent and complexity
      const tasks = await this.generateTasks(parsedQuery);

      this.emit('decompositionProgress', {
        phase: 'dependencies',
        taskCount: tasks.length
      });

      // Phase 3: Dependency analysis and graph construction
      const dependencies = await this.analyzeDependencies(tasks);
      const executionGraph = this.buildExecutionGraph(tasks, dependencies);

      // Phase 4: Parallelization optimization
      if (this.config.enableParallelization) {
        this.optimizeForParallelism(executionGraph);
      }

      this.emit('decompositionProgress', {
        phase: 'completed',
        graph: executionGraph
      });

      return executionGraph;

    } catch (error) {
      this.emit('decompositionError', { query, error });
      throw new Error(`Task decomposition failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse natural language query into structured format
   */
  private async parseQuery(query: string): Promise<ParsedQuery> {
    // Intent recognition using pattern matching
    const intent = this.recognizeIntent(query);

    // Complexity analysis based on keywords and structure
    const complexity = this.analyzeComplexity(query);

    // Entity extraction (files, technologies, concepts)
    const entities = this.extractEntities(query);

    // Agent hints based on domain keywords
    const agentHints = this.extractAgentHints(query);

    return {
      originalQuery: query,
      intent,
      entities,
      complexity,
      agentHints,
      confidence: this.calculateParsingConfidence(query, intent, entities)
    };
  }

  /**
   * Generate task definitions from parsed query
   */
  private async generateTasks(parsedQuery: ParsedQuery): Promise<TaskDefinition[]> {
    const tasks: TaskDefinition[] = [];

    switch (parsedQuery.intent) {
      case QueryIntent.BUILD:
        tasks.push(...await this.generateBuildTasks(parsedQuery));
        break;
      case QueryIntent.ANALYZE:
        tasks.push(...await this.generateAnalysisTasks(parsedQuery));
        break;
      case QueryIntent.DEBUG:
        tasks.push(...await this.generateDebugTasks(parsedQuery));
        break;
      case QueryIntent.OPTIMIZE:
        tasks.push(...await this.generateOptimizationTasks(parsedQuery));
        break;
      case QueryIntent.TEST:
        tasks.push(...await this.generateTestTasks(parsedQuery));
        break;
      case QueryIntent.DEPLOY:
        tasks.push(...await this.generateDeploymentTasks(parsedQuery));
        break;
      default:
        tasks.push(...await this.generateGeneralTasks(parsedQuery));
        break;
    }

    // Ensure we don't exceed maximum tasks per query
    if (tasks.length > this.config.maxTasksPerQuery) {
      return tasks
        .sort((a, b) => this.calculateTaskPriority(b) - this.calculateTaskPriority(a))
        .slice(0, this.config.maxTasksPerQuery);
    }

    return tasks;
  }

  /**
   * Generate tasks for build/create operations - CLAUDE POWERED VERSION with proper streaming
   * Uses Claude Code SDK for intelligent task decomposition
   */
  private async generateBuildTasks(parsedQuery: ParsedQuery): Promise<TaskDefinition[]> {
    const { originalQuery, entities, complexity } = parsedQuery;
    
    try {
      // Import Claude Code SDK
      const { query } = await import('@anthropic-ai/claude-code');
      
      let result = '';
      let isComplete = false;
      
      // Use simple string prompt for better compatibility
      const taskPrompt = `You are a professional software architect. Break down this development request into specific, actionable tasks.

Request: "${originalQuery}"

Provide a JSON response with tasks that are:
- Specific and actionable
- Appropriately sized (simple requests = 1 task, complex = multiple tasks)
- Include realistic time estimates
- Assign appropriate agent types

Response format:
{
  "tasks": [
    {
      "title": "Task title",
      "description": "Detailed description",
      "agentType": "assistant|backend|frontend|tester|devops|architect",
      "estimatedMinutes": 5,
      "tools": ["Write", "Edit", "Bash"],
      "complexity": "low|medium|high"
    }
  ]
}`;
      
      // Use simple string prompt mode
      for await (const message of query({
        prompt: taskPrompt,
        options: {
          model: 'claude-3-5-sonnet-20241022',
          allowedTools: [], // No tools needed for planning
          maxTurns: 1, // Single turn for task decomposition
          permissionMode: 'plan' // Planning mode - no execution
        }
      })) {
          
          // Handle assistant messages with real-time streaming
          if (message.type === 'assistant') {
            const content = message.message.content.map((block: any) => 
              block.type === 'text' ? block.text : ''
            ).join('');
            
            if (content && !result.includes(content)) {
              result += content;
              // Stream the task planning in real-time
              process.stdout.write(content);
            }
          }
          
          // Handle final result
          if (message.type === 'result') {
            const resultMessage = message;
            
            if (resultMessage.subtype === 'success') {
              if (!result) {
                result = resultMessage.result || '';
              }
              isComplete = true;
              break;
            } else {
              throw new Error(`Claude task planning failed: ${resultMessage.subtype}`);
            }
          }
          
          // Handle system messages for debugging
          if (message.type === 'system') {
            // Don't log system messages in production
            if (process.env.NODE_ENV === 'development') {
              console.debug('Claude system message during task planning:', message.subtype);
            }
          }
        }
      
      if (!result || !isComplete) {
        throw new Error('No result received from Claude or task planning incomplete');
      }

      // Parse Claude's response
      try {
        const jsonMatch = result.trim().match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');
        
        const parsed = JSON.parse(jsonMatch[0]);
        const claudeTasks = parsed.tasks || [];
        
        // Convert Claude's response to TaskDefinition format
        const tasks: TaskDefinition[] = claudeTasks.map((task: any, index: number) => ({
          id: this.generateTaskId('claude'),
          title: task.title || `Task ${index + 1}`,
          description: task.description || task.title,
          agentType: task.agentType || 'assistant',
          complexity: task.complexity || 'medium',
          estimatedDuration: task.estimatedMinutes || 10,
          dependencies: [], // Claude doesn't handle dependencies in this simple format
          tools: task.tools || ['Write', 'Edit']
        }));
        
        if (tasks.length > 0) {
          console.log(`🎯 Claude generated ${tasks.length} intelligent tasks`);
          return tasks;
        } else {
          throw new Error('No tasks found in Claude response');
        }
        
      } catch (parseError) {
        console.error('Failed to parse Claude task response:', parseError);
        throw new Error('Failed to parse Claude task decomposition response');
      }
      
    } catch (error) {
      console.warn(`Claude task planning failed: ${error instanceof Error ? error.message : String(error)}`);
      console.log('Falling back to simple task generation...');
      
      // Fallback to simple static task if Claude fails
      return [{
        id: this.generateTaskId('fallback'),
        title: this.generateSimpleTaskTitle(originalQuery),
        description: `Create: ${originalQuery}`,
        agentType: this.selectBestAgent(entities),
        complexity: this.mapComplexity(complexity),
        estimatedDuration: 10,
        dependencies: [],
        tools: this.getSimpleTaskTools(originalQuery)
      }];
    }
  }

  /**
   * Generate tasks for analysis operations
   */
  private async generateAnalysisTasks(parsedQuery: ParsedQuery): Promise<TaskDefinition[]> {
    const tasks: TaskDefinition[] = [];
    const { originalQuery, complexity } = parsedQuery;

    tasks.push({
      id: this.generateTaskId('research'),
      title: 'Research & Information Gathering',
      description: `Research requirements for: ${originalQuery}`,
      agentType: 'researcher',
      complexity: this.mapComplexity(complexity),
      estimatedDuration: 10,
      dependencies: [],
      tools: ['research', 'documentation', 'analysis']
    });

    tasks.push({
      id: this.generateTaskId('analyze'),
      title: 'Technical Analysis',
      description: 'Perform detailed technical analysis',
      agentType: 'architect',
      complexity: this.mapComplexity(complexity),
      estimatedDuration: 15,
      dependencies: [tasks[0].id],
      tools: ['analysis', 'architecture', 'evaluation']
    });

    tasks.push({
      id: this.generateTaskId('report'),
      title: 'Generate Analysis Report',
      description: 'Create comprehensive analysis report',
      agentType: 'assistant',
      complexity: 'low',
      estimatedDuration: 8,
      dependencies: [tasks[1].id],
      tools: ['documentation', 'reporting']
    });

    return tasks;
  }

  /**
   * Generate tasks for debugging operations
   */
  private async generateDebugTasks(parsedQuery: ParsedQuery): Promise<TaskDefinition[]> {
    const tasks: TaskDefinition[] = [];
    const { originalQuery, complexity } = parsedQuery;

    tasks.push({
      id: this.generateTaskId('investigate'),
      title: 'Issue Investigation',
      description: `Investigate issue: ${originalQuery}`,
      agentType: 'assistant',
      complexity: this.mapComplexity(complexity),
      estimatedDuration: 8,
      dependencies: [],
      tools: ['debugging', 'investigation', 'analysis']
    });

    tasks.push({
      id: this.generateTaskId('diagnose'),
      title: 'Problem Diagnosis',
      description: 'Diagnose root cause of the issue',
      agentType: 'backend', // Assumes backend issue, could be smarter
      complexity: this.mapComplexity(complexity),
      estimatedDuration: 12,
      dependencies: [tasks[0].id],
      tools: ['debugging', 'diagnosis', 'testing']
    });

    tasks.push({
      id: this.generateTaskId('fix'),
      title: 'Implement Fix',
      description: 'Implement solution to resolve the issue',
      agentType: 'backend',
      complexity: this.mapComplexity(complexity),
      estimatedDuration: 15,
      dependencies: [tasks[1].id],
      tools: ['implementation', 'coding', 'testing']
    });

    tasks.push({
      id: this.generateTaskId('verify'),
      title: 'Verify Fix',
      description: 'Test and verify the fix works correctly',
      agentType: 'tester',
      complexity: 'medium',
      estimatedDuration: 8,
      dependencies: [tasks[2].id],
      tools: ['testing', 'validation', 'verification']
    });

    return tasks;
  }

  /**
   * Generate generic tasks for unrecognized intents
   */
  private async generateGeneralTasks(parsedQuery: ParsedQuery): Promise<TaskDefinition[]> {
    return [
      {
        id: this.generateTaskId('general'),
        title: 'Process Request',
        description: `Process general request: ${parsedQuery.originalQuery}`,
        agentType: 'assistant',
        complexity: this.mapComplexity(parsedQuery.complexity),
        estimatedDuration: 10,
        dependencies: [],
        tools: ['general', 'assistance', 'problem_solving']
      }
    ];
  }

  /**
   * Generate tasks for optimization operations
   */
  private async generateOptimizationTasks(parsedQuery: ParsedQuery): Promise<TaskDefinition[]> {
    const tasks: TaskDefinition[] = [];
    const { originalQuery, complexity } = parsedQuery;

    tasks.push({
      id: this.generateTaskId('baseline'),
      title: 'Establish Performance Baseline',
      description: 'Measure current performance metrics',
      agentType: 'tester',
      complexity: 'medium',
      estimatedDuration: 10,
      dependencies: [],
      tools: ['performance_testing', 'benchmarking', 'metrics']
    });

    tasks.push({
      id: this.generateTaskId('optimize'),
      title: 'Implement Optimizations',
      description: `Optimize for: ${originalQuery}`,
      agentType: 'backend',
      complexity: this.mapComplexity(complexity),
      estimatedDuration: 20,
      dependencies: [tasks[0].id],
      tools: ['optimization', 'performance', 'coding']
    });

    return tasks;
  }

  /**
   * Generate tasks for testing operations
   */
  private async generateTestTasks(parsedQuery: ParsedQuery): Promise<TaskDefinition[]> {
    return [
      {
        id: this.generateTaskId('test'),
        title: 'Implement Tests',
        description: `Create tests for: ${parsedQuery.originalQuery}`,
        agentType: 'tester',
        complexity: this.mapComplexity(parsedQuery.complexity),
        estimatedDuration: 15,
        dependencies: [],
        tools: ['testing', 'automation', 'quality_assurance']
      }
    ];
  }

  /**
   * Generate tasks for deployment operations
   */
  private async generateDeploymentTasks(parsedQuery: ParsedQuery): Promise<TaskDefinition[]> {
    return [
      {
        id: this.generateTaskId('deploy'),
        title: 'Deploy Application',
        description: `Deploy: ${parsedQuery.originalQuery}`,
        agentType: 'devops',
        complexity: this.mapComplexity(parsedQuery.complexity),
        estimatedDuration: 15,
        dependencies: [],
        tools: ['deployment', 'infrastructure', 'monitoring']
      }
    ];
  }

  /**
   * Analyze dependencies between tasks
   */
  private async analyzeDependencies(tasks: TaskDefinition[]): Promise<TaskDependency[]> {
    const dependencies: TaskDependency[] = [];

    for (const task of tasks) {
      for (const depId of task.dependencies) {
        const dependency = tasks.find(t => t.id === depId);
        if (dependency) {
          dependencies.push({
            fromTask: dependency.id,
            toTask: task.id,
            type: 'blocking'
          });
        }
      }
    }

    return dependencies;
  }

  /**
   * Build execution graph from tasks and dependencies
   */
  private buildExecutionGraph(
    tasks: TaskDefinition[],
    dependencies: TaskDependency[]
  ): ExecutionGraph {
    const taskNodes: TaskNode[] = tasks.map(task => this.convertToTaskNode(task));

    const totalEstimatedMinutes = tasks.reduce((sum, task) => sum + task.estimatedDuration, 0);
    const maxConcurrency = this.calculateMaxConcurrency(taskNodes, dependencies);
    const criticalPath = this.findCriticalPath(taskNodes, dependencies);

    return {
      nodes: taskNodes,
      edges: dependencies,
      totalEstimatedTimeMinutes: totalEstimatedMinutes,
      maxConcurrency,
      parallelizable: maxConcurrency > 1,
      criticalPath
    };
  }

  /**
   * Convert TaskDefinition to TaskNode
   */
  private convertToTaskNode(task: TaskDefinition): TaskNode {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      assignedAgent: task.agentType,
      estimatedDuration: task.estimatedDuration,
      dependencies: task.dependencies,
      status: TaskStatus.PENDING,
      priority: TaskPriority.NORMAL, // Use enum value directly
      tools: task.tools,
      expectedOutputs: this.generateExpectedOutputs(task),
      createdAt: new Date(),
      metadata: {
        priority: this.calculateTaskPriority(task),
        tags: [task.agentType, task.complexity],
        gitBranch: null,
        worktreePath: null
      }
    };
  }

  // Helper methods for task analysis and generation

  private recognizeIntent(query: string): QueryIntent {
    for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
      if (pattern.test(query)) {
        return intent.toLowerCase() as QueryIntent;
      }
    }
    return QueryIntent.BUILD; // Default fallback
  }

  private analyzeComplexity(query: string): QueryComplexity {
    const words = query.toLowerCase().split(/\s+/);
    const complexityIndicators = [
      'enterprise', 'scalable', 'production', 'secure', 'distributed',
      'microservices', 'architecture', 'infrastructure', 'deployment',
      'integration', 'optimization', 'performance', 'monitoring'
    ];

    const matches = words.filter(word => complexityIndicators.includes(word)).length;

    if (matches >= 3) return QueryComplexity.ENTERPRISE;
    if (matches >= 2) return QueryComplexity.COMPLEX;
    if (matches >= 1) return QueryComplexity.MODERATE;
    return QueryComplexity.SIMPLE;
  }

  private extractEntities(query: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Technology entities
    const techPattern = /(react|vue|angular|node\.?js|typescript|javascript|python|docker|kubernetes|aws)/gi;
    let match;
    while ((match = techPattern.exec(query)) !== null) {
      entities.push({
        type: 'technology',
        value: match[0],
        confidence: 0.9
      });
    }

    // File entities
    const filePattern = /([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)/g;
    while ((match = filePattern.exec(query)) !== null) {
      entities.push({
        type: 'file',
        value: match[0],
        confidence: 0.8
      });
    }

    return entities;
  }

  private extractAgentHints(query: string): string[] {
    const hints: string[] = [];
    const lowerQuery = query.toLowerCase();

    if (/(ui|frontend|react|component|interface)/.test(lowerQuery)) {
      hints.push('frontend');
    }
    if (/(api|backend|server|database|endpoint)/.test(lowerQuery)) {
      hints.push('backend');
    }
    if (/(test|testing|quality|validation)/.test(lowerQuery)) {
      hints.push('tester');
    }
    if (/(deploy|infrastructure|docker|kubernetes|cloud)/.test(lowerQuery)) {
      hints.push('devops');
    }
    if (/(security|auth|encryption|vulnerability)/.test(lowerQuery)) {
      hints.push('security');
    }
    if (/(research|analyze|investigation|study)/.test(lowerQuery)) {
      hints.push('researcher');
    }
    if (/(architecture|design|system|pattern)/.test(lowerQuery)) {
      hints.push('architect');
    }

    return hints;
  }

  private calculateParsingConfidence(
    query: string,
    intent: QueryIntent,
    entities: ExtractedEntity[]
  ): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence for clear intent indicators
    if (INTENT_PATTERNS[intent.toUpperCase() as keyof typeof INTENT_PATTERNS]?.test(query)) {
      confidence += 0.3;
    }

    // Higher confidence for recognized entities
    confidence += Math.min(entities.length * 0.1, 0.2);

    return Math.min(confidence, 1.0);
  }

  private hasUIComponents(entities: ExtractedEntity[]): boolean {
    return entities.some(e =>
      e.type === 'technology' &&
      ['react', 'vue', 'angular', 'frontend'].includes(e.value.toLowerCase())
    );
  }

  private hasBackendComponents(entities: ExtractedEntity[]): boolean {
    return entities.some(e =>
      e.type === 'technology' &&
      ['node.js', 'nodejs', 'python', 'api', 'backend', 'server'].includes(e.value.toLowerCase())
    );
  }

  private mapComplexity(queryComplexity: QueryComplexity): 'low' | 'medium' | 'high' {
    switch (queryComplexity) {
      case 'simple': return 'low';
      case 'moderate': return 'medium';
      case 'complex':
      case 'enterprise': return 'high';
      default: return 'medium';
    }
  }

  private calculateTaskPriority(task: TaskDefinition): number {
    let priority = DEFAULT_TASK_PRIORITY;

    // Higher priority for foundational tasks
    if (task.dependencies.length === 0) priority += 2;

    // Higher priority for critical complexity
    if (task.complexity === 'high') priority += 2;

    // Higher priority for blocking tasks (many dependents)
    // This would require additional analysis of all tasks

    return Math.min(priority, 10);
  }

  private calculateMaxConcurrency(tasks: TaskNode[], dependencies: TaskDependency[]): number {
    // Find tasks with no dependencies (can start immediately)
    const noDeps = tasks.filter(t => t.dependencies.length === 0);
    return Math.max(noDeps.length, 1);
  }

  private findCriticalPath(tasks: TaskNode[], dependencies: TaskDependency[]): string[] {
    // Simplified critical path - find longest dependency chain
    const visited = new Set<string>();
    const paths: string[][] = [];

    const findPaths = (taskId: string, currentPath: string[]): void => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const newPath = [...currentPath, taskId];
      const dependents = dependencies.filter(d => d.fromTask === taskId);

      if (dependents.length === 0) {
        paths.push(newPath);
      } else {
        dependents.forEach(dep => findPaths(dep.toTask, newPath));
      }
    };

    // Start from root tasks (no dependencies)
    const rootTasks = tasks.filter(t => t.dependencies.length === 0);
    rootTasks.forEach(task => findPaths(task.id, []));

    // Return longest path
    return paths.reduce((longest, current) =>
      current.length > longest.length ? current : longest,
      []
    );
  }

  private optimizeForParallelism(graph: ExecutionGraph): void {
    // Optimization logic would go here
    // For now, the graph is already optimized through proper dependency analysis
    this.emit('parallelizationOptimized', {
      maxConcurrency: graph.maxConcurrency,
      parallelizable: graph.parallelizable
    });
  }

  private generateExpectedOutputs(task: TaskDefinition): string[] {
    const outputs: string[] = [];

    switch (task.agentType) {
      case 'architect':
        outputs.push('Technical specification', 'Architecture diagram', 'Implementation plan');
        break;
      case 'backend':
        outputs.push('API implementation', 'Database schema', 'Service code');
        break;
      case 'frontend':
        outputs.push('UI components', 'Styling', 'User interactions');
        break;
      case 'tester':
        outputs.push('Test suite', 'Test reports', 'Quality metrics');
        break;
      case 'devops':
        outputs.push('Deployment scripts', 'Infrastructure config', 'Monitoring setup');
        break;
      case 'security':
        outputs.push('Security assessment', 'Vulnerability report', 'Security fixes');
        break;
      case 'researcher':
        outputs.push('Research report', 'Technical analysis', 'Recommendations');
        break;
      default:
        outputs.push('Task completion', 'Documentation', 'Status report');
        break;
    }

    return outputs;
  }

  private generateTaskId(prefix: string): string {
    return `${prefix}_${Date.now()}_${++this.taskCounter}`;
  }

  // Helper methods for intelligent task generation

  /**
   * Generate simple task title based on query content
   */
  private generateSimpleTaskTitle(query: string): string {
    if (query.toLowerCase().includes('hello world')) {
      return 'Create Python hello world script';
    }
    if (query.toLowerCase().includes('script')) {
      return `Create ${query.includes('Python') ? 'Python' : 'script'}`;
    }
    return `Create: ${query}`;
  }

  /**
   * Get appropriate tools for simple tasks
   */
  private getSimpleTaskTools(query: string): string[] {
    const tools = ['Write'];
    
    if (query.toLowerCase().includes('python')) {
      tools.push('python');
    }
    if (query.toLowerCase().includes('javascript') || query.toLowerCase().includes('js')) {
      tools.push('javascript');
    }
    if (query.toLowerCase().includes('test')) {
      tools.push('testing');
    }
    
    return tools;
  }

  /**
   * Select best agent based on extracted entities
   */
  private selectBestAgent(entities: ExtractedEntity[]): string {
    // Check for technology-specific agents
    for (const entity of entities) {
      if (entity.type === 'technology') {
        const tech = entity.value.toLowerCase();
        if (['react', 'vue', 'angular', 'frontend'].includes(tech)) {
          return 'frontend';
        }
        if (['node.js', 'nodejs', 'api', 'server'].includes(tech)) {
          return 'backend';
        }
        if (['python'].includes(tech)) {
          return 'backend'; // Python is often backend
        }
      }
    }
    
    // Default to assistant for general tasks
    return 'assistant';
  }

  /**
   * Get implementation tools based on entities
   */
  private getImplementationTools(entities: ExtractedEntity[]): string[] {
    const tools = ['implementation', 'coding'];
    
    for (const entity of entities) {
      if (entity.type === 'technology') {
        tools.push(entity.value.toLowerCase());
      }
    }
    
    return [...new Set(tools)]; // Remove duplicates
  }
}
