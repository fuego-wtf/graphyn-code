/**
 * Interactive Shell - Rich command-line interface for Clyde
 * Provides auto-completion, command history, and intuitive user experience
 */

/// <reference path="../types/globals.d.ts" />
import * as readline from 'readline';
import chalk from 'chalk';
import { SmartCoordinator } from '../coordinator/smart-coordinator.js';
import { ModeManager } from './mode-manager.js';
import { ContextPreservingSession } from './context-preserving-session.js';

export interface InteractiveShellOptions {
  coordinator: SmartCoordinator;
  modeManager: ModeManager;
  session: ContextPreservingSession;
}

export class InteractiveShell {
  private coordinator: SmartCoordinator;
  private modeManager: ModeManager;
  private session: ContextPreservingSession;
  private rl?: readline.Interface;
  private isRunning: boolean = false;
  private commandHistory: string[] = [];

  constructor(options: InteractiveShellOptions) {
    this.coordinator = options.coordinator;
    this.modeManager = options.modeManager;
    this.session = options.session;
    
    // Load command history from session
    this.commandHistory = this.session.getRecentCommands(50).map(cmd => cmd.command);
  }

  /**
   * Start the interactive shell
   */
  async start(): Promise<void> {
    this.isRunning = true;
    
    // Display welcome message
    this.showWelcome();
    
    // Setup readline interface
    this.setupReadline();
    
    // Show initial prompt
    this.showPrompt();
    
    // Keep shell running
    return new Promise((resolve) => {
      const checkRunning = () => {
        if (!this.isRunning) {
          resolve();
        } else {
          setTimeout(checkRunning, 100);
        }
      };
      checkRunning();
    });
  }

  /**
   * Stop the interactive shell
   */
  stop(): void {
    this.isRunning = false;
    if (this.rl) {
      this.rl.close();
    }
  }

  /**
   * Setup readline interface with auto-completion
   */
  private setupReadline(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      history: this.commandHistory,
      historySize: 100,
      completer: this.completer.bind(this)
    });

    // Handle line input
    this.rl.on('line', async (input: string) => {
      await this.handleInput(input.trim());
    });

    // Handle SIGINT (Ctrl+C)
    this.rl.on('SIGINT', () => {
      console.log('\n👋 Goodbye!');
      this.stop();
      process.exit(0);
    });

    // Handle close
    this.rl.on('close', () => {
      this.stop();
    });
  }

  /**
   * Auto-completion function
   */
  private completer(line: string): [string[], string] {
    const completions = this.getCompletions();
    const hits = completions.filter(c => c.startsWith(line));
    
    // Return all completions if none match
    return [hits.length ? hits : completions, line];
  }

  /**
   * Get available completions based on current context
   */
  private getCompletions(): string[] {
    const currentMode = this.modeManager.getCurrentMode();
    
    const baseCommands = [
      // Agent commands
      'create', 'agent list', 'agent create', 'run', 'test', 'deploy',
      
      // Thread commands
      'thread list', 'thread create', 'chat', 'conversation',
      
      // System commands
      'mode standalone', 'mode dynamic', 'help', 'config show', 'config set',
      
      // Quick actions
      'list', 'status'
    ];
    
    const syncCommands = [
      'sync status', 'sync push', 'sync pull', 'clone', 'fork'
    ];
    
    // Add sync commands in dynamic mode
    if (currentMode === 'dynamic') {
      baseCommands.push(...syncCommands);
    }
    
    // Add recent command patterns
    const recentPatterns = this.commandHistory
      .slice(-10)
      .map(cmd => cmd.split(' ')[0])
      .filter((cmd, index, arr) => arr.indexOf(cmd) === index);
    
    baseCommands.push(...recentPatterns);
    
    return baseCommands.sort();
  }

  /**
   * Handle user input
   */
  private async handleInput(input: string): Promise<void> {
    if (!input) {
      this.showPrompt();
      return;
    }

    // Handle shell commands
    if (input === 'exit' || input === 'quit') {
      console.log(chalk.yellow('👋 Goodbye!'));
      this.stop();
      return;
    }
    
    if (input === 'clear' || input === 'cls') {
      console.clear();
      this.showWelcome();
      this.showPrompt();
      return;
    }
    
    if (input === 'history') {
      this.showHistory();
      this.showPrompt();
      return;
    }

    // Add to command history
    this.commandHistory.push(input);
    if (this.commandHistory.length > 100) {
      this.commandHistory = this.commandHistory.slice(-100);
    }

    try {
      // Process command through coordinator
      await this.coordinator.processCommand(input);
      
      // Record command in session
      this.session.addCommand(input, this.modeManager.getCurrentMode(), 'success');
      
    } catch (error) {
      console.error(chalk.red('❌ Command failed:'), error);
      this.session.addCommand(input, this.modeManager.getCurrentMode(), 'error');
    }

    // Show prompt for next command
    this.showPrompt();
  }

  /**
   * Show welcome message and current status
   */
  private showWelcome(): void {
    const modeStatus = this.modeManager.getModeStatus();
    const context = this.session.getContext();
    
    // Show Graphyn banner
    console.log(chalk.cyan.bold(`
╔════════════════════════════════════════════════════════════════════════════════╗
║                                                                                ║
║        ██████╗ ██████╗  █████╗ ██████╗ ██╗  ██╗██╗   ██╗███╗   ██╗             ║
║       ██╔════╝ ██╔══██╗██╔══██╗██╔══██╗██║  ██║╚██╗ ██╔╝████╗  ██║             ║
║       ██║  ███╗██████╔╝███████║██████╔╝███████║ ╚████╔╝ ██╔██╗ ██║             ║
║       ██║   ██║██╔══██╗██╔══██║██╔═══╝ ██╔══██║  ╚██╔╝  ██║╚██╗██║             ║
║       ╚██████╔╝██║  ██║██║  ██║██║     ██║  ██║   ██║   ██║ ╚████║             ║
║        ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═══╝             ║
║                                                                                ║
║                      Smart Claude Code Orchestrator                           ║
║                        Powered by Task Tool                                   ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝
`));

    console.log(chalk.green('🚀 Graphyn AI Terminal initialized'));
    console.log(chalk.gray(`Mode: ${modeStatus}`));
    
    if (context.currentProject) {
      console.log(chalk.gray(`Project: ${context.currentProject.name}${context.currentProject.framework ? ` (${context.currentProject.framework})` : ''}`));
    }
    
    // Claude Code integration status
    console.log('');
    if (typeof Task !== 'undefined') {
      console.log(chalk.green('✅ Claude Code Task tool detected - Full functionality available'));
    } else {
      console.log(chalk.yellow('⚠️  Claude Code Task tool not available'));
      console.log(chalk.gray('   For full functionality, run within Claude Code environment'));
      console.log(chalk.blue('   💡 Install: bun add --global @anthropic/claude-code'));
    }
    
    console.log('');
    console.log(chalk.blue('🏠 Graphyn AI Terminal (standalone auto-detected)'));
    console.log(chalk.white('✨ Everything is auto-managed. Just tell me what you want to build.'));
    console.log(chalk.white('🚀 Sessions, agents, and modes are handled automatically.'));
    
    console.log('');
    console.log(chalk.gray('📊 Status: ready | Mode: standalone'));
    console.log(chalk.gray('📈 Tasks executed: 0 (ready to start)'));
    
    // Show quick tips
    console.log('');
    console.log(chalk.yellow('💡 Examples:'));
    console.log(chalk.gray('  • create "a helpful code reviewer that checks for security issues"'));
    console.log(chalk.gray('  • build a React component for user authentication'));
    console.log(chalk.gray('  • test the current project'));
    console.log(chalk.gray('  • help - Show all available commands'));
    console.log(chalk.gray('  • exit - Close Clyde'));
    
    console.log(''); // Empty line before prompt
  }

  /**
   * Show command prompt
   */
  private showPrompt(): void {
    if (!this.rl || !this.isRunning) return;
    
    const currentMode = this.modeManager.getCurrentMode();
    const modeIcon = currentMode === 'dynamic' ? '🌐' : '🏠';
    const modeColor = currentMode === 'dynamic' ? 'cyan' : 'blue';
    
    const prompt = chalk[modeColor](`${modeIcon} graphyn `) + chalk.gray('› ');
    
    this.rl.setPrompt(prompt);
    this.rl.prompt();
  }

  /**
   * Show command history
   */
  private showHistory(): void {
    if (this.commandHistory.length === 0) {
      console.log(chalk.gray('No command history'));
      return;
    }
    
    console.log(chalk.blue('Command History:'));
    const recent = this.commandHistory.slice(-10);
    recent.forEach((cmd, index) => {
      const number = this.commandHistory.length - recent.length + index + 1;
      console.log(chalk.gray(`  ${number}. ${cmd}`));
    });
  }

  /**
   * Show contextual help
   */
  async showContextualHelp(): Promise<void> {
    const currentMode = this.modeManager.getCurrentMode();
    const context = this.session.getContext();
    
    console.log(chalk.cyan.bold('🤖 Graphyn Help'));
    console.log(chalk.gray(`Current mode: ${this.modeManager.getModeStatus()}\n`));
    
    // Show mode-specific commands
    if (currentMode === 'standalone') {
      console.log(chalk.blue('🏠 Standalone Mode Commands:'));
      console.log('  create <description>       Create a new agent');
      console.log('  list                       Show available agents');
      console.log('  run <agent>                Run an agent');
      console.log('  test <agent>               Test an agent');
      console.log('  mode dynamic               Switch to dynamic mode');
    } else {
      console.log(chalk.blue('🌐 Dynamic Mode Commands:'));
      console.log('  create <description>       Create a remote agent');
      console.log('  list                       Show remote agents');
      console.log('  run <agent>                Run a remote agent');
      console.log('  deploy <agent>             Deploy to production');
      console.log('  sync status                Show sync status');
      console.log('  sync push                  Push local changes');
      console.log('  sync pull                  Pull remote changes');
      console.log('  thread list                Show team threads');
      console.log('  thread create <name>       Create a new thread');
    }
    
    console.log(chalk.blue('\n⚙️  General Commands:'));
    console.log('  help                       Show this help');
    console.log('  config show                Show configuration');
    console.log('  history                    Show command history');
    console.log('  clear                      Clear screen');
    console.log('  exit                       Exit Graphyn');
    
    // Show project context
    if (context.currentProject) {
      console.log(chalk.blue('\n📁 Current Project:'));
      console.log(`  Name: ${context.currentProject.name}`);
      if (context.currentProject.framework) {
        console.log(`  Framework: ${context.currentProject.framework}`);
      }
      console.log(`  Path: ${context.currentProject.path}`);
    }
    
    // Show recent activity
    const recentCommands = context.commandHistory.slice(-3);
    if (recentCommands.length > 0) {
      console.log(chalk.blue('\n📝 Recent Activity:'));
      recentCommands.forEach(cmd => {
        const status = cmd.result === 'success' ? '✅' : 
                      cmd.result === 'error' ? '❌' : '⚠️';
        console.log(`  ${status} ${cmd.command}`);
      });
    }
    
    // Show tips
    console.log(chalk.blue('\n💡 Tips:'));
    console.log('  • Use Tab for auto-completion');
    console.log('  • Use arrow keys to navigate command history');
    console.log('  • Describe what you want in natural language');
    
    if (currentMode === 'standalone') {
      console.log(chalk.gray('  • Switch to dynamic mode for team features'));
    } else {
      console.log(chalk.gray('  • Use sync commands to collaborate with team'));
    }
  }

  /**
   * Show status information
   */
  async showStatus(): Promise<void> {
    const context = this.session.getContext();
    const currentMode = this.modeManager.getCurrentMode();
    
    console.log(chalk.blue('📊 Graphyn Status:'));
    console.log(`  Mode: ${this.modeManager.getModeStatus()}`);
    console.log(`  Session: ${context.sessionId.substring(0, 8)}...`);
    console.log(`  Commands: ${context.commandHistory.length}`);
    console.log(`  Active Agents: ${context.activeAgents.length}`);
    
    if (context.currentProject) {
      console.log(`  Project: ${context.currentProject.name}`);
      console.log(`  Directory: ${context.contextData.workingDirectory}`);
    }
    
    // Show sync status in dynamic mode
    if (currentMode === 'dynamic') {
      console.log(`  Last Sync: ${context.contextData.lastSync ? this.formatRelativeTime(context.contextData.lastSync) : 'never'}`);
    }
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

  /**
   * Handle special shell commands
   */
  private async handleShellCommand(command: string): Promise<boolean> {
    switch (command.toLowerCase()) {
      case 'help':
        await this.showContextualHelp();
        return true;
        
      case 'status':
        await this.showStatus();
        return true;
        
      case 'mode':
        const currentMode = this.modeManager.getCurrentMode();
        console.log(`Current mode: ${this.modeManager.getModeStatus()}`);
        console.log(chalk.gray(`Switch with: mode ${currentMode === 'standalone' ? 'dynamic' : 'standalone'}`));
        return true;
        
      default:
        return false;
    }
  }
}
