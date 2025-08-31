/**
 * Smart Coordinator - Intelligent command routing and intent parsing
 * Routes commands to standalone or dynamic engines based on current mode
 */

import { ModeManager, type Mode } from '../clyde/mode-manager.js';
import { StandaloneEngine } from '../engines/standalone-engine.js';
import { DynamicEngine } from '../engines/dynamic-engine.js';
import { ContextPreservingSession } from '../clyde/context-preserving-session.js';
import chalk from 'chalk';

export interface SmartCoordinatorOptions {
  modeManager: ModeManager;
  standaloneEngine: StandaloneEngine;
  dynamicEngine: DynamicEngine;
  session: ContextPreservingSession;
}

export interface CommandIntent {
  type: 'agent' | 'sync' | 'thread' | 'config' | 'help' | 'system';
  action: string;
  target?: string;
  args: string[];
  requiresAuth: boolean;
  preferredMode?: Mode;
}

export class SmartCoordinator {
  private modeManager: ModeManager;
  private standaloneEngine: StandaloneEngine;
  private dynamicEngine: DynamicEngine;
  private session: ContextPreservingSession;

  constructor(options: SmartCoordinatorOptions) {
    this.modeManager = options.modeManager;
    this.standaloneEngine = options.standaloneEngine;
    this.dynamicEngine = options.dynamicEngine;
    this.session = options.session;
  }

  /**
   * Process a command through intelligent intent parsing and routing
   */
  async processCommand(command: string): Promise<void> {
    const intent = this.parseIntent(command);
    
    console.log(chalk.gray(`📝 Intent: ${intent.type}.${intent.action}${intent.target ? ` → ${intent.target}` : ''}`));
    
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
   * Parse natural language commands into structured intents
   */
  private parseIntent(command: string): CommandIntent {
    const tokens = command.toLowerCase().split(' ').filter(t => t.length > 0);
    const firstToken = tokens[0];
    
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
      
      return {
        type: 'agent',
        action: actionWord,
        target: command, // Use full command as target for natural language
        args: [],
        requiresAuth: false
      };
    }
    
    // Default: treat as agent-related command
    return {
      type: 'agent',
      action: 'create',
      target: command,
      args: [],
      requiresAuth: false
    };
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
    
    console.log(chalk.cyan.bold('🤖 Clyde - Smart Claude Code Orchestrator'));
    console.log(chalk.gray(`Currently in ${modeStatus} mode\n`));
    
    console.log(chalk.blue('🎯 Agent Commands:'));
    console.log('  clyde create <description>     Create agent from description');
    console.log('  clyde agent list               List all agents');
    console.log('  clyde run <agent>              Run agent interactively');
    console.log('  clyde test <agent>             Test agent behavior');
    console.log('  clyde deploy <agent>           Deploy agent to production');
    
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