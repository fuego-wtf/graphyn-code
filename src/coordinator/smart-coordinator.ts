/**
 * Smart Coordinator - Intelligent command routing and multi-agent orchestration
 * Routes commands to standalone or dynamic engines, and orchestrates multi-agent workflows
 */

import { ModeManager, type Mode } from '../clyde/mode-manager.js';
import { StandaloneEngine } from '../engines/standalone-engine.js';
import { DynamicEngine } from '../engines/dynamic-engine.js';
import { ContextPreservingSession } from '../clyde/context-preserving-session.js';
import { AgentRegistry } from './agent-registry.js';
import { TaskDecomposer } from './task-decomposer.js';
import { MultiAgentSessionManager } from './multi-agent-session-manager.js';
import { CoordinationResult, ExecutionGraph } from './types.js';
import chalk from 'chalk';

export interface SmartCoordinatorOptions {
  modeManager: ModeManager;
  standaloneEngine: StandaloneEngine;
  dynamicEngine: DynamicEngine;
  session: ContextPreservingSession;
  enableMultiAgent?: boolean;
}

export interface CommandIntent {
  type: 'agent' | 'sync' | 'thread' | 'config' | 'help' | 'system' | 'coordinate';
  action: string;
  target?: string;
  args: string[];
  requiresAuth: boolean;
  preferredMode?: Mode;
  complexity?: 'low' | 'medium' | 'high';
  isMultiAgent?: boolean;
}

export class SmartCoordinator {
  private modeManager: ModeManager;
  private standaloneEngine: StandaloneEngine;
  private dynamicEngine: DynamicEngine;
  private session: ContextPreservingSession;
  
  // Multi-agent orchestration components
  private agentRegistry?: AgentRegistry;
  private taskDecomposer?: TaskDecomposer;
  private sessionManager?: MultiAgentSessionManager;
  private multiAgentEnabled: boolean;

  constructor(options: SmartCoordinatorOptions) {
    this.modeManager = options.modeManager;
    this.standaloneEngine = options.standaloneEngine;
    this.dynamicEngine = options.dynamicEngine;
    this.session = options.session;
    this.multiAgentEnabled = options.enableMultiAgent ?? true;
    
    if (this.multiAgentEnabled) {
      this.initializeMultiAgentCapabilities();
    }
  }

  /**
   * Initialize multi-agent orchestration capabilities
   */
  private async initializeMultiAgentCapabilities(): Promise<void> {
    try {
      console.log(chalk.cyan('🤖 Initializing multi-agent coordination...'));
      
      this.agentRegistry = new AgentRegistry();
      await this.agentRegistry.loadAgents();
      
      this.taskDecomposer = new TaskDecomposer(this.agentRegistry);
      this.sessionManager = new MultiAgentSessionManager(this.agentRegistry);
      
      console.log(chalk.green('✅ Multi-agent coordination ready'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize multi-agent capabilities:'), error);
      this.multiAgentEnabled = false;
    }
  }

  /**
   * Process a command through intelligent intent parsing and routing
   */
  async processCommand(command: string): Promise<void> {
    const intent = this.parseIntent(command);
    
    console.log(chalk.gray(`📝 Intent: ${intent.type}.${intent.action}${intent.target ? ` → ${intent.target}` : ''}`));
    
    // Check if this should be handled as multi-agent coordination
    if (this.shouldUseMultiAgent(intent)) {
      console.log(chalk.cyan('🎭 Routing to multi-agent coordination'));
      await this.coordinateWithMultipleAgents(intent);
      return;
    }
    
    // Check if command requires mode switch
    await this.handleModeRequirements(intent);
    
    // Route to appropriate engine
    const currentMode = this.modeManager.getCurrentMode();
    
    if (currentMode === 'dynamic' && this.dynamicEngine) {
      await this.routeToDynamicEngine(intent);
    } else {
      await this.routeToStandaloneEngine(intent);
    }
  }

  /**
   * Determine if a command should use multi-agent coordination
   */
  private shouldUseMultiAgent(intent: CommandIntent): boolean {
    if (!this.multiAgentEnabled || !this.agentRegistry || !this.taskDecomposer || !this.sessionManager) {
      return false;
    }

    // Explicit multi-agent coordination requests
    if (intent.type === 'coordinate' || intent.isMultiAgent) {
      return true;
    }

    // Complex tasks that benefit from multiple agents
    if (intent.complexity === 'high') {
      return true;
    }

    // Tasks with specific multi-agent keywords
    const multiAgentKeywords = [
      'fullstack', 'architecture', 'system design', 'multi-service',
      'comprehensive', 'end-to-end', 'complete implementation'
    ];

    const commandText = `${intent.action} ${intent.target || ''}`.toLowerCase();
    return multiAgentKeywords.some(keyword => commandText.includes(keyword));
  }

  /**
   * Coordinate task execution across multiple agents
   */
  private async coordinateWithMultipleAgents(intent: CommandIntent): Promise<CoordinationResult> {
    if (!this.taskDecomposer || !this.sessionManager) {
      throw new Error('Multi-agent capabilities not initialized');
    }

    const startTime = Date.now();
    console.log(chalk.cyan('🚀 Starting multi-agent coordination...'));

    try {
      // 1. Decompose the request into tasks
      const executionGraph = await this.taskDecomposer.decomposeRequest(intent.target || intent.action);
      
      if (executionGraph.nodes.length === 0) {
        throw new Error('No tasks generated from request');
      }

      // 2. Display execution plan
      this.displayExecutionPlan(executionGraph);

      // 3. Execute tasks with assigned agents
      const results = await this.sessionManager.executeTasksWithAgents(executionGraph.nodes);

      // 4. Compile final results
      const totalTime = (Date.now() - startTime) / 1000;
      const completedTasks = executionGraph.nodes.filter(t => t.status === 'completed').length;
      const failedTasks = executionGraph.nodes.filter(t => t.status === 'failed').length;

      const coordinationResult: CoordinationResult = {
        success: failedTasks === 0,
        totalTimeSeconds: totalTime,
        tasksCompleted: completedTasks,
        tasksFailed: failedTasks,
        results: Array.from(results.values()),
        errors: executionGraph.nodes.filter(t => t.error).map(t => t.error!)
      };

      // 5. Display final results
      this.displayCoordinationResults(coordinationResult);

      return coordinationResult;

    } catch (error) {
      const totalTime = (Date.now() - startTime) / 1000;
      console.error(chalk.red('❌ Multi-agent coordination failed:'), error);

      return {
        success: false,
        totalTimeSeconds: totalTime,
        tasksCompleted: 0,
        tasksFailed: 1,
        results: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Display execution plan to user
   */
  private displayExecutionPlan(graph: ExecutionGraph): void {
    console.log(chalk.blue('\n📋 Execution Plan:'));
    console.log(chalk.gray(`  Tasks: ${graph.nodes.length}`));
    console.log(chalk.gray(`  Estimated time: ${graph.totalEstimatedTime} minutes`));
    console.log(chalk.gray(`  Max concurrency: ${graph.maxConcurrency} agents`));
    console.log(chalk.gray(`  Parallelizable: ${graph.parallelizable ? 'Yes' : 'No'}`));

    console.log(chalk.blue('\n📝 Task Breakdown:'));
    for (const task of graph.nodes) {
      const depsText = task.dependencies.length > 0 
        ? ` (deps: ${task.dependencies.join(', ')})`
        : '';
      console.log(chalk.gray(`  ${task.id}: ${task.description}${depsText}`));
    }
    console.log();
  }

  /**
   * Display coordination results
   */
  private displayCoordinationResults(result: CoordinationResult): void {
    console.log(chalk.blue('\n🎉 Multi-Agent Coordination Results:'));
    console.log(chalk.gray(`  Success: ${result.success ? '✅' : '❌'}`));
    console.log(chalk.gray(`  Total time: ${result.totalTimeSeconds.toFixed(1)}s`));
    console.log(chalk.gray(`  Tasks completed: ${result.tasksCompleted}`));
    
    if (result.tasksFailed > 0) {
      console.log(chalk.gray(`  Tasks failed: ${result.tasksFailed}`));
    }

    if (result.errors.length > 0) {
      console.log(chalk.red('\n❌ Errors:'));
      for (const error of result.errors) {
        console.log(chalk.red(`  • ${error}`));
      }
    }

    // Performance assessment
    if (result.totalTimeSeconds < 30) {
      console.log(chalk.green('⚡ Performance target achieved (<30s)'));
    } else {
      console.log(chalk.yellow(`⚠️  Performance target missed (${result.totalTimeSeconds.toFixed(1)}s > 30s)`));
    }

    console.log();
  }

  /**
   * Parse natural language commands into structured intents
   */
  private parseIntent(command: string): CommandIntent {
    const tokens = command.toLowerCase().split(' ').filter(t => t.length > 0);
    const firstToken = tokens[0];
    
    // Multi-agent coordination commands
    if (['coordinate', 'orchestrate', 'multi-agent'].includes(firstToken)) {
      return {
        type: 'coordinate',
        action: 'execute',
        target: tokens.slice(1).join(' '),
        args: tokens.slice(1),
        requiresAuth: false,
        isMultiAgent: true,
        complexity: this.assessIntentComplexity(command)
      };
    }

    // System commands
    if (['help', 'version', '--help', '-h'].includes(firstToken)) {
      return {
        type: 'help',
        action: 'show',
        args: tokens.slice(1),
        requiresAuth: false
      };
    }
    
    if (['mode', 'switch'].includes(firstToken)) {
      return {
        type: 'system',
        action: 'switch_mode',
        target: tokens[1],
        args: tokens.slice(2),
        requiresAuth: false,
        preferredMode: tokens[1] as Mode
      };
    }
    
    // Configuration commands
    if (['config', 'configure', 'settings'].includes(firstToken)) {
      return {
        type: 'config',
        action: tokens[1] || 'show',
        target: tokens[2],
        args: tokens.slice(3),
        requiresAuth: false
      };
    }
    
    // Sync commands (Git-like)
    if (['sync', 'push', 'pull', 'status', 'clone', 'fork'].includes(firstToken)) {
      return {
        type: 'sync',
        action: firstToken === 'sync' ? (tokens[1] || 'status') : firstToken,
        target: tokens[firstToken === 'sync' ? 2 : 1],
        args: tokens.slice(firstToken === 'sync' ? 3 : 2),
        requiresAuth: true,
        preferredMode: 'dynamic'
      };
    }
    
    // Thread commands
    if (['thread', 'threads', 'chat', 'conversation'].includes(firstToken)) {
      return {
        type: 'thread',
        action: tokens[1] || 'list',
        target: tokens[2],
        args: tokens.slice(3),
        requiresAuth: false
      };
    }
    
    // Agent commands (most common)
    if (['agent', 'agents', 'create', 'run', 'test', 'deploy'].includes(firstToken)) {
      return {
        type: 'agent',
        action: firstToken === 'agent' || firstToken === 'agents' ? (tokens[1] || 'list') : firstToken,
        target: tokens[firstToken === 'agent' || firstToken === 'agents' ? 2 : 1],
        args: tokens.slice(firstToken === 'agent' || firstToken === 'agents' ? 3 : 2),
        requiresAuth: false
      };
    }
    
    // Natural language fallback - treat as agent creation/modification
    const hasActionWords = tokens.some(token => 
      ['create', 'make', 'build', 'add', 'update', 'modify', 'fix', 'test', 'deploy', 'run'].includes(token)
    );
    
    if (hasActionWords) {
      const actionWord = tokens.find(token => 
        ['create', 'make', 'build', 'add', 'update', 'modify', 'fix', 'test', 'deploy', 'run'].includes(token)
      ) || 'create';
      
      const complexity = this.assessIntentComplexity(command);
      const isMultiAgent = this.shouldConsiderMultiAgent(command);
      
      return {
        type: 'agent',
        action: actionWord,
        target: command, // Use full command as target for natural language
        args: [],
        requiresAuth: false,
        complexity,
        isMultiAgent
      };
    }
    
    // Default: treat as agent-related command
    const complexity = this.assessIntentComplexity(command);
    const isMultiAgent = this.shouldConsiderMultiAgent(command);
    
    return {
      type: 'agent',
      action: 'create',
      target: command,
      args: [],
      requiresAuth: false,
      complexity,
      isMultiAgent
    };
  }

  /**
   * Assess complexity of an intent based on command text
   */
  private assessIntentComplexity(command: string): 'low' | 'medium' | 'high' {
    const lower = command.toLowerCase();
    
    // High complexity indicators
    const highComplexityKeywords = [
      'fullstack', 'multi-service', 'architecture', 'system design',
      'infrastructure', 'migration', 'refactor', 'performance optimization',
      'comprehensive', 'complete implementation', 'end-to-end'
    ];
    
    // Medium complexity indicators  
    const mediumComplexityKeywords = [
      'integration', 'api', 'authentication', 'database', 'testing',
      'deployment', 'frontend', 'backend', 'implement', 'build'
    ];

    for (const keyword of highComplexityKeywords) {
      if (lower.includes(keyword)) return 'high';
    }
    
    for (const keyword of mediumComplexityKeywords) {
      if (lower.includes(keyword)) return 'medium';
    }
    
    return 'low';
  }

  /**
   * Determine if command should consider multi-agent approach
   */
  private shouldConsiderMultiAgent(command: string): boolean {
    const lower = command.toLowerCase();
    
    const multiAgentIndicators = [
      'fullstack', 'comprehensive', 'complete', 'end-to-end',
      'architecture', 'system', 'multi-service', 'multiple',
      'both frontend and backend', 'across the stack'
    ];

    return multiAgentIndicators.some(indicator => lower.includes(indicator));
  }

  /**
   * Public API: Get available agents
   */
  getAvailableAgents(): string[] {
    if (!this.agentRegistry) return [];
    return this.agentRegistry.getAgents().map(agent => agent.name);
  }

  /**
   * Public API: Get multi-agent status
   */
  getMultiAgentStatus(): { enabled: boolean; agentCount: number; sessionStatus?: any } {
    return {
      enabled: this.multiAgentEnabled,
      agentCount: this.agentRegistry?.getAgents().length || 0,
      sessionStatus: this.sessionManager?.getSessionStatus()
    };
  }

  /**
   * Public API: Force multi-agent coordination for a command
   */
  async coordinateCommand(command: string): Promise<CoordinationResult> {
    const intent: CommandIntent = {
      type: 'coordinate',
      action: 'execute',
      target: command,
      args: command.split(' '),
      requiresAuth: false,
      isMultiAgent: true,
      complexity: this.assessIntentComplexity(command)
    };

    return this.coordinateWithMultipleAgents(intent);
  }

  /**
   * Handle mode switching requirements based on intent
   */
  private async handleModeRequirements(intent: CommandIntent): Promise<void> {
    const currentMode = this.modeManager.getCurrentMode();
    
    // If command requires auth but we're in standalone mode
    if (intent.requiresAuth && currentMode === 'standalone') {
      console.log(chalk.yellow('⚠️  This command requires dynamic mode for full functionality'));
      console.log(chalk.gray('Hint: Use "clyde mode dynamic" to switch modes'));
      
      // Ask if user wants to switch
      const response = await this.promptModeSwitch('dynamic');
      if (response) {
        await this.modeManager.switchMode('dynamic');
      }
    }
    
    // If command has preferred mode different from current
    if (intent.preferredMode && intent.preferredMode !== currentMode) {
      console.log(chalk.blue(`💡 This command works best in ${intent.preferredMode} mode`));
      
      const response = await this.promptModeSwitch(intent.preferredMode);
      if (response) {
        await this.modeManager.switchMode(intent.preferredMode);
      }
    }
  }

  /**
   * Prompt user for mode switch
   */
  private async promptModeSwitch(targetMode: Mode): Promise<boolean> {
    // For now, return false to avoid blocking - interactive prompts will be added later
    // This will be implemented with the interactive shell
    return false;
  }

  /**
   * Route command to dynamic engine (Claude Code + Graphyn APIs)
   */
  private async routeToDynamicEngine(intent: CommandIntent): Promise<void> {
    console.log(chalk.cyan('🌐 Using dynamic mode (Claude Code + Graphyn APIs)'));
    
    try {
      switch (intent.type) {
        case 'agent':
          await this.dynamicEngine.handleAgentCommand(intent);
          break;
        case 'sync':
          await this.dynamicEngine.handleSyncCommand(intent);
          break;
        case 'thread':
          await this.dynamicEngine.handleThreadCommand(intent);
          break;
        case 'config':
          await this.handleConfigCommand(intent);
          break;
        case 'system':
          await this.handleSystemCommand(intent);
          break;
        case 'help':
          await this.handleHelpCommand(intent);
          break;
        default:
          console.log(chalk.red(`Unknown command type: ${intent.type}`));
      }
    } catch (error) {
      console.error(chalk.red('❌ Dynamic engine error:'), error);
      
      // Fallback to standalone mode
      console.log(chalk.yellow('🔄 Falling back to standalone mode...'));
      await this.routeToStandaloneEngine(intent);
    }
  }

  /**
   * Route command to standalone engine (pure Claude Code)
   */
  private async routeToStandaloneEngine(intent: CommandIntent): Promise<void> {
    console.log(chalk.blue('🏠 Using standalone mode (pure Claude Code)'));
    
    try {
      switch (intent.type) {
        case 'agent':
          await this.standaloneEngine.handleAgentCommand(intent);
          break;
        case 'sync':
          await this.standaloneEngine.handleSyncCommand(intent);
          break;
        case 'thread':
          await this.standaloneEngine.handleThreadCommand(intent);
          break;
        case 'config':
          await this.handleConfigCommand(intent);
          break;
        case 'system':
          await this.handleSystemCommand(intent);
          break;
        case 'help':
          await this.handleHelpCommand(intent);
          break;
        default:
          console.log(chalk.red(`Unknown command type: ${intent.type}`));
      }
    } catch (error) {
      console.error(chalk.red('❌ Standalone engine error:'), error);
    }
  }

  /**
   * Handle configuration commands
   */
  private async handleConfigCommand(intent: CommandIntent): Promise<void> {
    switch (intent.action) {
      case 'show':
      case 'get':
        const config = this.modeManager.getConfig();
        console.log(chalk.blue('Current Configuration:'));
        console.log(JSON.stringify(config, null, 2));
        break;
        
      case 'set':
        if (!intent.target || !intent.args[0]) {
          console.log(chalk.red('Usage: config set <key> <value>'));
          return;
        }
        
        const updates: any = {};
        updates[intent.target] = intent.args[0];
        await this.modeManager.updateConfig(updates);
        console.log(chalk.green(`✅ Updated ${intent.target} to ${intent.args[0]}`));
        break;
        
      default:
        console.log(chalk.yellow(`Unknown config action: ${intent.action}`));
        console.log(chalk.gray('Available actions: show, set'));
    }
  }

  /**
   * Handle system commands
   */
  private async handleSystemCommand(intent: CommandIntent): Promise<void> {
    switch (intent.action) {
      case 'switch_mode':
        if (!intent.target) {
          console.log(chalk.red('Usage: mode <standalone|dynamic>'));
          return;
        }
        
        const targetMode = intent.target as Mode;
        if (targetMode !== 'standalone' && targetMode !== 'dynamic') {
          console.log(chalk.red('Mode must be "standalone" or "dynamic"'));
          return;
        }
        
        await this.modeManager.switchMode(targetMode);
        break;
        
      default:
        console.log(chalk.yellow(`Unknown system action: ${intent.action}`));
    }
  }

  /**
   * Handle help commands
   */
  private async handleHelpCommand(intent: CommandIntent): Promise<void> {
    const currentMode = this.modeManager.getCurrentMode();
    const modeStatus = this.modeManager.getModeStatus();
    const multiAgentStatus = this.getMultiAgentStatus();
    
    console.log(chalk.cyan.bold('🤖 Clyde - Smart Claude Code Orchestrator'));
    console.log(chalk.gray(`Currently in ${modeStatus} mode`));
    
    if (multiAgentStatus.enabled) {
      console.log(chalk.green(`🎭 Multi-Agent Coordination: Enabled (${multiAgentStatus.agentCount} agents loaded)`));
    } else {
      console.log(chalk.yellow('🎭 Multi-Agent Coordination: Disabled'));
    }
    console.log();
    
    console.log(chalk.blue('🎯 Agent Commands:'));
    console.log('  clyde create <description>     Create agent from description');
    console.log('  clyde agent list               List all agents');
    console.log('  clyde run <agent>              Run agent interactively');
    console.log('  clyde test <agent>             Test agent behavior');
    console.log('  clyde deploy <agent>           Deploy agent to production');
    
    if (multiAgentStatus.enabled) {
      console.log(chalk.blue('\n🎭 Multi-Agent Commands:'));
      console.log('  clyde coordinate <task>        Coordinate task across multiple agents');
      console.log('  clyde orchestrate <request>    Orchestrate complex multi-step requests');
      console.log('  clyde multi-agent status       Show multi-agent system status');
      console.log('  clyde agents list              List all available specialized agents');
    }
    
    console.log(chalk.blue('\n🔄 Sync Commands (Git-like):'));
    console.log('  clyde sync status              Show sync status');
    console.log('  clyde sync push                Push local agents to cloud');
    console.log('  clyde sync pull                Pull updates from cloud');
    console.log('  clyde clone <org/repo>         Clone agent repository');
    
    console.log(chalk.blue('\n💬 Thread Commands:'));
    console.log('  clyde thread list              List all threads');
    console.log('  clyde thread create <name>     Create new thread');
    console.log('  clyde chat <thread>            Start interactive chat');
    
    console.log(chalk.blue('\n⚙️  System Commands:'));
    console.log('  clyde mode <standalone|dynamic> Switch between modes');
    console.log('  clyde config show              Show current configuration');
    console.log('  clyde config set <key> <value> Update configuration');
    
    console.log(chalk.blue('\n🏠 Standalone Mode:'));
    console.log('  • Works entirely through Claude Code');
    console.log('  • Local development and testing');
    console.log('  • No authentication required');
    
    console.log(chalk.blue('\n🌐 Dynamic Mode:'));
    console.log('  • Integrates with Graphyn APIs');
    console.log('  • Team collaboration features');
    console.log('  • Cloud sync and deployment');
    console.log('  • Requires authentication');
    
    if (currentMode === 'standalone') {
      console.log(chalk.yellow('\n💡 Tip: Switch to dynamic mode for team collaboration'));
      console.log(chalk.gray('   clyde mode dynamic'));
    }
  }

  /**
   * Get current mode status for display
   */
  getModeStatus(): string {
    return this.modeManager.getModeStatus();
  }
}