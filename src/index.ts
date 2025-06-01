#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { AuthManager } from './auth';
import { AgentManager } from './agents';
import { GraphynMDManager } from './graphyn-md';
import { version } from '../package.json';

// Initialize CLI
const program = new Command();

// Brand colors
const colors = {
  primary: chalk.hex('#3267F5'),
  secondary: chalk.hex('#C0B7FD'),
  accent: chalk.hex('#A67763'),
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray
};

// ASCII Banner
const banner = `
${colors.primary('╔══════════════════════════════════════════════════════════╗')}
${colors.primary('║')}                  ${colors.secondary('🚀 Graphyn Code')}                        ${colors.primary('║')}
${colors.primary('║')}        ${colors.info('Free AI Development Tool for Claude Code Users')}   ${colors.primary('║')}
${colors.primary('╚══════════════════════════════════════════════════════════╝')}
`;

// Configure CLI
program
  .name('graphyn')
  .description('AI development agents in your terminal')
  .version(version)
  .addHelpText('before', banner);

// Auth command
program
  .command('auth [apiKey]')
  .description('Authenticate with your Graphyn API key')
  .action(async (apiKey?: string) => {
    const authManager = new AuthManager();
    
    if (!apiKey) {
      const answers = await inquirer.prompt([{
        type: 'password',
        name: 'apiKey',
        message: 'Enter your API key:',
        validate: (input) => input.startsWith('gph_') || 'API key must start with gph_'
      }]);
      apiKey = answers.apiKey;
    }
    
    const spinner = ora('Authenticating...').start();
    
    try {
      await authManager.authenticate(apiKey!);
      spinner.succeed('Authentication successful!');
      console.log(colors.info('You can now use all Graphyn Code features.'));
    } catch (error) {
      spinner.fail('Authentication failed');
      console.error(colors.error(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// Backend agent
program
  .command('backend [query]')
  .alias('b')
  .description('Query the backend development agent')
  .action(async (query?: string) => {
    if (query) {
      await runAgent('backend', query);
    } else {
      await runInteractiveAgent('backend');
    }
  });

// Frontend agent  
program
  .command('frontend [query]')
  .alias('f')
  .description('Query the frontend development agent')
  .action(async (query?: string) => {
    if (query) {
      await runAgent('frontend', query);
    } else {
      await runInteractiveAgent('frontend');
    }
  });

// Architect agent
program
  .command('architect [query]')
  .alias('a')
  .description('Query the software architect agent')
  .action(async (query?: string) => {
    if (query) {
      await runAgent('architect', query);
    } else {
      await runInteractiveAgent('architect');
    }
  });

// Chain agents
program
  .command('chain <query>')
  .alias('c')
  .description('Chain all agents together for complex tasks')
  .action(async (query: string) => {
    const agentManager = new AgentManager();
    const spinner = ora('Orchestrating agents...').start();
    
    try {
      await agentManager.chainAgents(query);
      spinner.succeed('Agent chain completed!');
    } catch (error) {
      spinner.fail('Chain execution failed');
      console.error(colors.error(error instanceof Error ? error.message : 'Unknown error'));
    }
  });

// GRAPHYN.md commands
program
  .command('init')
  .description('Initialize GRAPHYN.md in current directory')
  .action(async () => {
    const graphynManager = new GraphynMDManager();
    await graphynManager.init();
  });

program
  .command('sync <action>')
  .description('Sync GRAPHYN.md (pull|push|edit)')
  .action(async (action: string) => {
    const graphynManager = new GraphynMDManager();
    
    switch (action) {
      case 'pull':
        await graphynManager.pull();
        break;
      case 'push':
        await graphynManager.push();
        break;
      case 'edit':
        await graphynManager.edit();
        break;
      default:
        console.error(colors.error(`Unknown action: ${action}`));
        console.log('Use: sync pull|push|edit');
    }
  });

// Status command
program
  .command('status')
  .description('Show agent customization status')
  .action(async () => {
    const graphynManager = new GraphynMDManager();
    await graphynManager.showStatus();
  });

// Whoami command
program
  .command('whoami')
  .description('Show authentication status')
  .action(async () => {
    const authManager = new AuthManager();
    await authManager.showStatus();
  });

// Logout command
program
  .command('logout')
  .description('Remove authentication')
  .action(async () => {
    const authManager = new AuthManager();
    await authManager.logout();
  });

// Helper function to run agents
async function runAgent(type: string, query: string) {
  const agentManager = new AgentManager();
  const authManager = new AuthManager();
  
  // Check auth
  if (!await authManager.isAuthenticated()) {
    console.log(colors.warning('⚠️  Not authenticated. Using local prompts.'));
    console.log(colors.info('Run "graphyn auth" to unlock all features.'));
    console.log();
  }
  
  // Show agent header
  const agentIcons = {
    backend: '🔧',
    frontend: '🎨',
    architect: '🏗️'
  };
  
  console.log();
  console.log(colors.primary('╭─────────────────────────────────────────╮'));
  console.log(colors.primary('│') + `  ${chalk.bold.white(`${type.charAt(0).toUpperCase() + type.slice(1)} Agent`)} ${agentIcons[type as keyof typeof agentIcons]}                     ` + colors.primary('│'));
  console.log(colors.primary('╰─────────────────────────────────────────╯'));
  console.log();
  console.log(colors.info(`Query: ${query}`));
  console.log();
  
  const spinner = ora('Analyzing your request...').start();
  
  try {
    const response = await agentManager.queryAgent(type, query);
    spinner.stop();
    console.log(response);
  } catch (error) {
    spinner.fail('Request failed');
    console.error(colors.error(error instanceof Error ? error.message : 'Unknown error'));
  }
}

// Helper function for interactive agent sessions
async function runInteractiveAgent(type: string) {
  const agentManager = new AgentManager();
  
  // Show agent header
  const agentIcons = {
    backend: '🔧',
    frontend: '🎨',
    architect: '🏗️'
  };
  
  console.log();
  console.log(colors.primary('╭─────────────────────────────────────────╮'));
  console.log(colors.primary('│') + `  ${chalk.bold.white(`${type.charAt(0).toUpperCase() + type.slice(1)} Agent`)} ${agentIcons[type as keyof typeof agentIcons]} - Interactive Mode         ` + colors.primary('│'));
  console.log(colors.primary('╰─────────────────────────────────────────╯'));
  console.log();
  console.log(colors.info('Type your questions and press Enter. Type "exit" to quit.'));
  console.log();
  
  // Start interactive Claude session with context
  await agentManager.startInteractiveSession(type);
}

// Parse arguments
program.parse(process.argv);

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}