/**
 * Dynamic Engine - Claude Code + Graphyn APIs integration
 * Handles operations that require cloud connectivity and team collaboration
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { GraphynAPIClient } from '../api/client.js';
import { GraphynMCPBridge } from '../mcp/bridge-implementation.js';
import type { CommandIntent } from '../coordinator/smart-coordinator.js';

export interface RemoteAgent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  capabilities: string[];
  owner: string;
  organization: string;
  created: Date;
  lastModified: Date;
  status: 'active' | 'draft' | 'archived';
}

export interface RemoteThread {
  id: string;
  name: string;
  description?: string;
  type: 'builder' | 'testing' | 'production';
  participants: string[];
  created: Date;
  lastActivity: Date;
}

export class DynamicEngine {
  private apiClient: GraphynAPIClient;
  private mcpBridge: GraphynMCPBridge;
  private isAuthenticated: boolean = false;

  constructor() {
    // Auth disabled for offline mode
    this.apiClient = new GraphynAPIClient();
    this.mcpBridge = new GraphynMCPBridge();
  }

  /**
   * Initialize the dynamic engine
   */
  async initialize(): Promise<void> {
    try {
      // Check authentication status
      this.isAuthenticated = await this.apiClient.isAuthenticated();
      
      if (!this.isAuthenticated) {
        console.log(chalk.yellow('⚠️  Authentication required for dynamic mode'));
        console.log(chalk.gray('Run: clyde auth login'));
        return;
      }
      
      // Initialize MCP bridge
      try {
        await this.mcpBridge.initialize();
        console.log(chalk.green('🌐 MCP bridge initialized'));
      } catch (error) {
        console.log(chalk.yellow('⚠️  MCP bridge initialization failed (continuing without MCP)'));
      }
      
      console.log(chalk.green('🌐 Dynamic engine initialized'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize dynamic engine:'), error);
      throw error;
    }
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    console.log(chalk.gray('🔌 Disconnecting dynamic engine...'));
    // Add any cleanup logic here
  }

  /**
   * Handle agent-related commands in dynamic mode
   */
  async handleAgentCommand(intent: CommandIntent): Promise<void> {
    if (!this.isAuthenticated) {
      console.log(chalk.red('❌ Authentication required'));
      console.log(chalk.gray('Run: clyde auth login'));
      return;
    }

    switch (intent.action) {
      case 'create':
      case 'make':
      case 'build':
        await this.createRemoteAgent(intent.target || '', intent.args);
        break;
        
      case 'list':
        await this.listRemoteAgents();
        break;
        
      case 'run':
        await this.runRemoteAgent(intent.target || '', intent.args);
        break;
        
      case 'test':
        await this.testRemoteAgent(intent.target || '');
        break;
        
      case 'deploy':
        await this.deployAgent(intent.target || '');
        break;
        
      case 'update':
      case 'modify':
        await this.updateRemoteAgent(intent.target || '', intent.args);
        break;
        
      case 'delete':
      case 'remove':
        await this.deleteRemoteAgent(intent.target || '');
        break;
        
      default:
        // Natural language agent creation
        await this.createRemoteAgent(intent.target || intent.action, intent.args);
    }
  }

  /**
   * Handle sync commands in dynamic mode
   */
  async handleSyncCommand(intent: CommandIntent): Promise<void> {
    if (!this.isAuthenticated) {
      console.log(chalk.red('❌ Authentication required for sync operations'));
      return;
    }

    switch (intent.action) {
      case 'status':
        await this.showSyncStatus();
        break;
        
      case 'push':
        await this.pushLocalAgents();
        break;
        
      case 'pull':
        await this.pullRemoteAgents(intent.target);
        break;
        
      case 'clone':
        await this.cloneAgentRepository(intent.target || '');
        break;
        
      case 'fork':
        await this.forkAgentRepository(intent.target || '');
        break;
        
      default:
        console.log(chalk.red(`Unknown sync action: ${intent.action}`));
    }
  }

  /**
   * Handle thread commands in dynamic mode
   */
  async handleThreadCommand(intent: CommandIntent): Promise<void> {
    if (!this.isAuthenticated) {
      console.log(chalk.red('❌ Authentication required for thread operations'));
      return;
    }

    switch (intent.action) {
      case 'list':
        await this.listRemoteThreads();
        break;
        
      case 'create':
        await this.createRemoteThread(intent.target || 'New Thread', intent.args);
        break;
        
      case 'start':
      case 'chat':
        await this.startRemoteThread(intent.target || '');
        break;
        
      case 'invite':
        await this.inviteToThread(intent.target || '', intent.args);
        break;
        
      case 'leave':
        await this.leaveThread(intent.target || '');
        break;
        
      default:
        console.log(chalk.red(`Unknown thread action: ${intent.action}`));
    }
  }

  // Agent Management

  /**
   * Create a new remote agent
   */
  private async createRemoteAgent(description: string, additionalArgs: string[]): Promise<void> {
    if (!description.trim()) {
      console.log(chalk.red('❌ Please provide an agent description'));
      return;
    }

    console.log(chalk.cyan('🤖 Creating remote agent...'));
    console.log(chalk.gray(`Description: ${description}`));

    try {
      // Use MCP bridge to create agent through Claude Code
      const agentPrompt = this.buildRemoteAgentCreationPrompt(description, additionalArgs);
      
      // Launch Claude Code with MCP context
      await this.launchClaudeCodeWithMCP(agentPrompt, {
        action: 'create_agent',
        description,
        additionalArgs
      });
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to create remote agent:'), error);
    }
  }

  /**
   * List remote agents
   */
  private async listRemoteAgents(): Promise<void> {
    try {
      console.log(chalk.cyan('🔍 Fetching remote agents...'));
      
      const agents = await this.apiClient.listAgents();
      
      if (agents.length === 0) {
        console.log(chalk.gray('📝 No remote agents found'));
        console.log(chalk.gray('Create your first agent: clyde create "describe your agent"'));
        return;
      }
      
      console.log(chalk.blue('🤖 Remote Agents:'));
      
      for (const agent of agents) {
        const status = agent.status === 'active' ? '🟢' : 
                      agent.status === 'draft' ? '🟡' : '⚫';
        const lastModified = this.formatRelativeTime(new Date(agent.lastModified));
        
        console.log(`  ${status} ${agent.name} - ${agent.description} ${chalk.gray(`(${lastModified})`)}`);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to list remote agents:'), error);
    }
  }

  /**
   * Run a remote agent
   */
  private async runRemoteAgent(agentName: string, args: string[]): Promise<void> {
    if (!agentName) {
      console.log(chalk.red('❌ Please specify an agent name'));
      await this.listRemoteAgents();
      return;
    }

    try {
      console.log(chalk.cyan(`🚀 Running remote agent: ${agentName}`));
      
      // Find the agent
      const agents = await this.apiClient.listAgents();
      const agent = agents.find(a => 
        a.name.toLowerCase().includes(agentName.toLowerCase())
      );
      
      if (!agent) {
        console.log(chalk.red(`❌ Agent "${agentName}" not found`));
        await this.listRemoteAgents();
        return;
      }
      
      // Create thread and add agent
      const thread = await this.apiClient.createThread({
        name: `Running ${agent.name}`,
        type: 'testing',
        participants: [agent.id]
      });
      
      // Launch Claude Code with agent context and thread
      const runPrompt = this.buildRemoteAgentRunPrompt(agent, args, thread.id);
      await this.launchClaudeCodeWithMCP(runPrompt, {
        action: 'run_agent',
        agentId: agent.id,
        threadId: thread.id
      });
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to run remote agent:'), error);
    }
  }

  /**
   * Deploy an agent to production
   */
  private async deployAgent(agentName: string): Promise<void> {
    if (!agentName) {
      console.log(chalk.red('❌ Please specify an agent name'));
      return;
    }

    try {
      console.log(chalk.cyan(`🚀 Deploying agent: ${agentName}`));
      
      const agents = await this.apiClient.listAgents();
      const agent = agents.find(a => 
        a.name.toLowerCase().includes(agentName.toLowerCase())
      );
      
      if (!agent) {
        console.log(chalk.red(`❌ Agent "${agentName}" not found`));
        return;
      }
      
      // Update agent status to active
      await this.apiClient.updateAgent(agent.id, { status: 'active' });
      
      console.log(chalk.green(`✅ Agent "${agent.name}" deployed to production`));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to deploy agent:'), error);
    }
  }

  // Sync Operations

  /**
   * Show sync status
   */
  private async showSyncStatus(): Promise<void> {
    try {
      console.log(chalk.blue('📦 Dynamic Sync Status:'));
      console.log(chalk.gray('Mode: Dynamic (cloud + local)'));
      
      // Local agents
      const localAgents = this.getLocalAgents();
      console.log(chalk.gray(`Local agents: ${localAgents.length}`));
      
      // Remote agents
      const remoteAgents = await this.apiClient.listAgents();
      console.log(chalk.gray(`Remote agents: ${remoteAgents.length}`));
      
      // Check for unsynchronized changes
      const unsynced = await this.findUnsyncedAgents();
      if (unsynced.length > 0) {
        console.log(chalk.yellow(`\n⚠️  ${unsynced.length} agents with local changes`));
        unsynced.forEach(agent => {
          console.log(chalk.yellow(`  • ${agent}`));
        });
        console.log(chalk.gray('Run: clyde sync push'));
      } else {
        console.log(chalk.green('\n✅ All agents synchronized'));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to get sync status:'), error);
    }
  }

  /**
   * Push local agents to cloud
   */
  private async pushLocalAgents(): Promise<void> {
    try {
      const localAgents = this.getLocalAgents();
      
      if (localAgents.length === 0) {
        console.log(chalk.gray('📝 No local agents to push'));
        return;
      }
      
      console.log(chalk.cyan(`📤 Pushing ${localAgents.length} local agents...`));
      
      for (const agentFile of localAgents) {
        try {
          const agentConfig = this.loadLocalAgent(agentFile);
          
          // Check if agent exists remotely
          const remoteAgents = await this.apiClient.listAgents();
          const existingAgent = remoteAgents.find(a => a.name === agentConfig.name);
          
          if (existingAgent) {
            // Update existing
            await this.apiClient.updateAgent(existingAgent.id, {
              description: agentConfig.description,
              instructions: agentConfig.instructions,
              capabilities: agentConfig.capabilities
            });
            console.log(chalk.green(`  ✅ Updated ${agentConfig.name}`));
          } else {
            // Create new
            await this.apiClient.createAgent({
              name: agentConfig.name,
              description: agentConfig.description,
              instructions: agentConfig.instructions,
              capabilities: agentConfig.capabilities
            });
            console.log(chalk.green(`  ✅ Created ${agentConfig.name}`));
          }
          
        } catch (error) {
          console.log(chalk.red(`  ❌ Failed to push ${agentFile}: ${error}`));
        }
      }
      
      console.log(chalk.green('📤 Push complete'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to push agents:'), error);
    }
  }

  /**
   * Pull remote agents to local
   */
  private async pullRemoteAgents(filter?: string): Promise<void> {
    try {
      console.log(chalk.cyan('📥 Pulling remote agents...'));
      
      const remoteAgents = await this.apiClient.listAgents();
      let agentsToPull = remoteAgents;
      
      if (filter) {
        agentsToPull = remoteAgents.filter(agent =>
          agent.name.toLowerCase().includes(filter.toLowerCase()) ||
          agent.description.toLowerCase().includes(filter.toLowerCase())
        );
      }
      
      if (agentsToPull.length === 0) {
        console.log(chalk.gray('📝 No agents to pull'));
        return;
      }
      
      const agentsDir = path.join(process.cwd(), '.claude', 'agents');
      if (!fs.existsSync(agentsDir)) {
        fs.mkdirSync(agentsDir, { recursive: true });
      }
      
      for (const agent of agentsToPull) {
        try {
          const localConfig = {
            name: agent.name,
            description: agent.description,
            instructions: agent.instructions,
            capabilities: agent.capabilities,
            created: agent.created,
            lastUsed: agent.lastModified,
            remoteId: agent.id,
            lastSync: new Date()
          };
          
          const fileName = `${agent.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`;
          const filePath = path.join(agentsDir, fileName);
          
          fs.writeFileSync(filePath, JSON.stringify(localConfig, null, 2));
          console.log(chalk.green(`  ✅ Pulled ${agent.name}`));
          
        } catch (error) {
          console.log(chalk.red(`  ❌ Failed to pull ${agent.name}: ${error}`));
        }
      }
      
      console.log(chalk.green('📥 Pull complete'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to pull agents:'), error);
    }
  }

  // Thread Management

  /**
   * List remote threads
   */
  private async listRemoteThreads(): Promise<void> {
    try {
      console.log(chalk.cyan('🔍 Fetching remote threads...'));
      
      const threads = await this.apiClient.listThreads();
      
      if (threads.length === 0) {
        console.log(chalk.gray('📝 No remote threads found'));
        console.log(chalk.gray('Create your first thread: clyde thread create "My Thread"'));
        return;
      }
      
      console.log(chalk.blue('💬 Remote Threads:'));
      
      for (const thread of threads) {
        const typeIcon = thread.type === 'builder' ? '🏗️' : 
                        thread.type === 'testing' ? '🧪' : '🚀';
        const lastActivity = this.formatRelativeTime(new Date(thread.lastActivity));
        
        console.log(`  ${typeIcon} ${thread.name} (${thread.participants.length} participants) ${chalk.gray(`- ${lastActivity}`)}`);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to list remote threads:'), error);
    }
  }

  /**
   * Create a remote thread
   */
  private async createRemoteThread(name: string, args: string[]): Promise<void> {
    try {
      console.log(chalk.cyan(`💬 Creating remote thread: ${name}`));
      
      const threadType = args.includes('--production') ? 'production' :
                        args.includes('--testing') ? 'testing' : 'builder';
      
      const thread = await this.apiClient.createThread({
        name,
        type: threadType,
        participants: []
      });
      
      console.log(chalk.green(`✅ Created thread: ${thread.name} (${thread.id})`));
      
      // Launch Claude Code with thread context
      const threadPrompt = this.buildRemoteThreadPrompt(thread);
      await this.launchClaudeCodeWithMCP(threadPrompt, {
        action: 'start_thread',
        threadId: thread.id
      });
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to create remote thread:'), error);
    }
  }

  // Helper Methods

  /**
   * Launch Claude Code with MCP context
   */
  private async launchClaudeCodeWithMCP(content: string, mcpContext?: any): Promise<void> {
    try {
      console.log(chalk.cyan('🚀 Launching Claude Code with Graphyn context...'));
      
      // Enhanced content with MCP context
      const enhancedContent = `${content}

# Graphyn MCP Integration Active
You have access to Graphyn platform tools via MCP:
- create_thread, send_message, list_threads
- spawn_agent, configure_squad
- analyze_repository

Current context: ${JSON.stringify(mcpContext, null, 2)}
`;
      
      // Launch Claude Code with direct content
      const child = spawn('claude', [enhancedContent], {
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          GRAPHYN_MCP_ENABLED: 'true'
        }
      });
      
      return new Promise((resolve, reject) => {
        child.on('close', (code) => {
          if (code === 0) {
            console.log(chalk.green('✅ Claude Code session completed'));
            resolve();
          } else {
            reject(new Error(`Claude Code exited with code ${code}`));
          }
        });
        
        child.on('error', reject);
      });
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to launch Claude Code with MCP:'), error);
    }
  }

  /**
   * Get local agent files
   */
  private getLocalAgents(): string[] {
    const agentsDir = path.join(process.cwd(), '.claude', 'agents');
    try {
      return fs.readdirSync(agentsDir).filter(file => file.endsWith('.json'));
    } catch (error) {
      return [];
    }
  }

  /**
   * Load local agent configuration
   */
  private loadLocalAgent(filename: string): any {
    const agentsDir = path.join(process.cwd(), '.claude', 'agents');
    const filePath = path.join(agentsDir, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Find agents with local changes
   */
  private async findUnsyncedAgents(): Promise<string[]> {
    // This would compare local vs remote timestamps
    // For now, return empty array
    return [];
  }

  /**
   * Build remote agent creation prompt
   */
  private buildRemoteAgentCreationPrompt(description: string, args: string[]): string {
    return `# Create New Remote Agent (Dynamic Mode)

Please help me create a new AI agent for the Graphyn platform:
"${description}"

Additional requirements: ${args.join(' ')}

This agent will be:
- Created on the Graphyn platform (remote)
- Available for team collaboration
- Deployable to production
- Synchronized across devices

Please use the Graphyn MCP tools to:
1. Create the agent configuration
2. Set up appropriate capabilities
3. Test the agent in a thread
4. Prepare for deployment

Current project context:
- Working directory: ${process.cwd()}
- Mode: Dynamic (Claude Code + Graphyn APIs)
`;
  }

  /**
   * Build remote agent run prompt
   */
  private buildRemoteAgentRunPrompt(agent: any, args: string[], threadId: string): string {
    return `# Running Remote Agent: ${agent.name}

Agent Configuration:
- ID: ${agent.id}
- Description: ${agent.description}
- Status: ${agent.status}

Instructions:
${agent.instructions}

Capabilities: ${agent.capabilities.join(', ')}

Thread ID: ${threadId}
User Input: ${args.join(' ')}

Please act as this agent and interact with the user in the thread.
Use the Graphyn MCP tools to send messages and coordinate with other agents.
`;
  }

  /**
   * Build remote thread prompt
   */
  private buildRemoteThreadPrompt(thread: any): string {
    return `# Remote Thread: ${thread.name}

Thread Details:
- ID: ${thread.id}
- Type: ${thread.type}
- Participants: ${thread.participants.length}

You are now connected to a Graphyn remote thread. 
You can invite agents, send messages, and collaborate with your team.

Available MCP tools:
- send_message: Send a message to this thread
- spawn_agent: Create and invite new agents
- list_threads: See other threads

How can I help you in this thread?
`;
  }

  /**
   * Format relative time
   */
  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }
}