import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { OAuthManager } from '../auth/oauth.js';
import { AgentRevivalService } from '../services/agent-revival.js';
import { checkSystemRequirements } from '../utils/system-check.js';
import { ConfigManager } from '../config-manager.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold
};

export interface InitOptions {
  skipAuth?: boolean;
  skipAgentRevival?: boolean;
  skipSystemCheck?: boolean;
  force?: boolean;
}

export class InitCommand {
  private authManager: OAuthManager;
  private revivalService: AgentRevivalService;
  private configManager: ConfigManager;
  
  constructor() {
    this.authManager = new OAuthManager();
    this.revivalService = new AgentRevivalService();
    this.configManager = new ConfigManager();
  }
  
  /**
   * Run the initialization flow
   */
  async run(options: InitOptions = {}): Promise<void> {
    console.log(colors.bold('\n🚀 Welcome to Graphyn Code!\n'));
    console.log(colors.info('Let\'s get you set up...\n'));
    
    try {
      // Step 1: System requirements check
      if (!options.skipSystemCheck) {
        await this.checkSystem();
      }
      
      // Step 2: Authentication
      if (!options.skipAuth) {
        await this.checkAuthentication();
      }
      
      // Step 3: Project initialization
      await this.initializeProject(options);
      
      // Step 4: Agent revival (the GAME CHANGER!)
      if (!options.skipAgentRevival) {
        await this.checkForAgentRevival();
      }
      
      // Step 5: Show next steps
      this.showNextSteps();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(colors.error(`\n❌ Initialization failed: ${errorMessage}`));
      process.exit(1);
    }
  }
  
  /**
   * Check system requirements
   */
  private async checkSystem(): Promise<void> {
    const spinner = ora('Checking system requirements...').start();
    
    try {
      const requirements = await checkSystemRequirements();
      
      if (requirements.allPassed) {
        spinner.succeed('System requirements checked');
      } else {
        spinner.warn('Some system requirements are missing');
        
        const missing = [];
        if (!requirements.node) missing.push('Node.js');
        if (!requirements.git) missing.push('Git');
        if (!requirements.tmux) missing.push('tmux (optional but recommended)');
        
        if (missing.length > 0) {
          console.log(colors.warning(`\n⚠️  Missing: ${missing.join(', ')}`));
          console.log(colors.info('Some features may not work without these tools.\n'));
        }
      }
    } catch (error) {
      spinner.fail('Failed to check system requirements');
    }
  }
  
  /**
   * Check and handle authentication
   */
  private async checkAuthentication(): Promise<void> {
    const spinner = ora('Checking authentication...').start();
    
    try {
      const isAuthenticated = await this.authManager.isAuthenticated();
      
      if (isAuthenticated) {
        spinner.succeed('Already authenticated');
        
        // Get user info if available
        const userConfig = await this.configManager.get('auth.user');
        if (userConfig) {
          console.log(colors.success(`   ✓ Logged in as: ${userConfig.email}`));
          if (userConfig.orgID) {
            console.log(colors.info(`   Organization: ${userConfig.orgID}`));
          }
        }
      } else {
        spinner.info('Not authenticated');
        
        const { authenticate } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'authenticate',
            message: 'Would you like to authenticate now?',
            default: true
          }
        ]);
        
        if (authenticate) {
          console.log(colors.highlight('\n🔐 Starting authentication...\n'));
          await this.authManager.authenticate();
        } else {
          console.log(colors.info('\nYou can authenticate later by running "graphyn auth"'));
        }
      }
    } catch (error) {
      spinner.fail('Authentication check failed');
      console.log(colors.info('You can authenticate later by running "graphyn auth"'));
    }
  }
  
  /**
   * Initialize project configuration
   */
  private async initializeProject(options: InitOptions): Promise<void> {
    // Check if .graphyn directory exists
    const graphynDir = path.join(process.cwd(), '.graphyn');
    
    if (fs.existsSync(graphynDir) && !options.force) {
      console.log(colors.info('\n✓ Project already initialized (.graphyn directory exists)'));
      return;
    }
    
    const spinner = ora('Initializing project...').start();
    
    try {
      // Create .graphyn directory
      if (!fs.existsSync(graphynDir)) {
        fs.mkdirSync(graphynDir, { recursive: true });
      }
      
      // Create default configuration
      const configPath = path.join(graphynDir, 'config.json');
      if (!fs.existsSync(configPath) || options.force) {
        const defaultConfig = {
          version: '1.0.0',
          project: {
            name: path.basename(process.cwd()),
            initialized: new Date().toISOString()
          },
          agents: {
            imported: []
          }
        };
        
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      }
      
      spinner.succeed('Project initialized');
      console.log(colors.success(`   ✓ Created .graphyn directory`));
      
    } catch (error) {
      spinner.fail('Failed to initialize project');
      throw error;
    }
  }
  
  /**
   * Check for static agents and offer revival (GAME CHANGER!)
   */
  private async checkForAgentRevival(): Promise<void> {
    console.log(colors.highlight('\n🎯 Checking for static agents...\n'));
    
    try {
      const hasAgents = await this.revivalService.hasAgentsToRevive();
      
      if (hasAgents) {
        console.log(colors.bold('✨ GAME CHANGER ALERT! ✨'));
        console.log(colors.highlight('\nWe found static .claude/agents that can be brought to life!'));
        console.log(colors.info('Transform your static prompts into living, learning agents on Graphyn.\n'));
        
        const { revive } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'revive',
            message: 'Would you like to bring your static agents to life?',
            default: true
          }
        ]);
        
        if (revive) {
          await this.revivalService.reviveAgents({
            interactive: true
          });
        } else {
          console.log(colors.info('\nYou can revive agents later by running "graphyn agents revive"'));
        }
      } else {
        console.log(colors.info('No static agents found.'));
        console.log(colors.info('Create .claude/agents/*.md files to define agents that can be brought to life!'));
      }
    } catch (error) {
      console.error(colors.warning('Could not check for agents:'), error);
    }
  }
  
  /**
   * Show next steps to the user
   */
  private showNextSteps(): void {
    console.log(colors.bold('\n✅ Setup Complete!\n'));
    console.log(colors.highlight('Next steps:'));
    console.log();
    console.log('  1. Create agents:');
    console.log(colors.info('     graphyn "Create an agent that reviews code"'));
    console.log();
    console.log('  2. Launch the GUI:');
    console.log(colors.info('     graphyn'));
    console.log();
    console.log('  3. Revive static agents:');
    console.log(colors.info('     graphyn agents revive'));
    console.log();
    console.log('  4. Start MCP server for Claude:');
    console.log(colors.info('     graphyn mcp'));
    console.log();
    console.log(colors.highlight('Learn more at https://docs.graphyn.xyz'));
  }
}

/**
 * Run the init command
 */
export async function init(options: InitOptions = {}): Promise<void> {
  const command = new InitCommand();
  await command.run(options);
}