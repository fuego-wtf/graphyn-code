/**
 * Claude Code Subagent Launcher
 * 
 * This service launches actual Claude Code subagents when tasks are ready for execution.
 * It bridges from our orchestration layer to real Claude Code agent processes.
 * 
 * Key Features:
 * - Spawns specialized Claude Code agents based on task requirements
 * - Manages agent sessions and lifecycles
 * - Routes tasks to appropriate agents based on expertise
 * - Handles inter-agent communication and coordination
 * - Provides real-time monitoring and intervention capabilities
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

// Types for agent management
export interface ClaudeCodeAgent {
  id: string;
  name: string;
  role: AgentRole;
  process?: ChildProcess;
  sessionId?: string;
  status: 'initializing' | 'ready' | 'busy' | 'error' | 'completed';
  currentTask?: string;
  expertise: string[];
  tools: string[];
  workingDirectory: string;
  startTime: number;
  lastActivity: number;
}

export interface AgentRole {
  name: string;
  systemPrompt: string;
  allowedTools: string[];
  specialization: string[];
  maxConcurrentTasks: number;
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  dependencies: string[];
  assignedAgent?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  priority: number;
  estimatedTime: number;
  context: TaskContext;
}

export interface TaskContext {
  workingDirectory: string;
  relevantFiles: string[];
  previousResults: Map<string, any>;
  userInstructions: string;
  constraints: string[];
}

export interface AgentExecutionResult {
  agentId: string;
  taskId: string;
  success: boolean;
  output: string;
  artifacts: string[];
  duration: number;
  nextRecommendations?: string[];
}

export class ClaudeCodeAgentLauncher extends EventEmitter {
  private activeAgents = new Map<string, ClaudeCodeAgent>();
  private taskQueue: AgentTask[] = [];
  private executionResults = new Map<string, AgentExecutionResult>();
  private agentRoles: Map<string, AgentRole>;
  
  constructor() {
    super();
    this.agentRoles = this.initializeAgentRoles();
    this.setupCleanupInterval();
  }
  
  /**
   * Launch agents based on task requirements
   */
  async launchAgentsForTasks(
    tasks: AgentTask[],
    options: {
      workingDirectory: string;
      enableHumanLoop?: boolean;
      parallelExecution?: boolean;
    }
  ): Promise<AgentExecutionResult[]> {
    
    this.emit('agent_launch_started', { taskCount: tasks.length, options });
    
    // Analyze tasks and determine required agents
    const requiredAgents = this.analyzeRequiredAgents(tasks);
    
    // Launch agents in parallel
    const launchPromises = requiredAgents.map(agentSpec => 
      this.launchAgent(agentSpec, options.workingDirectory)
    );
    
    const launchedAgents = await Promise.allSettled(launchPromises);
    
    // Assign tasks to agents
    await this.assignTasksToAgents(tasks);
    
    // Execute tasks based on strategy
    if (options.parallelExecution) {
      return await this.executeTasksInParallel(options);
    } else {
      return await this.executeTasksSequentially(options);
    }
  }
  
  /**
   * Launch a specific Claude Code agent
   */
  private async launchAgent(
    agentSpec: { role: string; expertise: string[] },
    workingDirectory: string
  ): Promise<ClaudeCodeAgent> {
    
    const role = this.agentRoles.get(agentSpec.role);
    if (!role) {
      throw new Error(`Unknown agent role: ${agentSpec.role}`);
    }
    
    const agentId = this.generateAgentId(agentSpec.role);
    
    const agent: ClaudeCodeAgent = {
      id: agentId,
      name: `${role.name} Agent`,
      role,
      status: 'initializing',
      expertise: agentSpec.expertise,
      tools: role.allowedTools,
      workingDirectory,
      startTime: Date.now(),
      lastActivity: Date.now()
    };
    
    this.emit('agent_launching', agent);
    
    try {
      // Launch Claude Code process with specialized system prompt
      const claudeProcess = await this.spawnClaudeCodeAgent(agent, workingDirectory);
      agent.process = claudeProcess;
      
      // Initialize agent session
      const sessionId = await this.initializeAgentSession(agent);
      agent.sessionId = sessionId;
      
      agent.status = 'ready';
      this.activeAgents.set(agentId, agent);
      
      this.emit('agent_launched', agent);
      return agent;
      
    } catch (error) {
      agent.status = 'error';
      this.emit('agent_launch_failed', { agent, error });
      throw error;
    }
  }
  
  /**
   * Spawn Claude Code process for agent
   */
  private async spawnClaudeCodeAgent(
    agent: ClaudeCodeAgent,
    workingDirectory: string
  ): Promise<ChildProcess> {
    
    // Build Claude Code command with agent specialization
    const args = [
      '-p', agent.role.systemPrompt,
      '--output-format', 'json',
      '--allowedTools', agent.role.allowedTools.join(','),
      '--append-system-prompt', this.buildAgentSystemPrompt(agent)
    ];
    
    this.emit('spawning_agent_process', { agent: agent.id, args });
    
    const claudeProcess = spawn('claude', args, {
      cwd: workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CLAUDE_AGENT_ID: agent.id,
        CLAUDE_AGENT_ROLE: agent.role.name,
        CLAUDE_AGENT_EXPERTISE: agent.expertise.join(',')
      }
    });
    
    // Set up process monitoring
    this.setupProcessMonitoring(agent.id, claudeProcess);
    
    return claudeProcess;
  }
  
  /**
   * Initialize agent with specialized capabilities
   */
  private async initializeAgentSession(agent: ClaudeCodeAgent): Promise<string> {
    
    if (!agent.process) {
      throw new Error(`Agent ${agent.id} has no process`);
    }
    
    const initializationPrompt = this.buildInitializationPrompt(agent);
    
    return new Promise((resolve, reject) => {
      let outputBuffer = '';
      let sessionId = '';
      
      // Set timeout for initialization
      const timeout = setTimeout(() => {
        reject(new Error(`Agent ${agent.id} initialization timeout`));
      }, 30000);
      
      // Listen for initialization response
      agent.process!.stdout?.on('data', (data) => {
        outputBuffer += data.toString();
        
        // Try to extract session ID from response
        try {
          const response = JSON.parse(outputBuffer);
          if (response.session_id) {
            sessionId = response.session_id;
            clearTimeout(timeout);
            resolve(sessionId);
          }
        } catch (error) {
          // Continue waiting for complete JSON
        }
      });
      
      // Send initialization prompt
      agent.process!.stdin?.write(JSON.stringify({
        type: 'initialization',
        prompt: initializationPrompt,
        agent_id: agent.id,
        timestamp: Date.now()
      }) + '\n');
      
      // Handle process errors
      agent.process!.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  
  /**
   * Execute tasks in parallel across agents
   */
  private async executeTasksInParallel(
    options: { enableHumanLoop?: boolean }
  ): Promise<AgentExecutionResult[]> {
    
    const executionPromises: Promise<AgentExecutionResult>[] = [];
    
    // Group tasks by dependencies
    const taskGroups = this.groupTasksByDependencies(this.taskQueue);
    
    for (const group of taskGroups) {
      // Execute independent tasks in parallel
      const groupPromises = group.map(task => this.executeTask(task, options));
      executionPromises.push(...groupPromises);
      
      // Wait for current group to complete before starting next group
      await Promise.allSettled(groupPromises);
    }
    
    const results = await Promise.allSettled(executionPromises);
    
    return results.map(result => 
      result.status === 'fulfilled' 
        ? result.value 
        : this.createErrorResult(result.reason)
    );
  }
  
  /**
   * Execute a specific task on assigned agent
   */
  private async executeTask(
    task: AgentTask,
    options: { enableHumanLoop?: boolean }
  ): Promise<AgentExecutionResult> {
    
    if (!task.assignedAgent) {
      throw new Error(`Task ${task.id} has no assigned agent`);
    }
    
    const agent = this.activeAgents.get(task.assignedAgent);
    if (!agent) {
      throw new Error(`Agent ${task.assignedAgent} not found`);
    }
    
    this.emit('task_execution_started', { task, agent: agent.id });
    
    const startTime = Date.now();
    agent.status = 'busy';
    agent.currentTask = task.id;
    task.status = 'in_progress';
    
    try {
      // Build task execution prompt
      const executionPrompt = this.buildTaskExecutionPrompt(task, agent);
      
      // Send task to agent
      const result = await this.sendTaskToAgent(task, agent, executionPrompt);
      
      // Process agent response
      const executionResult: AgentExecutionResult = {
        agentId: agent.id,
        taskId: task.id,
        success: true,
        output: result.output,
        artifacts: result.artifacts || [],
        duration: Date.now() - startTime,
        nextRecommendations: result.recommendations
      };
      
      // Update task and agent status
      task.status = 'completed';
      agent.status = 'ready';
      agent.currentTask = undefined;
      agent.lastActivity = Date.now();
      
      // Store result for future tasks
      this.executionResults.set(task.id, executionResult);
      
      this.emit('task_execution_completed', { task, agent: agent.id, result: executionResult });
      
      return executionResult;
      
    } catch (error) {
      // Handle execution failure
      task.status = 'failed';
      agent.status = 'error';
      
      const errorResult: AgentExecutionResult = {
        agentId: agent.id,
        taskId: task.id,
        success: false,
        output: `Task execution failed: ${error}`,
        artifacts: [],
        duration: Date.now() - startTime
      };
      
      this.emit('task_execution_failed', { task, agent: agent.id, error });
      
      return errorResult;
    }
  }
  
  /**
   * Send task to agent and await response
   */
  private async sendTaskToAgent(
    task: AgentTask,
    agent: ClaudeCodeAgent,
    prompt: string
  ): Promise<{ output: string; artifacts?: string[]; recommendations?: string[] }> {
    
    if (!agent.process || !agent.sessionId) {
      throw new Error(`Agent ${agent.id} is not properly initialized`);
    }
    
    return new Promise((resolve, reject) => {
      let outputBuffer = '';
      const timeout = setTimeout(() => {
        reject(new Error(`Task ${task.id} execution timeout on agent ${agent.id}`));
      }, task.estimatedTime * 2 || 300000); // 5 minute default timeout
      
      // Listen for agent response
      const dataHandler = (data: Buffer) => {
        outputBuffer += data.toString();
        
        // Try to parse complete response
        try {
          const response = JSON.parse(outputBuffer);
          
          if (response.type === 'task_completed') {
            clearTimeout(timeout);
            agent.process!.stdout?.off('data', dataHandler);
            resolve({
              output: response.output || response.result,
              artifacts: response.artifacts,
              recommendations: response.recommendations
            });
          }
        } catch (error) {
          // Continue waiting for complete response
        }
      };
      
      agent.process.stdout?.on('data', dataHandler);
      
      // Send task to agent
      const taskMessage = {
        type: 'execute_task',
        session_id: agent.sessionId,
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          requirements: task.requirements,
          context: task.context,
          prompt: prompt
        },
        timestamp: Date.now()
      };
      
      agent.process.stdin?.write(JSON.stringify(taskMessage) + '\n');
    });
  }
  
  /**
   * Build specialized system prompts for different agent roles
   */
  private initializeAgentRoles(): Map<string, AgentRole> {
    return new Map([
      ['backend', {
        name: 'Backend Specialist',
        systemPrompt: 'You are a backend development expert specializing in APIs, databases, and server-side logic.',
        allowedTools: ['Bash', 'Read', 'Edit', 'Write', 'MultiEdit'],
        specialization: ['api-design', 'database', 'authentication', 'server-architecture'],
        maxConcurrentTasks: 2
      }],
      ['security', {
        name: 'Security Expert',
        systemPrompt: 'You are a cybersecurity expert focused on secure coding practices, vulnerability assessment, and authentication systems.',
        allowedTools: ['Read', 'Grep', 'WebSearch', 'Bash'],
        specialization: ['security-audit', 'authentication', 'authorization', 'vulnerability-scanning'],
        maxConcurrentTasks: 3
      }],
      ['frontend', {
        name: 'Frontend Specialist',
        systemPrompt: 'You are a frontend development expert specializing in user interfaces, user experience, and client-side logic.',
        allowedTools: ['Read', 'Edit', 'Write', 'MultiEdit', 'WebFetch'],
        specialization: ['ui-design', 'react', 'typescript', 'user-experience'],
        maxConcurrentTasks: 2
      }],
      ['tester', {
        name: 'Quality Assurance Expert',
        systemPrompt: 'You are a QA expert focused on testing, validation, and ensuring code quality.',
        allowedTools: ['Bash', 'Read', 'Write', 'Grep'],
        specialization: ['unit-testing', 'integration-testing', 'test-automation', 'quality-assurance'],
        maxConcurrentTasks: 3
      }],
      ['devops', {
        name: 'DevOps Engineer',
        systemPrompt: 'You are a DevOps expert focused on deployment, infrastructure, and CI/CD pipelines.',
        allowedTools: ['Bash', 'Read', 'Write', 'Edit'],
        specialization: ['deployment', 'docker', 'ci-cd', 'infrastructure'],
        maxConcurrentTasks: 2
      }]
    ]);
  }
  
  /**
   * Analyze tasks and determine which agents are needed
   */
  private analyzeRequiredAgents(tasks: AgentTask[]): Array<{ role: string; expertise: string[] }> {
    const requiredAgents = new Set<string>();
    const expertiseMap = new Map<string, string[]>();
    
    for (const task of tasks) {
      for (const requirement of task.requirements) {
        // Map requirements to agent roles
        const agentRole = this.mapRequirementToAgentRole(requirement);
        if (agentRole) {
          requiredAgents.add(agentRole);
          
          if (!expertiseMap.has(agentRole)) {
            expertiseMap.set(agentRole, []);
          }
          expertiseMap.get(agentRole)!.push(requirement);
        }
      }
    }
    
    return Array.from(requiredAgents).map(role => ({
      role,
      expertise: expertiseMap.get(role) || []
    }));
  }
  
  /**
   * Map task requirements to appropriate agent roles
   */
  private mapRequirementToAgentRole(requirement: string): string | null {
    const req = requirement.toLowerCase();
    
    if (req.includes('api') || req.includes('database') || req.includes('server')) {
      return 'backend';
    }
    
    if (req.includes('security') || req.includes('auth') || req.includes('vulnerability')) {
      return 'security';
    }
    
    if (req.includes('ui') || req.includes('frontend') || req.includes('react') || req.includes('component')) {
      return 'frontend';
    }
    
    if (req.includes('test') || req.includes('validation') || req.includes('quality')) {
      return 'tester';
    }
    
    if (req.includes('deploy') || req.includes('docker') || req.includes('ci')) {
      return 'devops';
    }
    
    // Default to backend for unclear requirements
    return 'backend';
  }
  
  /**
   * Build agent-specific system prompt
   */
  private buildAgentSystemPrompt(agent: ClaudeCodeAgent): string {
    return `
You are ${agent.name}, a specialized AI agent with expertise in: ${agent.expertise.join(', ')}.

Your role is to execute tasks assigned to you with the following capabilities:
- Tools available: ${agent.tools.join(', ')}
- Working directory: ${agent.workingDirectory}
- Agent ID: ${agent.id}

When executing tasks:
1. Analyze the task requirements carefully
2. Use your specialized knowledge and tools effectively
3. Provide detailed output and recommendations
4. Coordinate with other agents when necessary
5. Report progress and completion status

Always respond with structured JSON containing your results, artifacts created, and next recommendations.
    `.trim();
  }
  
  /**
   * Build task execution prompt
   */
  private buildTaskExecutionPrompt(task: AgentTask, agent: ClaudeCodeAgent): string {
    const contextFiles = task.context.relevantFiles.length > 0 
      ? `\nRelevant files: ${task.context.relevantFiles.join(', ')}`
      : '';
    
    const previousResults = task.context.previousResults.size > 0
      ? `\nPrevious results: ${Array.from(task.context.previousResults.entries()).map(([k, v]) => `${k}: ${v}`).join(', ')}`
      : '';
    
    return `
Task: ${task.title}
Description: ${task.description}
Requirements: ${task.requirements.join(', ')}
Priority: ${task.priority}
${contextFiles}
${previousResults}

User Instructions: ${task.context.userInstructions}
Constraints: ${task.context.constraints.join(', ')}

Please execute this task using your specialized expertise as a ${agent.role.name}.
    `.trim();
  }

  /**
   * Build initialization prompt for agent
   */
  private buildInitializationPrompt(agent: ClaudeCodeAgent): string {
    return `
Initializing ${agent.name} (${agent.id})

You are being initialized as a specialized Claude Code agent with the following configuration:
- Role: ${agent.role.name}
- Expertise: ${agent.expertise.join(', ')}
- Available Tools: ${agent.tools.join(', ')}
- Working Directory: ${agent.workingDirectory}

Please confirm your initialization and provide a session ID for this conversation.
Respond with JSON: { "session_id": "your_session_id", "status": "ready", "capabilities": [...] }
    `.trim();
  }

  /**
   * Assign tasks to appropriate agents based on requirements and availability
   */
  private async assignTasksToAgents(tasks: AgentTask[]): Promise<void> {
    this.taskQueue = [...tasks];
    
    for (const task of tasks) {
      // Find best agent for this task
      const bestAgent = this.findBestAgentForTask(task);
      
      if (bestAgent) {
        task.assignedAgent = bestAgent.id;
        task.status = 'assigned';
        this.emit('task_assigned', { task, agent: bestAgent.id });
      } else {
        task.status = 'pending';
        this.emit('task_assignment_failed', { task, reason: 'No suitable agent found' });
      }
    }
  }

  /**
   * Find the best agent for a specific task
   */
  private findBestAgentForTask(task: AgentTask): ClaudeCodeAgent | null {
    const availableAgents = Array.from(this.activeAgents.values())
      .filter(agent => agent.status === 'ready');
    
    // Score agents based on expertise match and availability
    const scoredAgents = availableAgents.map(agent => {
      let score = 0;
      
      // Score based on expertise match
      for (const requirement of task.requirements) {
        const agentRole = this.mapRequirementToAgentRole(requirement);
        if (agentRole === agent.role.name.toLowerCase().replace(' specialist', '').replace(' expert', '').replace(' engineer', '')) {
          score += 10;
        }
        
        for (const expertise of agent.expertise) {
          if (requirement.toLowerCase().includes(expertise)) {
            score += 5;
          }
        }
      }
      
      // Prefer agents with fewer current tasks
      const currentTaskCount = Array.from(this.activeAgents.values())
        .filter(a => a.currentTask && a.id === agent.id).length;
      score -= currentTaskCount * 3;
      
      return { agent, score };
    });
    
    // Return agent with highest score
    scoredAgents.sort((a, b) => b.score - a.score);
    return scoredAgents.length > 0 ? scoredAgents[0].agent : null;
  }

  /**
   * Execute tasks sequentially
   */
  private async executeTasksSequentially(
    options: { enableHumanLoop?: boolean }
  ): Promise<AgentExecutionResult[]> {
    const results: AgentExecutionResult[] = [];
    
    // Sort tasks by priority and dependencies
    const sortedTasks = this.sortTasksByPriorityAndDependencies(this.taskQueue);
    
    for (const task of sortedTasks) {
      if (task.status === 'assigned') {
        const result = await this.executeTask(task, options);
        results.push(result);
      }
    }
    
    return results;
  }

  /**
   * Group tasks by their dependencies for parallel execution
   */
  private groupTasksByDependencies(tasks: AgentTask[]): AgentTask[][] {
    const groups: AgentTask[][] = [];
    const processed = new Set<string>();
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    
    const processBatch = (): AgentTask[] => {
      const batch: AgentTask[] = [];
      
      for (const task of tasks) {
        if (processed.has(task.id)) continue;
        
        // Check if all dependencies are processed
        const canExecute = task.dependencies.every(depId => 
          processed.has(depId) || !taskMap.has(depId)
        );
        
        if (canExecute) {
          batch.push(task);
          processed.add(task.id);
        }
      }
      
      return batch;
    };
    
    while (processed.size < tasks.length) {
      const batch = processBatch();
      if (batch.length === 0) {
        // Handle circular dependencies or orphaned tasks
        const remaining = tasks.filter(t => !processed.has(t.id));
        if (remaining.length > 0) {
          groups.push(remaining.slice(0, 1));
          processed.add(remaining[0].id);
        }
      } else {
        groups.push(batch);
      }
    }
    
    return groups;
  }

  /**
   * Sort tasks by priority and dependencies
   */
  private sortTasksByPriorityAndDependencies(tasks: AgentTask[]): AgentTask[] {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const sorted: AgentTask[] = [];
    const processed = new Set<string>();
    
    const canProcess = (task: AgentTask): boolean => {
      return task.dependencies.every(depId => 
        processed.has(depId) || !taskMap.has(depId)
      );
    };
    
    while (sorted.length < tasks.length) {
      const available = tasks
        .filter(task => !processed.has(task.id) && canProcess(task))
        .sort((a, b) => b.priority - a.priority);
      
      if (available.length === 0) {
        // Handle circular dependencies
        const remaining = tasks.filter(t => !processed.has(t.id));
        if (remaining.length > 0) {
          available.push(remaining[0]);
        }
      }
      
      if (available.length > 0) {
        const task = available[0];
        sorted.push(task);
        processed.add(task.id);
      }
    }
    
    return sorted;
  }

  /**
   * Create error result for failed task execution
   */
  private createErrorResult(error: any): AgentExecutionResult {
    return {
      agentId: 'unknown',
      taskId: 'unknown',
      success: false,
      output: `Error: ${error?.message || error}`,
      artifacts: [],
      duration: 0
    };
  }
  
  // Helper methods and cleanup
  private generateAgentId(role: string): string {
    return `${role}-agent-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  }
  
  private setupProcessMonitoring(agentId: string, process: ChildProcess): void {
    process.on('error', (error) => {
      this.emit('agent_process_error', { agentId, error });
    });
    
    process.on('exit', (code) => {
      this.emit('agent_process_exited', { agentId, code });
      this.activeAgents.delete(agentId);
    });
  }
  
  private setupCleanupInterval(): void {
    setInterval(() => {
      this.cleanupInactiveAgents();
    }, 60000); // Cleanup every minute
  }
  
  private cleanupInactiveAgents(): void {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 minutes
    
    for (const [agentId, agent] of this.activeAgents) {
      if (now - agent.lastActivity > timeout) {
        this.terminateAgent(agentId);
      }
    }
  }
  
  private terminateAgent(agentId: string): void {
    const agent = this.activeAgents.get(agentId);
    if (agent?.process && !agent.process.killed) {
      agent.process.kill();
    }
    this.activeAgents.delete(agentId);
    this.emit('agent_terminated', { agentId });
  }
  
  /**
   * Public methods for external control
   */
  
  async getAgentStatus(): Promise<ClaudeCodeAgent[]> {
    return Array.from(this.activeAgents.values());
  }
  
  async terminateAllAgents(): Promise<void> {
    for (const agentId of this.activeAgents.keys()) {
      this.terminateAgent(agentId);
    }
  }
  
  async pauseAgent(agentId: string): Promise<void> {
    const agent = this.activeAgents.get(agentId);
    if (agent?.process) {
      agent.process.kill('SIGSTOP');
      this.emit('agent_paused', { agentId });
    }
  }
  
  async resumeAgent(agentId: string): Promise<void> {
    const agent = this.activeAgents.get(agentId);
    if (agent?.process) {
      agent.process.kill('SIGCONT');
      this.emit('agent_resumed', { agentId });
    }
  }
}

// Export singleton
export const claudeCodeAgentLauncher = new ClaudeCodeAgentLauncher();
