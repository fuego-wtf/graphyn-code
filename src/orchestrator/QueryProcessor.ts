/**
 * Query Processing Engine
 * 
 * Converts natural language queries into structured execution plans
 * with agent assignments and task dependencies.
 */

import { 
  QueryProcessingResult,
  ParsedQuery,
  ExecutionPlan,
  TaskDefinition,
  TaskDependency,
  AgentType,
  QueryIntent,
  QueryComplexity,
  ExecutionMode,
  ExtractedEntity
} from './types.js';

/**
 * Query processing configuration
 */
interface QueryProcessorConfig {
  readonly maxComplexity: QueryComplexity;
  readonly defaultMode: ExecutionMode;
  readonly enableFigmaDetection: boolean; // Preserve Figma functionality
  readonly customPatterns?: readonly QueryPattern[];
}

/**
 * Pattern matching for query analysis
 */
interface QueryPattern {
  readonly pattern: RegExp;
  readonly intent: QueryIntent;
  readonly agents: readonly AgentType[];
  readonly complexity: QueryComplexity;
  readonly confidence: number;
}

/**
 * Default query patterns for common development tasks
 */
const DEFAULT_PATTERNS: readonly QueryPattern[] = [
  // Figma integration patterns (preserved functionality)
  {
    pattern: /figma|design|extract|component|ui/i,
    intent: QueryIntent.EXTRACT_FIGMA,
    agents: ['figma-extractor', 'design', 'frontend'],
    complexity: QueryComplexity.MODERATE,
    confidence: 0.9
  },
  
  // Full-stack application patterns
  {
    pattern: /build.*(app|application|system)|full.?stack|end.?to.?end/i,
    intent: QueryIntent.BUILD_FEATURE,
    agents: ['architect', 'backend', 'frontend', 'test-writer', 'production-architect'],
    complexity: QueryComplexity.ENTERPRISE,
    confidence: 0.95
  },
  
  // Backend development patterns
  {
    pattern: /api|backend|server|database|microservice/i,
    intent: QueryIntent.BUILD_FEATURE,
    agents: ['architect', 'backend', 'test-writer'],
    complexity: QueryComplexity.MODERATE,
    confidence: 0.85
  },
  
  // Frontend development patterns
  {
    pattern: /frontend|ui|interface|component|react|vue|angular/i,
    intent: QueryIntent.BUILD_FEATURE,
    agents: ['design', 'frontend', 'test-writer'],
    complexity: QueryComplexity.MODERATE,
    confidence: 0.8
  },
  
  // Bug fixing patterns
  {
    pattern: /fix|bug|error|issue|problem|debug/i,
    intent: QueryIntent.FIX_BUG,
    agents: ['task-dispatcher'], // Let dispatcher analyze the bug
    complexity: QueryComplexity.SIMPLE,
    confidence: 0.7
  },
  
  // Testing patterns
  {
    pattern: /test|spec|unit|integration|e2e|coverage/i,
    intent: QueryIntent.ADD_TESTS,
    agents: ['test-writer', 'backend', 'frontend'],
    complexity: QueryComplexity.MODERATE,
    confidence: 0.9
  },
  
  // Refactoring patterns
  {
    pattern: /refactor|optimize|improve|clean|reorganize/i,
    intent: QueryIntent.REFACTOR_CODE,
    agents: ['architect', 'backend', 'frontend'],
    complexity: QueryComplexity.COMPLEX,
    confidence: 0.8
  },
  
  // Deployment patterns
  {
    pattern: /deploy|deployment|production|release|ci\/cd|docker|kubernetes/i,
    intent: QueryIntent.DEPLOY_APP,
    agents: ['production-architect', 'backend'],
    complexity: QueryComplexity.COMPLEX,
    confidence: 0.9
  },
  
  // CLI tooling patterns
  {
    pattern: /cli|command.?line|tool|script|automation/i,
    intent: QueryIntent.BUILD_FEATURE,
    agents: ['cli', 'test-writer'],
    complexity: QueryComplexity.MODERATE,
    confidence: 0.85
  }
];

/**
 * Technology and framework detection patterns
 */
const TECHNOLOGY_PATTERNS = new Map([
  // Frontend frameworks
  ['react', /react|jsx|tsx|next\.?js/i],
  ['vue', /vue|nuxt/i],
  ['angular', /angular|ng/i],
  ['svelte', /svelte|sveltekit/i],
  
  // Backend frameworks
  ['node.js', /node\.?js|express|fastify|koa/i],
  ['django', /django|python.*web/i],
  ['rails', /rails|ruby.*on.*rails/i],
  ['spring', /spring|java.*web/i],
  ['encore', /encore\.dev|encore/i],
  
  // Databases
  ['postgresql', /postgres|postgresql|pg/i],
  ['mongodb', /mongo|mongodb/i],
  ['mysql', /mysql/i],
  ['redis', /redis/i],
  
  // Cloud platforms
  ['aws', /aws|amazon.*web.*services/i],
  ['gcp', /gcp|google.*cloud/i],
  ['azure', /azure|microsoft.*cloud/i],
  
  // Tools
  ['docker', /docker|container/i],
  ['kubernetes', /k8s|kubernetes/i],
  ['terraform', /terraform|iac|infrastructure.*code/i]
]);

/**
 * Main Query Processing Engine
 */
export class QueryProcessor {
  private readonly config: QueryProcessorConfig;
  private readonly patterns: readonly QueryPattern[];

  constructor(config?: Partial<QueryProcessorConfig>) {
    this.config = {
      maxComplexity: QueryComplexity.ENTERPRISE,
      defaultMode: ExecutionMode.ADAPTIVE,
      enableFigmaDetection: true,
      ...config
    };
    
    this.patterns = [
      ...DEFAULT_PATTERNS,
      ...(this.config.customPatterns || [])
    ];
  }

  /**
   * Main entry point: process a natural language query
   */
  public async processQuery(query: string, workspaceContext?: Record<string, unknown>): Promise<QueryProcessingResult> {
    const parsed = this.parseQuery(query);
    const executionPlan = await this.generateExecutionPlan(parsed, workspaceContext);
    
    return {
      parsed,
      executionPlan,
      recommendations: this.generateRecommendations(parsed, executionPlan),
      warnings: this.generateWarnings(parsed, executionPlan),
      estimatedCost: this.estimateCost(executionPlan)
    };
  }

  /**
   * Parse query into structured components
   */
  public parseQuery(query: string): ParsedQuery {
    const normalizedQuery = query.trim().toLowerCase();
    
    // Extract entities (technologies, actions, constraints)
    const entities = this.extractEntities(query);
    
    // Detect intent and agents using pattern matching
    const { intent, agents, complexity, confidence } = this.detectIntentAndAgents(normalizedQuery);
    
    // Suggest execution mode based on complexity and agents
    const suggestedMode = this.suggestExecutionMode(complexity, agents.length);
    
    return {
      originalQuery: query,
      intent,
      entities,
      complexity,
      agentHints: agents,
      requiredAgents: agents,
      confidence,
      suggestedMode
    };
  }

  /**
   * Detect query complexity based on various factors
   */
  public detectComplexity(query: string, agentCount: number, entityCount: number): QueryComplexity {
    let complexityScore = 0;
    
    // Base score from query length and keywords
    if (query.length > 200) complexityScore += 2;
    else if (query.length > 100) complexityScore += 1;
    
    // Agent count contribution
    if (agentCount >= 5) complexityScore += 3;
    else if (agentCount >= 3) complexityScore += 2;
    else if (agentCount >= 2) complexityScore += 1;
    
    // Entity count contribution
    if (entityCount >= 5) complexityScore += 2;
    else if (entityCount >= 3) complexityScore += 1;
    
    // Complexity keywords
    const complexityKeywords = [
      'microservices', 'distributed', 'scalable', 'enterprise',
      'multi-tenant', 'real-time', 'integration', 'workflow'
    ];
    
    for (const keyword of complexityKeywords) {
      if (query.toLowerCase().includes(keyword)) {
        complexityScore += 1;
      }
    }
    
    // Map score to complexity level
    if (complexityScore >= 6) return QueryComplexity.ENTERPRISE;
    if (complexityScore >= 4) return QueryComplexity.COMPLEX;
    if (complexityScore >= 2) return QueryComplexity.MODERATE;
    return QueryComplexity.SIMPLE;
  }

  /**
   * Extract required agents from query analysis
   */
  public extractAgents(query: string, intent: QueryIntent): AgentType[] {
    const agents = new Set<AgentType>();
    
    // Intent-based agent assignment
    switch (intent) {
      case QueryIntent.EXTRACT_FIGMA:
        agents.add('figma-extractor');
        agents.add('design');
        agents.add('frontend');
        break;
        
      case QueryIntent.BUILD_FEATURE:
        // Start with architect for planning
        agents.add('architect');
        
        // Add specific agents based on query content
        if (this.containsBackendKeywords(query)) {
          agents.add('backend');
        }
        if (this.containsFrontendKeywords(query)) {
          agents.add('frontend');
          agents.add('design');
        }
        if (this.containsTestKeywords(query)) {
          agents.add('test-writer');
        }
        if (this.containsDeploymentKeywords(query)) {
          agents.add('production-architect');
        }
        break;
        
      case QueryIntent.FIX_BUG:
        agents.add('task-dispatcher'); // Analyze first
        break;
        
      case QueryIntent.ADD_TESTS:
        agents.add('test-writer');
        break;
        
      case QueryIntent.REFACTOR_CODE:
        agents.add('architect');
        agents.add('backend');
        agents.add('frontend');
        break;
        
      case QueryIntent.DEPLOY_APP:
        agents.add('production-architect');
        agents.add('backend');
        break;
        
      default:
        agents.add('task-dispatcher'); // Default fallback
    }
    
    // Ensure we have at least one agent
    if (agents.size === 0) {
      agents.add('task-dispatcher');
    }
    
    return Array.from(agents);
  }

  /**
   * Generate execution plan from parsed query
   */
  private async generateExecutionPlan(
    parsed: ParsedQuery, 
    workspaceContext?: Record<string, unknown>
  ): Promise<ExecutionPlan> {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Create tasks based on agents and intent
    const tasks = this.generateTasks(parsed);
    
    // Create dependencies between tasks
    const dependencies = this.generateTaskDependencies(tasks, parsed.intent);
    
    // Estimate duration
    const estimatedDuration = this.estimateExecutionTime(tasks, dependencies);
    
    // Calculate parallelism level
    const parallelismLevel = this.calculateParallelismLevel(parsed.complexity, tasks.length);
    
    return {
      id: planId,
      query: parsed.originalQuery,
      complexity: parsed.complexity,
      mode: parsed.suggestedMode,
      tasks,
      dependencies,
      estimatedDuration,
      requiredAgents: parsed.requiredAgents,
      parallelismLevel
    };
  }

  /**
   * Generate tasks from parsed query
   */
  private generateTasks(parsed: ParsedQuery): TaskDefinition[] {
    const tasks: TaskDefinition[] = [];
    let taskCounter = 1;
    
    for (const agentType of parsed.requiredAgents) {
      const taskId = `task_${taskCounter++}_${agentType}`;
      const description = this.generateTaskDescription(agentType, parsed);
      const priority = this.calculateTaskPriority(agentType, parsed.intent);
      const estimatedDuration = this.estimateTaskDuration(agentType, parsed.complexity);
      
      tasks.push({
        id: taskId,
        title: this.generateTaskTitle(agentType, parsed),
        description,
        agentType,
        agent: agentType,
        complexity: this.mapQueryComplexityToTaskComplexity(parsed.complexity),
        estimatedDuration,
        dependencies: [], // Will be populated by generateTaskDependencies
        tools: this.generateTaskTools(agentType),
        priority,
        tags: this.generateTaskTags(agentType, parsed),
        metadata: {
          intent: parsed.intent,
          complexity: parsed.complexity,
          confidence: parsed.confidence
        }
      });
    }
    
    return tasks;
  }

  /**
   * Generate task dependencies based on agent workflows
   */
  private generateTaskDependencies(tasks: TaskDefinition[], intent: QueryIntent): TaskDependency[] {
    const dependencies: TaskDependency[] = [];
    const taskMap = new Map(tasks.map(t => [t.agent, t.id]));
    
    // Standard workflow dependencies
    const architectTask = taskMap.get('architect');
    const backendTask = taskMap.get('backend');
    const frontendTask = taskMap.get('frontend');
    const designTask = taskMap.get('design');
    const testTask = taskMap.get('test-writer');
    const deployTask = taskMap.get('production-architect');
    const figmaTask = taskMap.get('figma-extractor');
    
    // Architect should run first for planning
    if (architectTask) {
      if (backendTask) {
        dependencies.push({
          sourceTaskId: architectTask,
          targetTaskId: backendTask,
          type: 'hard',
          reason: 'Architecture must be planned before backend development'
        });
      }
      if (frontendTask) {
        dependencies.push({
          sourceTaskId: architectTask,
          targetTaskId: frontendTask,
          type: 'hard',
          reason: 'Architecture must be planned before frontend development'
        });
      }
    }
    
    // Figma extraction should precede design work
    if (figmaTask && designTask) {
      dependencies.push({
        sourceTaskId: figmaTask,
        targetTaskId: designTask,
        type: 'hard',
        reason: 'Figma components must be extracted before design work'
      });
    }
    
    // Design should precede frontend development
    if (designTask && frontendTask) {
      dependencies.push({
        sourceTaskId: designTask,
        targetTaskId: frontendTask,
        type: 'soft',
        reason: 'Design system should be established before frontend implementation'
      });
    }
    
    // Backend and frontend should be completed before testing
    if (testTask) {
      if (backendTask) {
        dependencies.push({
          sourceTaskId: backendTask,
          targetTaskId: testTask,
          type: 'soft',
          reason: 'Backend implementation should be ready for testing'
        });
      }
      if (frontendTask) {
        dependencies.push({
          sourceTaskId: frontendTask,
          targetTaskId: testTask,
          type: 'soft',
          reason: 'Frontend implementation should be ready for testing'
        });
      }
    }
    
    // Testing should precede deployment
    if (testTask && deployTask) {
      dependencies.push({
        sourceTaskId: testTask,
        targetTaskId: deployTask,
        type: 'hard',
        reason: 'Tests must pass before deployment'
      });
    }
    
    return dependencies;
  }

  /**
   * Extract entities (technologies, components, actions) from query
   */
  private extractEntities(query: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    // Extract technologies
    for (const [tech, pattern] of TECHNOLOGY_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        entities.push({
          type: 'technology',
          value: tech,
          confidence: 0.9,
          span: [match.index || 0, (match.index || 0) + match[0].length]
        });
      }
    }
    
    // Extract actions
    const actionPatterns = new Map([
      ['create', /create|build|develop|make|implement/i],
      ['update', /update|modify|change|edit|refactor/i],
      ['delete', /delete|remove|clean/i],
      ['test', /test|verify|validate|check/i],
      ['deploy', /deploy|release|publish|ship/i],
      ['analyze', /analyze|review|inspect|audit/i]
    ]);
    
    for (const [action, pattern] of actionPatterns) {
      const match = query.match(pattern);
      if (match) {
        entities.push({
          type: 'action',
          value: action,
          confidence: 0.8,
          span: [match.index || 0, (match.index || 0) + match[0].length]
        });
      }
    }
    
    return entities;
  }

  /**
   * Detect intent and required agents using pattern matching
   */
  private detectIntentAndAgents(query: string): {
    intent: QueryIntent;
    agents: AgentType[];
    complexity: QueryComplexity;
    confidence: number;
  } {
    let bestMatch = {
      intent: QueryIntent.BUILD_FEATURE,
      agents: ['task-dispatcher'] as AgentType[],
      complexity: QueryComplexity.SIMPLE,
      confidence: 0.5
    };
    
    for (const pattern of this.patterns) {
      if (pattern.pattern.test(query)) {
        if (pattern.confidence > bestMatch.confidence) {
          bestMatch = {
            intent: pattern.intent,
            agents: [...pattern.agents],
            complexity: pattern.complexity,
            confidence: pattern.confidence
          };
        }
      }
    }
    
    // Extract additional agents based on query content
    const additionalAgents = this.extractAgents(query, bestMatch.intent);
    const allAgents = [...new Set([...bestMatch.agents, ...additionalAgents])];
    
    return {
      ...bestMatch,
      agents: allAgents
    };
  }

  /**
   * Suggest execution mode based on complexity and agent count
   */
  private suggestExecutionMode(complexity: QueryComplexity, agentCount: number): ExecutionMode {
    if (complexity === QueryComplexity.ENTERPRISE || agentCount > 4) {
      return ExecutionMode.ADAPTIVE; // Smart coordination for complex tasks
    }
    
    if (complexity === QueryComplexity.COMPLEX || agentCount > 2) {
      return ExecutionMode.PARALLEL; // Parallel execution when possible
    }
    
    return ExecutionMode.SEQUENTIAL; // Simple sequential execution
  }

  // Helper methods for keyword detection
  private containsBackendKeywords(query: string): boolean {
    return /api|backend|server|database|endpoint|service|microservice/i.test(query);
  }

  private containsFrontendKeywords(query: string): boolean {
    return /frontend|ui|interface|component|react|vue|angular|web|app/i.test(query);
  }

  private containsTestKeywords(query: string): boolean {
    return /test|spec|coverage|quality|validation|e2e|unit|integration/i.test(query);
  }

  private containsDeploymentKeywords(query: string): boolean {
    return /deploy|production|release|ci\/cd|docker|kubernetes|infrastructure/i.test(query);
  }

  // Task generation helpers
  private generateTaskDescription(agentType: AgentType, parsed: ParsedQuery): string {
    const baseDescriptions = new Map([
      ['architect', `Analyze requirements and design system architecture for: ${parsed.originalQuery}`],
      ['backend', `Implement backend services and APIs for: ${parsed.originalQuery}`],
      ['frontend', `Develop frontend components and user interface for: ${parsed.originalQuery}`],
      ['design', `Create design system and UI/UX specifications for: ${parsed.originalQuery}`],
      ['test-writer', `Create comprehensive test suite for: ${parsed.originalQuery}`],
      ['production-architect', `Design deployment and infrastructure for: ${parsed.originalQuery}`],
      ['figma-extractor', `Extract Figma designs and components for: ${parsed.originalQuery}`],
      ['cli', `Develop command-line interface for: ${parsed.originalQuery}`],
      ['pr-merger', `Review and merge pull requests for: ${parsed.originalQuery}`],
      ['task-dispatcher', `Analyze and dispatch tasks for: ${parsed.originalQuery}`]
    ]);
    
    return baseDescriptions.get(agentType) || `Execute ${agentType} tasks for: ${parsed.originalQuery}`;
  }

  private calculateTaskPriority(agentType: AgentType, intent: QueryIntent): number {
    // Higher number = higher priority
    const priorityMap = new Map([
      ['task-dispatcher', 100],  // Always highest priority for analysis
      ['architect', 90],         // High priority for planning
      ['figma-extractor', 85],   // High priority for design extraction
      ['design', 80],           // High priority for design system
      ['backend', 70],          // Medium-high for backend work
      ['frontend', 70],         // Medium-high for frontend work
      ['test-writer', 60],      // Medium for testing
      ['cli', 60],              // Medium for CLI tools
      ['production-architect', 50], // Lower for deployment
      ['pr-merger', 40]         // Lowest for merge operations
    ]);
    
    return priorityMap.get(agentType) || 50;
  }

  private estimateTaskDuration(agentType: AgentType, complexity: QueryComplexity): number {
    const baseTime = new Map([
      ['task-dispatcher', 5],    // 5 minutes for analysis
      ['architect', 30],         // 30 minutes for architecture
      ['figma-extractor', 15],   // 15 minutes for extraction
      ['design', 45],           // 45 minutes for design work
      ['backend', 90],          // 1.5 hours for backend
      ['frontend', 90],         // 1.5 hours for frontend
      ['test-writer', 60],      // 1 hour for tests
      ['cli', 45],              // 45 minutes for CLI
      ['production-architect', 60], // 1 hour for deployment
      ['pr-merger', 15]         // 15 minutes for review
    ]);
    
    const base = baseTime.get(agentType) || 60;
    const multiplier = {
      [QueryComplexity.SIMPLE]: 1,
      [QueryComplexity.MODERATE]: 1.5,
      [QueryComplexity.COMPLEX]: 2.5,
      [QueryComplexity.ENTERPRISE]: 4
    }[complexity];
    
    return Math.round(base * multiplier);
  }

  private generateTaskTags(agentType: AgentType, parsed: ParsedQuery): string[] {
    const tags = [agentType, parsed.intent, parsed.complexity];
    
    // Add technology tags
    const techEntities = parsed.entities
      .filter(e => e.type === 'technology')
      .map(e => e.value);
    
    return [...tags, ...techEntities];
  }

  private generateTaskTitle(agentType: AgentType, parsed: ParsedQuery): string {
    const actionMap = new Map([
      ['architect', 'Design Architecture'],
      ['backend', 'Implement Backend'],
      ['frontend', 'Develop Frontend'],
      ['design', 'Create Design System'],
      ['test-writer', 'Write Tests'],
      ['production-architect', 'Setup Deployment'],
      ['figma-extractor', 'Extract Figma Designs'],
      ['cli', 'Build CLI Tool'],
      ['pr-merger', 'Review & Merge'],
      ['task-dispatcher', 'Analyze & Dispatch']
    ]);

    const baseTitle = actionMap.get(agentType) || `Execute ${agentType} Task`;
    
    // Try to extract key noun from query for context
    const query = parsed.originalQuery.toLowerCase();
    const keyWords = query.match(/\b(api|app|component|service|feature|system|interface)\b/);
    const context = keyWords?.[0] ? ` - ${keyWords[0].charAt(0).toUpperCase() + keyWords[0].slice(1)}` : '';
    
    return `${baseTitle}${context}`;
  }

  private mapQueryComplexityToTaskComplexity(queryComplexity: QueryComplexity): 'low' | 'medium' | 'high' {
    switch (queryComplexity) {
      case QueryComplexity.SIMPLE:
        return 'low';
      case QueryComplexity.MODERATE:
        return 'medium';
      case QueryComplexity.COMPLEX:
      case QueryComplexity.ENTERPRISE:
        return 'high';
      default:
        return 'medium';
    }
  }

  private generateTaskTools(agentType: AgentType): string[] {
    const toolsMap = new Map([
      ['architect', ['system-design', 'documentation', 'modeling']],
      ['backend', ['api-development', 'database', 'server-management']],
      ['frontend', ['ui-development', 'component-library', 'testing']],
      ['design', ['ui-design', 'prototyping', 'design-system']],
      ['test-writer', ['test-automation', 'quality-assurance', 'coverage']],
      ['production-architect', ['deployment', 'infrastructure', 'monitoring']],
      ['figma-extractor', ['design-extraction', 'component-analysis']],
      ['cli', ['command-line', 'scripting', 'automation']],
      ['pr-merger', ['code-review', 'version-control', 'integration']],
      ['task-dispatcher', ['task-analysis', 'coordination', 'planning']]
    ]);

    return toolsMap.get(agentType) || ['general-development'];
  }

  private estimateExecutionTime(tasks: TaskDefinition[], dependencies: TaskDependency[]): number {
    // Simplified estimation - sum all task durations
    // In reality, this would consider parallelism and dependencies
    return tasks.reduce((total, task) => total + (task.estimatedDuration || 60), 0);
  }

  private calculateParallelismLevel(complexity: QueryComplexity, taskCount: number): number {
    const baseLevel = {
      [QueryComplexity.SIMPLE]: 2,
      [QueryComplexity.MODERATE]: 4,
      [QueryComplexity.COMPLEX]: 6,
      [QueryComplexity.ENTERPRISE]: 8
    }[complexity];
    
    return Math.min(baseLevel, taskCount);
  }

  private generateRecommendations(parsed: ParsedQuery, plan: ExecutionPlan): string[] {
    const recommendations: string[] = [];
    
    if (parsed.confidence < 0.7) {
      recommendations.push('Query intent unclear - consider providing more specific details');
    }
    
    if (plan.tasks.length > 5) {
      recommendations.push('Large task count - consider breaking into smaller phases');
    }
    
    if (parsed.complexity === QueryComplexity.ENTERPRISE) {
      recommendations.push('Complex task - recommend close monitoring and staged execution');
    }
    
    // Figma-specific recommendations
    if (parsed.requiredAgents.includes('figma-extractor')) {
      recommendations.push('Ensure Figma access token is configured for design extraction');
    }
    
    return recommendations;
  }

  private generateWarnings(parsed: ParsedQuery, plan: ExecutionPlan): string[] {
    const warnings: string[] = [];
    
    if (plan.estimatedDuration > 480) { // 8 hours
      warnings.push('Long execution time estimated - consider breaking into phases');
    }
    
    if (parsed.requiredAgents.length > 6) {
      warnings.push('High agent count may cause coordination overhead');
    }
    
    return warnings;
  }

  private estimateCost(plan: ExecutionPlan) {
    // Simplified cost estimation
    const costPerMinute = 0.1; // $0.10 per minute
    const computeTime = plan.estimatedDuration;
    
    return {
      computeTime,
      resourceUnits: computeTime,
      estimatedCost: computeTime * costPerMinute,
      breakdown: [
        {
          component: 'Compute Time',
          usage: computeTime,
          rate: costPerMinute,
          cost: computeTime * costPerMinute
        }
      ]
    };
  }
}