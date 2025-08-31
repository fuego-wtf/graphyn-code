/**
 * Task Distributor
 * Analyzes complex requests and breaks them down into agent-specific tasks
 */
import { Task, OrchestrationRequest } from './multi-agent-orchestrator.js';
import { ClaudeCodeWrapper } from './claude-wrapper.js';
import { debug } from '../utils/debug.js';

export interface TaskDependency {
  taskId: string;
  dependsOn: string[];
  reason: string;
}

export class TaskDistributor {
  private claudeWrapper: ClaudeCodeWrapper;

  constructor() {
    this.claudeWrapper = new ClaudeCodeWrapper();
  }
  
  /**
   * Decompose a complex request into specific tasks for different agents using Claude Code
   */
  async decompose(request: OrchestrationRequest): Promise<Task[]> {
    debug('Decomposing request using Claude Code:', request.query);

    try {
      // Use Claude Code to intelligently analyze and decompose the task
      const decompositionPrompt = this.buildDecompositionPrompt(request);
      const decompositionResult = await this.claudeWrapper.executeQuery({
        prompt: decompositionPrompt,
        timeout: 60000 // 1 minute timeout
      });

      // Parse the Claude Code response to extract tasks
      const tasks = this.parseTasksFromClaudeResponse(decompositionResult);
      
      debug('Claude Code generated tasks:', tasks.length);
      return tasks;

    } catch (error) {
      debug('Claude Code decomposition failed, falling back to static analysis:', error);
      // Fallback to static analysis if Claude Code fails
      return this.fallbackDecompose(request);
    }
  }

  private buildDecompositionPrompt(request: OrchestrationRequest): string {
    return `You are a software project manager expert at breaking down complex development requests into specific, actionable tasks for different specialized agents.

**Request**: "${request.query}"

**Context**:
- Repository: ${request.context.repository}
- Framework: ${request.context.framework || 'Not specified'}
- Language: ${request.context.language || 'Not specified'}
- Available agents: system-architect, backend-dev, frontend-dev, tester, reviewer, deployer

**Instructions**:
Analyze this request and break it down into specific tasks. For each task, provide:
1. A clear, actionable description
2. Which agent should handle it
3. Priority level (1-5, where 1 is highest priority)
4. Dependencies (which tasks must be completed first)

**Output Format** (respond ONLY in this JSON format):
\`\`\`json
{
  "tasks": [
    {
      "id": "task_1",
      "description": "Specific task description",
      "agent": "system-architect",
      "priority": 1,
      "dependencies": [],
      "metadata": {
        "phase": "planning",
        "estimated_duration": "short"
      }
    }
  ]
}
\`\`\`

**Guidelines**:
- Create 3-8 tasks maximum
- Be specific and actionable
- Consider logical dependencies
- Use appropriate agent types
- Include both implementation and testing tasks
- Focus on the core request, avoid over-engineering

Analyze the request and provide the task breakdown:`;
  }

  private parseTasksFromClaudeResponse(response: string): Task[] {
    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const parsed = JSON.parse(jsonMatch[1]);
      const tasks: Task[] = [];

      for (const taskData of parsed.tasks || []) {
        tasks.push({
          id: taskData.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          description: taskData.description,
          agent: taskData.agent,
          dependencies: taskData.dependencies || [],
          priority: taskData.priority || 3,
          status: 'pending',
          metadata: taskData.metadata || {}
        });
      }

      return tasks;

    } catch (error) {
      debug('Failed to parse Claude response:', error);
      throw new Error(`Failed to parse task decomposition: ${error.message}`);
    }
  }

  private fallbackDecompose(request: OrchestrationRequest): Task[] {
    debug('Using fallback decomposition');

    const tasks: Task[] = [];
    let taskCounter = 1;

    // Simple fallback logic based on keyword detection
    const requestType = this.analyzeRequestType(request.query);
    
    switch (requestType) {
      case 'full_stack_feature':
        tasks.push(...this.createFullStackTasks(request, taskCounter));
        break;
      default:
        // Create a generic task for the system architect to analyze
        tasks.push({
          id: `task_${taskCounter}`,
          description: `Analyze and plan: ${request.query}`,
          agent: 'system-architect',
          dependencies: [],
          priority: 1,
          status: 'pending',
          metadata: { phase: 'analysis' }
        });
    }

    return tasks;
  }

  /**
   * Analyze what type of request this is
   */
  private analyzeRequestType(query: string): string {
    const lowerQuery = query.toLowerCase();

    // Full stack indicators
    if (this.hasMultiple(lowerQuery, ['frontend', 'backend', 'database', 'api', 'ui'])) {
      return 'full_stack_feature';
    }

    // Backend specific
    if (this.hasAny(lowerQuery, ['api', 'database', 'backend', 'server', 'endpoint', 'microservice'])) {
      return 'backend_feature';
    }

    // Frontend specific
    if (this.hasAny(lowerQuery, ['ui', 'frontend', 'react', 'component', 'interface', 'dashboard'])) {
      return 'frontend_feature';
    }

    // Architecture
    if (this.hasAny(lowerQuery, ['architecture', 'design', 'structure', 'refactor', 'organize'])) {
      return 'architecture_review';
    }

    // Bug fixes
    if (this.hasAny(lowerQuery, ['bug', 'fix', 'error', 'issue', 'broken', 'not working'])) {
      return 'bug_fix';
    }

    // Testing
    if (this.hasAny(lowerQuery, ['test', 'testing', 'unit test', 'integration', 'coverage'])) {
      return 'testing';
    }

    return 'generic';
  }

  /**
   * Create tasks for full-stack features
   */
  private createFullStackTasks(request: OrchestrationRequest, startCounter: number): Task[] {
    const tasks: Task[] = [];
    let counter = startCounter;

    // 1. Architecture planning (architect)
    tasks.push({
      id: `task_${counter++}`,
      description: `Analyze and plan architecture for: ${request.query}`,
      agent: 'architect',
      dependencies: [],
      priority: 1,
      status: 'pending',
      metadata: { phase: 'planning' }
    });

    // 2. Backend implementation (backend) - depends on architecture
    tasks.push({
      id: `task_${counter++}`,
      description: `Implement backend services and APIs for: ${request.query}`,
      agent: 'backend',
      dependencies: [`task_${startCounter}`],
      priority: 2,
      status: 'pending',
      metadata: { phase: 'backend' }
    });

    // 3. Frontend implementation (frontend) - depends on backend APIs
    tasks.push({
      id: `task_${counter++}`,
      description: `Implement frontend UI and components for: ${request.query}`,
      agent: 'frontend',
      dependencies: [`task_${startCounter + 1}`],
      priority: 2,
      status: 'pending',
      metadata: { phase: 'frontend' }
    });

    // 4. Integration testing (test-writer) - depends on both frontend and backend
    tasks.push({
      id: `task_${counter++}`,
      description: `Create integration tests for: ${request.query}`,
      agent: 'test-writer',
      dependencies: [`task_${startCounter + 1}`, `task_${startCounter + 2}`],
      priority: 3,
      status: 'pending',
      metadata: { phase: 'testing' }
    });

    // 5. Production readiness (production-architect) - final step
    tasks.push({
      id: `task_${counter++}`,
      description: `Ensure production readiness for: ${request.query}`,
      agent: 'production-architect',
      dependencies: [`task_${startCounter + 3}`],
      priority: 4,
      status: 'pending',
      metadata: { phase: 'deployment' }
    });

    return tasks;
  }

  /**
   * Create tasks for backend-focused features
   */
  private createBackendTasks(request: OrchestrationRequest, startCounter: number): Task[] {
    const tasks: Task[] = [];
    let counter = startCounter;

    // 1. Design backend architecture
    tasks.push({
      id: `task_${counter++}`,
      description: `Design backend architecture for: ${request.query}`,
      agent: 'architect',
      dependencies: [],
      priority: 1,
      status: 'pending',
      metadata: { focus: 'backend_design' }
    });

    // 2. Implement backend services
    tasks.push({
      id: `task_${counter++}`,
      description: `Implement backend services: ${request.query}`,
      agent: 'backend',
      dependencies: [`task_${startCounter}`],
      priority: 2,
      status: 'pending',
      metadata: { focus: 'implementation' }
    });

    // 3. Write tests
    tasks.push({
      id: `task_${counter++}`,
      description: `Write tests for backend: ${request.query}`,
      agent: 'test-writer',
      dependencies: [`task_${startCounter + 1}`],
      priority: 3,
      status: 'pending',
      metadata: { focus: 'testing' }
    });

    return tasks;
  }

  /**
   * Create tasks for frontend-focused features
   */
  private createFrontendTasks(request: OrchestrationRequest, startCounter: number): Task[] {
    const tasks: Task[] = [];
    let counter = startCounter;

    // 1. Design UI/UX
    if (request.query.toLowerCase().includes('design') || request.query.toLowerCase().includes('ui')) {
      tasks.push({
        id: `task_${counter++}`,
        description: `Design UI/UX for: ${request.query}`,
        agent: 'design',
        dependencies: [],
        priority: 1,
        status: 'pending',
        metadata: { focus: 'design' }
      });
    }

    // 2. Implement frontend components
    tasks.push({
      id: `task_${counter++}`,
      description: `Implement frontend components: ${request.query}`,
      agent: 'frontend',
      dependencies: tasks.length > 0 ? [tasks[0].id] : [],
      priority: 2,
      status: 'pending',
      metadata: { focus: 'implementation' }
    });

    // 3. Write frontend tests
    tasks.push({
      id: `task_${counter++}`,
      description: `Write frontend tests for: ${request.query}`,
      agent: 'test-writer',
      dependencies: [`task_${counter - 1}`],
      priority: 3,
      status: 'pending',
      metadata: { focus: 'testing' }
    });

    return tasks;
  }

  /**
   * Create tasks for architecture reviews
   */
  private createArchitectureTasks(request: OrchestrationRequest, startCounter: number): Task[] {
    const tasks: Task[] = [];
    let counter = startCounter;

    // 1. Analyze current architecture
    tasks.push({
      id: `task_${counter++}`,
      description: `Analyze current architecture: ${request.query}`,
      agent: 'architect',
      dependencies: [],
      priority: 1,
      status: 'pending',
      metadata: { focus: 'analysis' }
    });

    // 2. Propose improvements
    tasks.push({
      id: `task_${counter++}`,
      description: `Propose architecture improvements: ${request.query}`,
      agent: 'production-architect',
      dependencies: [`task_${startCounter}`],
      priority: 2,
      status: 'pending',
      metadata: { focus: 'recommendations' }
    });

    return tasks;
  }

  /**
   * Create tasks for bug fixes
   */
  private createBugFixTasks(request: OrchestrationRequest, startCounter: number): Task[] {
    const tasks: Task[] = [];
    let counter = startCounter;

    // Determine which type of bug (backend, frontend, or unclear)
    const lowerQuery = request.query.toLowerCase();
    
    if (this.hasAny(lowerQuery, ['api', 'server', 'database', 'backend'])) {
      tasks.push({
        id: `task_${counter++}`,
        description: `Fix backend bug: ${request.query}`,
        agent: 'backend',
        dependencies: [],
        priority: 1,
        status: 'pending',
        metadata: { focus: 'bug_fix', area: 'backend' }
      });
    } else if (this.hasAny(lowerQuery, ['ui', 'frontend', 'component', 'styling'])) {
      tasks.push({
        id: `task_${counter++}`,
        description: `Fix frontend bug: ${request.query}`,
        agent: 'frontend',
        dependencies: [],
        priority: 1,
        status: 'pending',
        metadata: { focus: 'bug_fix', area: 'frontend' }
      });
    } else {
      // Unclear - start with analysis
      tasks.push({
        id: `task_${counter++}`,
        description: `Investigate and diagnose bug: ${request.query}`,
        agent: 'task-dispatcher',
        dependencies: [],
        priority: 1,
        status: 'pending',
        metadata: { focus: 'diagnosis' }
      });
    }

    // Always add testing after fix
    tasks.push({
      id: `task_${counter++}`,
      description: `Test bug fix: ${request.query}`,
      agent: 'test-writer',
      dependencies: [`task_${startCounter}`],
      priority: 2,
      status: 'pending',
      metadata: { focus: 'verification' }
    });

    return tasks;
  }

  /**
   * Create tasks for testing requests
   */
  private createTestingTasks(request: OrchestrationRequest, startCounter: number): Task[] {
    const tasks: Task[] = [];
    let counter = startCounter;

    tasks.push({
      id: `task_${counter++}`,
      description: `Write comprehensive tests: ${request.query}`,
      agent: 'test-writer',
      dependencies: [],
      priority: 1,
      status: 'pending',
      metadata: { focus: 'testing' }
    });

    return tasks;
  }

  /**
   * Create generic tasks when type is unclear
   */
  private createGenericTasks(request: OrchestrationRequest, startCounter: number): Task[] {
    const tasks: Task[] = [];
    let counter = startCounter;

    // Start with task analysis and routing
    tasks.push({
      id: `task_${counter++}`,
      description: `Analyze and route request: ${request.query}`,
      agent: 'task-dispatcher',
      dependencies: [],
      priority: 1,
      status: 'pending',
      metadata: { focus: 'analysis' }
    });

    return tasks;
  }

  /**
   * Determine which agents are needed based on request
   */
  private determineRequiredAgents(request: OrchestrationRequest, requestType: string): string[] {
    const agents = new Set<string>();
    const lowerQuery = request.query.toLowerCase();

    // Add agents based on request content
    if (this.hasAny(lowerQuery, ['backend', 'api', 'server', 'database'])) {
      agents.add('backend');
    }
    if (this.hasAny(lowerQuery, ['frontend', 'ui', 'component', 'react'])) {
      agents.add('frontend');
    }
    if (this.hasAny(lowerQuery, ['architecture', 'design', 'structure'])) {
      agents.add('architect');
    }
    if (this.hasAny(lowerQuery, ['test', 'testing'])) {
      agents.add('test-writer');
    }

    // Default to architect if unclear
    if (agents.size === 0) {
      agents.add('task-dispatcher');
    }

    return Array.from(agents);
  }

  /**
   * Establish dependencies between tasks based on logical workflow
   */
  private establishDependencies(tasks: Task[]): void {
    // Dependencies are already set in the creation methods
    // This method can be used for additional dependency logic if needed
    debug('Established dependencies for', tasks.length, 'tasks');
  }

  /**
   * Helper: Check if query contains any of the given keywords
   */
  private hasAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  /**
   * Helper: Check if query contains multiple keywords (indicating complex request)
   */
  private hasMultiple(text: string, keywords: string[], minCount: number = 2): boolean {
    const foundCount = keywords.filter(keyword => text.includes(keyword)).length;
    return foundCount >= minCount;
  }
}