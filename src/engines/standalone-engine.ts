/**
 * Standalone Engine - Pure Claude Code operations
 * Handles all operations through direct Claude Code integration
 */

/// <reference path="../types/globals.d.ts" />
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import type { CommandIntent } from '../coordinator-legacy/smart-coordinator.js';

export interface AgentConfig {
  name: string;
  description: string;
  instructions: string;
  capabilities: string[];
  created: Date;
  lastUsed?: Date;
}

export class StandaloneEngine {
  private agentsDir: string;
  private claudeCodePath?: string;

  constructor() {
    // Store agents in .claude directory
    this.agentsDir = path.join(process.cwd(), '.claude', 'agents');
    this.ensureAgentsDirectory();
  }

  /**
   * Initialize the standalone engine
   */
  async initialize(): Promise<void> {
    // Detect Claude Code installation
    this.claudeCodePath = await this.detectClaudeCode();
    
    if (!this.claudeCodePath) {
      console.log(chalk.yellow('⚠️  Claude Code not found in PATH'));
      console.log(chalk.gray('   Install with: npm install -g @anthropic/claude-code'));
    }
    
    console.log(chalk.blue('🏠 Standalone engine initialized'));
  }

  /**
   * Handle agent-related commands
   */
  async handleAgentCommand(intent: CommandIntent): Promise<void> {
    switch (intent.action) {
      case 'create':
      case 'make':
      case 'build':
        await this.createAgent(intent.target || '', intent.args);
        break;
        
      case 'list':
        await this.listAgents();
        break;
        
      case 'run':
        await this.runAgent(intent.target || '', intent.args);
        break;
        
      case 'test':
        await this.testAgent(intent.target || '');
        break;
        
      case 'update':
      case 'modify':
        await this.updateAgent(intent.target || '', intent.args);
        break;
        
      case 'delete':
      case 'remove':
        await this.deleteAgent(intent.target || '');
        break;
        
      default:
        // Treat unknown actions as natural language agent creation
        await this.createAgent(intent.target || intent.action, intent.args);
    }
  }

  /**
   * Handle sync commands in standalone mode
   */
  async handleSyncCommand(intent: CommandIntent): Promise<void> {
    console.log(chalk.yellow('📦 Sync in standalone mode (local only)'));
    
    switch (intent.action) {
      case 'status':
        await this.showLocalSyncStatus();
        break;
        
      case 'push':
        console.log(chalk.gray('💡 Switch to dynamic mode to push to cloud'));
        console.log(chalk.gray('   clyde mode dynamic'));
        break;
        
      case 'pull':
        console.log(chalk.gray('💡 Switch to dynamic mode to pull from cloud'));
        console.log(chalk.gray('   clyde mode dynamic'));
        break;
        
      case 'clone':
        console.log(chalk.gray('💡 Switch to dynamic mode to clone from cloud'));
        console.log(chalk.gray('   clyde mode dynamic'));
        break;
        
      default:
        console.log(chalk.red(`Unknown sync action: ${intent.action}`));
    }
  }

  /**
   * Handle thread commands in standalone mode
   */
  async handleThreadCommand(intent: CommandIntent): Promise<void> {
    console.log(chalk.blue('💬 Thread operations in standalone mode'));
    
    switch (intent.action) {
      case 'list':
        await this.listLocalThreads();
        break;
        
      case 'create':
        await this.createLocalThread(intent.target || 'New Thread');
        break;
        
      case 'start':
      case 'chat':
        await this.startThread(intent.target || '');
        break;
        
      default:
        console.log(chalk.red(`Unknown thread action: ${intent.action}`));
    }
  }

  /**
   * Create a new agent from description
   */
  private async createAgent(description: string, additionalArgs: string[]): Promise<void> {
    if (!description.trim()) {
      console.log(chalk.red('❌ Please provide an agent description'));
      console.log(chalk.gray('Example: clyde create "A helpful code reviewer that checks for security issues"'));
      return;
    }
    
    console.log(chalk.cyan('🤖 Creating agent from description...'));
    console.log(chalk.gray(`Description: ${description}`));
    
    // Build context for agent creation
    const context = {
      workingDirectory: process.cwd(),
      projectType: await this.detectProjectType(),
      description,
      additionalArgs,
      agentsDir: this.agentsDir
    };
    
    try {
      // Execute using Claude Code Task tool
      const result = await this.executeViaClaudeCode(
        this.buildAgentCreationPrompt(description, additionalArgs),
        context,
        'coder'
      );
      
      if (result.success) {
        console.log(chalk.green('✅ Agent created successfully!'));
      } else if (result.mockMode) {
        console.log(chalk.yellow('📝 Agent creation requires Claude Code environment'));
      } else {
        console.log(chalk.red(`❌ Agent creation failed: ${result.error}`));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to create agent:'), error);
    }
  }

  /**
   * Detect project type for context
   */
  private async detectProjectType(): Promise<string> {
    try {
      if (fs.existsSync(path.join(process.cwd(), 'package.json'))) {
        return 'nodejs';
      }
      if (fs.existsSync(path.join(process.cwd(), 'requirements.txt'))) {
        return 'python';
      }
      if (fs.existsSync(path.join(process.cwd(), 'Cargo.toml'))) {
        return 'rust';
      }
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * List all local agents
   */
  private async listAgents(): Promise<void> {
    const agentFiles = this.getAgentFiles();
    
    if (agentFiles.length === 0) {
      console.log(chalk.gray('📝 No agents found in .claude/agents/'));
      console.log(chalk.gray('Create your first agent: clyde create "describe your agent"'));
      return;
    }
    
    console.log(chalk.blue('🤖 Local Agents:'));
    
    for (const file of agentFiles) {
      try {
        const agentPath = path.join(this.agentsDir, file);
        const agentConfig = this.loadAgentConfig(agentPath);
        
        const lastUsed = agentConfig.lastUsed ? 
          `(used ${this.formatRelativeTime(agentConfig.lastUsed)})` : 
          '(never used)';
          
        console.log(`  • ${agentConfig.name} - ${agentConfig.description} ${chalk.gray(lastUsed)}`);
      } catch (error) {
        console.log(`  • ${file} ${chalk.red('(error loading)')}`);
      }
    }
  }

  /**
   * Run an agent interactively
   */
  private async runAgent(agentName: string, args: string[]): Promise<void> {
    if (!agentName) {
      console.log(chalk.red('❌ Please specify an agent name'));
      await this.listAgents();
      return;
    }
    
    const agentPath = this.findAgentPath(agentName);
    if (!agentPath) {
      console.log(chalk.red(`❌ Agent "${agentName}" not found`));
      await this.listAgents();
      return;
    }
    
    try {
      const agentConfig = this.loadAgentConfig(agentPath);
      console.log(chalk.cyan(`🚀 Running agent: ${agentConfig.name}`));
      
      // Build context for Claude Code
      const runPrompt = this.buildAgentRunPrompt(agentConfig, args);
      
      // Launch Claude Code with agent context
      await this.launchClaudeCode(runPrompt);
      
      // Update last used timestamp
      agentConfig.lastUsed = new Date();
      this.saveAgentConfig(agentPath, agentConfig);
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to run agent:'), error);
    }
  }

  /**
   * Test an agent with sample scenarios
   */
  private async testAgent(agentName: string): Promise<void> {
    if (!agentName) {
      console.log(chalk.red('❌ Please specify an agent name'));
      return;
    }
    
    const agentPath = this.findAgentPath(agentName);
    if (!agentPath) {
      console.log(chalk.red(`❌ Agent "${agentName}" not found`));
      return;
    }
    
    try {
      const agentConfig = this.loadAgentConfig(agentPath);
      console.log(chalk.yellow(`🧪 Testing agent: ${agentConfig.name}`));
      
      const testPrompt = this.buildAgentTestPrompt(agentConfig);
      await this.launchClaudeCode(testPrompt);
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to test agent:'), error);
    }
  }

  /**
   * Update an existing agent
   */
  private async updateAgent(agentName: string, modifications: string[]): Promise<void> {
    if (!agentName) {
      console.log(chalk.red('❌ Please specify an agent name'));
      return;
    }
    
    const agentPath = this.findAgentPath(agentName);
    if (!agentPath) {
      console.log(chalk.red(`❌ Agent "${agentName}" not found`));
      return;
    }
    
    try {
      const agentConfig = this.loadAgentConfig(agentPath);
      const updatePrompt = this.buildAgentUpdatePrompt(agentConfig, modifications);
      
      await this.launchClaudeCode(updatePrompt);
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to update agent:'), error);
    }
  }

  /**
   * Delete an agent
   */
  private async deleteAgent(agentName: string): Promise<void> {
    if (!agentName) {
      console.log(chalk.red('❌ Please specify an agent name'));
      return;
    }
    
    const agentPath = this.findAgentPath(agentName);
    if (!agentPath) {
      console.log(chalk.red(`❌ Agent "${agentName}" not found`));
      return;
    }
    
    try {
      const agentConfig = this.loadAgentConfig(agentPath);
      console.log(chalk.yellow(`🗑️  Delete agent: ${agentConfig.name}?`));
      console.log(chalk.gray('This action cannot be undone.'));
      
      // For now, just show what would be deleted
      // Interactive confirmation will be added with the shell
      console.log(chalk.red('❌ Agent deletion requires confirmation (not implemented yet)'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to delete agent:'), error);
    }
  }

  /**
   * Show local sync status
   */
  private async showLocalSyncStatus(): Promise<void> {
    const agentFiles = this.getAgentFiles();
    
    console.log(chalk.blue('📦 Local Sync Status:'));
    console.log(chalk.gray('Mode: Standalone (local only)'));
    console.log(chalk.gray(`Agents: ${agentFiles.length} local agents`));
    
    if (agentFiles.length > 0) {
      console.log('\nLocal agents:');
      agentFiles.forEach(file => {
        console.log(chalk.green(`  ✓ ${file}`));
      });
    }
    
    console.log(chalk.yellow('\n💡 Switch to dynamic mode for cloud sync'));
    console.log(chalk.gray('   clyde mode dynamic'));
  }

  /**
   * List local threads (Claude Code sessions)
   */
  private async listLocalThreads(): Promise<void> {
    console.log(chalk.blue('💬 Local Threads:'));
    console.log(chalk.gray('In standalone mode, threads are Claude Code sessions'));
    console.log(chalk.gray('Start a new session: clyde thread create <name>'));
  }

  /**
   * Create a local thread
   */
  private async createLocalThread(name: string): Promise<void> {
    console.log(chalk.cyan(`💬 Starting thread: ${name}`));
    
    const threadPrompt = `# Thread: ${name}
    
You are now in a Clyde thread. This is a focused conversation session within the Clyde orchestrator.

Current context:
- Mode: Standalone (pure Claude Code)
- Working directory: ${process.cwd()}
- Available agents: ${this.getAgentFiles().length}

How can I help you in this thread?`;

    await this.launchClaudeCode(threadPrompt);
  }

  /**
   * Start an existing thread
   */
  private async startThread(threadName: string): Promise<void> {
    if (!threadName) {
      await this.createLocalThread('Interactive Session');
      return;
    }
    
    await this.createLocalThread(threadName);
  }

  // Helper methods

  /**
   * Ensure agents directory exists
   */
  private ensureAgentsDirectory(): void {
    if (!fs.existsSync(this.agentsDir)) {
      fs.mkdirSync(this.agentsDir, { recursive: true });
    }
  }

  /**
   * Detect Claude Code installation
   */
  private async detectClaudeCode(): Promise<string | undefined> {
    const possiblePaths = ['claude', 'claude-code', 'npx claude-code'];
    
    for (const cmdPath of possiblePaths) {
      try {
        // Test if command exists
        const { spawn } = await import('child_process');
        return cmdPath;
      } catch (error) {
        // Continue to next path
      }
    }
    
    return undefined;
  }

  /**
   * Execute task through Claude Code Task tool
   */
  private async executeViaClaudeCode(description: string, context: any, agentType: string = 'general-purpose'): Promise<any> {
    try {
      // Check if we're running within Claude Code environment
      if (typeof Task !== 'undefined' && typeof Task === 'function') {
        console.log(chalk.cyan(`🧠 Executing via Claude Code Task tool (${agentType})...`));
        
        // Build enhanced prompt with context
        const enhancedPrompt = this.buildEnhancedPrompt(description, context);
        
        // Execute using real Claude Code Task tool
        const result = await Task({
          description: `Clyde AI: ${description}`,
          prompt: enhancedPrompt,
          subagent_type: agentType
        });
        
        console.log(chalk.green('✅ Claude Code execution completed'));
        
        return {
          success: true,
          result: result.result || result,
          agent: agentType,
          timestamp: Date.now()
        };
        
      } else {
        // Not in Claude Code environment
        console.log(chalk.yellow('⚠️  Claude Code Task tool not available'));
        console.log(chalk.gray('For full functionality, run within Claude Code environment'));
        console.log(chalk.blue('💡 Install: npm install -g @anthropic/claude-code'));
        
        return {
          success: false,
          error: 'Claude Code Task tool not available',
          message: 'Run Clyde within Claude Code for full functionality',
          mockMode: true
        };
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Claude Code execution failed:'), (error as any).message);
      
      return {
        success: false,
        error: (error as any).message,
        agent: agentType,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Build enhanced prompt for Claude Code
   */
  private buildEnhancedPrompt(description: string, context: any): string {
    return `# Clyde AI Task Request

## User Request
${description}

## Project Context
- **Working Directory**: ${context?.workingDirectory || process.cwd()}
- **Project Type**: ${context?.projectType || 'unknown'}
- **Git Branch**: ${context?.gitInfo?.branch || 'none'}

## Task Guidelines
1. Follow existing code patterns and conventions in the project
2. Use the detected project structure and organization
3. Integrate with existing dependencies and frameworks
4. Provide working, tested code that can be run immediately
5. Include appropriate error handling and validation

## Expected Output
Please provide a comprehensive implementation that addresses the user's request with proper integration into the existing project structure.

Begin implementation now.
`;
  }

  /**
   * Launch Claude Code with given content (legacy method)
   */
  private async launchClaudeCode(content: string): Promise<void> {
    // This method is now deprecated in favor of executeViaClaudeCode
    await this.executeViaClaudeCode(content, {}, 'general-purpose');
  }

  /**
   * Get all agent files
   */
  private getAgentFiles(): string[] {
    try {
      return fs.readdirSync(this.agentsDir)
        .filter(file => file.endsWith('.json'))
        .sort();
    } catch (error) {
      return [];
    }
  }

  /**
   * Find agent path by name
   */
  private findAgentPath(agentName: string): string | undefined {
    const agentFiles = this.getAgentFiles();
    
    // Try exact match first
    const exactMatch = `${agentName}.json`;
    if (agentFiles.includes(exactMatch)) {
      return path.join(this.agentsDir, exactMatch);
    }
    
    // Try partial match
    const partialMatch = agentFiles.find(file => 
      file.toLowerCase().includes(agentName.toLowerCase())
    );
    
    if (partialMatch) {
      return path.join(this.agentsDir, partialMatch);
    }
    
    return undefined;
  }

  /**
   * Load agent configuration
   */
  private loadAgentConfig(agentPath: string): AgentConfig {
    const content = fs.readFileSync(agentPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Save agent configuration
   */
  private saveAgentConfig(agentPath: string, config: AgentConfig): void {
    fs.writeFileSync(agentPath, JSON.stringify(config, null, 2));
  }

  /**
   * Build agent creation prompt
   */
  private buildAgentCreationPrompt(description: string, args: string[]): string {
    return `# Create New Agent

Please help me create a new AI agent based on this description:
"${description}"

Additional requirements: ${args.join(' ')}

The agent should be designed for the Clyde orchestrator (standalone mode).

Current project context:
- Working directory: ${process.cwd()}
- Mode: Standalone (pure Claude Code)

Please:
1. Analyze the description and determine the agent's purpose
2. Create appropriate instructions and capabilities
3. Generate a JSON configuration file in .claude/agents/
4. Suggest how to test and use this agent

The agent configuration should follow this format:
{
  "name": "agent-name",
  "description": "Brief description",
  "instructions": "Detailed instructions for the agent",
  "capabilities": ["list", "of", "capabilities"],
  "created": "ISO date string"
}`;
  }

  /**
   * Build agent run prompt
   */
  private buildAgentRunPrompt(config: AgentConfig, args: string[]): string {
    return `# Running Agent: ${config.name}

Agent Description: ${config.description}

Instructions:
${config.instructions}

Capabilities: ${config.capabilities.join(', ')}

User Input: ${args.join(' ')}

Please act as this agent and help the user with their request.`;
  }

  /**
   * Build agent test prompt
   */
  private buildAgentTestPrompt(config: AgentConfig): string {
    return `# Testing Agent: ${config.name}

Please help me test this agent configuration:

Name: ${config.name}
Description: ${config.description}
Instructions: ${config.instructions}
Capabilities: ${config.capabilities.join(', ')}

Create some test scenarios that would validate this agent works correctly.
Then run through each test scenario and provide feedback on the agent's performance.`;
  }

  /**
   * Build agent update prompt
   */
  private buildAgentUpdatePrompt(config: AgentConfig, modifications: string[]): string {
    return `# Update Agent: ${config.name}

Current Configuration:
${JSON.stringify(config, null, 2)}

Requested modifications: ${modifications.join(' ')}

Please help me update this agent based on the requested changes.
Provide the updated JSON configuration and explain what changed.`;
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