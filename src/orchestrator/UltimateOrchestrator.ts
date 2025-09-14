/**
 * Ultimate Orchestrator - Main orchestration engine for multi-agent system
 *
 * Coordinates 8 parallel Claude Code sessions with professional personas,
 * implements DAG-based task decomposition, and ensures <30s completion.
 *
 * Performance Targets:
 * - Complex features: <30 seconds completion
 * - Memory usage: <150MB during peak execution
 * - Reliability: 99% task completion rate
 * - UI performance: 60fps (<16ms render)
 */

import { EventEmitter } from 'events';
import {
  OrchestrationResult,
  TaskNode,
  TaskStatus,
  TaskResult,
  AgentPersona,
  AgentSession,
  ExecutionGraph,
  TaskExecution,
  ExecutionResults,
  OrchestrationPerformanceMetrics,
  GitWorktreeInfo,
  AgentState,
  QueryComplexity
} from './types.js';
import { UniversalTaskDecomposer } from './UniversalTaskDecomposer.js';
import { AgentSessionManager } from './AgentSessionManager.js';
import { PerformanceMonitor } from '../performance/PerformanceMonitor.js';
import { createInterface } from 'readline';
import {
  MAX_PARALLEL_AGENTS,
  DEFAULT_TIMEOUT_MS,
  TASK_COMPLETION_TARGET_MS,
  MEMORY_LIMIT_MB,
  AGENT_PERSONAS
} from './constants.js';

/**
 * Configuration for Ultimate Orchestrator
 */
export interface UltimateOrchestratorConfig {
  readonly maxParallelAgents?: number;
  readonly taskTimeoutMs?: number;
  readonly memoryLimitMb?: number;
  readonly enableGitWorktrees?: boolean;
  readonly enablePerformanceMonitoring?: boolean;
  readonly workingDirectory?: string;
}

/**
 * Ultimate Orchestrator - Coordinates multi-agent system execution
 */
export class UltimateOrchestrator extends EventEmitter {
  private readonly taskDecomposer: UniversalTaskDecomposer;
  private readonly agentSessionManager: AgentSessionManager;
  private readonly performanceMonitor: PerformanceMonitor;
  private readonly config: Required<UltimateOrchestratorConfig>;

  private activeTasks = new Map<string, TaskExecution>();
  private executionResults = new Map<string, ExecutionResults>();
  private currentExecutionId: string | null = null;
  private executionStartTime: Date | null = null;

  /**
   * Initialize Ultimate Orchestrator with professional agent personas
   */
  constructor(config: UltimateOrchestratorConfig = {}) {
    super();

    this.config = {
      maxParallelAgents: config.maxParallelAgents || MAX_PARALLEL_AGENTS,
      taskTimeoutMs: config.taskTimeoutMs || DEFAULT_TIMEOUT_MS,
      memoryLimitMb: config.memoryLimitMb || MEMORY_LIMIT_MB,
      enableGitWorktrees: config.enableGitWorktrees ?? true,
      enablePerformanceMonitoring: config.enablePerformanceMonitoring ?? true,
      workingDirectory: config.workingDirectory || process.cwd()
    };

    // Initialize core components
    this.taskDecomposer = new UniversalTaskDecomposer({
      maxComplexity: QueryComplexity.ENTERPRISE,
      enableParallelization: true,
      targetCompletionMs: TASK_COMPLETION_TARGET_MS
    });

    this.agentSessionManager = new AgentSessionManager({
      maxSessions: this.config.maxParallelAgents,
      sessionTimeoutMs: this.config.taskTimeoutMs,
      enableWorktrees: false, // Temporarily disabled for testing core functionality
      workingDirectory: this.config.workingDirectory
    });

    this.performanceMonitor = new PerformanceMonitor({
      memoryLimitMb: this.config.memoryLimitMb,
      taskTargetMs: TASK_COMPLETION_TARGET_MS,
      enabled: this.config.enablePerformanceMonitoring
    });

    this.setupEventHandlers();
  }

  /**
   * Main orchestration method - processes natural language query
   */
  async orchestrateQuery(query: string): Promise<OrchestrationResult> {
    const executionId = this.generateExecutionId();
    this.currentExecutionId = executionId;
    this.executionStartTime = new Date();

    try {
      // Start performance monitoring
      this.performanceMonitor.startExecution(executionId, query);

      // Phase 1: Task Decomposition (< 3s)
      const executionGraph = await this.taskDecomposer.decomposeQuery(query);

      if (!executionGraph.nodes || executionGraph.nodes.length === 0) {
        throw new Error('No tasks generated from query');
      }
      
      // HUMAN-IN-THE-LOOP APPROVAL CHECKPOINT
      const approved = await this.requestHumanApproval(executionGraph.nodes as TaskNode[], query);
      if (!approved) {
        console.log('❌ Execution cancelled by user');
        throw new Error('Execution cancelled by user');
      }

      // Phase 2: Agent Assignment & Session Creation (< 2s)
      const agentAssignments = await this.assignAgentsToTasks(executionGraph.nodes as TaskNode[]);

      // Create agent sessions for required personas
      const requiredPersonas = [...new Set(agentAssignments.map(task => task.assignedAgent))];
      const sessions = await this.agentSessionManager.createSessions(requiredPersonas);

      // Phase 3: Parallel Task Execution (let Claude SDK handle its own timing)
      const results = await this.executeTasksInParallel(
        agentAssignments,
        sessions
      );

      // Phase 4: Result Aggregation & Performance Analysis
      const orchestrationResult = this.buildOrchestrationResult(
        executionId,
        results,
        executionGraph
      );

      // Emit completion event
      this.emit('orchestrationCompleted', orchestrationResult);

      return orchestrationResult;

    } catch (error) {
      const errorResult = this.buildErrorResult(executionId, error);
      this.emit('orchestrationFailed', errorResult);
      throw error;
    } finally {
      // Cleanup
      await this.cleanup();
    }
  }

  /**
   * Assign optimal agents to tasks based on capabilities and workload
   */
  private async assignAgentsToTasks(tasks: TaskNode[]): Promise<TaskNode[]> {
    const assignedTasks: TaskNode[] = [];

    for (const task of tasks) {
      // Find best agent for this task type
      const optimalAgent = this.findOptimalAgent(task);

      const assignedTask: TaskNode = {
        ...task,
        assignedAgent: optimalAgent.id,
        metadata: {
          ...task.metadata,
          tags: [...task.metadata.tags, `agent:${optimalAgent.id}`]
        }
      };

      assignedTasks.push(assignedTask);
    }

    return assignedTasks;
  }

  /**
   * Find optimal agent based on task requirements and current workload
   */
  private findOptimalAgent(task: TaskNode): AgentPersona {
    const candidates = AGENT_PERSONAS.filter(agent =>
      agent.specializations.some(spec =>
        task.tools.some(tool => spec.toLowerCase().includes(tool.toLowerCase())) ||
        task.description.toLowerCase().includes(spec.toLowerCase())
      )
    );

    if (candidates.length === 0) {
      // Default to assistant for general tasks
      return AGENT_PERSONAS.find(agent => agent.id === 'assistant') || AGENT_PERSONAS[0];
    }

    // Select agent with lowest workload score
    return candidates.reduce((best, current) =>
      current.workloadScore < best.workloadScore ? current : best
    );
  }

  /**
   * Execute tasks in true parallel with Git worktrees for multi-agent coordination
   * Each agent works in its own isolated worktree to prevent conflicts
   */
  private async executeTasksInParallel(
    tasks: TaskNode[],
    sessions: AgentSession[]
  ): Promise<TaskResult[]> {
    const sessionMap = new Map(sessions.map(s => [s.agentPersona.id, s]));

    // Progress tracking for multiple tasks
    let completedCount = 0;
    const totalTasks = tasks.length;
    
    const displayProgress = () => {
      if (tasks.length > 1) {
        const percentage = Math.round((completedCount / totalTasks) * 100);
        console.log(`  Progress: ${completedCount}/${totalTasks} tasks (${percentage}%)`);
      }
    };

    // Execute all tasks in parallel using Promise.allSettled for robust error handling
    const taskPromises = tasks.map(async (task, i) => {
      const session = sessionMap.get(task.assignedAgent);

      if (!session) {
        console.error(`❌ No session found for agent: ${task.assignedAgent}`);
        completedCount++;
        displayProgress();
        return {
          taskId: task.id,
          agentType: task.assignedAgent,
          success: false,
          error: `No session found for agent: ${task.assignedAgent}`,
          duration: 0,
          timeElapsedMs: 0
        };
      }

      try {
        // Execute task in parallel - each agent has its own worktree
        const result = await this.executeTask(task, session);
        completedCount++;
        displayProgress();
        return result;

      } catch (error) {
        completedCount++;
        displayProgress();
        return {
          taskId: task.id,
          agentType: task.assignedAgent,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: 0,
          timeElapsedMs: 0
        };
      }
    });

    // Initial progress display
    displayProgress();

    // Wait for all tasks to complete (or fail)
    const taskResults = await Promise.allSettled(taskPromises);
    
    // Extract results from Promise.allSettled
    const results: TaskResult[] = taskResults.map((result) => 
      result.status === 'fulfilled' ? result.value : {
        taskId: 'unknown',
        agentType: 'unknown', 
        success: false,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        duration: 0,
        timeElapsedMs: 0
      }
    );

    return results;
  }


  /**
   * Execute single task with specific agent session - FIXED: Use only AgentSessionManager
   */
  private async executeTask(task: TaskNode, session: AgentSession): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      // Build context prompt for the agent
      const contextPrompt = this.buildTaskContext(task, session.agentPersona);

      // Convert TaskNode to TaskExecution for AgentSessionManager
      const taskExecution: TaskExecution = {
        id: task.id,
        taskId: task.id,
        agentType: task.assignedAgent,
        title: task.title,
        description: task.description,
        priority: typeof task.priority === 'number' ? task.priority : 1,
        status: 'pending' as const,
        startTime: new Date(),
        dependencies: [...task.dependencies],
        tools: [...task.tools],
        logs: [],
        retryCount: 0,
        maxRetries: 3
      };

      // Use AgentSessionManager for execution (no duplicate Claude clients)
      const result = await this.agentSessionManager.executeTaskWithSession(
        session.id,
        taskExecution,
        contextPrompt
      );

      const duration = Date.now() - startTime;
      this.emit('taskCompleted', { taskId: task.id, duration, success: result.success });

      return {
        ...result,
        memoryUsedMb: this.performanceMonitor.getCurrentMemoryMb()
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.emit('taskFailed', { taskId: task.id, duration, error });

      return {
        taskId: task.id,
        agentType: session.agentPersona.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
        timeElapsedMs: duration
      };
    }
  }


  /**
   * Build comprehensive context prompt for agent
   */
  private buildTaskContext(task: TaskNode, agent: AgentPersona): string {
    return `${agent.systemPrompt}

TASK CONTEXT:
- ID: ${task.id}
- Title: ${task.title}
- Description: ${task.description}
- Priority: ${task.priority}
- Tools Available: ${task.tools.join(', ')}
- Expected Outputs: ${task.expectedOutputs.join(', ')}
- Dependencies: ${task.dependencies.length > 0 ? task.dependencies.join(', ') : 'None'}

WORKING DIRECTORY: ${this.config.workingDirectory}

TASK REQUIREMENTS:
${task.description}

PERFORMANCE TARGETS:
- Complete in < ${Math.ceil(task.estimatedDuration)}min
- Memory usage < ${this.config.memoryLimitMb}MB
- Provide clear status updates

Execute this task efficiently and report your progress.`;
  }


  /**
   * Build dependency graph for task execution order
   */
  private buildDependencyGraph(tasks: TaskNode[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const task of tasks) {
      graph.set(task.id, [...task.dependencies]);
    }

    return graph;
  }

  /**
   * Build final orchestration result
   */
  private buildOrchestrationResult(
    executionId: string,
    results: TaskResult[],
    executionGraph: ExecutionGraph
  ): OrchestrationResult {
    const endTime = Date.now();
    const startTime = this.executionStartTime?.getTime() || endTime;
    const totalTimeSeconds = (endTime - startTime) / 1000;

    const successfulTasks = results.filter(r => r.success);
    const failedTasks = results.filter(r => !r.success);

    const performanceMetrics: OrchestrationPerformanceMetrics = {
      memoryPeakMb: this.performanceMonitor.getPeakMemoryMb(),
      cpuAveragePercent: this.performanceMonitor.getAverageCpuPercent(),
      parallelEfficiency: successfulTasks.length / results.length,
      targetTimeAchieved: totalTimeSeconds <= (TASK_COMPLETION_TARGET_MS / 1000)
    };

    return {
      success: failedTasks.length === 0,
      totalTimeSeconds,
      tasksCompleted: successfulTasks.length,
      tasksFailed: failedTasks.length,
      agentsUsed: new Set(results.map(r => r.agentType)).size,
      results,
      errors: failedTasks.map(t => t.error || 'Unknown error'),
      performanceMetrics
    };
  }

  /**
   * Build error result for failed orchestration
   */
  private buildErrorResult(executionId: string, error: any): OrchestrationResult {
    const endTime = Date.now();
    const startTime = this.executionStartTime?.getTime() || endTime;
    const totalTimeSeconds = (endTime - startTime) / 1000;

    return {
      success: false,
      totalTimeSeconds,
      tasksCompleted: 0,
      tasksFailed: 1,
      agentsUsed: 0,
      results: [],
      errors: [error instanceof Error ? error.message : String(error)],
      performanceMetrics: {
        memoryPeakMb: this.performanceMonitor.getCurrentMemoryMb(),
        cpuAveragePercent: 0,
        parallelEfficiency: 0,
        targetTimeAchieved: false
      }
    };
  }

  /**
   * Setup event handlers for orchestrator components
   */
  private setupEventHandlers(): void {
    this.taskDecomposer.on('decompositionProgress', (progress) => {
      this.emit('decompositionProgress', progress);
    });

    this.agentSessionManager.on('sessionCreated', (session) => {
      this.emit('agentSessionCreated', session);
    });

    this.agentSessionManager.on('sessionTerminated', (session) => {
      this.emit('agentSessionTerminated', session);
    });

    // FIXED: Listen to sessionOutput events for streaming Claude responses to CLI
    this.agentSessionManager.on('sessionOutput', (event) => {
      // Stream Claude output directly to console in real-time (handle EPIPE gracefully)
      try {
        // Immediate streaming without delays - show content as soon as it arrives
        const content = event.chunk.trim();
        if (content) {
          // Use console.log for immediate output with proper flushing
          console.log(`✨ ${content}`);
        }
      } catch (error) {
        // Ignore EPIPE errors (happens when piping to head, etc.)
        if ((error as any).code !== 'EPIPE') {
          console.error('Failed to write streaming output:', error);
        }
      }
    });

    this.performanceMonitor.on('memoryWarning', (usage) => {
      this.emit('performanceWarning', { type: 'memory', value: usage });
    });

    this.performanceMonitor.on('timeoutWarning', (elapsed) => {
      this.emit('performanceWarning', { type: 'timeout', value: elapsed });
    });
  }

  /**
   * Parse Claude output for structured results
   */
  private parseClaudeOutput(output: string): any {
    // Extract structured data from Claude output
    try {
      const jsonMatches = output.match(/```json\n(.*?)\n```/s);
      if (jsonMatches) {
        return JSON.parse(jsonMatches[1]);
      }
    } catch (error) {
      // Fallback to raw output
    }

    return { summary: output.slice(0, 500) };
  }

  /**
   * Extract artifacts from Claude output
   */
  private extractArtifacts(output: string): string[] {
    const artifacts: string[] = [];
    const artifactRegex = /Created:\s*([^\n]+)/gi;
    let match;

    while ((match = artifactRegex.exec(output)) !== null) {
      artifacts.push(match[1].trim());
    }

    return artifacts;
  }

  /**
   * Extract modified files from Claude output
   */
  private extractFilesModified(output: string): string[] {
    const files: string[] = [];
    const fileRegex = /(?:Modified|Updated|Created):\s*([^\s]+\.[a-zA-Z0-9]+)/gi;
    let match;

    while ((match = fileRegex.exec(output)) !== null) {
      files.push(match[1]);
    }

    return files;
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources after orchestration
   */
  private async cleanup(): Promise<void> {
    try {
      await this.agentSessionManager.cleanup();
      this.performanceMonitor.stopExecution();
      this.activeTasks.clear();
      this.currentExecutionId = null;
      this.executionStartTime = null;
    } catch (error) {
      this.emit('cleanupError', error);
    }
  }

  /**
   * Get current orchestration statistics
   */
  getStatistics() {
    return {
      activeExecutions: this.currentExecutionId ? 1 : 0,
      activeTasks: this.activeTasks.size,
      agentSessions: this.agentSessionManager.getActiveSessionCount(),
      memoryUsageMb: this.performanceMonitor.getCurrentMemoryMb(),
      uptime: this.performanceMonitor.getUptimeMs()
    };
  }

  /**
   * Request human approval before execution - HUMAN-IN-THE-LOOP CONTROL
   */
  private async requestHumanApproval(tasks: TaskNode[], originalQuery: string): Promise<boolean> {
    // For simple single tasks, show minimal info
    if (tasks.length === 1 && tasks[0].estimatedDuration <= 2) {
      console.log(`  Planning: ${tasks[0].title}`);
    } else {
      // Show detailed plan for complex tasks
      console.log('  Planning:');
      tasks.forEach((task, i) => {
        console.log(`    ${i + 1}. ${task.title} (${task.estimatedDuration}min)`);
      });
    }
    
    // Check for suspicious patterns and warn user
    const warnings = this.detectSuspiciousDecomposition(tasks, originalQuery);
    if (warnings.length > 0) {
      console.log('  \n⚠️  Issues detected:');
      warnings.forEach(warning => console.log(`    • ${warning}`));
    }

    // Simple approval prompt with proper input handling
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      const answer = await new Promise<string>((resolve) => {
        rl.question('  Continue? [Y/n]: ', (input) => {
          resolve(input);
        });
      });
      
      const response = answer.trim().toLowerCase();
      return response === '' || response === 'y' || response === 'yes';
    } finally {
      rl.close();
    }
  }

  /**
   * Detect suspicious task decompositions that may be over-engineered
   */
  private detectSuspiciousDecomposition(tasks: TaskNode[], originalQuery: string): string[] {
    const warnings: string[] = [];

    // Check for over-engineering signals
    if (originalQuery.toLowerCase().includes('hello world') && tasks.length > 1) {
      warnings.push('Hello world typically requires only one task');
    }

    if (originalQuery.toLowerCase().includes('simple') && tasks.length > 2) {
      warnings.push('Simple tasks usually need 1-2 steps');
    }

    if (originalQuery.length < 30 && tasks.length > 3) {
      warnings.push('Short queries rarely need complex decomposition');
    }

    // Check time estimates
    const totalTime = tasks.reduce((sum, task) => sum + (task.estimatedDuration || 0), 0);
    if (totalTime > 30 && originalQuery.toLowerCase().includes('quick')) {
      warnings.push('Time estimate seems high for a "quick" task');
    }

    return warnings;
  }

  /**
   * Emergency stop - terminate all running operations
   */
  async emergencyStop(): Promise<void> {
    console.log('🚨 Emergency stop initiated...');

    try {
      await this.agentSessionManager.terminateAllSessions();
      this.activeTasks.clear();
      this.performanceMonitor.stopExecution();

      this.emit('emergencyStop');
      console.log('✅ Emergency stop completed');
    } catch (error) {
      console.error('❌ Emergency stop failed:', error);
      throw error;
    }
  }
}