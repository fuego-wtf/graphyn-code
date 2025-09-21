/**
 * MCP Agent Manager - Manages multiple MCP-integrated agents
 * 
 * Coordinates multiple specialized agents with MCP server,
 * handles agent lifecycle, and provides unified management interface
 */

import { v4 as uuidv4 } from 'uuid';
import { ClaudeCodeAgent } from '../base/ClaudeCodeAgent.js';
import { MCPAgentAdapter, type MCPAgentConfig } from '../adapters/MCPAgentAdapter.js';
import { FigmaAgent } from '../specialized/FigmaAgent.js';
import { DevOpsAgent } from '../specialized/DevOpsAgent.js';

export interface MCPManagerConfig {
  sessionId: string;
  mcpServerUrl?: string;
  workspaceDir?: string;
  enabledAgentTypes?: string[];
  maxConcurrentAgents?: number;
}

export interface AgentInfo {
  id: string;
  type: string;
  status: string;
  isRunning: boolean;
  currentTask: string | null;
  adapter: MCPAgentAdapter;
}

/**
 * MCP Agent Manager - Central coordination for MCP-enabled agents
 */
export class MCPAgentManager {
  private config: MCPManagerConfig;
  private agents: Map<string, MCPAgentAdapter> = new Map();
  private isStarted = false;

  constructor(config: MCPManagerConfig) {
    this.config = {
      ...config,
      enabledAgentTypes: config.enabledAgentTypes || ['figma', 'devops'],
      maxConcurrentAgents: config.maxConcurrentAgents || 4,
      mcpServerUrl: config.mcpServerUrl || process.env.MCP_SERVER_URL
    };
  }

  /**
   * Initialize and start all configured agents
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    this.log('info', 'Starting MCP Agent Manager...');

    try {
      // Create and start agents based on configuration
      for (const agentType of this.config.enabledAgentTypes!) {
        await this.createAgent(agentType);
      }

      // Start all agents
      const startPromises = Array.from(this.agents.values()).map(adapter => 
        adapter.start()
      );
      
      await Promise.all(startPromises);

      this.isStarted = true;
      this.log('info', `MCP Agent Manager started with ${this.agents.size} agents`);

    } catch (error) {
      this.log('error', `Failed to start MCP Agent Manager: ${error}`);
      throw error;
    }
  }

  /**
   * Stop all agents and clean up resources
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    this.log('info', 'Stopping MCP Agent Manager...');

    // Stop all agents
    const stopPromises = Array.from(this.agents.values()).map(adapter =>
      adapter.stop()
    );

    await Promise.all(stopPromises);

    this.agents.clear();
    this.isStarted = false;

    this.log('info', 'MCP Agent Manager stopped');
  }

  /**
   * Create a new agent of specified type
   */
  async createAgent(agentType: string, customConfig?: Partial<MCPAgentConfig>): Promise<string> {
    const agentId = customConfig?.id || `${agentType}-${uuidv4().substring(0, 8)}`;
    
    this.log('info', `Creating ${agentType} agent: ${agentId}`);

    try {
      // Create the base agent based on type
      let baseAgent: ClaudeCodeAgent;
      
      switch (agentType.toLowerCase()) {
        case 'figma':
          baseAgent = new FigmaAgent(agentId, this.config.workspaceDir || process.cwd());
          break;
        
        case 'devops':
          baseAgent = new DevOpsAgent(agentId, this.config.workspaceDir || process.cwd());
          break;
          
        default:
          throw new Error(`Unsupported agent type: ${agentType}`);
      }

      // Create MCP adapter configuration
      const adapterConfig: MCPAgentConfig = {
        id: agentId,
        type: agentType,
        specialization: agentType,
        capabilities: baseAgent.config.capabilities,
        sessionId: this.config.sessionId,
        mcpServerUrl: this.config.mcpServerUrl,
        workspaceDir: this.config.workspaceDir,
        tools: baseAgent.config.tools,
        ...customConfig
      };

      // Create MCP adapter
      const adapter = new MCPAgentAdapter(baseAgent, adapterConfig);
      
      // Store adapter
      this.agents.set(agentId, adapter);

      // If manager is already started, start this agent immediately
      if (this.isStarted) {
        await adapter.start();
      }

      this.log('info', `Created ${agentType} agent: ${agentId}`);
      return agentId;

    } catch (error) {
      this.log('error', `Failed to create ${agentType} agent: ${error}`);
      throw error;
    }
  }

  /**
   * Remove an agent
   */
  async removeAgent(agentId: string): Promise<void> {
    const adapter = this.agents.get(agentId);
    if (!adapter) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    this.log('info', `Removing agent: ${agentId}`);

    try {
      await adapter.stop();
      this.agents.delete(agentId);
      
      this.log('info', `Agent removed: ${agentId}`);
    } catch (error) {
      this.log('error', `Failed to remove agent ${agentId}: ${error}`);
      throw error;
    }
  }

  /**
   * Get agent information
   */
  getAgent(agentId: string): AgentInfo | null {
    const adapter = this.agents.get(agentId);
    if (!adapter) {
      return null;
    }

    const status = adapter.getStatus();
    return {
      id: status.agentId,
      type: status.type,
      status: status.status,
      isRunning: status.isRunning,
      currentTask: status.currentTask,
      adapter: adapter
    };
  }

  /**
   * Get all agents information
   */
  getAllAgents(): AgentInfo[] {
    return Array.from(this.agents.values()).map(adapter => {
      const status = adapter.getStatus();
      return {
        id: status.agentId,
        type: status.type,
        status: status.status,
        isRunning: status.isRunning,
        currentTask: status.currentTask,
        adapter: adapter
      };
    });
  }

  /**
   * Get agents by type
   */
  getAgentsByType(agentType: string): AgentInfo[] {
    return this.getAllAgents().filter(agent => agent.type === agentType);
  }

  /**
   * Get available (idle) agents
   */
  getAvailableAgents(): AgentInfo[] {
    return this.getAllAgents().filter(agent => agent.status === 'idle');
  }

  /**
   * Get busy agents
   */
  getBusyAgents(): AgentInfo[] {
    return this.getAllAgents().filter(agent => agent.status === 'busy');
  }

  /**
   * Get manager status
   */
  getStatus(): {
    isStarted: boolean;
    sessionId: string;
    totalAgents: number;
    agentsByType: Record<string, number>;
    agentsByStatus: Record<string, number>;
    configuration: MCPManagerConfig;
  } {
    const agents = this.getAllAgents();
    
    const agentsByType = agents.reduce((acc, agent) => {
      acc[agent.type] = (acc[agent.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const agentsByStatus = agents.reduce((acc, agent) => {
      acc[agent.status] = (acc[agent.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      isStarted: this.isStarted,
      sessionId: this.config.sessionId,
      totalAgents: this.agents.size,
      agentsByType,
      agentsByStatus,
      configuration: this.config
    };
  }

  /**
   * Scale agents - add or remove agents to reach target count
   */
  async scaleAgents(agentType: string, targetCount: number): Promise<void> {
    const currentAgents = this.getAgentsByType(agentType);
    const currentCount = currentAgents.length;

    if (targetCount === currentCount) {
      return; // Already at target
    }

    if (targetCount > currentCount) {
      // Scale up
      const toAdd = targetCount - currentCount;
      this.log('info', `Scaling up ${agentType} agents: adding ${toAdd}`);
      
      const createPromises = [];
      for (let i = 0; i < toAdd; i++) {
        createPromises.push(this.createAgent(agentType));
      }
      
      await Promise.all(createPromises);
      
    } else {
      // Scale down
      const toRemove = currentCount - targetCount;
      this.log('info', `Scaling down ${agentType} agents: removing ${toRemove}`);
      
      // Remove idle agents first, then busy ones if necessary
      const idleAgents = currentAgents.filter(agent => agent.status === 'idle');
      const agentsToRemove = idleAgents.slice(0, toRemove);
      
      if (agentsToRemove.length < toRemove) {
        const busyAgents = currentAgents.filter(agent => agent.status === 'busy');
        const additionalToRemove = toRemove - agentsToRemove.length;
        agentsToRemove.push(...busyAgents.slice(0, additionalToRemove));
      }

      const removePromises = agentsToRemove.map(agent => this.removeAgent(agent.id));
      await Promise.all(removePromises);
    }

    this.log('info', `Scaled ${agentType} agents to ${targetCount}`);
  }

  /**
   * Health check for all agents
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    agentHealth: Record<string, { healthy: boolean; issues: string[] }>;
  }> {
    const issues: string[] = [];
    const agentHealth: Record<string, { healthy: boolean; issues: string[] }> = {};

    if (!this.isStarted) {
      issues.push('Manager not started');
    }

    if (this.agents.size === 0) {
      issues.push('No agents registered');
    }

    // Check each agent
    for (const [agentId, adapter] of this.agents.entries()) {
      const agentIssues: string[] = [];
      const status = adapter.getStatus();

      if (status.status === 'error') {
        agentIssues.push('Agent in error state');
      }

      if (!status.isRunning && this.isStarted) {
        agentIssues.push('Agent not running but manager is started');
      }

      if (!status.mcpConnected && status.isRunning) {
        agentIssues.push('Agent running but not connected to MCP');
      }

      agentHealth[agentId] = {
        healthy: agentIssues.length === 0,
        issues: agentIssues
      };

      if (agentIssues.length > 0) {
        issues.push(`Agent ${agentId}: ${agentIssues.join(', ')}`);
      }
    }

    return {
      healthy: issues.length === 0,
      issues,
      agentHealth
    };
  }

  /**
   * Structured logging
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [MCPManager:${this.config.sessionId}]`;
    
    const logMessage = data ? `${message} ${JSON.stringify(data)}` : message;
    
    switch (level) {
      case 'debug':
        console.debug(`${prefix} ${logMessage}`);
        break;
      case 'info':
        console.log(`${prefix} ${logMessage}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${logMessage}`);
        break;
      case 'error':
        console.error(`${prefix} ${logMessage}`);
        break;
    }
  }
}