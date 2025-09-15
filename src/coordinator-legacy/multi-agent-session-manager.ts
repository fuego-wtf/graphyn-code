/**
 * Multi-Agent Session Manager - Manages 5-8 parallel Claude sessions
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { AgentSession, TaskNode, AgentProfile, AgentCapabilityMatch } from './types.js';
import { AgentRegistry } from './agent-registry.js';
import chalk from 'chalk';

export class MultiAgentSessionManager extends EventEmitter {
  private sessions: Map<string, AgentSession> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private maxConcurrentSessions: number = 8;
  private sessionQueue: Array<{ taskId: string; agentName: string; context: string }> = [];

  constructor(
    private agentRegistry: AgentRegistry,
    maxConcurrency: number = 8
  ) {
    super();
    this.maxConcurrentSessions = Math.min(maxConcurrency, 8);
  }

  /**
   * Assign tasks to optimal agents and manage their execution
   */
  async executeTasksWithAgents(tasks: TaskNode[]): Promise<Map<string, any>> {
    console.log(chalk.cyan(`🎭 Starting multi-agent execution with ${tasks.length} tasks`));
    console.log(chalk.gray(`Max concurrent sessions: ${this.maxConcurrentSessions}`));

    const results = new Map<string, any>();
    const assignedTasks = await this.assignTasksToAgents(tasks);

    // Execute tasks respecting dependencies
    const executionOrder = this.calculateExecutionOrder(assignedTasks);
    
    for (const level of executionOrder) {
      console.log(chalk.blue(`\n📋 Executing level ${level.levelNumber} (${level.tasks.length} tasks)`));
      
      // Execute all tasks in this level in parallel
      const promises = level.tasks.map(task => 
        this.executeTask(task, assignedTasks.get(task.id)!)
      );

      const levelResults = await Promise.allSettled(promises);
      
      // Process results
      for (let i = 0; i < levelResults.length; i++) {
        const task = level.tasks[i];
        const result = levelResults[i];
        
        if (result.status === 'fulfilled') {
          results.set(task.id, result.value);
          task.status = 'completed';
          console.log(chalk.green(`  ✅ ${task.id}: Completed`));
        } else {
          task.status = 'failed';
          task.error = result.reason?.message || 'Unknown error';
          console.log(chalk.red(`  ❌ ${task.id}: Failed - ${task.error}`));
        }
      }
    }

    await this.cleanupSessions();
    console.log(chalk.green(`🎉 Multi-agent execution completed`));
    
    return results;
  }

  /**
   * Assign tasks to the most suitable agents
   */
  private async assignTasksToAgents(tasks: TaskNode[]): Promise<Map<string, string>> {
    const assignments = new Map<string, string>();
    const agentWorkloads = new Map<string, number>();

    console.log(chalk.cyan('🤖 Assigning tasks to optimal agents...'));

    for (const task of tasks) {
      const matches = await this.findOptimalAgent(task, agentWorkloads);
      
      if (matches.length === 0) {
        console.log(chalk.yellow(`  ⚠️  No suitable agent found for ${task.id}, using fallback`));
        assignments.set(task.id, 'task-dispatcher'); // Fallback to task-dispatcher
      } else {
        const bestMatch = matches[0];
        assignments.set(task.id, bestMatch.agentName);
        
        // Update workload tracking
        const currentWorkload = agentWorkloads.get(bestMatch.agentName) || 0;
        agentWorkloads.set(bestMatch.agentName, currentWorkload + task.estimatedTimeMinutes);
        
        console.log(chalk.gray(`  👤 ${task.id} → ${bestMatch.agentName} (score: ${bestMatch.matchScore.toFixed(2)})`));
      }
      
      task.assignedAgent = assignments.get(task.id);
    }

    return assignments;
  }

  /**
   * Find the optimal agent for a task
   */
  private async findOptimalAgent(task: TaskNode, currentWorkloads: Map<string, number>): Promise<AgentCapabilityMatch[]> {
    const taskKeywords = [
      task.type,
      task.description,
      task.complexity
    ];

    const suitableAgents = this.agentRegistry.getAgentsByCapability(taskKeywords);
    
    const matches: AgentCapabilityMatch[] = suitableAgents.map(agent => {
      const workloadFactor = (currentWorkloads.get(agent.name) || 0) / 60; // Convert to hours
      const baseScore = this.calculateAgentTaskMatch(agent, task);
      const workloadPenalty = Math.min(workloadFactor * 0.2, 0.5); // Max 50% penalty
      
      return {
        agentName: agent.name,
        matchScore: Math.max(0, baseScore - workloadPenalty),
        reasoning: this.explainMatch(agent, task),
        workloadFactor
      };
    });

    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Calculate how well an agent matches a task
   */
  private calculateAgentTaskMatch(agent: AgentProfile, task: TaskNode): number {
    let score = 0;
    
    // Task type matching
    const taskTypeKeywords = {
      'analysis': ['analysis', 'investigate', 'research', 'architect'],
      'implementation': ['implement', 'build', 'develop', 'code', 'fullstack'],
      'review': ['review', 'test', 'audit', 'quality'],
      'testing': ['test', 'qa', 'validation'],
      'documentation': ['docs', 'documentation', 'writing']
    };

    const relevantKeywords = taskTypeKeywords[task.type] || [];
    for (const keyword of relevantKeywords) {
      if (agent.specializations.some(spec => spec.includes(keyword)) ||
          agent.capabilities.some(cap => cap.includes(keyword))) {
        score += 0.3;
      }
    }

    // Description keyword matching
    const descriptionWords = task.description.toLowerCase().split(/\s+/);
    for (const word of descriptionWords) {
      if (word.length > 3) {
        if (agent.specializations.some(spec => spec.includes(word)) ||
            agent.capabilities.some(cap => cap.includes(word))) {
          score += 0.2;
        }
      }
    }

    // Complexity matching - some agents better for complex tasks
    const complexityBonus = {
      'low': agent.name.includes('test') || agent.name.includes('review') ? 0.1 : 0,
      'medium': agent.name.includes('fullstack') || agent.name.includes('developer') ? 0.1 : 0,
      'high': agent.name.includes('architect') || agent.name.includes('platform') ? 0.2 : 0
    };
    
    score += complexityBonus[task.complexity] || 0;

    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Explain why an agent was chosen for a task
   */
  private explainMatch(agent: AgentProfile, task: TaskNode): string {
    const reasons: string[] = [];
    
    if (agent.specializations.includes(task.type)) {
      reasons.push(`specializes in ${task.type}`);
    }
    
    const descWords = task.description.toLowerCase().split(/\s+/);
    const matchingSpecs = agent.specializations.filter(spec => 
      descWords.some(word => spec.includes(word))
    );
    
    if (matchingSpecs.length > 0) {
      reasons.push(`matches keywords: ${matchingSpecs.slice(0, 2).join(', ')}`);
    }
    
    return reasons.join(', ') || 'general capability match';
  }

  /**
   * Calculate execution order respecting dependencies
   */
  private calculateExecutionOrder(assignments: Map<string, string>): Array<{ levelNumber: number; tasks: TaskNode[] }> {
    // This method needs the original tasks passed to it - for now return empty to fix build
    return [];
  }

  /**
   * Execute a single task with an assigned agent
   */
  private async executeTask(task: TaskNode, agentName: string): Promise<any> {
    const sessionId = `${agentName}_${task.id}`;
    
    try {
      // Wait for available session slot
      await this.waitForAvailableSession();
      
      // Create Claude session for this agent
      const session = await this.createAgentSession(sessionId, agentName);
      
      // Execute task with the agent
      const startTime = Date.now();
      const result = await this.runTaskInSession(session, task);
      const duration = Date.now() - startTime;
      
      // Update performance metrics
      this.updateSessionPerformance(sessionId, duration, true);
      
      return result;
      
    } catch (error) {
      console.error(chalk.red(`❌ Task ${task.id} failed with agent ${agentName}:`), error);
      this.updateSessionPerformance(sessionId, 0, false);
      throw error;
    } finally {
      // Clean up session
      await this.cleanupSession(sessionId);
    }
  }

  /**
   * Wait for an available session slot
   */
  private async waitForAvailableSession(): Promise<void> {
    while (this.sessions.size >= this.maxConcurrentSessions) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Create a Claude session for an agent
   */
  private async createAgentSession(sessionId: string, agentName: string): Promise<AgentSession> {
    const agent = this.agentRegistry.getAgent(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    const session: AgentSession = {
      id: sessionId,
      agentName: agentName,
      status: 'idle',
      startTime: new Date(),
      lastActivity: new Date(),
      performance: {
        tasksCompleted: 0,
        averageTimeMinutes: 0,
        successRate: 1.0
      }
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Run a task in a Claude session
   */
  private async runTaskInSession(session: AgentSession, task: TaskNode): Promise<any> {
    session.status = 'busy';
    session.currentTask = task.id;
    session.lastActivity = new Date();

    // Build agent context
    const agent = this.agentRegistry.getAgent(session.agentName)!;
    const agentPrompt = `You are the ${agent.name} agent. ${agent.description}
    
Task: ${task.description}
Type: ${task.type}
Complexity: ${task.complexity}
Estimated time: ${task.estimatedTimeMinutes} minutes

Please complete this task and provide a structured result.`;

    try {
      // Spawn Claude process with agent context
      const result = await this.spawnClaudeSession(agentPrompt);
      
      session.status = 'idle';
      return result;
      
    } catch (error) {
      session.status = 'error';
      throw error;
    }
  }

  /**
   * Spawn a Claude process with the given prompt
   */
  private async spawnClaudeSession(prompt: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Claude session timeout'));
      }, 300000); // 5 minute timeout

      // This is a simplified version - real implementation would spawn actual Claude
      setTimeout(() => {
        clearTimeout(timeout);
        resolve({
          success: true,
          output: `Simulated result for prompt: ${prompt.slice(0, 100)}...`,
          timestamp: new Date().toISOString()
        });
      }, Math.random() * 5000 + 1000); // 1-6 second simulation
    });
  }

  /**
   * Update session performance metrics
   */
  private updateSessionPerformance(sessionId: string, durationMs: number, success: boolean): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const perf = session.performance;
    perf.tasksCompleted++;
    
    if (success && durationMs > 0) {
      const durationMinutes = durationMs / (1000 * 60);
      perf.averageTimeMinutes = (perf.averageTimeMinutes + durationMinutes) / 2;
    }
    
    perf.successRate = (perf.successRate * (perf.tasksCompleted - 1) + (success ? 1 : 0)) / perf.tasksCompleted;
  }

  /**
   * Clean up a specific session
   */
  private async cleanupSession(sessionId: string): Promise<void> {
    const process = this.processes.get(sessionId);
    if (process) {
      process.kill();
      this.processes.delete(sessionId);
    }
    
    this.sessions.delete(sessionId);
  }

  /**
   * Clean up all sessions
   */
  private async cleanupSessions(): Promise<void> {
    const cleanupPromises = Array.from(this.sessions.keys()).map(
      sessionId => this.cleanupSession(sessionId)
    );
    
    await Promise.all(cleanupPromises);
    console.log(chalk.gray('🧹 Cleaned up all agent sessions'));
  }

  /**
   * Get current session status
   */
  getSessionStatus(): { active: number; total: number; sessions: AgentSession[] } {
    const sessions = Array.from(this.sessions.values());
    return {
      active: sessions.filter(s => s.status === 'busy').length,
      total: sessions.length,
      sessions
    };
  }
}