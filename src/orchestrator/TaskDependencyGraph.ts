/**
 * Task Dependency Graph Manager
 * 
 * Manages task dependencies using directed acyclic graph (DAG) structure
 * with topological sorting for optimal execution planning.
 */

import { 
  TaskDefinition,
  TaskExecution,
  TaskDependency,
  TaskStatus,
  ExecutionError,
  AgentType
} from './types.js';

/**
 * Graph node representing a task with its dependencies
 */
interface GraphNode {
  readonly task: TaskDefinition;
  readonly incomingEdges: Set<string>; // Tasks this depends on
  readonly outgoingEdges: Set<string>; // Tasks that depend on this
  execution?: TaskExecution;
}

/**
 * Execution order with parallel batches
 */
export interface ExecutionOrder {
  readonly batches: readonly (readonly string[])[]; // Parallel execution batches
  readonly totalTasks: number;
  readonly maxParallelism: number;
  readonly estimatedDuration: number;
}

/**
 * Dependency validation result
 */
export interface DependencyValidation {
  readonly isValid: boolean;
  readonly cycles?: readonly string[][];
  readonly orphanedTasks?: readonly string[];
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Task execution statistics
 */
export interface ExecutionStatistics {
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly pendingTasks: number;
  readonly blockedTasks: number;
  readonly averageExecutionTime: number;
  readonly successRate: number;
  readonly criticalPath: readonly string[];
  readonly bottlenecks: readonly string[];
}

/**
 * Task Dependency Graph Implementation
 */
export class TaskDependencyGraph {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly dependencies = new Map<string, TaskDependency>();
  private executionOrder?: ExecutionOrder;
  private readonly executionHistory: TaskExecution[] = [];

  /**
   * Add a task to the dependency graph
   */
  public addTask(task: TaskDefinition): void {
    if (this.nodes.has(task.id)) {
      throw new Error(`Task with ID '${task.id}' already exists in the graph`);
    }

    const node: GraphNode = {
      task,
      incomingEdges: new Set(),
      outgoingEdges: new Set()
    };

    this.nodes.set(task.id, node);
    
    // Add dependencies specified in the task
    for (const dependencyId of task.dependencies) {
      if (this.nodes.has(dependencyId)) {
        this.addDependencyInternal(dependencyId, task.id, 'hard', 'Task dependency');
      } else {
        // Dependency task not found - will be validated later
        console.warn(`Dependency '${dependencyId}' for task '${task.id}' not found in graph`);
      }
    }

    // Invalidate cached execution order
    this.executionOrder = undefined;
  }

  /**
   * Add a dependency between two tasks
   */
  public addDependency(
    sourceTaskId: string, 
    targetTaskId: string, 
    type: 'hard' | 'soft' = 'hard',
    reason?: string
  ): void {
    this.addDependencyInternal(sourceTaskId, targetTaskId, type, reason);
    
    // Invalidate cached execution order
    this.executionOrder = undefined;
  }

  /**
   * Internal method to add dependency
   */
  private addDependencyInternal(
    sourceTaskId: string, 
    targetTaskId: string, 
    type: 'hard' | 'soft',
    reason?: string
  ): void {
    const sourceNode = this.nodes.get(sourceTaskId);
    const targetNode = this.nodes.get(targetTaskId);

    if (!sourceNode) {
      throw new Error(`Source task '${sourceTaskId}' not found in graph`);
    }
    if (!targetNode) {
      throw new Error(`Target task '${targetTaskId}' not found in graph`);
    }

    const dependencyKey = `${sourceTaskId}->${targetTaskId}`;
    
    if (this.dependencies.has(dependencyKey)) {
      console.warn(`Dependency '${dependencyKey}' already exists`);
      return;
    }

    // Add dependency
    const dependency: TaskDependency = {
      sourceTaskId,
      targetTaskId,
      type,
      reason
    };

    this.dependencies.set(dependencyKey, dependency);

    // Update graph edges
    sourceNode.outgoingEdges.add(targetTaskId);
    targetNode.incomingEdges.add(sourceTaskId);
  }

  /**
   * Remove a task from the graph
   */
  public removeTask(taskId: string): boolean {
    const node = this.nodes.get(taskId);
    if (!node) {
      return false;
    }

    // Remove all dependencies involving this task
    const dependenciesToRemove: string[] = [];
    
    for (const [key, dependency] of this.dependencies) {
      if (dependency.sourceTaskId === taskId || dependency.targetTaskId === taskId) {
        dependenciesToRemove.push(key);
      }
    }

    for (const key of dependenciesToRemove) {
      this.dependencies.delete(key);
    }

    // Update other nodes' edge sets
    for (const incomingTaskId of node.incomingEdges) {
      const incomingNode = this.nodes.get(incomingTaskId);
      if (incomingNode) {
        incomingNode.outgoingEdges.delete(taskId);
      }
    }

    for (const outgoingTaskId of node.outgoingEdges) {
      const outgoingNode = this.nodes.get(outgoingTaskId);
      if (outgoingNode) {
        outgoingNode.incomingEdges.delete(taskId);
      }
    }

    // Remove the node
    this.nodes.delete(taskId);
    
    // Invalidate cached execution order
    this.executionOrder = undefined;
    
    return true;
  }

  /**
   * Perform topological sort to determine execution order
   */
  public topologicalSort(): ExecutionOrder {
    if (this.executionOrder) {
      return this.executionOrder;
    }

    // Validate graph first
    const validation = this.validateDependencies();
    if (!validation.isValid) {
      throw new Error(`Cannot sort graph with cycles: ${validation.errors.join(', ')}`);
    }

    const batches: string[][] = [];
    const visited = new Set<string>();
    const inDegree = new Map<string, number>();
    
    // Calculate in-degrees
    for (const [taskId, node] of this.nodes) {
      inDegree.set(taskId, node.incomingEdges.size);
    }

    // Process nodes in batches (parallel execution groups)
    while (visited.size < this.nodes.size) {
      const currentBatch: string[] = [];
      
      // Find all nodes with no incoming edges (ready to execute)
      for (const [taskId, degree] of inDegree) {
        if (degree === 0 && !visited.has(taskId)) {
          currentBatch.push(taskId);
        }
      }

      if (currentBatch.length === 0) {
        throw new Error('Circular dependency detected during topological sort');
      }

      // Sort batch by priority
      currentBatch.sort((a, b) => {
        const taskA = this.nodes.get(a)?.task;
        const taskB = this.nodes.get(b)?.task;
        return (taskB?.priority || 0) - (taskA?.priority || 0);
      });

      batches.push(currentBatch);

      // Mark batch as visited and update in-degrees
      for (const taskId of currentBatch) {
        visited.add(taskId);
        const node = this.nodes.get(taskId);
        
        if (node) {
          for (const dependentTaskId of node.outgoingEdges) {
            const currentDegree = inDegree.get(dependentTaskId) || 0;
            inDegree.set(dependentTaskId, currentDegree - 1);
          }
        }
      }
    }

    // Calculate execution metrics
    const totalTasks = this.nodes.size;
    const maxParallelism = Math.max(...batches.map(batch => batch.length));
    const estimatedDuration = this.calculateEstimatedDuration(batches);

    this.executionOrder = {
      batches,
      totalTasks,
      maxParallelism,
      estimatedDuration
    };

    return this.executionOrder;
  }

  /**
   * Validate the dependency graph for cycles and orphaned nodes
   */
  public validateDependencies(): DependencyValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const cycles = this.detectCycles();
    const orphanedTasks = this.findOrphanedTasks();

    if (cycles.length > 0) {
      errors.push(`Circular dependencies detected: ${cycles.map(cycle => cycle.join(' -> ')).join(', ')}`);
    }

    if (orphanedTasks.length > 0) {
      warnings.push(`Orphaned tasks found: ${orphanedTasks.join(', ')}`);
    }

    // Check for missing dependencies
    for (const [taskId, node] of this.nodes) {
      for (const dependencyId of node.task.dependencies) {
        if (!this.nodes.has(dependencyId)) {
          errors.push(`Task '${taskId}' depends on missing task '${dependencyId}'`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      cycles: cycles.length > 0 ? cycles : undefined,
      orphanedTasks: orphanedTasks.length > 0 ? orphanedTasks : undefined,
      errors,
      warnings
    };
  }

  /**
   * Get tasks that are ready to execute (no unmet dependencies)
   */
  public getReadyTasks(): TaskDefinition[] {
    const readyTasks: TaskDefinition[] = [];

    for (const [taskId, node] of this.nodes) {
      if (this.isTaskReady(taskId)) {
        readyTasks.push(node.task);
      }
    }

    // Sort by priority
    return readyTasks.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if a specific task is ready to execute
   */
  public isTaskReady(taskId: string): boolean {
    const node = this.nodes.get(taskId);
    if (!node) {
      return false;
    }

    // If task is already running or completed, it's not ready
    if (node.execution?.status === 'in_progress' || node.execution?.status === 'completed') {
      return false;
    }

    // Check if all hard dependencies are completed
    for (const dependencyId of node.incomingEdges) {
      const dependencyNode = this.nodes.get(dependencyId);
      const dependencyKey = `${dependencyId}->${taskId}`;
      const dependency = this.dependencies.get(dependencyKey);

      if (dependency?.type === 'hard') {
        if (!dependencyNode?.execution || dependencyNode.execution.status !== 'completed') {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Mark task as started
   */
  public startTask(taskId: string): TaskExecution {
    const node = this.nodes.get(taskId);
    if (!node) {
      throw new Error(`Task '${taskId}' not found in graph`);
    }

    if (!this.isTaskReady(taskId)) {
      throw new Error(`Task '${taskId}' is not ready to execute`);
    }

    const execution: TaskExecution = {
      ...node.task,
      status: 'in_progress',
      startTime: new Date(),
      progress: 0,
      logs: [],
      retryCount: 0,
      maxRetries: 3
    };

    node.execution = execution;
    return execution;
  }

  /**
   * Mark task as completed
   */
  public completeTask(taskId: string, result?: unknown): void {
    const node = this.nodes.get(taskId);
    if (!node || !node.execution) {
      throw new Error(`Task '${taskId}' not found or not started`);
    }

    node.execution.status = 'completed';
    node.execution.endTime = new Date();
    node.execution.progress = 100;
    node.execution.result = result;

    this.executionHistory.push(node.execution);
  }

  /**
   * Mark task as failed
   */
  public failTask(taskId: string, error: string): void {
    const node = this.nodes.get(taskId);
    if (!node || !node.execution) {
      throw new Error(`Task '${taskId}' not found or not started`);
    }

    node.execution.status = 'failed';
    node.execution.endTime = new Date();
    node.execution.error = error;

    this.executionHistory.push(node.execution);
  }

  /**
   * Get execution statistics
   */
  public getExecutionStatistics(): ExecutionStatistics {
    const completedTasks = this.executionHistory.filter(t => t.status === 'completed').length;
    const failedTasks = this.executionHistory.filter(t => t.status === 'failed').length;
    
    let pendingTasks = 0;
    let blockedTasks = 0;

    for (const [taskId, node] of this.nodes) {
      if (!node.execution) {
        if (this.isTaskReady(taskId)) {
          pendingTasks++;
        } else {
          blockedTasks++;
        }
      } else if (node.execution.status === 'in_progress') {
        pendingTasks++;
      }
    }

    const completedExecutions = this.executionHistory.filter(t => t.status === 'completed' && t.startTime && t.endTime);
    const averageExecutionTime = completedExecutions.length > 0 
      ? completedExecutions.reduce((sum, task) => {
          const duration = task.endTime!.getTime() - task.startTime!.getTime();
          return sum + duration;
        }, 0) / completedExecutions.length
      : 0;

    const successRate = (completedTasks + failedTasks) > 0 
      ? completedTasks / (completedTasks + failedTasks)
      : 0;

    return {
      completedTasks,
      failedTasks,
      pendingTasks,
      blockedTasks,
      averageExecutionTime,
      successRate,
      criticalPath: this.findCriticalPath(),
      bottlenecks: this.findBottlenecks()
    };
  }

  /**
   * Get all tasks in the graph
   */
  public getAllTasks(): TaskDefinition[] {
    return Array.from(this.nodes.values()).map(node => node.task);
  }

  /**
   * Get task by ID
   */
  public getTask(taskId: string): TaskDefinition | undefined {
    return this.nodes.get(taskId)?.task;
  }

  /**
   * Get task execution status
   */
  public getTaskExecution(taskId: string): TaskExecution | undefined {
    return this.nodes.get(taskId)?.execution;
  }

  /**
   * Get all dependencies
   */
  public getAllDependencies(): TaskDependency[] {
    return Array.from(this.dependencies.values());
  }

  /**
   * Get dependencies for a specific task
   */
  public getTaskDependencies(taskId: string): TaskDependency[] {
    return Array.from(this.dependencies.values())
      .filter(dep => dep.targetTaskId === taskId);
  }

  /**
   * Get tasks that depend on a specific task
   */
  public getTaskDependents(taskId: string): TaskDependency[] {
    return Array.from(this.dependencies.values())
      .filter(dep => dep.sourceTaskId === taskId);
  }

  // Private helper methods

  /**
   * Detect cycles in the dependency graph using DFS
   */
  private detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (taskId: string): void => {
      visited.add(taskId);
      recursionStack.add(taskId);
      path.push(taskId);

      const node = this.nodes.get(taskId);
      if (node) {
        for (const dependentId of node.outgoingEdges) {
          if (!visited.has(dependentId)) {
            dfs(dependentId);
          } else if (recursionStack.has(dependentId)) {
            // Found a cycle
            const cycleStart = path.indexOf(dependentId);
            const cycle = path.slice(cycleStart);
            cycle.push(dependentId);
            cycles.push([...cycle]);
          }
        }
      }

      recursionStack.delete(taskId);
      path.pop();
    };

    for (const taskId of this.nodes.keys()) {
      if (!visited.has(taskId)) {
        dfs(taskId);
      }
    }

    return cycles;
  }

  /**
   * Find tasks with no incoming or outgoing dependencies
   */
  private findOrphanedTasks(): string[] {
    const orphaned: string[] = [];

    for (const [taskId, node] of this.nodes) {
      if (node.incomingEdges.size === 0 && node.outgoingEdges.size === 0) {
        orphaned.push(taskId);
      }
    }

    return orphaned;
  }

  /**
   * Calculate estimated duration considering parallel execution
   */
  private calculateEstimatedDuration(batches: string[][]): number {
    let totalDuration = 0;

    for (const batch of batches) {
      // For parallel batch, duration is the maximum duration in the batch
      let batchDuration = 0;
      
      for (const taskId of batch) {
        const task = this.nodes.get(taskId)?.task;
        const taskDuration = task?.estimatedDuration || 60; // Default 60 minutes
        batchDuration = Math.max(batchDuration, taskDuration);
      }
      
      totalDuration += batchDuration;
    }

    return totalDuration;
  }

  /**
   * Find the critical path (longest path through the graph)
   */
  private findCriticalPath(): string[] {
    // Simplified implementation - would need proper longest path algorithm
    const executionOrder = this.topologicalSort();
    const longestPath: string[] = [];
    
    // For now, return the task with longest estimated duration from each batch
    for (const batch of executionOrder.batches) {
      if (batch.length > 0) {
        const longestTask = batch.reduce((longest, taskId) => {
          const currentTask = this.nodes.get(taskId)?.task;
          const longestTask = this.nodes.get(longest)?.task;
          
          return (currentTask?.estimatedDuration || 0) > (longestTask?.estimatedDuration || 0) 
            ? taskId 
            : longest;
        });
        
        longestPath.push(longestTask);
      }
    }

    return longestPath;
  }

  /**
   * Find potential bottlenecks in the graph
   */
  private findBottlenecks(): string[] {
    const bottlenecks: string[] = [];

    // Tasks with many dependents are potential bottlenecks
    for (const [taskId, node] of this.nodes) {
      if (node.outgoingEdges.size >= 3) { // Arbitrary threshold
        bottlenecks.push(taskId);
      }
    }

    return bottlenecks;
  }
}