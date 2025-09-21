import { AgentConfigurationSystem } from './AgentConfigurationSystem.js';
import { ClaudeCodeMCPIntegration } from './ClaudeCodeMCPIntegration.js';
import { SpecializedAgentFactory } from '../agents/SpecializedAgentFactory.js';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AgentProcess {
  id: string;
  type: string;
  pid: number;
  status: 'initializing' | 'running' | 'waiting' | 'completed' | 'failed' | 'terminated';
  startTime: Date;
  endTime?: Date;
  task?: string;
  progress?: number;
  dependencies?: string[];
  integration: ClaudeCodeMCPIntegration;
}

export interface OrchestratorOptions {
  configPath?: string;
  templatePath?: string;
  workingDirectory?: string;
  verbose?: boolean;
  debug?: boolean;
}

export interface WorkflowExecutionPlan {
  workflowName: string;
  steps: WorkflowStep[];
  totalEstimatedTime: number;
}

export interface WorkflowStep {
  id: string;
  description: string;
  agentType: string;
  dependencies: string[];
  estimatedDuration: number;
  status: 'pending' | 'ready' | 'running' | 'completed' | 'failed';
}

/**
 * GraphynOrchestrator - Main orchestration engine for multi-agent workflows
 * 
 * Manages the lifecycle of specialized Claude Code sub-agents, coordinates
 * task execution via MCP protocol, and provides real-time monitoring.
 */
export class GraphynOrchestrator extends EventEmitter {
  private agentConfig: AgentConfigurationSystem;
  private agentFactory: SpecializedAgentFactory;
  private activeAgents: Map<string, AgentProcess> = new Map();
  private workflowExecutions: Map<string, WorkflowExecutionPlan> = new Map();
  private options: OrchestratorOptions;

  constructor(options: OrchestratorOptions = {}) {
    super();
    this.options = {
      configPath: options.configPath || path.join(__dirname, '../../config/agent-specializations.json'),
      templatePath: options.templatePath || path.join(__dirname, '../../templates'),
      workingDirectory: options.workingDirectory || process.cwd(),
      verbose: options.verbose || false,
      debug: options.debug || false,
      ...options
    };

    this.agentConfig = new AgentConfigurationSystem();
    this.agentFactory = new SpecializedAgentFactory();
  }

  /**
   * Initialize the orchestrator with agent configurations
   */
  async initialize(): Promise<void> {
    try {
      await this.agentConfig.loadConfiguration(
        this.options.configPath!,
        this.options.templatePath!
      );

      await this.agentFactory.initialize(this.agentConfig);

      this.emit('initialized', {
        agents: this.agentConfig.getAvailableAgentTypes(),
        workflows: this.agentConfig.getAvailableWorkflows()
      });

      if (this.options.verbose) {
        console.log('🚀 GraphynOrchestrator initialized successfully');
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Execute a workflow with multiple coordinated agents
   */
  async executeWorkflow(workflowName: string, context?: any): Promise<WorkflowExecutionPlan> {
    if (!this.agentConfig.isConfigurationLoaded()) {
      throw new Error('Orchestrator not initialized. Call initialize() first.');
    }

    const workflow = this.agentConfig.getWorkflow(workflowName);
    if (!workflow) {
      throw new Error(`Workflow '${workflowName}' not found`);
    }

    if (this.options.verbose) {
      console.log(`🔄 Executing workflow: ${workflowName}`);
      console.log(`📝 Description: ${workflow.description}`);
      console.log(`👥 Agents: ${workflow.agents.join(' → ')}`);
    }

    // Create execution plan
    const executionPlan: WorkflowExecutionPlan = {
      workflowName,
      steps: workflow.steps.map(step => ({
        id: `${step.agent}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        description: step.description,
        agentType: step.agent,
        dependencies: step.dependencies || [],
        estimatedDuration: step.estimatedDuration || 300, // 5 minutes default
        status: 'pending'
      })),
      totalEstimatedTime: workflow.steps.reduce((total, step) => total + (step.estimatedDuration || 300), 0)
    };

    this.workflowExecutions.set(workflowName, executionPlan);

    this.emit('workflowStarted', executionPlan);

    try {
      // Execute steps in dependency order
      await this.executeWorkflowSteps(executionPlan, context);
      
      this.emit('workflowCompleted', executionPlan);
      return executionPlan;
    } catch (error) {
      this.emit('workflowFailed', { executionPlan, error });
      throw error;
    }
  }

  /**
   * Launch a single specialized agent
   */
  async launchAgent(agentType: string, task?: string, context?: any): Promise<AgentProcess> {
    if (!this.agentConfig.isConfigurationLoaded()) {
      throw new Error('Orchestrator not initialized. Call initialize() first.');
    }

    const agentSpec = this.agentConfig.getAgentSpecialization(agentType);
    if (!agentSpec) {
      throw new Error(`Agent type '${agentType}' not found`);
    }

    const agentId = `${agentType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (this.options.verbose) {
      console.log(`🤖 Launching ${agentType} agent (${agentId})...`);
      if (task) {
        console.log(`📋 Task: ${task}`);
      }
    }

    try {
      // Create Claude Code MCP integration for this agent
      const integration = await this.agentFactory.createAgent(agentType, {
        agentId,
        task,
        context,
        workingDirectory: this.options.workingDirectory!,
        verbose: this.options.verbose,
        debug: this.options.debug
      });

      const agentProcess: AgentProcess = {
        id: agentId,
        type: agentType,
        pid: integration.getProcessId(),
        status: 'initializing',
        startTime: new Date(),
        task,
        progress: 0,
        integration
      };

      this.activeAgents.set(agentId, agentProcess);

      // Set up event listeners for the agent
      this.setupAgentEventListeners(agentProcess);

      // Start the agent
      await integration.start();
      
      agentProcess.status = 'running';
      this.emit('agentLaunched', agentProcess);

      return agentProcess;
    } catch (error) {
      this.emit('agentLaunchFailed', { agentType, agentId, error });
      throw error;
    }
  }

  /**
   * Terminate a specific agent
   */
  async terminateAgent(agentId: string, reason = 'User requested'): Promise<void> {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (this.options.verbose) {
      console.log(`🛑 Terminating agent ${agentId} (${reason})`);
    }

    try {
      await agent.integration.stop();
      agent.status = 'terminated';
      agent.endTime = new Date();
      
      this.activeAgents.delete(agentId);
      this.emit('agentTerminated', { agent, reason });
    } catch (error) {
      this.emit('agentTerminationFailed', { agent, error });
      throw error;
    }
  }

  /**
   * Terminate all active agents
   */
  async terminateAllAgents(reason = 'Orchestrator shutdown'): Promise<void> {
    if (this.options.verbose) {
      console.log(`🛑 Terminating all ${this.activeAgents.size} agents...`);
    }

    const terminations = Array.from(this.activeAgents.keys()).map(agentId =>
      this.terminateAgent(agentId, reason)
    );

    await Promise.allSettled(terminations);
    this.activeAgents.clear();
  }

  /**
   * Get status of all active agents
   */
  getAgentStatus(): AgentProcess[] {
    return Array.from(this.activeAgents.values());
  }

  /**
   * Get workflow execution status
   */
  getWorkflowStatus(workflowName: string): WorkflowExecutionPlan | undefined {
    return this.workflowExecutions.get(workflowName);
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    activeAgents: number;
    mcpConnections: number;
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
  }> {
    const activeAgents = this.activeAgents.size;
    const mcpConnections = Array.from(this.activeAgents.values())
      .filter(agent => agent.integration.isConnected()).length;

    return {
      status: activeAgents === mcpConnections ? 'healthy' : 'degraded',
      activeAgents,
      mcpConnections,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  /**
   * Execute workflow steps in dependency order
   */
  private async executeWorkflowSteps(executionPlan: WorkflowExecutionPlan, context?: any): Promise<void> {
    const completedSteps = new Set<string>();
    
    while (completedSteps.size < executionPlan.steps.length) {
      // Find steps that are ready to execute (dependencies satisfied)
      const readySteps = executionPlan.steps.filter(step => 
        step.status === 'pending' && 
        step.dependencies.every(dep => completedSteps.has(dep))
      );

      if (readySteps.length === 0) {
        // Check if there are any running steps
        const runningSteps = executionPlan.steps.filter(step => step.status === 'running');
        if (runningSteps.length === 0) {
          // No ready steps and nothing running - possible circular dependency
          const pendingSteps = executionPlan.steps.filter(step => step.status === 'pending');
          if (pendingSteps.length > 0) {
            throw new Error('Workflow execution deadlock: circular dependencies detected');
          }
        }
        // Wait for running steps to complete
        await this.waitForAnyStepCompletion(executionPlan);
        continue;
      }

      // Launch ready steps
      await Promise.all(readySteps.map(async step => {
        step.status = 'ready';
        
        try {
          const agent = await this.launchAgent(step.agentType, step.description, {
            ...context,
            workflowStep: step
          });

          step.status = 'running';
          
          // Wait for this step to complete
          await this.waitForStepCompletion(step, agent);
          
          step.status = 'completed';
          completedSteps.add(step.id);
          
        } catch (error) {
          step.status = 'failed';
          throw new Error(`Workflow step failed: ${step.description} (${error})`);
        }
      }));
    }
  }

  /**
   * Wait for a specific step to complete
   */
  private async waitForStepCompletion(step: WorkflowStep, agent: AgentProcess): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        if (agent.status === 'completed') {
          resolve();
        } else if (agent.status === 'failed' || agent.status === 'terminated') {
          reject(new Error(`Agent failed or was terminated: ${agent.id}`));
        } else {
          // Continue waiting
          setTimeout(checkStatus, 1000); // Check every second
        }
      };
      
      checkStatus();
    });
  }

  /**
   * Wait for any step to complete (used in workflow coordination)
   */
  private async waitForAnyStepCompletion(executionPlan: WorkflowExecutionPlan): Promise<void> {
    return new Promise((resolve) => {
      const runningSteps = executionPlan.steps.filter(step => step.status === 'running');
      if (runningSteps.length === 0) {
        resolve();
        return;
      }

      const checkCompletion = () => {
        const stillRunning = executionPlan.steps.some(step => step.status === 'running');
        if (!stillRunning) {
          resolve();
        } else {
          setTimeout(checkCompletion, 1000);
        }
      };

      setTimeout(checkCompletion, 1000);
    });
  }

  /**
   * Set up event listeners for an agent process
   */
  private setupAgentEventListeners(agent: AgentProcess): void {
    agent.integration.on('message', (message) => {
      this.emit('agentMessage', { agent, message });
      
      if (this.options.debug) {
        console.log(`📧 Agent ${agent.id}: ${JSON.stringify(message)}`);
      }
    });

    agent.integration.on('progress', (progress: number) => {
      agent.progress = progress;
      this.emit('agentProgress', { agent, progress });
      
      if (this.options.verbose) {
        console.log(`📊 Agent ${agent.id}: ${progress}% complete`);
      }
    });

    agent.integration.on('completed', () => {
      agent.status = 'completed';
      agent.endTime = new Date();
      this.emit('agentCompleted', agent);
      
      if (this.options.verbose) {
        const duration = agent.endTime.getTime() - agent.startTime.getTime();
        console.log(`✅ Agent ${agent.id} completed in ${duration}ms`);
      }
    });

    agent.integration.on('failed', (error) => {
      agent.status = 'failed';
      agent.endTime = new Date();
      this.emit('agentFailed', { agent, error });
      
      if (this.options.verbose) {
        console.log(`❌ Agent ${agent.id} failed: ${error.message}`);
      }
    });

    agent.integration.on('disconnected', () => {
      this.emit('agentDisconnected', agent);
      
      if (this.options.verbose) {
        console.log(`🔌 Agent ${agent.id} disconnected`);
      }
    });
  }

  /**
   * Graceful shutdown of the orchestrator
   */
  async shutdown(): Promise<void> {
    if (this.options.verbose) {
      console.log('🛑 Shutting down GraphynOrchestrator...');
    }

    await this.terminateAllAgents('Orchestrator shutdown');
    this.workflowExecutions.clear();
    this.removeAllListeners();

    if (this.options.verbose) {
      console.log('✅ GraphynOrchestrator shutdown complete');
    }
  }
}