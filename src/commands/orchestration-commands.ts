/**
 * Orchestration CLI Commands - Project-Agnostic Multi-Agent Coordination
 * 
 * Provides comprehensive CLI commands for project initialization, task planning,
 * execution coordination, and session management across any project type.
 */

import { analyzeProjectContext, type ProjectContext } from '../context/context7-integration.js';
import { universalTaskDecomposer } from '../orchestrator/UniversalTaskDecomposer.js';
import { dynamicAgentRegistry } from '../agents/DynamicAgentRegistry.js';
import { MultiAgentSessionManager } from '../orchestrator/MultiAgentSessionManager.js';
import { generateMCPConfig } from '../services/mcp-config-generator.js';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import inquirer from 'inquirer';

export interface OrchestrationConfig {
  projectPath: string;
  maxConcurrency: number;
  timeout: number;
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class OrchestrationCommands {
  private config?: OrchestrationConfig;
  private projectContext?: ProjectContext;
  private sessionManager?: MultiAgentSessionManager;
  
  constructor(config?: Partial<OrchestrationConfig>) {
    this.config = {
      projectPath: process.cwd(),
      maxConcurrency: 3,
      timeout: 300000,
      enableLogging: true,
      logLevel: 'info',
      ...config
    };
  }
  
  /**
   * Initialize project for multi-agent orchestration
   */
  async initProject(options: {
    force?: boolean;
    template?: string;
    agents?: string[];
  } = {}): Promise<void> {
    console.log(chalk.cyan('🚀 Initializing project for multi-agent orchestration...'));
    
    const projectPath = this.config!.projectPath;
    const claudeDir = path.join(projectPath, '.claude');
    const agentsDir = path.join(claudeDir, 'agents');
    
    // Check if already initialized
    if (!options.force && await this.directoryExists(claudeDir)) {
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Project already initialized. Reinitialize?',
        default: false
      }]);
      
      if (!proceed) {
        console.log(chalk.yellow('📝 Initialization cancelled.'));
        return;
      }
    }
    
    // Step 1: Analyze project context
    console.log(chalk.blue('🔍 Analyzing project context...'));
    this.projectContext = await analyzeProjectContext(projectPath);
    
    console.log(chalk.green(`✅ Detected: ${this.projectContext.name} (${this.projectContext.architecture.type})`));
    console.log(chalk.gray(`   Technologies: ${this.projectContext.techStack.frameworks.map(f => f.name).join(', ')}`));
    
    // Step 2: Create directory structure
    console.log(chalk.blue('📁 Creating orchestration directories...'));
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.mkdir(agentsDir, { recursive: true });
    await fs.mkdir(path.join(claudeDir, 'sessions'), { recursive: true });
    await fs.mkdir(path.join(claudeDir, 'context'), { recursive: true });
    await fs.mkdir(path.join(claudeDir, 'logs'), { recursive: true });
    
    // Step 3: Initialize agent registry
    console.log(chalk.blue('🤖 Initializing agent registry...'));
    await dynamicAgentRegistry.initialize();
    
    // Step 4: Create specialized agents based on context
    console.log(chalk.blue('⚙️  Creating specialized agents...'));
    const specializedAgents = await this.createSpecializedAgents(options.agents);
    
    // Step 5: Generate MCP configuration
    console.log(chalk.blue('🔧 Generating MCP configuration...'));
    await generateMCPConfig({ validate: true });
    
    // Step 6: Create orchestration config
    const orchConfig = {
      version: '1.0.0',
      project: {
        name: this.projectContext.name,
        type: this.projectContext.architecture.type,
        technologies: this.projectContext.techStack.frameworks.map(f => f.name)
      },
      agents: specializedAgents.map(match => ({
        id: match.agent.id,
        type: match.agent.type,
        specialization: match.specialization?.technology,
        confidence: match.confidence
      })),
      capabilities: this.projectContext.capabilities,
      taskPatterns: this.projectContext.taskPatterns,
      createdAt: new Date().toISOString()
    };
    
    await fs.writeFile(
      path.join(claudeDir, 'orchestration.json'),
      JSON.stringify(orchConfig, null, 2)
    );
    
    // Step 7: Initialize task decomposer
    console.log(chalk.blue('🎯 Initializing task decomposer...'));
    await universalTaskDecomposer.initialize(projectPath);
    
    console.log(chalk.green('\\n✨ Project initialization complete!'));
    console.log(chalk.gray('\\nNext steps:'));
    console.log(chalk.gray('  • Use "graphyn plan <request>" to plan tasks'));
    console.log(chalk.gray('  • Use "graphyn execute <plan>" to run orchestration'));
    console.log(chalk.gray('  • Use "graphyn status" to monitor progress'));
    console.log(chalk.gray('  • Use "graphyn agents list" to see available agents'));
  }
  
  /**
   * Plan tasks from natural language request
   */
  async planTasks(request: string, options: {
    complexity?: 'simple' | 'moderate' | 'complex';
    maxTasks?: number;
    agents?: string[];
    dryRun?: boolean;
    save?: boolean;
  } = {}): Promise<void> {
    console.log(chalk.cyan(`🎯 Planning tasks for: "${request}"`));
    
    await this.ensureInitialized();
    
    // Decompose request into tasks
    const decomposition = await universalTaskDecomposer.decomposeRequest(request, {
      maxTasks: options.maxTasks,
      preferredAgents: options.agents as any,
      complexity: options.complexity
    });
    
    // Display plan
    console.log(chalk.blue('\\n📋 Task Plan:'));
    console.log(chalk.gray(`   Complexity: ${decomposition.complexity}`));
    console.log(chalk.gray(`   Estimated time: ${decomposition.estimatedTime} minutes`));
    console.log(chalk.gray(`   Parallelizable: ${decomposition.parallelizable ? 'Yes' : 'No'}`));
    console.log(chalk.gray(`   Recommended agents: ${decomposition.recommendedAgents.join(', ')}`));
    
    console.log(chalk.blue('\\n📝 Tasks:'));
    for (let i = 0; i < decomposition.tasks.length; i++) {
      const task = decomposition.tasks[i];
      console.log(chalk.white(`   ${i + 1}. ${task.description}`));
      console.log(chalk.gray(`      Agent: ${task.agent} | Priority: ${task.priority} | Est: ${task.estimatedMinutes || 30}min`));
      
      if (task.dependencies.length > 0) {
        const depNames = task.dependencies.map(depId => {
          const dep = decomposition.tasks.find(t => t.id === depId);
          return dep ? dep.description : depId;
        });
        console.log(chalk.gray(`      Dependencies: ${depNames.join(', ')}`));
      }
    }
    
    // Show execution graph
    if (decomposition.executionGraph.batches.length > 1) {
      console.log(chalk.blue('\\n🔀 Execution Order:'));
      for (let i = 0; i < decomposition.executionGraph.batches.length; i++) {
        const batch = decomposition.executionGraph.batches[i];
        const batchTasks = batch.map(taskId => {
          const task = decomposition.tasks.find(t => t.id === taskId);
          return task ? task.description : taskId;
        });
        console.log(chalk.gray(`   Batch ${i + 1}: ${batchTasks.join(', ')}`));
      }
    }
    
    if (options.dryRun) {
      console.log(chalk.yellow('\\n🔍 Dry run complete. No tasks executed.'));
      return;
    }
    
    // Save plan if requested
    if (options.save) {
      const planId = `plan-${Date.now()}`;
      const planPath = path.join(this.config!.projectPath, '.claude', 'plans', `${planId}.json`);
      
      await fs.mkdir(path.dirname(planPath), { recursive: true });
      await fs.writeFile(planPath, JSON.stringify({
        id: planId,
        request,
        decomposition,
        createdAt: new Date().toISOString(),
        options
      }, null, 2));
      
      console.log(chalk.green(`\\n💾 Plan saved as: ${planId}`));
    }
    
    // Ask if user wants to execute
    const { execute } = await inquirer.prompt([{
      type: 'confirm',
      name: 'execute',
      message: 'Execute this plan now?',
      default: true
    }]);
    
    if (execute) {
      await this.executeDecomposition(decomposition);
    }
  }
  
  /**
   * Execute orchestration plan
   */
  async executePlan(planId?: string, options: {
    maxConcurrency?: number;
    timeout?: number;
    interactive?: boolean;
  } = {}): Promise<void> {
    console.log(chalk.cyan('🚀 Executing orchestration plan...'));
    
    await this.ensureInitialized();
    
    let decomposition;
    
    if (planId) {
      // Load saved plan
      const planPath = path.join(this.config!.projectPath, '.claude', 'plans', `${planId}.json`);
      const planData = JSON.parse(await fs.readFile(planPath, 'utf-8'));
      decomposition = planData.decomposition;
      console.log(chalk.blue(`📋 Loaded plan: ${planData.request}`));
    } else {
      // Interactive plan creation
      const { request } = await inquirer.prompt([{
        type: 'input',
        name: 'request',
        message: 'What would you like to accomplish?'
      }]);
      
      decomposition = await universalTaskDecomposer.decomposeRequest(request);
    }
    
    await this.executeDecomposition(decomposition, options);
  }
  
  /**
   * Show orchestration status
   */
  async showStatus(): Promise<void> {
    console.log(chalk.cyan('📊 Orchestration Status'));
    
    await this.ensureInitialized();
    
    // Show project context
    console.log(chalk.blue('\\n🏗️  Project Context:'));
    console.log(chalk.white(`   Name: ${this.projectContext!.name}`));
    console.log(chalk.white(`   Type: ${this.projectContext!.architecture.type}`));
    console.log(chalk.white(`   Technologies: ${this.projectContext!.techStack.frameworks.map(f => f.name).join(', ')}`));
    
    // Show available agents
    const agents = dynamicAgentRegistry.getAgents();
    console.log(chalk.blue('\\n🤖 Available Agents:'));
    for (const agent of agents) {
      console.log(chalk.white(`   • ${agent.name} (${agent.type})`));
      if (agent.specializations.length > 0) {
        console.log(chalk.gray(`     Specializations: ${agent.specializations.map(s => s.technology).join(', ')}`));
      }
    }
    
    // Show session status if active
    if (this.sessionManager) {
      const stats = this.sessionManager.getStatistics();
      console.log(chalk.blue('\\n⚡ Session Status:'));
      console.log(chalk.white(`   Active sessions: ${stats.activeSessions}`));
      console.log(chalk.white(`   Completed tasks: ${stats.completedTasks}`));
      console.log(chalk.white(`   Failed tasks: ${stats.failedTasks}`));
      console.log(chalk.white(`   Duration: ${Math.round(stats.duration / 1000)}s`));
    }
    
    // Show recent plans
    const plansDir = path.join(this.config!.projectPath, '.claude', 'plans');
    try {
      const planFiles = await fs.readdir(plansDir);
      if (planFiles.length > 0) {
        console.log(chalk.blue('\\n📋 Recent Plans:'));
        const recentPlans = planFiles
          .slice(-5)
          .reverse();
        
        for (const file of recentPlans) {
          const planData = JSON.parse(await fs.readFile(path.join(plansDir, file), 'utf-8'));
          const age = Math.round((Date.now() - new Date(planData.createdAt).getTime()) / (1000 * 60));
          console.log(chalk.white(`   • ${planData.id}: "${planData.request}" (${age}m ago)`));
        }
      }
    } catch {
      // Plans directory doesn't exist or is empty
    }
  }
  
  /**
   * Manage agents
   */
  async manageAgents(action: 'list' | 'create' | 'update' | 'delete', options: any = {}): Promise<void> {
    await this.ensureInitialized();
    
    switch (action) {
      case 'list':
        await this.listAgents();
        break;
      case 'create':
        await this.createAgent(options);
        break;
      case 'update':
        await this.updateAgent(options);
        break;
      case 'delete':
        await this.deleteAgent(options);
        break;
    }
  }
  
  /**
   * Configure orchestration settings
   */
  async configure(settings: {
    maxConcurrency?: number;
    timeout?: number;
    logLevel?: string;
  } = {}): Promise<void> {
    console.log(chalk.cyan('⚙️  Configuring orchestration settings...'));
    
    const configPath = path.join(this.config!.projectPath, '.claude', 'config.json');
    let existingConfig = {};
    
    try {
      existingConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    } catch {
      // Config doesn't exist yet
    }
    
    const newConfig = {
      ...existingConfig,
      ...settings,
      updatedAt: new Date().toISOString()
    };
    
    await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2));
    
    console.log(chalk.green('✅ Configuration updated'));
    console.log(chalk.gray('Current settings:'));
    for (const [key, value] of Object.entries(newConfig)) {
      if (key !== 'updatedAt') {
        console.log(chalk.gray(`   ${key}: ${value}`));
      }
    }
  }
  
  /**
   * Show help and available commands
   */
  showHelp(): void {
    console.log(chalk.cyan.bold('🤖 Multi-Agent Orchestration CLI\\n'));
    
    console.log(chalk.blue('Project Commands:'));
    console.log('  init [options]                 Initialize project for orchestration');
    console.log('  status                         Show project and orchestration status');
    console.log('  configure [options]            Configure orchestration settings\\n');
    
    console.log(chalk.blue('Task Planning & Execution:'));
    console.log('  plan <request> [options]       Plan tasks from natural language');
    console.log('  execute [plan-id] [options]    Execute orchestration plan');
    console.log('  coordinate <request>           Plan and execute in one step\\n');
    
    console.log(chalk.blue('Agent Management:'));
    console.log('  agents list                    List all available agents');
    console.log('  agents create [options]        Create new specialized agent');
    console.log('  agents update <id> [options]   Update agent configuration');
    console.log('  agents delete <id>             Delete agent\\n');
    
    console.log(chalk.blue('Session Management:'));
    console.log('  sessions list                  List active sessions');
    console.log('  sessions terminate <id>        Terminate specific session');
    console.log('  sessions cleanup               Clean up completed sessions\\n');
    
    console.log(chalk.blue('Examples:'));
    console.log('  graphyn init --template=fullstack');
    console.log('  graphyn plan "add user authentication"');
    console.log('  graphyn coordinate "optimize database performance"');
    console.log('  graphyn agents create --type=backend --tech=django');
  }
  
  // Private methods
  
  private async ensureInitialized(): Promise<void> {
    const claudeDir = path.join(this.config!.projectPath, '.claude');
    
    if (!await this.directoryExists(claudeDir)) {
      console.log(chalk.yellow('⚠️  Project not initialized for orchestration.'));
      console.log(chalk.gray('Run "graphyn init" to initialize.'));
      process.exit(1);
    }
    
    // Load project context if not loaded
    if (!this.projectContext) {
      this.projectContext = await analyzeProjectContext(this.config!.projectPath);
    }
    
    // Initialize components
    if (!dynamicAgentRegistry.getAgents().length) {
      await dynamicAgentRegistry.initialize();
    }
    
    if (!this.sessionManager) {
      this.sessionManager = new MultiAgentSessionManager(this.config!.projectPath);
    }
  }
  
  private async executeDecomposition(decomposition: any, options: any = {}): Promise<void> {
    console.log(chalk.cyan('🚀 Starting task execution...'));
    
    if (!this.sessionManager) {
      this.sessionManager = new MultiAgentSessionManager(this.config!.projectPath);
    }
    
    // Convert decomposition to query for session manager
    const mainTask = decomposition.tasks[0];
    const query = mainTask ? mainTask.description : 'Execute planned tasks';
    
    try {
      const result = await this.sessionManager.executeQuery(query, {
        maxConcurrency: options.maxConcurrency || this.config!.maxConcurrency,
        timeout: options.timeout || this.config!.timeout
      });
      
      console.log(chalk.green('\\n🎉 Execution completed!'));
      console.log(chalk.gray(`   Success: ${result.success}`));
      console.log(chalk.gray(`   Duration: ${Math.round(result.totalDuration / 1000)}s`));
      console.log(chalk.gray(`   Tasks completed: ${result.completedTasks.length}`));
      
      if (result.failedTasks.length > 0) {
        console.log(chalk.red(`   Tasks failed: ${result.failedTasks.length}`));
        for (const failed of result.failedTasks) {
          console.log(chalk.red(`     • ${failed.error}`));
        }
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Execution failed:'), error);
      throw error;
    }
  }
  
  private async createSpecializedAgents(preferredAgents?: string[]): Promise<any[]> {
    const matches = await dynamicAgentRegistry.getSpecializedAgents(this.projectContext!);
    
    console.log(chalk.green(`✅ Found ${matches.length} specialized agents:`));
    for (const match of matches) {
      console.log(chalk.gray(`   • ${match.agent.name} (${match.confidence.toFixed(2)} confidence)`));
      if (match.specialization) {
        console.log(chalk.gray(`     Specializes in: ${match.specialization.technology}`));
      }
    }
    
    return matches;
  }
  
  private async listAgents(): Promise<void> {
    const agents = dynamicAgentRegistry.getAgents();
    
    console.log(chalk.blue('\\n🤖 Available Agents:'));
    for (const agent of agents) {
      console.log(chalk.white(`\\n• ${agent.name} (${agent.id})`));
      console.log(chalk.gray(`  Type: ${agent.type}`));
      console.log(chalk.gray(`  Description: ${agent.description}`));
      
      if (agent.specializations.length > 0) {
        console.log(chalk.gray(`  Specializations: ${agent.specializations.map(s => s.technology).join(', ')}`));
      }
      
      if (agent.defaultCapabilities.length > 0) {
        console.log(chalk.gray(`  Capabilities: ${agent.defaultCapabilities.map(c => c.name).join(', ')}`));
      }
    }
  }
  
  private async createAgent(options: any): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Agent name:',
        default: options.name
      },
      {
        type: 'list',
        name: 'type',
        message: 'Agent type:',
        choices: ['architect', 'backend', 'frontend', 'test-writer', 'design', 'cli'],
        default: options.type
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:',
        default: options.description
      },
      {
        type: 'input',
        name: 'specialization',
        message: 'Technology specialization (optional):',
        default: options.specialization
      }
    ]);
    
    const agent = await dynamicAgentRegistry.createAgent(answers);
    console.log(chalk.green(`✅ Created agent: ${agent.name} (${agent.id})`));
  }
  
  private async updateAgent(options: any): Promise<void> {
    // Implementation for updating agents
    console.log(chalk.yellow('Agent update functionality coming soon...'));
  }
  
  private async deleteAgent(options: any): Promise<void> {
    const { agentId } = options;
    if (!agentId) {
      console.log(chalk.red('❌ Agent ID required'));
      return;
    }
    
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Delete agent ${agentId}?`,
      default: false
    }]);
    
    if (confirm) {
      await dynamicAgentRegistry.deleteAgent(agentId);
      console.log(chalk.green('✅ Agent deleted'));
    }
  }
  
  private async directoryExists(dir: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dir);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}

// Export CLI command handlers
export async function handleInitCommand(options: any): Promise<void> {
  const orchestrator = new OrchestrationCommands();
  await orchestrator.initProject(options);
}

export async function handlePlanCommand(request: string, options: any): Promise<void> {
  const orchestrator = new OrchestrationCommands();
  await orchestrator.planTasks(request, options);
}

export async function handleExecuteCommand(planId?: string, options: any = {}): Promise<void> {
  const orchestrator = new OrchestrationCommands();
  await orchestrator.executePlan(planId, options);
}

export async function handleStatusCommand(): Promise<void> {
  const orchestrator = new OrchestrationCommands();
  await orchestrator.showStatus();
}

export async function handleAgentsCommand(action: string, options: any = {}): Promise<void> {
  const orchestrator = new OrchestrationCommands();
  await orchestrator.manageAgents(action as any, options);
}

export async function handleConfigureCommand(settings: any): Promise<void> {
  const orchestrator = new OrchestrationCommands();
  await orchestrator.configure(settings);
}

export async function handleCoordinateCommand(request: string, options: any = {}): Promise<void> {
  const orchestrator = new OrchestrationCommands();
  
  // Plan and execute in one step
  await orchestrator.planTasks(request, { ...options, dryRun: false });
}

export function handleHelpCommand(): void {
  const orchestrator = new OrchestrationCommands();
  orchestrator.showHelp();
}
