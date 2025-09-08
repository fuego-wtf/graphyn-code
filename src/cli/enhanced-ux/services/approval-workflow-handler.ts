/**
 * ApprovalWorkflowHandler Service
 * 
 * Manages task decomposition and interactive approval workflow
 * with keyboard navigation and task modification capabilities.
 */

import { EventEmitter } from 'events';
import type {
  TaskItem,
  TaskDecompositionResult,
  ApprovalState,
  KeyboardAction,
  EnhancedUXConfig,
  PerformanceMetrics
} from '../types.js';

export class ApprovalWorkflowHandler extends EventEmitter {
  private config: EnhancedUXConfig;
  private performanceMetrics: PerformanceMetrics = {
    renderTime: 0,
    analysisTime: 0,
    inputResponseTime: 0,
    memoryUsage: 0
  };

  constructor(config: EnhancedUXConfig) {
    super();
    this.config = config;
  }

  /**
   * Decompose complex query into manageable tasks
   */
  async decomposeQuery(query: string): Promise<TaskDecompositionResult> {
    const startTime = performance.now();

    try {
      const tasks = await this.analyzeQueryAndCreateTasks(query);
      const totalEstimatedTime = tasks.reduce((sum, task) => sum + task.estimatedTime, 0);
      const parallelizable = this.checkParallelizability(tasks);
      const complexity = this.assessComplexity(query, tasks);

      const result: TaskDecompositionResult = {
        query,
        tasks,
        totalEstimatedTime,
        parallelizable,
        complexity
      };

      const decompositionTime = performance.now() - startTime;
      this.performanceMetrics.analysisTime = decompositionTime;

      return result;

    } catch (error) {
      throw new Error(`Query decomposition failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Analyze query and create task list
   */
  private async analyzeQueryAndCreateTasks(query: string): Promise<TaskItem[]> {
    const tasks: TaskItem[] = [];
    const queryLower = query.toLowerCase();

    // Simple pattern-based task decomposition
    let taskId = 1;

    // Database-related tasks
    if (queryLower.includes('database') || queryLower.includes('schema') || queryLower.includes('model')) {
      tasks.push({
        id: `task-${taskId++}`,
        title: 'Design database schema',
        description: 'Create database tables and relationships based on requirements',
        agent: 'backend',
        estimatedTime: 1800, // 30 minutes
        dependencies: [],
        status: 'pending'
      });
    }

    // API-related tasks
    if (queryLower.includes('api') || queryLower.includes('endpoint') || queryLower.includes('rest')) {
      const dbTaskExists = tasks.some(t => t.title.includes('database'));
      tasks.push({
        id: `task-${taskId++}`,
        title: 'Create API endpoints',
        description: 'Implement REST API endpoints with proper validation and error handling',
        agent: 'backend',
        estimatedTime: 2400, // 40 minutes
        dependencies: dbTaskExists ? [tasks[0].id] : [],
        status: 'pending'
      });
    }

    // Authentication tasks
    if (queryLower.includes('auth') || queryLower.includes('login') || queryLower.includes('user')) {
      tasks.push({
        id: `task-${taskId++}`,
        title: 'Implement authentication',
        description: 'Set up user authentication with JWT tokens and secure sessions',
        agent: 'backend',
        estimatedTime: 3000, // 50 minutes
        dependencies: [],
        status: 'pending'
      });
    }

    // Frontend UI tasks
    if (queryLower.includes('ui') || queryLower.includes('component') || queryLower.includes('page') || queryLower.includes('interface')) {
      const apiTaskExists = tasks.some(t => t.title.includes('API'));
      tasks.push({
        id: `task-${taskId++}`,
        title: 'Build UI components',
        description: 'Create responsive user interface components with proper styling',
        agent: 'frontend',
        estimatedTime: 2700, // 45 minutes
        dependencies: apiTaskExists ? [tasks.find(t => t.title.includes('API'))!.id] : [],
        status: 'pending'
      });
    }

    // E-commerce specific tasks
    if (queryLower.includes('ecommerce') || queryLower.includes('e-commerce') || queryLower.includes('shopping')) {
      tasks.push(
        {
          id: `task-${taskId++}`,
          title: 'Product catalog system',
          description: 'Create product management system with categories and inventory',
          agent: 'backend',
          estimatedTime: 3600, // 60 minutes
          dependencies: [],
          status: 'pending'
        },
        {
          id: `task-${taskId++}`,
          title: 'Shopping cart functionality',
          description: 'Implement shopping cart with add/remove/update operations',
          agent: 'frontend',
          estimatedTime: 2400, // 40 minutes
          dependencies: [`task-${taskId - 1}`],
          status: 'pending'
        },
        {
          id: `task-${taskId++}`,
          title: 'Payment processing',
          description: 'Integrate payment gateway with secure transaction handling',
          agent: 'backend',
          estimatedTime: 4800, // 80 minutes
          dependencies: [`task-${taskId - 1}`],
          status: 'pending'
        }
      );
    }

    // Testing tasks
    if (queryLower.includes('test') || tasks.length > 2) {
      tasks.push({
        id: `task-${taskId++}`,
        title: 'Write comprehensive tests',
        description: 'Create unit and integration tests for all components',
        agent: 'backend',
        estimatedTime: 1800, // 30 minutes
        dependencies: tasks.slice(-2).map(t => t.id), // Depends on last few tasks
        status: 'pending'
      });
    }

    // Architecture review for complex projects
    if (tasks.length > 3 || queryLower.includes('architecture') || queryLower.includes('microservice')) {
      tasks.unshift({
        id: `task-${taskId++}`,
        title: 'Architecture planning',
        description: 'Design system architecture and define component boundaries',
        agent: 'architect',
        estimatedTime: 2100, // 35 minutes
        dependencies: [],
        status: 'pending'
      });

      // Update dependencies to include architecture task
      tasks.slice(1).forEach(task => {
        if (task.dependencies.length === 0) {
          task.dependencies.push(tasks[0].id);
        }
      });
    }

    // Fallback for simple queries
    if (tasks.length === 0) {
      tasks.push({
        id: `task-${taskId++}`,
        title: 'Implement requested feature',
        description: `Implement: ${query}`,
        agent: 'backend',
        estimatedTime: 1200, // 20 minutes
        dependencies: [],
        status: 'pending'
      });
    }

    return tasks;
  }

  /**
   * Check if tasks can be run in parallel
   */
  private checkParallelizability(tasks: TaskItem[]): boolean {
    const independentTasks = tasks.filter(task => task.dependencies.length === 0);
    return independentTasks.length > 1;
  }

  /**
   * Assess query complexity
   */
  private assessComplexity(query: string, tasks: TaskItem[]): 'simple' | 'moderate' | 'complex' {
    const queryWords = query.split(' ').length;
    const taskCount = tasks.length;
    const totalTime = tasks.reduce((sum, task) => sum + task.estimatedTime, 0);

    if (taskCount > 5 || totalTime > 14400 || queryWords > 20) { // > 4 hours or very detailed
      return 'complex';
    } else if (taskCount > 2 || totalTime > 3600 || queryWords > 10) { // > 1 hour or moderate detail
      return 'moderate';
    } else {
      return 'simple';
    }
  }

  /**
   * Initialize approval state for task list
   */
  async initializeApproval(tasks: TaskItem[]): Promise<ApprovalState> {
    return {
      tasks: [...tasks], // Copy to avoid mutations
      selectedIndex: tasks.length > 0 ? 0 : -1,
      modified: false,
      approved: false
    };
  }

  /**
   * Handle keyboard input for approval workflow
   */
  async handleKeyboardInput(state: ApprovalState, action: KeyboardAction): Promise<ApprovalState> {
    const startTime = performance.now();

    try {
      const newState = { ...state };

      switch (action.action) {
        case 'next':
          newState.selectedIndex = Math.min(newState.selectedIndex + 1, newState.tasks.length - 1);
          break;

        case 'previous':
          newState.selectedIndex = Math.max(newState.selectedIndex - 1, 0);
          break;

        case 'approve':
          newState.approved = true;
          this.emit('approval_completed', newState);
          break;

        case 'modify':
          newState.modified = true;
          // Enter modification mode - would typically open task editor
          break;

        case 'filter':
          if (action.target) {
            newState.tasks = state.tasks.filter(task => task.status === action.target);
            newState.selectedIndex = 0;
          }
          break;

        case 'cancel':
          throw new Error('User cancelled approval workflow');

        case 'toggle':
          if (newState.selectedIndex >= 0 && newState.selectedIndex < newState.tasks.length) {
            const task = newState.tasks[newState.selectedIndex];
            task.status = task.status === 'pending' ? 'approved' : 
                         task.status === 'approved' ? 'rejected' : 'pending';
            newState.modified = true;
            this.emit('task_status_changed', task);
          }
          break;

        default:
          // Invalid action, return unchanged state
          return state;
      }

      // Update performance metrics
      const responseTime = performance.now() - startTime;
      this.performanceMetrics.inputResponseTime = responseTime;

      return newState;

    } catch (error) {
      throw error; // Re-throw to allow proper error handling
    }
  }

  /**
   * Modify task details
   */
  async modifyTask(task: TaskItem, modifications: Partial<Omit<TaskItem, 'id' | 'status'>>): Promise<TaskItem> {
    // Validate modifications
    if (modifications.estimatedTime && modifications.estimatedTime < 0) {
      throw new Error('Invalid task modifications: estimated time cannot be negative');
    }

    if (modifications.agent && !['backend', 'frontend', 'architect', 'tester'].includes(modifications.agent)) {
      throw new Error('Invalid task modifications: invalid agent type');
    }

    return {
      ...task,
      ...modifications,
      id: task.id, // Preserve ID
      status: task.status // Preserve status
    };
  }

  /**
   * Render approval interface (placeholder for terminal rendering)
   */
  async renderApprovalInterface(state: ApprovalState): Promise<void> {
    const startTime = performance.now();

    // This would render the approval interface in the terminal
    // For now, just track performance
    
    const renderTime = performance.now() - startTime;
    this.performanceMetrics.renderTime = renderTime;

    if (renderTime > this.config.performance.maxRenderTime) {
      this.emit('performance_warning', `Approval interface render time ${renderTime.toFixed(2)}ms exceeds target`);
    }
  }

  /**
   * Sanitize corrupted approval state
   */
  async sanitizeApprovalState(corruptedState: any): Promise<ApprovalState> {
    return {
      tasks: Array.isArray(corruptedState.tasks) ? corruptedState.tasks : [],
      selectedIndex: typeof corruptedState.selectedIndex === 'number' && corruptedState.selectedIndex >= -1
        ? corruptedState.selectedIndex : -1,
      modified: typeof corruptedState.modified === 'boolean' ? corruptedState.modified : false,
      approved: typeof corruptedState.approved === 'boolean' ? corruptedState.approved : false
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }
}