#!/usr/bin/env node
import { OAuthManager } from './auth/oauth.js';
import { switchSquad, showCurrentSquad, clearSquadSelection } from './commands/squad-manage.js';
import { analyzeRepository } from './commands/analyze.js';
import { createSquad } from './commands/squad.js';
import { doctor } from './commands/doctor.js';
import { mcpCommand } from './commands/mcp-simple.js';
import { checkSystemRequirements } from './utils/system-check.js';
import chalk from 'chalk';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan
};

async function main() {
  const [,, ...args] = process.argv;
  
  // Parse options and message
  let userMessage = '';
  const options: any = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--non-interactive' || args[i] === '-n') {
      options.nonInteractive = true;
    } else if (args[i] === '--debug') {
      options.debug = true;
    } else if (args[i] === '--new') {
      options.new = true;
    } else {
      // Everything else is part of the user message
      userMessage = args.slice(i).join(' ').trim();
      break;
    }
  }
  
  // Handle special commands
  if (userMessage === '--version' || userMessage === '-v') {
    console.log('0.1.60');
    process.exit(0);
  }
  
  if (userMessage === '--help' || userMessage === '-h' || userMessage === 'help' || !userMessage) {
    console.log(`
Graphyn Code - AI Development Tool

Usage:
  graphyn <request>              Create an AI development squad
  graphyn auth                   Authenticate with Graphyn
  graphyn logout                 Log out from Graphyn
  graphyn doctor                 Check system requirements & setup
  graphyn analyze [--mode mode]  Analyze repository for tech stack
  graphyn squad                  Show current squad
  graphyn squad switch           Switch to a different squad
  graphyn squad clear            Clear squad selection
  graphyn mcp <command>          MCP (Model Context Protocol) integration

MCP Commands:
  graphyn mcp init               Initialize MCP with Claude Flow
  graphyn mcp servers            List registered MCP servers
  graphyn mcp swarm init         Initialize a swarm
  graphyn mcp swarm spawn        Spawn an agent
  graphyn mcp swarm task         Orchestrate a task

Options:
  --non-interactive, -n          Exit after creating thread (no interactive mode)
  --debug                        Show debug information
  --new                          Skip squad selection and create a new squad
  graphyn --version              Show version
  graphyn --help                 Show help

Examples:
  graphyn "I need to add user authentication to my Next.js app"
  graphyn "Create a REST API with Express and PostgreSQL"
  graphyn "Help me refactor this React component to use hooks"
  graphyn analyze                Analyze your repository
  graphyn analyze --mode summary Get a summary analysis
  graphyn squad switch           Switch between your squads
  graphyn mcp init               Initialize MCP integration
`);
    process.exit(0);
  }
  
  // Handle doctor command
  if (userMessage === 'doctor') {
    await doctor();
    process.exit(0);
  }
  
  // Handle auth command
  if (userMessage === 'auth') {
    const oauthManager = new OAuthManager();
    await oauthManager.authenticate();
    process.exit(0);
  }
  
  // Handle logout command
  if (userMessage === 'logout') {
    const oauthManager = new OAuthManager();
    await oauthManager.logout();
    process.exit(0);
  }
  
  
  // Handle squad commands
  if (userMessage === 'squad') {
    await showCurrentSquad();
    process.exit(0);
  }
  
  if (userMessage === 'squad switch') {
    await switchSquad();
    process.exit(0);
  }
  
  if (userMessage === 'squad clear') {
    await clearSquadSelection();
    process.exit(0);
  }
  
  // MCP commands disabled - use direct file editing instead
  if (userMessage === 'mcp' || userMessage.startsWith('mcp ')) {
    console.log(colors.info('MCP commands are disabled. Use natural language requests instead.'));
    console.log(colors.info('Example: graphyn "fix duplicate components in thread detail page"'));
    process.exit(0);
  }
  
  // Handle analyze command
  if (userMessage.startsWith('analyze')) {
    const options: any = {};
    const parts = userMessage.split(' ');
    
    // Parse options
    for (let i = 1; i < parts.length; i++) {
      if (parts[i] === '--mode' && parts[i + 1]) {
        options.mode = parts[i + 1];
        i++;
      } else if (parts[i] === '--save') {
        options.save = true;
      } else if (parts[i] === '--output' && parts[i + 1]) {
        options.output = parts[i + 1];
        i++;
      }
    }
    
    await analyzeRepository(options);
    process.exit(0);
  }
  
  // Main flow: check system requirements, authenticate, select squad, then create request
  try {
    // Step 0: Silently check if system is ready (no output unless there's a problem)
    const doctorResult = await checkSystemRequirements();
    
    // If critical components are missing, run doctor command
    if (!doctorResult.canProceed) {
      console.log(colors.warning('\n⚠️  System requirements not met. Running setup...\n'));
      await doctor();
      process.exit(0);
    }
    
    // Step 1: Check authentication
    const oauthManager = new OAuthManager();
    if (!(await oauthManager.isAuthenticated())) {
      console.log(colors.info('\n🔗 Connecting to Graphyn platform...'));
      console.log(colors.info('🌐 Opening browser for authentication...\n'));
      
      // Authenticate user
      await oauthManager.authenticate();
      console.log(colors.success('\n✓ Authentication successful!\n'));
    }
    
    // Step 2: Get valid token
    let token = await oauthManager.getValidToken();
    if (!token) {
      // Token might be expired, try to re-authenticate
      console.log(colors.warning('⚠️  Session expired. Re-authenticating...'));
      console.log(colors.info('🌐 Opening browser for authentication...\n'));
      
      await oauthManager.authenticate();
      
      // Try to get token again
      token = await oauthManager.getValidToken();
      if (!token) {
        console.log(colors.error('❌ Authentication failed. Please try "graphyn auth" manually.'));
        process.exit(1);
      }
      
      console.log(colors.success('\n✓ Re-authentication successful!\n'));
    }
    
    // Step 3: Create a new squad for this request
    // The backend will use the authenticated user's organization
    console.log(colors.info(`\n🎆 Creating a new AI squad...\n`));
    await createSquad(userMessage, options);
  } catch (error) {
    console.error(colors.error('\n❌ Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(colors.error('Error:'), error.message);
  process.exit(1);
});