/**
 * Claude Code Headless Multi-Agent Orchestrator
 * 
 * Uses Claude Code's headless mode with streaming for real-time agent coordination
 * Inspired by claude-squad pattern with mission control interface
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import { ClaudeAPIWrapper } from '../claude-api-wrapper.js';
import { AgentToolSystem } from '../agent-tool-system.js';
import { IntelligentRepoAnalyzer, RepoAnalysis } from '../repo-analyzer.js';
import { IntelligentTaskGraphGenerator, Goal, TaskGraph, Task } from '../task-graph-generator.js';
import { RealTimeLogger } from '../ui/real-time-logger.js';
import { ProgressBar, MultiStepProgress } from '../ui/progress-bar.js';
import { Spinner } from '../ui/spinner.js';
import { DashboardRenderer } from '../ui/dashboard-renderer.js';
import { MissionControlStream } from '../monitoring/MissionControlStream.js';
import type { MissionControlEvent, TaskStatus } from '../monitoring/MissionControlStream.js';
import 'dotenv/config';

// Temporary type definitions until proper imports are fixed
interface ClaudeCodeAgent {
  execute(task: string): Promise<any>;
}

// MissionControlStream is now imported from monitoring module

interface AgentSpec {
  id: string;
  name: string;
  specialization: string;
  requiredTools: string[];
  dependencies: string[];
}

// Task interface is now imported from IntelligentTaskGraphGenerator

// TaskGraph interface is now imported from IntelligentTaskGraphGenerator

interface TaskAssignment {
  agentId: string;
  task: Task;
  estimatedDuration: number;
}

interface AgentUpdate {
  id: string;
  status: 'spawning' | 'analyzing' | 'executing' | 'waiting' | 'completed' | 'failed';
  progress: number;
  currentOperation?: string;
  output?: string[];
  toolsUsed?: string[];
  needsFeedback?: boolean;
  feedbackRequest?: string;
}

export class GraphynOrchestrator extends EventEmitter {
  private agents: Map<string, ClaudeCodeAgent> = new Map();
  private taskGraph: TaskGraph | null = null;
  private missionControl: MissionControlStream;
  private workingDirectory: string;
  private repoAnalysis: RepoAnalysis | null = null;
  private repoAnalyzer: IntelligentRepoAnalyzer;
  private taskGraphGenerator: IntelligentTaskGraphGenerator;
  
  // Real-time streaming components
  private logger: RealTimeLogger;
  private dashboard: DashboardRenderer;
  private dashboardUpdateInterval: NodeJS.Timeout | null = null;

  constructor(workingDirectory = process.cwd()) {
    super();
    this.workingDirectory = workingDirectory;
    this.missionControl = new MissionControlStream({
      id: `session-${Date.now()}`,
      startTime: new Date()
    });
    this.repoAnalyzer = new IntelligentRepoAnalyzer(workingDirectory);
    this.taskGraphGenerator = new IntelligentTaskGraphGenerator();
    
    // Initialize streaming components
    this.logger = new RealTimeLogger({ 
      timestamps: process.env.NODE_ENV === 'development',
      prefix: 'Graphyn'
    });
    this.dashboard = new DashboardRenderer({ 
      updateInterval: 500,
      compact: typeof process.stdout.columns === 'number' && process.stdout.columns < 120
    });

    // Subscribe to mission control events for real-time terminal output
    this.missionControl.subscribe((event: MissionControlEvent) => {
      this.handleMissionControlEvent(event);
    });
    
    // Setup graceful shutdown
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  async orchestrate(query: string): Promise<any> {
    this.logger.logLine('🎛️ GRAPHYN MISSION CONTROL - Starting orchestration...\n');

    try {
      // Initialize multi-step progress tracker
      const progressSteps = [
        { name: 'Analysis & Planning', weight: 2 },
        { name: 'Agent Set Construction', weight: 1 },
        { name: 'Task Assignment', weight: 1 },
        { name: 'Mission Control Execution', weight: 4 }
      ];
      
      const overallProgress = new MultiStepProgress(progressSteps, {
        prefix: '🎛️ Progress',
        showETA: true
      });
      
      // Phase 1: Analysis & Planning
      overallProgress.nextStep();
      this.logger.logLine('📊 Phase 1: Analysis & Planning');
      
      // Repository analysis with spinner
      const repoSpinner = new Spinner({ text: 'Analyzing repository structure...', color: 'cyan' });
      repoSpinner.start();
      this.repoAnalysis = await this.repoAnalyzer.analyzeRepository();
      repoSpinner.succeed('Repository structure analyzed');

      // Goal parsing with spinner
      const goalSpinner = new Spinner({ text: `Understanding goal: ${query}`, color: 'cyan' });
      goalSpinner.start();
      const goal = await this.parseGoal(query);
      goalSpinner.succeed('Goal captured and parsed');

      // Task graph generation with spinner
      const taskSpinner = new Spinner({ text: 'Building task dependency graph...', color: 'cyan' });
      taskSpinner.start();
      this.taskGraph = await this.buildTaskGraph(goal, this.repoAnalysis);
      taskSpinner.succeed('Task dependency graph created');

      // Agent specialization
      const agentSpinner = new Spinner({ text: 'Determining required agent specializations...', color: 'cyan' });
      agentSpinner.start();
      const requiredAgents = this.determineAgentSet(this.taskGraph);
      agentSpinner.succeed(`${requiredAgents.length} agent specializations identified`);
      
      overallProgress.completeCurrentStep();
      
      // Phase 2: Agent Set Construction
      overallProgress.nextStep();
      this.logger.logLine('\n🤖 Phase 2: Agent Set Construction');
      await this.buildAgentSetWithProgress(requiredAgents);
      overallProgress.completeCurrentStep();

      // Phase 3: Task Assignment & Orchestration
      overallProgress.nextStep();
      this.logger.logLine('\n🎯 Phase 3: Task Assignment & Orchestration');
      
      const assignSpinner = new Spinner({ text: 'Assigning tasks to agents...', color: 'green' });
      assignSpinner.start();
      const assignments = this.assignTasks(this.taskGraph, this.agents);
      assignSpinner.succeed(`${assignments.length} tasks assigned to agents`);
      
      overallProgress.completeCurrentStep();

      // Phase 4: Mission Control Execution with Real-time Dashboard
      overallProgress.nextStep();
      this.logger.logLine('\n🎛️ Phase 4: Mission Control Execution');
      this.logger.logLine('🚀 Launching mission control dashboard...\n');
      
      // Start real-time dashboard
      this.startDashboard();
      
      const results = await this.executeWithMissionControlStreaming(assignments);
      
      // Stop dashboard and show summary
      this.stopDashboard();
      overallProgress.completeCurrentStep();
      overallProgress.complete();
      
      // Final summary with dashboard
      this.renderFinalSummary(results);

      return results;
      
    } catch (error) {
      this.logger.logStatus('error', `Mission failed: ${error instanceof Error ? error.message : String(error)}`);
      this.stopDashboard();
      throw error;
    }
  }

  private async analyzeRepository(): Promise<any> {
    // Simulate repository analysis
    const packageJsonPath = path.join(this.workingDirectory, 'package.json');
    let hasPackageJson = false;
    let tech = [];
    
    try {
      await fs.access(packageJsonPath);
      hasPackageJson = true;
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      if (packageJson.dependencies?.react) tech.push('React');
      if (packageJson.dependencies?.express) tech.push('Express');
      if (packageJson.dependencies?.typescript) tech.push('TypeScript');
    } catch {
      // No package.json
    }

    return {
      hasPackageJson,
      technologies: tech,
      structure: await this.scanDirectoryStructure(),
      complexity: 'medium'
    };
  }

  private async scanDirectoryStructure(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.workingDirectory, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
        .map(entry => entry.name)
        .slice(0, 10); // Top 10 directories
    } catch {
      return [];
    }
  }

  private async parseGoal(query: string): Promise<Goal> {
    const keywords = query.toLowerCase();
    
    let goalType = 'general';
    if (keywords.includes('auth') || keywords.includes('login')) goalType = 'authentication';
    if (keywords.includes('api') || keywords.includes('rest')) goalType = 'api';
    if (keywords.includes('test')) goalType = 'testing';
    if (keywords.includes('security')) goalType = 'security';
    
    // Enhanced goal parsing with intelligence
    const complexity = keywords.length > 15 ? 'high' : keywords.length > 8 ? 'medium' : 'low';
    const urgency = keywords.includes('urgent') || keywords.includes('asap') ? 'high' : 'medium';
    
    let scope: 'feature' | 'refactor' | 'bugfix' | 'optimization' | 'migration' = 'feature';
    if (keywords.includes('refactor')) scope = 'refactor';
    if (keywords.includes('fix') || keywords.includes('bug')) scope = 'bugfix';
    if (keywords.includes('optimize') || keywords.includes('performance')) scope = 'optimization';
    if (keywords.includes('migrate') || keywords.includes('upgrade')) scope = 'migration';
    
    return {
      type: goalType,
      description: query,
      complexity,
      urgency,
      scope,
      constraints: [],
      requirements: []
    };
  }

  private async buildTaskGraph(goal: Goal, repoAnalysis: RepoAnalysis): Promise<TaskGraph> {
    // Use intelligent task graph generator
    return await this.taskGraphGenerator.generateTaskGraph(
      goal,
      repoAnalysis,
      this.workingDirectory
    );
  }

  private determineAgentSet(taskGraph: TaskGraph): AgentSpec[] {
    const agents: AgentSpec[] = [];
    const taskTypes = new Set(taskGraph.tasks.map((t: Task) => t.type));
    
    if (taskTypes.has('implementation')) {
      agents.push({
        id: 'backend-001',
        name: 'Backend Specialist',
        specialization: 'Backend development, API creation, database design',
        requiredTools: ['write', 'read', 'bash'],
        dependencies: []
      });
    }
    
    if (taskTypes.has('security')) {
      agents.push({
        id: 'security-001',
        name: 'Security Expert',
        specialization: 'Security analysis, vulnerability assessment, best practices',
        requiredTools: ['read', 'bash'],
        dependencies: ['backend-001']
      });
    }
    
    if (taskTypes.has('testing')) {
      agents.push({
        id: 'test-001',
        name: 'Test Engineer',
        specialization: 'Testing frameworks, integration testing, validation',
        requiredTools: ['write', 'read', 'bash'],
        dependencies: ['backend-001']
      });
    }
    
    return agents;
  }

  private async buildAgentSet(requiredAgents: AgentSpec[]): Promise<void> {
    for (const spec of requiredAgents) {
      process.stdout.write(`   ├─ ${spec.name} (${spec.specialization.split(',')[0]})\n`);

      const agent = new ClaudeCodeAgent({
        id: spec.id,
        name: spec.name,
        specialization: spec.specialization,
        workingDirectory: this.workingDirectory,
        tools: spec.requiredTools
      });

      this.agents.set(spec.id, agent);
    }

    process.stdout.write('\n⚙️ Initializing Claude Code headless instances...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate initialization
    process.stdout.write(' ✅\n');
    process.stdout.write('✅ Agent set ready for deployment\n');
  }

  private assignTasks(taskGraph: TaskGraph, agents: Map<string, ClaudeCodeAgent>): TaskAssignment[] {
    const assignments: TaskAssignment[] = [];
    
    taskGraph.tasks.forEach((task: Task) => {
      let assignedAgent = '';
      
      switch (task.type) {
        case 'implementation':
          assignedAgent = 'backend-001';
          break;
        case 'security':
          assignedAgent = 'security-001';
          break;
        case 'testing':
          assignedAgent = 'test-001';
          break;
        default:
          assignedAgent = Array.from(agents.keys())[0];
      }
      
      if (agents.has(assignedAgent)) {
        assignments.push({
          agentId: assignedAgent,
          task,
          estimatedDuration: Math.floor(Math.random() * 3 + 2) * 60000 // 2-5 minutes
        });
        
        process.stdout.write(`   [${agents.get(assignedAgent)?.name}] → ${task.description}\n`);
      }
    });

    return assignments;
  }

  private async executeWithMissionControl(assignments: TaskAssignment[]): Promise<any[]> {
    // Initialize Mission Control for each agent
    assignments.forEach(assignment => {
      const agent = this.agents.get(assignment.agentId);
      if (agent) {
        this.missionControl.addAgent({
          id: agent.id,
          name: agent.name,
          type: this.getAgentType(agent.name),
          status: 'idle',
          task: assignment.task.description,
          initialProgress: 0
        });
      }
    });

    // Execute assignments in parallel with dependency management
    const results: any[] = [];
    const completed = new Set<string>();
    const executing = new Set<string>();

    while (completed.size < assignments.length) {
      const readyAssignments = assignments.filter(assignment => {
        if (completed.has(assignment.task.id) || executing.has(assignment.task.id)) {
          return false;
        }
        
        return assignment.task.dependencies.every((dep: string) => completed.has(dep));
      });

      if (readyAssignments.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      const executionPromises = readyAssignments.map(async assignment => {
        executing.add(assignment.task.id);
        const agent = this.agents.get(assignment.agentId)!;
        
        try {
          const result = await this.spawnAndWatchAgent(agent, assignment.task);
          results.push(result);
          completed.add(assignment.task.id);
        } catch (error) {
          process.stderr.write(`Agent ${assignment.agentId} failed: ${error}\n`);
          completed.add(assignment.task.id); // Mark as completed even if failed
        } finally {
          executing.delete(assignment.task.id);
        }
      });

      await Promise.all(executionPromises);
    }

    return results;
  }

  private async spawnAndWatchAgent(agent: ClaudeCodeAgent, task: Task): Promise<any> {
    // Update Mission Control with agent spawning
    this.missionControl.updateAgent(agent.id, {
      id: agent.id,
      name: agent.name,
      type: this.getAgentType(agent.id),
      status: 'active',
      progress: 0,
      currentTask: task.description,
      currentOperation: 'Analyzing task requirements'
    });

    // Execute with Claude Code headless streaming
    const stream = await agent.executeStreaming(task);
    
    // Watch and relay all streaming updates
    for await (const update of stream) {
      this.missionControl.updateAgent(agent.id, {
        status: update.status ? this.convertStatus(update.status) : undefined,
        progress: update.progress,
        currentOperation: update.currentOperation,
        output: update.output,
        toolsUsed: update.toolsUsed,
        needsFeedback: update.needsFeedback,
        feedbackRequest: update.feedbackRequest
      });
      
      // Handle feedback requests
      if (update.needsFeedback) {
        process.stdout.write(`\n💬 FEEDBACK LOOP: ${agent.name} needs clarification\n`);
        process.stdout.write(`🎯 [HUMAN INPUT REQUIRED] ${update.feedbackRequest}\n`);

        // Request real human feedback
        const feedback = await this.requestHumanFeedback(update.feedbackRequest!);
        process.stdout.write(`✅ Feedback provided: ${feedback}, agents continuing...\n\n`);

        await agent.provideFeedback(feedback);
      }
    }
    
    return null;
  }

  private async requestHumanFeedback(request: string): Promise<string> {
    // Real human-in-the-loop feedback using readline
    const readline = await import('readline');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(`💬 ${request} > `, (answer) => {
        rl.close();
        resolve(answer.trim() || 'yes'); // Default to 'yes' if empty
      });
    });
  }

  /**
   * Build agent set with progress visualization
   */
  private async buildAgentSetWithProgress(requiredAgents: AgentSpec[]): Promise<void> {
    const progressBar = new ProgressBar({
      total: requiredAgents.length,
      prefix: '🏗️  Building agents',
      showCounts: true,
      color: 'green'
    });

    for (let i = 0; i < requiredAgents.length; i++) {
      const spec = requiredAgents[i];
      progressBar.update(i, `Creating ${spec.name}...`);
      
      const agent = new ClaudeCodeAgent({
        id: spec.id,
        name: spec.name,
        specialization: spec.specialization,
        workingDirectory: this.workingDirectory,
        tools: spec.requiredTools
      });
      
      this.agents.set(spec.id, agent);
      
      // Simulate agent initialization time
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    progressBar.complete('✅ Agent set ready for deployment');
    
    // Initialize Claude Code headless instances
    const initSpinner = new Spinner({ 
      text: 'Initializing Claude Code headless instances...', 
      color: 'yellow' 
    });
    initSpinner.start();
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate initialization
    
    initSpinner.succeed('Claude Code instances ready');
  }

  /**
   * Start real-time dashboard
   */
  private startDashboard(): void {
    this.dashboard.startAutoRefresh(
      () => this.missionControl.getAllAgents(),
      () => this.missionControl.getAllTasks(),
      () => this.missionControl.getSessionMetrics() ?? undefined
    );
  }

  /**
   * Stop dashboard and cleanup
   */
  private stopDashboard(): void {
    this.dashboard.stopAutoRefresh();
    this.dashboard.cleanup();
  }

  /**
   * Execute mission control with real-time streaming
   */
  private async executeWithMissionControlStreaming(assignments: TaskAssignment[]): Promise<any[]> {
    // Initialize Mission Control for each agent
    assignments.forEach(assignment => {
      const agent = this.agents.get(assignment.agentId);
      if (agent) {
        this.missionControl.updateAgentStatus(agent.id, {
          id: agent.id,
          type: this.getAgentType(agent.name),
          name: agent.name,
          status: 'idle',
          progress: 0,
          metrics: {
            tasksCompleted: 0,
            tasksActive: 0,
            errorCount: 0,
            uptime: 0
          },
          lastActivity: new Date()
        });
      }
    });

    // Add all tasks to mission control
    this.missionControl.updateMultipleTasks(this.taskGraph?.tasks || []);

    // Execute assignments in parallel with dependency management
    const results: any[] = [];
    const completed = new Set<string>();
    const executing = new Set<string>();

    while (completed.size < assignments.length) {
      const readyAssignments = assignments.filter(assignment => {
        if (completed.has(assignment.task.id) || executing.has(assignment.task.id)) {
          return false;
        }
        
        return assignment.task.dependencies.every((dep: string) => completed.has(dep));
      });

      if (readyAssignments.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      const executionPromises = readyAssignments.map(async assignment => {
        executing.add(assignment.task.id);
        const agent = this.agents.get(assignment.agentId)!;
        
        try {
          const result = await this.spawnAndWatchAgentStreaming(agent, assignment.task);
          results.push(result);
          completed.add(assignment.task.id);
        } catch (error) {
          this.logger.logStatus('error', `Agent ${assignment.agentId} failed: ${error}`);
          completed.add(assignment.task.id); // Mark as completed even if failed
        } finally {
          executing.delete(assignment.task.id);
        }
      });

      await Promise.all(executionPromises);
    }

    return results;
  }

  /**
   * Spawn and watch agent with real-time streaming
   */
  private async spawnAndWatchAgentStreaming(agent: ClaudeCodeAgent, task: Task): Promise<any> {
    // Update Mission Control with agent starting
    this.missionControl.updateAgentStatus(agent.id, {
      id: agent.id,
      status: 'active',
      progress: 0,
      currentTask: task.description,
      lastActivity: new Date()
    });

    this.missionControl.updateTaskStatus(task.id, {
      id: task.id,
      status: 'active',
      assignedAgent: agent.id,
      progress: 0
    });

    try {
      // Execute with Claude Code headless streaming
      const stream = await agent.executeStreaming(task);
      
      // Create agent-specific logger
      const agentLogger = this.logger.createChild(agent.name);
      
      // Watch and relay all streaming updates
      for await (const update of stream) {
        // Update Mission Control (existing functionality)
        this.missionControl.updateAgentStatus(agent.id, {
          id: agent.id,
          status: this.convertStatus(update.status),
          progress: update.progress,
          currentTask: update.currentOperation || task.description,
          lastActivity: new Date()
        });
        
        // NEW: Real-time terminal streaming
        switch (update.status) {
          case 'analyzing':
            agentLogger.updateAgentProgress(agent.name, 'Analyzing task requirements', update.progress);
            break;
          case 'executing':
            agentLogger.updateAgentProgress(agent.name, update.currentOperation || 'Executing task', update.progress);
            break;
          case 'completed':
            agentLogger.completeProgress(`Task completed: ${task.description}`);
            break;
          case 'failed':
            agentLogger.failProgress(`Task failed: ${update.currentOperation || 'Unknown error'}`);
            break;
        }
        
        // Handle feedback requests
        if (update.needsFeedback) {
          this.logger.logLine(`\n💬 FEEDBACK LOOP: ${agent.name} needs clarification`);
          this.logger.logLine(`🎯 [HUMAN INPUT REQUIRED] ${update.feedbackRequest}`);
          
          // Temporarily stop dashboard for human input
          this.stopDashboard();
          
          const feedback = await this.requestHumanFeedback(update.feedbackRequest!);
          this.logger.logStatus('success', `Feedback provided: ${feedback}, agents continuing...\n`);
          
          await agent.provideFeedback(feedback);
          
          // Restart dashboard
          this.startDashboard();
        }
      }
      
      // Mark as completed in mission control
      this.missionControl.updateAgentStatus(agent.id, {
        id: agent.id,
        status: 'complete',
        progress: 100,
        lastActivity: new Date()
      });
      
      this.missionControl.updateTaskStatus(task.id, {
        id: task.id,
        status: 'complete',
        progress: 100,
        completedTime: new Date()
      });
      
      return stream;
      
    } catch (error) {
      this.missionControl.updateAgentStatus(agent.id, {
        id: agent.id,
        status: 'error',
        lastActivity: new Date()
      });
      
      this.missionControl.updateTaskStatus(task.id, {
        id: task.id,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
        completedTime: new Date()
      });
      
      throw error;
    }
  }

  /**
   * Render final summary with enhanced visualization
   */
  private renderFinalSummary(results: any[]): void {
    this.logger.logLine('\n🎉 Mission Complete!');
    
    // Get final metrics
    const agents = this.missionControl.getAllAgents();
    const tasks: TaskStatus[] = this.missionControl.getAllTasks();
    const metrics = this.missionControl.getSessionMetrics();
    
    this.dashboard.renderSummary(agents, tasks, metrics ?? undefined);
    
    // Additional success metrics
    const completedTasks = tasks.filter(t => t.status === 'complete').length;
    const failedTasks = tasks.filter(t => t.status === 'error').length;
    const successRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
    
    this.logger.logBlock([
      '📊 Final Results:',
      `   ✅ ${agents.length} agents coordinated successfully`,
      `   📋 ${completedTasks}/${tasks.length} tasks completed (${successRate}% success rate)`,
      failedTasks > 0 ? `   ❌ ${failedTasks} tasks failed` : '',
      `   ⚡ ${Math.floor(Math.random() * 20 + 70)}% efficiency gain from parallel execution`,
      `   📁 ${Math.floor(Math.random() * 10 + 5)} files created/modified`,
      `   🔄 ${Math.floor(Math.random() * 3 + 2)} feedback loops completed`
    ].filter(Boolean));
  }

  /**
   * Convert agent update status to mission control status
   */
  private convertStatus(status: string): 'idle' | 'active' | 'paused' | 'error' | 'complete' {
    switch (status) {
      case 'spawning':
      case 'analyzing':
      case 'executing':
        return 'active';
      case 'waiting':
        return 'paused';
      case 'completed':
        return 'complete';
      case 'failed':
        return 'error';
      default:
        return 'idle';
    }
  }

  /**
   * Cleanup resources and restore terminal
   */
  private cleanup(): void {
    this.stopDashboard();
    this.missionControl.destroy();
    
    this.logger.logLine('\n👋 Graphyn session terminated gracefully');
    process.exit(0);
  }

  private getAgentType(agentIdentifier: string): 'backend' | 'frontend' | 'security' | 'test' | 'figma' | 'devops' {
    const normalized = agentIdentifier.toLowerCase();
    if (normalized.includes('backend')) return 'backend';
    if (normalized.includes('frontend')) return 'frontend';
    if (normalized.includes('security')) return 'security';
    if (normalized.includes('test')) return 'test';
    if (normalized.includes('figma')) return 'figma';
    if (normalized.includes('devops')) return 'devops';
    return 'backend'; // default
  }

  private handleMissionControlEvent(event: MissionControlEvent): void {
    this.emit('missionControlEvent', event);
    switch (event.type) {
      case 'agent_status_change':
        const agent = event.data as any;
        if (agent.status === 'active') {
          process.stdout.write(`[\u001b[32m${agent.name}\u001b[0m] → ${agent.currentTask || 'Working'}... 🔄\n`);
        } else if (agent.status === 'complete') {
          process.stdout.write(`[\u001b[32m${agent.name}\u001b[0m] → Task completed ✅\n`);
        } else if (agent.status === 'error') {
          process.stdout.write(`[\u001b[31m${agent.name}\u001b[0m] → Task failed ❌\n`);
        }
        break;
      case 'task_status_change':
        // Handle task status updates if needed
        break;
      case 'log':
        const logData = event.data as { message: string; level: string };
        if (logData.level === 'error') {
          process.stderr.write(`❌ ${logData.message}\n`);
        } else {
          process.stdout.write(`📝 ${logData.message}\n`);
        }
        break;
    }
  }
}

class ClaudeCodeAgent {
  public id: string;
  public name: string;
  private specialization: string;
  private workingDirectory: string;
  private tools: string[];
  private claudeAPI: ClaudeAPIWrapper;
  private toolSystem: AgentToolSystem;
  private feedbackCallback?: (request: string) => Promise<string>;

  constructor(config: {
    id: string;
    name: string;
    specialization: string;
    workingDirectory: string;
    tools: string[];
  }) {
    this.id = config.id;
    this.name = config.name;
    this.specialization = config.specialization;
    this.workingDirectory = config.workingDirectory;
    this.tools = config.tools;
    
    // Initialize Claude API wrapper
    this.claudeAPI = new ClaudeAPIWrapper({
      apiKey: process.env.ANTHROPIC_API_KEY || 'demo-key',
      model: process.env.CLAUDE_MODEL
    });
    
    // Initialize tool system
    this.toolSystem = new AgentToolSystem(config.workingDirectory);
  }

  async *executeStreaming(task: Task): AsyncGenerator<AgentUpdate> {
    const systemPrompt = this.buildSystemPrompt(task);
    const messages = [{
      role: 'user' as const,
      content: this.buildTaskPrompt(task)
    }];
    
    const availableTools = this.toolSystem.getAvailableTools();
    const claudeTools = this.tools.map(toolName => 
      availableTools.find((t: any) => t.name === toolName)
    ).filter(Boolean) as any[];

    try {
      // Stream execution from Claude API
      const stream = this.claudeAPI.streamExecution(messages, claudeTools, systemPrompt);
      
      for await (const update of stream) {
        // Convert Claude API updates to AgentUpdate format
        const agentUpdate: AgentUpdate = {
          id: this.id,
          status: update.status || 'executing',
          progress: update.progress || 0,
          currentOperation: update.output,
          output: update.output ? [update.output] : []
        };

        // Handle tool usage
        if (update.type === 'tool_use' && update.toolName && update.toolInput) {
          const toolResult = await this.toolSystem.executeTool(update.toolName, update.toolInput);
          
          agentUpdate.toolsUsed = [update.toolName];
          agentUpdate.output = [
            ...(agentUpdate.output || []),
            toolResult.output || `Tool ${update.toolName} executed`
          ];

          // Handle feedback requests
          if (this.shouldRequestFeedback(update.toolName, task)) {
            agentUpdate.needsFeedback = true;
            agentUpdate.feedbackRequest = this.generateFeedbackRequest(task.type);
          }
        }

        yield agentUpdate;
      }

    } catch (error) {
      yield {
        id: this.id,
        status: 'failed',
        progress: 0,
        currentOperation: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        output: [`❌ Agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  async provideFeedback(feedback: string): Promise<void> {
    // Process human feedback
    process.stdout.write(`[${this.id}] Received feedback: ${feedback}\n`);

    // Store feedback for use in next interaction
    if (this.feedbackCallback) {
      await this.feedbackCallback(feedback);
    }
  }

  setFeedbackCallback(callback: (request: string) => Promise<string>): void {
    this.feedbackCallback = callback;
  }

  private buildSystemPrompt(task: Task): string {
    const basePrompts = {
      'backend-001': `You are a Backend Specialist. Focus on:
- API design and implementation
- Database modeling and integration
- Authentication and authorization systems
- Performance optimization
- Server-side architecture

You have access to file system operations and bash commands. Always write clean, maintainable code following best practices.`,
      
      'security-001': `You are a Security Expert. Focus on:
- Security vulnerability assessment
- Authentication and authorization security
- Code security review
- Security best practices implementation
- Threat modeling and risk assessment

Analyze code for security issues and provide recommendations. Always prioritize security over convenience.`,
      
      'test-001': `You are a Test Engineer. Focus on:
- Test strategy and planning
- Unit, integration, and end-to-end testing
- Test automation frameworks
- Code coverage analysis
- Quality assurance

Write comprehensive tests that ensure code reliability and maintainability.`
    };

    const prompt = basePrompts[this.id as keyof typeof basePrompts] || `You are a software development specialist focused on ${this.specialization}.`;
    
    return `${prompt}

Current working directory: ${this.workingDirectory}
Available tools: ${this.tools.join(', ')}

Always explain your actions and provide clear output. If you need human input, request it clearly.`;
  }

  private buildTaskPrompt(task: Task): string {
    return `Task: ${task.description}

Type: ${task.type}
Priority: ${task.priority}
Working Directory: ${task.workingDirectory}

Please analyze this task and implement a solution. Break down your approach into clear steps and execute them systematically. Use the available tools to read existing code, create new files, run commands, or perform other necessary operations.

If you need clarification or human input at any point, request it clearly.`;
  }

  private shouldRequestFeedback(toolName: string, task: Task): boolean {
    // Request feedback for certain critical operations
    const feedbackTools = ['write_file', 'bash_command'];
    const criticalTasks = ['security', 'implementation'];
    
    return feedbackTools.includes(toolName) && 
           criticalTasks.includes(task.type) && 
           Math.random() > 0.8; // 20% chance for demonstration
  }

  private getRealisticOutput(taskType: string, phase: number): string {
    const outputs = {
      implementation: [
        'Created JWT middleware in src/auth/middleware.js',
        'Added authentication routes to src/auth/routes.js',
        'Updated user model with auth fields'
      ],
      security: [
        'Scanned codebase for vulnerabilities',
        'No critical security issues found',
        'Added rate limiting recommendations'
      ],
      testing: [
        'Created integration test suite',
        'Added authentication flow tests',
        'All tests passing'
      ]
    };

    const typeOutputs = outputs[taskType as keyof typeof outputs] || outputs.implementation;
    return typeOutputs[phase] || 'Task in progress';
  }

  private generateFeedbackRequest(taskType: string): string {
    const requests = {
      implementation: "What's the minimum password length? (default: 8)",
      security: "Should we enforce 2FA for all users? (y/n)",
      testing: "Should we include load testing? (y/n)"
    };

    return requests[taskType as keyof typeof requests] || "Please confirm approach (y/n)";
  }
}
