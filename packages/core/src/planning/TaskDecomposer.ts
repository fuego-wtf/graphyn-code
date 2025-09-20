/**
 * TaskDecomposer - Natural Language Task Decomposition Engine
 * 
 * Analyzes natural language queries and decomposes them into structured,
 * actionable tasks with proper dependencies and agent assignments.
 */

import { ClaudeAPIWrapper } from '../claude-api-wrapper.js';
import { Task, TaskGraph, Goal } from '../task-graph-generator.js';
import { RepoAnalysis } from '../repo-analyzer.js';

export interface TaskDecomposition {
  originalQuery: string;
  extractedGoal: Goal;
  tasks: Task[];
  dependencies: Map<string, string[]>;
  estimatedDuration: number;
  complexity: 'low' | 'medium' | 'high';
  requiredAgentTypes: string[];
  suggestedApproach: string;
}

export interface DecompositionContext {
  workingDirectory: string;
  repoAnalysis?: RepoAnalysis;
  availableAgents?: string[];
  userPreferences?: {
    verbose?: boolean;
    riskTolerance?: 'low' | 'medium' | 'high';
    timeConstraint?: 'flexible' | 'moderate' | 'urgent';
  };
}

export class TaskDecomposer {
  private claudeAPI: ClaudeAPIWrapper;

  constructor(claudeAPI?: ClaudeAPIWrapper) {
    this.claudeAPI = claudeAPI || new ClaudeAPIWrapper({
      apiKey: process.env.ANTHROPIC_API_KEY || 'demo-key'
    });
  }

  /**
   * Main entry point: decompose natural language query into structured tasks
   */
  async decomposeQuery(
    query: string, 
    context: DecompositionContext
  ): Promise<TaskDecomposition> {
    console.log(`🧠 Analyzing query: "${query}"`);
    
    try {
      // Step 1: Extract goal and intent from natural language
      const goal = await this.extractGoal(query, context);
      
      // Step 2: Analyze complexity and requirements
      const complexity = this.assessComplexity(query, context);
      
      // Step 3: Generate task breakdown
      const tasks = await this.generateTasks(goal, context);
      
      // Step 4: Build dependency graph
      const dependencies = this.buildDependencyGraph(tasks);
      
      // Step 5: Determine required agent types
      const requiredAgentTypes = this.determineAgentTypes(tasks);
      
      // Step 6: Calculate estimates and approach
      const estimatedDuration = this.estimateDuration(tasks);
      const suggestedApproach = this.generateApproach(goal, tasks, context);

      const decomposition: TaskDecomposition = {
        originalQuery: query,
        extractedGoal: goal,
        tasks,
        dependencies,
        estimatedDuration,
        complexity,
        requiredAgentTypes,
        suggestedApproach
      };

      console.log(`✅ Task decomposition complete:`);
      console.log(`   - ${tasks.length} tasks identified`);
      console.log(`   - ${requiredAgentTypes.length} agent types required: ${requiredAgentTypes.join(', ')}`);
      console.log(`   - Estimated duration: ${Math.round(estimatedDuration)} minutes`);
      console.log(`   - Complexity: ${complexity}`);

      return decomposition;

    } catch (error) {
      console.warn('Advanced decomposition failed, using fallback analysis');
      return this.fallbackDecomposition(query, context);
    }
  }

  /**
   * Extract structured goal from natural language query
   */
  private async extractGoal(query: string, context: DecompositionContext): Promise<Goal> {
    // Analyze query patterns to determine goal type and scope
    const queryLower = query.toLowerCase();
    
    let type = 'general';
    let scope: Goal['scope'] = 'feature';
    
    // Determine goal type based on keywords
    if (queryLower.includes('auth') || queryLower.includes('login') || queryLower.includes('user')) {
      type = 'authentication';
    } else if (queryLower.includes('api') || queryLower.includes('endpoint') || queryLower.includes('rest')) {
      type = 'api_development';
    } else if (queryLower.includes('test') || queryLower.includes('spec')) {
      type = 'testing';
    } else if (queryLower.includes('security') || queryLower.includes('audit') || queryLower.includes('vulnerability')) {
      type = 'security';
    } else if (queryLower.includes('database') || queryLower.includes('data') || queryLower.includes('model')) {
      type = 'data_management';
    } else if (queryLower.includes('ui') || queryLower.includes('interface') || queryLower.includes('frontend')) {
      type = 'frontend';
    }

    // Determine scope
    if (queryLower.includes('fix') || queryLower.includes('bug') || queryLower.includes('issue')) {
      scope = 'bugfix';
    } else if (queryLower.includes('refactor') || queryLower.includes('improve') || queryLower.includes('optimize')) {
      scope = 'refactor';
    } else if (queryLower.includes('migrate') || queryLower.includes('upgrade') || queryLower.includes('update')) {
      scope = 'migration';
    }

    // Assess complexity based on query length, technical terms, and repo context
    let complexity: Goal['complexity'] = 'medium';
    const technicalTermCount = this.countTechnicalTerms(query);
    const queryComplexity = query.split(' ').length;

    if (technicalTermCount > 3 || queryComplexity > 15) {
      complexity = 'high';
    } else if (technicalTermCount < 2 && queryComplexity < 8) {
      complexity = 'low';
    }

    // Assess urgency from language cues
    let urgency: Goal['urgency'] = 'medium';
    if (queryLower.includes('urgent') || queryLower.includes('asap') || queryLower.includes('critical')) {
      urgency = 'high';
    } else if (queryLower.includes('when possible') || queryLower.includes('eventually')) {
      urgency = 'low';
    }

    return {
      type,
      description: query,
      complexity,
      urgency,
      scope,
      constraints: this.extractConstraints(query),
      requirements: this.extractRequirements(query, context)
    };
  }

  /**
   * Generate specific tasks based on the goal and context
   */
  private async generateTasks(goal: Goal, context: DecompositionContext): Promise<Task[]> {
    const tasks: Task[] = [];
    let taskCounter = 0;

    const generateTaskId = () => `task-${++taskCounter}-${Date.now()}`;

    // Generate tasks based on goal type and complexity
    switch (goal.type) {
      case 'authentication':
        tasks.push(...this.generateAuthTasks(goal, context, generateTaskId));
        break;
        
      case 'api_development':
        tasks.push(...this.generateAPITasks(goal, context, generateTaskId));
        break;
        
      case 'testing':
        tasks.push(...this.generateTestingTasks(goal, context, generateTaskId));
        break;
        
      case 'security':
        tasks.push(...this.generateSecurityTasks(goal, context, generateTaskId));
        break;
        
      case 'data_management':
        tasks.push(...this.generateDataTasks(goal, context, generateTaskId));
        break;
        
      case 'frontend':
        tasks.push(...this.generateFrontendTasks(goal, context, generateTaskId));
        break;
        
      default:
        tasks.push(...this.generateGeneralTasks(goal, context, generateTaskId));
    }

    return tasks;
  }

  /**
   * Generate authentication-related tasks
   */
  private generateAuthTasks(goal: Goal, context: DecompositionContext, generateId: () => string): Task[] {
    const tasks: Task[] = [];

    // Analysis task
    tasks.push({
      id: generateId(),
      description: 'Analyze current authentication requirements and architecture',
      type: 'analysis',
      dependencies: [],
      workingDirectory: context.workingDirectory,
      priority: 5,
      estimatedDuration: 30,
      requiredSkills: ['Authentication', 'Security Analysis'],
      deliverables: ['Authentication requirements document', 'Architecture analysis'],
      acceptanceCriteria: ['Requirements clearly defined', 'Security considerations documented'],
      requirements: goal.requirements
    });

    // Implementation task
    if (goal.scope === 'feature' || goal.scope === 'refactor' || goal.scope === 'migration') {
      const analysisTaskId = tasks[0].id;
      
      tasks.push({
        id: generateId(),
        description: 'Implement JWT-based authentication system',
        type: 'implementation',
        dependencies: [analysisTaskId],
        workingDirectory: context.workingDirectory,
        priority: 4,
        estimatedDuration: 120,
        requiredSkills: ['Backend Development', 'JWT', 'Authentication'],
        deliverables: ['Authentication middleware', 'JWT token handling', 'Login/logout endpoints'],
        acceptanceCriteria: ['Authentication flow working', 'JWT tokens generated correctly', 'Secure password handling'],
        requirements: goal.requirements,
        config: {
          tools: ['fs.write', 'fs.patch', 'shell.exec']
        }
      });

      // Testing task
      tasks.push({
        id: generateId(),
        description: 'Create authentication tests and security validation',
        type: 'testing',
        dependencies: [tasks[1].id],
        workingDirectory: context.workingDirectory,
        priority: 3,
        estimatedDuration: 60,
        requiredSkills: ['Testing', 'Security Testing'],
        deliverables: ['Authentication test suite', 'Security validation tests'],
        acceptanceCriteria: ['All auth flows tested', 'Security vulnerabilities checked'],
        requirements: goal.requirements
      });
    }

    return tasks;
  }

  /**
   * Generate API development tasks
   */
  private generateAPITasks(goal: Goal, context: DecompositionContext, generateId: () => string): Task[] {
    const tasks: Task[] = [];

    tasks.push({
      id: generateId(),
      description: 'Design API endpoints and data models',
      type: 'analysis',
      dependencies: [],
      workingDirectory: context.workingDirectory,
      priority: 5,
      estimatedDuration: 45,
      requiredSkills: ['API Design', 'Data Modeling'],
      deliverables: ['API specification', 'Data model design'],
      acceptanceCriteria: ['RESTful design principles followed', 'Data models validated'],
      requirements: goal.requirements
    });

    if (goal.scope === 'feature' || goal.scope === 'refactor' || goal.scope === 'migration') {
      tasks.push({
        id: generateId(),
        description: 'Implement REST API endpoints with validation',
        type: 'implementation',
        dependencies: [tasks[0].id],
        workingDirectory: context.workingDirectory,
        priority: 4,
        estimatedDuration: 90,
        requiredSkills: ['Backend Development', 'REST API', 'Validation'],
        deliverables: ['API endpoints', 'Request validation', 'Error handling'],
        acceptanceCriteria: ['All endpoints functional', 'Proper HTTP status codes', 'Input validation working'],
        requirements: goal.requirements,
        config: {
          tools: ['fs.write', 'fs.patch', 'shell.exec']
        }
      });
    }

    return tasks;
  }

  /**
   * Generate testing-related tasks
   */
  private generateTestingTasks(goal: Goal, context: DecompositionContext, generateId: () => string): Task[] {
    return [{
      id: generateId(),
      description: 'Implement comprehensive test suite',
      type: 'testing',
      dependencies: [],
      workingDirectory: context.workingDirectory,
      priority: 4,
      estimatedDuration: 90,
      requiredSkills: ['Testing', 'Test Automation'],
      deliverables: ['Unit tests', 'Integration tests', 'Test coverage report'],
      acceptanceCriteria: ['90%+ code coverage', 'All critical paths tested'],
      requirements: goal.requirements
    }];
  }

  /**
   * Generate security-related tasks
   */
  private generateSecurityTasks(goal: Goal, context: DecompositionContext, generateId: () => string): Task[] {
    return [{
      id: generateId(),
      description: 'Perform security audit and vulnerability assessment',
      type: 'security',
      dependencies: [],
      workingDirectory: context.workingDirectory,
      priority: 5,
      estimatedDuration: 120,
      requiredSkills: ['Security Analysis', 'Vulnerability Assessment'],
      deliverables: ['Security audit report', 'Vulnerability assessment', 'Remediation recommendations'],
      acceptanceCriteria: ['All security issues identified', 'OWASP Top 10 compliance checked'],
      requirements: goal.requirements
    }];
  }

  /**
   * Generate data management tasks
   */
  private generateDataTasks(goal: Goal, context: DecompositionContext, generateId: () => string): Task[] {
    const tasks: Task[] = [];

    tasks.push({
      id: generateId(),
      description: 'Design database schema and data models',
      type: 'analysis',
      dependencies: [],
      workingDirectory: context.workingDirectory,
      priority: 5,
      estimatedDuration: 60,
      requiredSkills: ['Database Design', 'Data Modeling'],
      deliverables: ['Database schema', 'Data model documentation'],
      acceptanceCriteria: ['Schema normalized', 'Relationships properly defined'],
      requirements: goal.requirements
    });

    if (goal.scope === 'feature' || goal.scope === 'refactor' || goal.scope === 'migration') {
      tasks.push({
        id: generateId(),
        description: 'Implement database migrations and data access layer',
        type: 'implementation',
        dependencies: [tasks[0].id],
        workingDirectory: context.workingDirectory,
        priority: 4,
        estimatedDuration: 90,
        requiredSkills: ['Database Implementation', 'Backend Development'],
        deliverables: ['Database migrations', 'Data access layer', 'Query optimization'],
        acceptanceCriteria: ['Migrations run successfully', 'Data access layer functional'],
        requirements: goal.requirements
      });
    }

    return tasks;
  }

  /**
   * Generate frontend-related tasks
   */
  private generateFrontendTasks(goal: Goal, context: DecompositionContext, generateId: () => string): Task[] {
    return [{
      id: generateId(),
      description: 'Implement user interface components and interactions',
      type: 'implementation',
      dependencies: [],
      workingDirectory: context.workingDirectory,
      priority: 4,
      estimatedDuration: 120,
      requiredSkills: ['Frontend Development', 'UI/UX'],
      deliverables: ['UI components', 'User interactions', 'Responsive design'],
      acceptanceCriteria: ['UI components functional', 'Mobile responsive', 'Accessibility compliant'],
      requirements: goal.requirements
    }];
  }

  /**
   * Generate general tasks when type is unknown
   */
  private generateGeneralTasks(goal: Goal, context: DecompositionContext, generateId: () => string): Task[] {
    return [{
      id: generateId(),
      description: goal.description,
      type: 'implementation',
      dependencies: [],
      workingDirectory: context.workingDirectory,
      priority: 3,
      estimatedDuration: 60,
      requiredSkills: ['General Development'],
      deliverables: ['Implementation complete'],
      acceptanceCriteria: ['Requirements satisfied'],
      requirements: goal.requirements
    }];
  }

  /**
   * Build dependency graph between tasks
   */
  private buildDependencyGraph(tasks: Task[]): Map<string, string[]> {
    const dependencies = new Map<string, string[]>();
    
    tasks.forEach(task => {
      dependencies.set(task.id, task.dependencies);
    });

    return dependencies;
  }

  /**
   * Determine required agent types based on task types
   */
  private determineAgentTypes(tasks: Task[]): string[] {
    const agentTypes = new Set<string>();

    tasks.forEach(task => {
      switch (task.type) {
        case 'analysis':
          agentTypes.add('backend');
          break;
        case 'implementation':
          if (task.requiredSkills.some(skill => skill.toLowerCase().includes('frontend'))) {
            agentTypes.add('frontend');
          } else {
            agentTypes.add('backend');
          }
          break;
        case 'testing':
          agentTypes.add('testing');
          break;
        case 'security':
          agentTypes.add('security');
          break;
        case 'deployment':
          agentTypes.add('devops');
          break;
        default:
          agentTypes.add('backend');
      }
    });

    return Array.from(agentTypes);
  }

  /**
   * Estimate total duration for all tasks
   */
  private estimateDuration(tasks: Task[]): number {
    // Account for parallel execution - not all tasks run sequentially
    const totalSequentialTime = tasks.reduce((sum, task) => sum + task.estimatedDuration, 0);
    
    // Assume some parallel execution efficiency
    const parallelEfficiency = 0.7; // 70% of sequential time due to dependencies
    
    return Math.round(totalSequentialTime * parallelEfficiency);
  }

  /**
   * Generate suggested approach based on analysis
   */
  private generateApproach(goal: Goal, tasks: Task[], context: DecompositionContext): string {
    const approach = [];
    
    approach.push(`**Recommended Approach for: "${goal.description}"**\n`);
    
    if (goal.complexity === 'high') {
      approach.push('🔸 **High Complexity Detected** - Breaking down into smaller, manageable tasks');
    }
    
    if (goal.urgency === 'high') {
      approach.push('⏰ **High Priority** - Parallel execution recommended where possible');
    }
    
    approach.push(`\n**Execution Strategy:**`);
    approach.push(`1. **Analysis Phase**: Start with requirements gathering and design`);
    approach.push(`2. **Implementation Phase**: Develop core functionality with testing`);
    approach.push(`3. **Validation Phase**: Ensure quality and security standards`);
    
    if (tasks.length > 3) {
      approach.push(`\n**Parallel Execution**: ${Math.floor(tasks.length / 2)} tasks can run in parallel to optimize delivery time.`);
    }

    return approach.join('\n');
  }

  /**
   * Assess complexity of the query
   */
  private assessComplexity(query: string, context: DecompositionContext): 'low' | 'medium' | 'high' {
    let score = 0;
    
    // Length-based complexity
    const words = query.split(' ').length;
    if (words > 15) score += 2;
    else if (words > 8) score += 1;
    
    // Technical terms
    const technicalTerms = this.countTechnicalTerms(query);
    score += Math.min(technicalTerms, 3);
    
    // Multiple system integration
    if (query.includes(' and ') || query.includes(' with ') || query.includes('integrate')) score += 1;
    
    // Repository context
    if (context.repoAnalysis?.complexity?.score && context.repoAnalysis.complexity.score > 7) {
      score += 1;
    }
    
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  /**
   * Count technical terms in query
   */
  private countTechnicalTerms(query: string): number {
    const technicalTerms = [
      'api', 'rest', 'graphql', 'database', 'sql', 'nosql', 'auth', 'jwt', 'oauth',
      'microservice', 'docker', 'kubernetes', 'ci/cd', 'testing', 'unit', 'integration',
      'security', 'encryption', 'ssl', 'https', 'frontend', 'backend', 'fullstack',
      'react', 'vue', 'angular', 'node', 'express', 'fastify', 'typescript', 'javascript'
    ];
    
    const queryLower = query.toLowerCase();
    return technicalTerms.filter(term => queryLower.includes(term)).length;
  }

  /**
   * Extract constraints from natural language
   */
  private extractConstraints(query: string): string[] {
    const constraints = [];
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('no database') || queryLower.includes('without database')) {
      constraints.push('No database dependency');
    }
    
    if (queryLower.includes('simple') || queryLower.includes('minimal')) {
      constraints.push('Keep implementation minimal');
    }
    
    if (queryLower.includes('secure') || queryLower.includes('security')) {
      constraints.push('Security compliance required');
    }
    
    return constraints;
  }

  /**
   * Extract requirements from natural language and context
   */
  private extractRequirements(query: string, context: DecompositionContext): string[] {
    const requirements = [];
    const queryLower = query.toLowerCase();
    
    // Technology requirements
    if (context.repoAnalysis?.technology) {
      const tech = context.repoAnalysis.technology;
      if (tech.primaryLanguages.length > 0) {
        requirements.push(`Use ${tech.primaryLanguages[0]} as primary language`);
      }
      if (tech.frameworks.length > 0) {
        requirements.push(`Integrate with ${tech.frameworks[0]} framework`);
      }
    }
    
    // Functional requirements from query
    if (queryLower.includes('user')) {
      requirements.push('User management functionality');
    }
    
    if (queryLower.includes('dashboard') || queryLower.includes('admin')) {
      requirements.push('Administrative interface');
    }
    
    if (queryLower.includes('mobile') || queryLower.includes('responsive')) {
      requirements.push('Mobile-responsive design');
    }

    return requirements;
  }

  /**
   * Fallback decomposition when advanced analysis fails
   */
  private fallbackDecomposition(query: string, context: DecompositionContext): TaskDecomposition {
    console.log('Using fallback task decomposition');
    
    const fallbackGoal: Goal = {
      type: 'general',
      description: query,
      complexity: 'medium',
      urgency: 'medium',
      scope: 'feature',
      constraints: [],
      requirements: []
    };

    const fallbackTask: Task = {
      id: `fallback-task-${Date.now()}`,
      description: query,
      type: 'implementation',
      dependencies: [],
      workingDirectory: context.workingDirectory,
      priority: 3,
      estimatedDuration: 60,
      requiredSkills: ['General Development'],
      deliverables: ['Task completion'],
      acceptanceCriteria: ['Requirements satisfied'],
      requirements: []
    };

    return {
      originalQuery: query,
      extractedGoal: fallbackGoal,
      tasks: [fallbackTask],
      dependencies: new Map([[fallbackTask.id, []]]),
      estimatedDuration: 60,
      complexity: 'medium',
      requiredAgentTypes: ['backend'],
      suggestedApproach: 'Single-task implementation with general-purpose agent'
    };
  }
}