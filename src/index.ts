#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import inquirer from 'inquirer';
import { AuthManager } from './auth';
import { AgentManager } from './agents';
import { GraphynMDManager } from './graphyn-md';
import { createThreadsCommand } from './commands/threads';
import { createAgentsCommand } from './commands/agents';
import { createDesignCommand } from './commands/design';
import { createDoctorCommand } from './commands/doctor';
import { createSetupCommand } from './commands/setup';
import { version } from '../package.json';
import { 
  colors, 
  createBanner, 
  createAgentHeader, 
  createSuccessBox,
  createErrorBox,
  createTipBox,
  createDivider
} from './ui';
import { isFirstRun, runFirstTimeSetup } from './setup/first-run-wizard';

// Initialize CLI
const program = new Command();

// Configure CLI with async banner
(async () => {
  const banner = await createBanner();
  
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
      console.log(createSuccessBox('You can now use all Graphyn Code features.'));
    } catch (error) {
      spinner.fail('Authentication failed');
      console.log(createErrorBox(error instanceof Error ? error.message : 'Unknown error'));
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

// CLI agent
program
  .command('cli [query]')
  .description('Query the CLI development specialist agent')
  .action(async (query?: string) => {
    if (query) {
      await runAgent('cli', query);
    } else {
      await runInteractiveAgent('cli');
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

// Threads command
program.addCommand(createThreadsCommand());

// Agents command
program.addCommand(createAgentsCommand());

// Design command
program.addCommand(createDesignCommand());

// Doctor command
program.addCommand(createDoctorCommand());

// Setup command
program.addCommand(createSetupCommand());

// History command
program
  .command('history')
  .description('Show recent agent interactions')
  .option('-n, --number <count>', 'Number of interactions to show', '10')
  .action(async (options) => {
    const { GraphynLogger } = await import('./logger');
    const logger = new GraphynLogger();
    const interactions = logger.getRecentInteractions(parseInt(options.number));
    
    if (interactions.length === 0) {
      console.log(colors.info('No recent interactions found.'));
      return;
    }
    
    console.log(colors.primary('\n📜 Recent Graphyn Interactions'));
    console.log(colors.dim('─'.repeat(60)));
    
    interactions.forEach((interaction, index) => {
      const date = new Date(interaction.timestamp);
      const timeStr = date.toLocaleString();
      
      console.log();
      console.log(colors.accent(`${index + 1}. ${interaction.agent} agent`));
      console.log(colors.dim(`   Time: ${timeStr}`));
      console.log(colors.info(`   Query: ${interaction.query}`));
      console.log(colors.dim(`   File: ${interaction.contextFile}`));
    });
    
    console.log();
    console.log(colors.dim(`💡 Contexts saved in: ~/.graphyn/contexts/`));
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
  console.log();
  console.log(createAgentHeader(type));
  console.log();
  console.log(colors.info('Query: ') + colors.bold(query));
  console.log(createDivider());
  
  const spinner = ora('Analyzing your request...').start();
  
  try {
    const response = await agentManager.queryAgent(type, query);
    spinner.stop();
    // Only print response if it's not a status message
    if (response && response !== 'context-saved' && response !== 'interactive-saved' && response !== 'claude-launched') {
      console.log(response);
    }
  } catch (error) {
    spinner.fail('Request failed');
    console.error(colors.error(error instanceof Error ? error.message : 'Unknown error'));
  }
}

// Helper function for interactive agent sessions
async function runInteractiveAgent(type: string) {
  const agentManager = new AgentManager();
  
  console.log();
  console.log(createAgentHeader(type, 'Interactive Mode'));
  console.log();
  console.log(createTipBox('Type your questions and press Enter. Type "exit" to quit.'));
  console.log();
  
  // Start interactive Claude session with context
  await agentManager.startInteractiveSession(type);
}

  // Add interactive command
  program
    .command('interactive')
    .alias('i')
    .description('Start interactive mode')
    .action(async () => {
      const { interactiveMenu } = await import('./interactive');
      await interactiveMenu();
    });

  // Check for first run (skip for certain commands)
  const skipSetupCommands = ['--version', '-V', '--help', '-h', 'doctor', 'setup'];
  const shouldCheckFirstRun = !process.argv.slice(2).some(arg => skipSetupCommands.includes(arg));
  
  if (shouldCheckFirstRun && await isFirstRun()) {
    await runFirstTimeSetup();
    return; // Exit after setup
  }
  
  // Show interactive menu if no arguments
  if (!process.argv.slice(2).length) {
    const { interactiveMenu } = await import('./interactive');
    await interactiveMenu();
  } else {
    // Parse arguments only if we have them
    program.parse(process.argv);
  }
})();