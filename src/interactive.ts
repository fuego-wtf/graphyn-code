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
      name: `${agentThemes.backend.icon}  Backend Agent - API, database, and server development`,
      value: 'backend'
    },
    {
      name: `${agentThemes.frontend.icon}  Frontend Agent - UI, components, and user experience`,
      value: 'frontend'
    },
    {
      name: `${agentThemes.architect.icon}  Architect Agent - System design and best practices`,
      value: 'architect'
    },
    new inquirer.Separator(createDivider()),
    {
      name: '🔗  Chain Agents - Run all agents in sequence',
      value: 'chain'
    },
    {
      name: '📋  Initialize GRAPHYN.md',
      value: 'init'
    },
    {
      name: '🔑  Authenticate',
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
  if (['backend', 'frontend', 'architect'].includes(action)) {
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
        console.log(response);
      } catch (error) {
        spinner.fail('Query failed');
        console.error(colors.error(error instanceof Error ? error.message : 'Unknown error'));
      }
    } else {
      // Start interactive session
      const agentManager = new AgentManager();
      console.log();
      console.log(createAgentHeader(action, 'Interactive Mode'));
      console.log();
      await agentManager.startInteractiveSession(action);
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
      spinner.fail('Chain execution failed');
      console.error(colors.error(error instanceof Error ? error.message : 'Unknown error'));
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