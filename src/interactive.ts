import inquirer from 'inquirer';
import ora from 'ora';
import { AgentManager } from './agents';
import { AuthManager } from './auth';
import { GraphynMDManager } from './graphyn-md';
import { 
  colors, 
  createBanner, 
  agentThemes,
  createDivider,
  createAgentHeader,
  createSuccessBox,
  createErrorBox
} from './ui';

export async function interactiveMenu(): Promise<void> {
  console.clear();
  const banner = await createBanner();
  console.log(banner);
  
  const choices = [
    {
      name: `${agentThemes.backend.icon}  Backend Agent - APIs that scale, databases that perform`,
      value: 'backend'
    },
    {
      name: `${agentThemes.frontend.icon}  Frontend Agent - Interfaces users love, experiences that delight`,
      value: 'frontend'
    },
    {
      name: `${agentThemes.architect.icon}  Architect Agent - Systems that evolve, decisions that last`,
      value: 'architect'
    },
    {
      name: `${agentThemes.cli.icon}  CLI Agent - Command-line tools that empower developers`,
      value: 'cli'
    },
    new inquirer.Separator(createDivider()),
    {
      name: '🔗  Chain Agents - Complex problems, comprehensive solutions',
      value: 'chain'
    },
    {
      name: '📋  Initialize Living Docs - Create your project\'s evolving knowledge',
      value: 'init'
    },
    {
      name: '🔑  Authenticate - Unlock cloud features (optional)',
      value: 'auth'
    },
    new inquirer.Separator(createDivider()),
    {
      name: '❌  Exit',
      value: 'exit'
    }
  ];
  
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What would you like to do?',
    choices,
    pageSize: 12
  }]);
  
  if (action === 'exit') {
    console.log(colors.dim('\nGoodbye! 👋\n'));
    process.exit(0);
  }
  
  // Handle agent selection
  if (['backend', 'frontend', 'architect', 'cli'].includes(action)) {
    const { queryType } = await inquirer.prompt([{
      type: 'list',
      name: 'queryType',
      message: 'How would you like to interact?',
      choices: [
        { name: '💬  Enter a specific query', value: 'query' },
        { name: '🚀  Start interactive session', value: 'interactive' },
        { name: '◀️   Back to main menu', value: 'back' }
      ]
    }]);
    
    if (queryType === 'back') {
      return interactiveMenu();
    }
    
    if (queryType === 'query') {
      const { query } = await inquirer.prompt([{
        type: 'input',
        name: 'query',
        message: `Enter your ${action} query:`,
        validate: (input) => input.trim().length > 0 || 'Please enter a query'
      }]);
      
      // Run agent query
      const agentManager = new AgentManager();
      const authManager = new AuthManager();
      
      if (!await authManager.isAuthenticated()) {
        console.log(colors.warning('\n⚠️  Not authenticated. Using local prompts.'));
        console.log(colors.info('Run "graphyn auth" to unlock all features.\n'));
      }
      
      console.log();
      console.log(createAgentHeader(action));
      console.log();
      console.log(colors.info('Query: ') + colors.bold(query));
      console.log(createDivider());
      
      const spinner = ora('Analyzing your request...').start();
      
      try {
        const response = await agentManager.queryAgent(action, query);
        spinner.stop();
        
        // Handle different response types
        if (response === 'context-saved' || response === 'interactive-saved') {
          // Context was saved, wait for instructions to display then exit
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log(colors.dim('\n✨ Exiting graphyn. Happy coding!\n'));
          process.exit(0);
        } else if (response === '') {
          console.log(colors.dim('\nClaude Code launched. Exiting interactive menu.\n'));
          setTimeout(() => process.exit(0), 100);
          return;
        } else {
          // Print other responses
          console.log(response);
        }
      } catch (error) {
        spinner.stop();
        if (error instanceof Error && error.message.includes('Interrupt')) {
          console.log(colors.warning('\n⚠️  Query interrupted by user'));
        } else {
          console.log(createErrorBox(error instanceof Error ? error.message : 'Unknown error'));
        }
      }
    } else {
      // Start interactive session
      const agentManager = new AgentManager();
      console.log();
      console.log(createAgentHeader(action, 'Interactive Mode'));
      console.log();
      await agentManager.startInteractiveSession(action);
      // Continue with menu after showing instructions
    }
  }
  
  // Handle chain
  if (action === 'chain') {
    const { query } = await inquirer.prompt([{
      type: 'input',
      name: 'query',
      message: 'Enter your query for all agents:',
      validate: (input) => input.trim().length > 0 || 'Please enter a query'
    }]);
    
    const agentManager = new AgentManager();
    const spinner = ora('Orchestrating agents...').start();
    
    try {
      await agentManager.chainAgents(query);
      spinner.succeed('Agent chain completed!');
    } catch (error) {
      spinner.stop();
      if (error instanceof Error && error.message.includes('Interrupt')) {
        console.log(colors.warning('\n⚠️  Chain interrupted by user'));
      } else {
        console.log(createErrorBox(error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  }
  
  // Handle other actions
  if (action === 'init') {
    const graphynManager = new GraphynMDManager();
    await graphynManager.init();
  }
  
  if (action === 'auth') {
    const authManager = new AuthManager();
    const { apiKey } = await inquirer.prompt([{
      type: 'password',
      name: 'apiKey',
      message: 'Enter your API key:',
      validate: (input) => input.startsWith('gph_') || 'API key must start with gph_'
    }]);
    
    try {
      await authManager.authenticate(apiKey);
      console.log(createSuccessBox('Authentication successful!'));
    } catch (error) {
      console.log(createErrorBox(error instanceof Error ? error.message : 'Authentication failed'));
    }
  }
  
  // Ask if user wants to continue
  console.log();
  // Clear any residual ANSI codes
  process.stdout.write('\x1B[0m'); // Reset all attributes
  
  const { continueChoice } = await inquirer.prompt([{
    type: 'confirm',
    name: 'continueChoice',
    message: 'Would you like to do something else?',
    default: true
  }]);
  
  if (continueChoice) {
    return interactiveMenu();
  } else {
    console.log(colors.dim('\nGoodbye! 👋\n'));
  }
}