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
import { spawn, ChildProcess } from 'child_process';
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
      enableWorktrees: this.config.enableGitWorktrees,
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
      console.log(`🔍 Phase 1: Analyzing query - "${query}"`);
      const executionGraph = await this.taskDecomposer.decomposeQuery(query);

      if (!executionGraph.nodes || executionGraph.nodes.length === 0) {
        throw new Error('No tasks generated from query');
      }

      console.log(`✅ Generated ${executionGraph.nodes.length} tasks in ${executionGraph.totalEstimatedTimeMinutes}min`);
      console.log(`📊 Parallelizable: ${executionGraph.parallelizable}, Max Concurrency: ${executionGraph.maxConcurrency}`);

      // Phase 2: Agent Assignment & Session Creation (< 2s)
      console.log('🤖 Phase 2: Assigning agents and creating sessions...');
      const agentAssignments = await this.assignAgentsToTasks(executionGraph.nodes as TaskNode[]);

      // Create agent sessions for required personas
      const requiredPersonas = [...new Set(agentAssignments.map(task => task.assignedAgent))];
      const sessions = await this.agentSessionManager.createSessions(requiredPersonas);

      console.log(`✅ Created ${sessions.length} agent sessions: ${requiredPersonas.join(', ')}`);

      // Phase 3: Parallel Task Execution (< 25s)
      console.log('⚡ Phase 3: Executing tasks in parallel...');
      const results = await this.executeTasksInParallel(
        executionGraph.nodes as TaskNode[],
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
   * Execute tasks in parallel with optimal resource allocation
   */
  private async executeTasksInParallel(
    tasks: TaskNode[],
    sessions: AgentSession[]
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    const runningTasks = new Map<string, Promise<TaskResult>>();
    const sessionMap = new Map(sessions.map(s => [s.agentPersona.id, s]));

    // Build dependency graph for execution ordering
    const dependencyGraph = this.buildDependencyGraph(tasks);
    const readyTasks = tasks.filter(task => task.dependencies.length === 0);
    const remainingTasks = tasks.filter(task => task.dependencies.length > 0);

    // Execute ready tasks immediately
    for (const task of readyTasks) {
      const session = sessionMap.get(task.assignedAgent);
      if (session && runningTasks.size < this.config.maxParallelAgents) {
        const taskPromise = this.executeTask(task, session);
        runningTasks.set(task.id, taskPromise);
      }
    }

    // Process remaining tasks as dependencies complete
    while (runningTasks.size > 0 || remainingTasks.length > 0) {
      // Wait for any task to complete
      const completedTaskId = await this.waitForAnyTask(runningTasks);
      const result = await runningTasks.get(completedTaskId)!;

      runningTasks.delete(completedTaskId);
      results.push(result);

      // Check if any remaining tasks are now ready
      const nowReadyTasks = remainingTasks.filter(task =>
        task.dependencies.every(depId =>
          results.some(r => r.taskId === depId && r.success)
        )
      );

      // Start newly ready tasks
      for (const task of nowReadyTasks) {
        const session = sessionMap.get(task.assignedAgent);
        if (session && runningTasks.size < this.config.maxParallelAgents) {
          const taskPromise = this.executeTask(task, session);
          runningTasks.set(task.id, taskPromise);

          // Remove from remaining tasks
          const index = remainingTasks.indexOf(task);
          remainingTasks.splice(index, 1);
        }
      }
    }

    return results;
  }

  /**
   * Execute single task with specific agent session
   */
  private async executeTask(task: TaskNode, session: AgentSession): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      // Build context prompt for the agent
      const contextPrompt = this.buildTaskContext(task, session.agentPersona);

      // Execute with Claude Code
      const result = await this.executeClaude(contextPrompt, task, session);

      const duration = Date.now() - startTime;
      this.emit('taskCompleted', { taskId: task.id, duration, success: true });

      return {
        taskId: task.id,
        agentType: session.agentPersona.id,
        success: true,
        output: result.output,
        result: result.result,
        duration,
        artifacts: result.artifacts || [],
        filesModified: result.filesModified || [],
        timeElapsedMs: duration,
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
   * Execute Claude Code with task context
   */
  private async executeClaude(
    contextPrompt: string,
    task: TaskNode,
    session: AgentSession
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      let output = '';
      let error = '';

      const claudeProcess = spawn('claude', ['-p', contextPrompt], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: session.worktreePath || this.config.workingDirectory,
        timeout: this.config.taskTimeoutMs
      });

      claudeProcess.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        output += chunk;
        this.emit('taskProgress', {
          taskId: task.id,
          agentId: session.agentPersona.id,
          chunk
        });
      });

      claudeProcess.stderr?.on('data', (data: Buffer) => {
        error += data.toString();
      });

      claudeProcess.on('exit', (code) => {
        if (code === 0) {
          resolve({
            output,
            result: this.parseClaudeOutput(output),
            artifacts: this.extractArtifacts(output),
            filesModified: this.extractFilesModified(output)
          });
        } else {
          reject(new Error(`Claude process exited with code ${code}: ${error}`));
        }
      });

      claudeProcess.on('error', (err) => {
        reject(new Error(`Claude process error: ${err.message}`));
      });

      // Set timeout
      setTimeout(() => {
        if (!claudeProcess.killed) {
          claudeProcess.kill('SIGTERM');
          reject(new Error('Task execution timeout'));
        }
      }, this.config.taskTimeoutMs);
    });
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
   * Wait for any running task to complete
   */
  private async waitForAnyTask(runningTasks: Map<string, Promise<TaskResult>>): Promise<string> {
    const promises = Array.from(runningTasks.entries()).map(([taskId, promise]) =>
      promise.then(() => taskId)
    );

    return Promise.race(promises);
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