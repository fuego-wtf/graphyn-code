#!/usr/bin/env node
import { OAuthManager } from './auth/oauth.js';
import { analyzeRepository } from './commands/analyze.js';
import { doctor } from './commands/doctor.js';
import { checkSystemRequirements } from './utils/system-check.js';
import { config } from './config.js';
import { ThreadService } from './services/thread-service.js';
import chalk from 'chalk';
import * as readline from 'readline';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan
};

async function startInteractiveConsole(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colors.highlight('graphyn> ')
  });

  // Set up authentication once
  let threadService: ThreadService | null = null;
  
  try {
    // Check authentication and system requirements
    const oauthManager = new OAuthManager();
    const doctorResult = await checkSystemRequirements();
    
    if (!doctorResult.canProceed) {
      console.log(colors.warning('⚠️  System requirements not met. Running setup...'));
      await doctor();
      return;
    }

    if (!(await oauthManager.isAuthenticated())) {
      console.log(colors.info('🔗 Authentication required for interactive mode...'));
      await oauthManager.authenticate();
      console.log(colors.success('✓ Authentication successful!\n'));
    }

    threadService = new ThreadService();
    console.log(colors.success('✓ Ready for development requests!\n'));
  } catch (error) {
    console.error(colors.error('❌ Setup failed:'), error instanceof Error ? error.message : error);
    console.log(colors.info('You can still use individual commands like "graphyn auth" or "graphyn doctor"\n'));
  }

  rl.prompt();

  rl.on('line', async (input) => {
    const command = input.trim();
    
    if (!command) {
      rl.prompt();
      return;
    }

    if (command === 'exit' || command === 'quit') {
      console.log(colors.info('\n👋 Goodbye!'));
      rl.close();
      process.exit(0);
    }

    if (command === 'help') {
      console.log('\nAvailable commands:');
      console.log('  <your request>     Send development request');
      console.log('  help              Show this help');
      console.log('  clear             Clear screen');
      console.log('  exit/quit         Exit interactive mode\n');
      rl.prompt();
      return;
    }

    if (command === 'clear') {
      console.clear();
      console.log('\n' + colors.highlight('🤖 Graphyn Code - Your AI Software Engineering Consultant'));
      console.log(colors.info('Type your development requests or "exit" to quit\n'));
      rl.prompt();
      return;
    }

    // Handle development request
    if (threadService) {
      try {
        console.log(''); // Add spacing before output
        await threadService.processWithStream(command, process.cwd());
        console.log(''); // Add spacing after output
      } catch (error) {
        console.error(colors.error('❌ Request failed:'), error instanceof Error ? error.message : error);
      }
    } else {
      console.log(colors.error('❌ Not authenticated. Please restart and authenticate first.'));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(colors.info('\n👋 Goodbye!'));
    process.exit(0);
  });

  // Handle Ctrl+C gracefully
  rl.on('SIGINT', () => {
    console.log(colors.info('\n👋 Goodbye!'));
    process.exit(0);
  });
}

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
    } else if (args[i] === '--dev') {
      options.dev = true;
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
  
  if (userMessage === '--help' || userMessage === '-h' || userMessage === 'help') {
    console.log(`
Graphyn Code - AI Development Tool

Usage:
  graphyn                        Launch persistent interactive consultant
  graphyn <request>              Create AI development thread and stream responses
  graphyn init                   Initialize project with MCP config & agent revival
  graphyn auth                   Authenticate with Graphyn (PKCE OAuth flow)
  graphyn logout                 Log out from Graphyn
  graphyn doctor                 Check system requirements & setup
  graphyn analyze [--mode mode]  Analyze repository for tech stack
  graphyn mcp                    Start MCP server for Claude Code integration
  graphyn mcp config             Generate MCP configuration for Claude Desktop

Options:
  --non-interactive, -n          Skip launching agents (prepare only)
  --debug                        Show debug information
  --dev                          Development mode (local analysis only)
  graphyn --version              Show version
  graphyn --help                 Show help

Examples:
  graphyn "Implement signup with email OTP"
  graphyn "Create a REST API with PostgreSQL"
  graphyn "Build dashboard UI from Figma design"
  graphyn --dev "help me understand whats in this repo"
  graphyn analyze                Analyze your repository
  graphyn analyze --mode summary Get a summary analysis
`);
    process.exit(0);
  }

  // Handle interactive mode (no arguments, no dev flag)
  if (!userMessage && !options.dev) {
    console.log('\n' + colors.highlight('🤖 Graphyn Code - Your AI Software Engineering Consultant'));
    console.log(colors.info('Type your development requests or "exit" to quit\n'));
    
    await startInteractiveConsole();
    return;
  }
  
  // Handle init command
  if (userMessage === 'init' || userMessage.startsWith('init ')) {
    const { init } = await import('./commands/init.js');
    const initOptions: any = {};
    
    // Parse options
    if (userMessage.includes('--skip-auth')) initOptions.skipAuth = true;
    if (userMessage.includes('--skip-agents')) initOptions.skipAgentRevival = true;
    if (userMessage.includes('--skip-mcp')) initOptions.skipMCP = true;
    if (userMessage.includes('--force')) initOptions.force = true;
    
    await init(initOptions);
    process.exit(0);
  }
  
  // Handle doctor command
  if (userMessage === 'doctor') {
    await doctor();
    process.exit(0);
  }
  
  // Handle auth command
  if (userMessage === 'auth' || userMessage.startsWith('auth ')) {
    // Use PKCE OAuth flow
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
  
  // Handle MCP commands
  if (userMessage === 'mcp' || userMessage === 'mcp-server') {
    const { runMCPServer } = await import('./commands/mcp-server.js');
    await runMCPServer();
    process.exit(0);
  }
  
  // Handle MCP config command
  if (userMessage === 'mcp config' || userMessage.startsWith('mcp config ')) {
    const { mcpConfig } = await import('./commands/mcp-config.js');
    const configOptions: any = {};
    
    // Parse options
    if (userMessage.includes('--update')) configOptions.update = true;
    if (userMessage.includes('--validate')) configOptions.validate = true;
    if (userMessage.includes('--force')) configOptions.force = true;
    
    await mcpConfig(configOptions);
    process.exit(0);
  }
  
  // Handle development mode (--dev flag) FIRST
  if (options.dev) {
    if (userMessage) {
      // Use orchestration for dev queries
      const { orchestrateCommand } = await import('./commands/orchestrate.js');
      await orchestrateCommand({
        query: userMessage,
        repository: process.cwd(),
        dev: true,
        interactive: true
      });
    } else {
      // No query provided, show dev menu
      console.log(colors.info('No query provided. Available dev options:\n'));
      console.log('• graphyn --dev "your request"    - Orchestrate agents for request');
      console.log('• graphyn analyze                - Analyze repository'); 
      console.log('• graphyn init                   - Initialize project');
      console.log('• graphyn doctor                 - Check system requirements\n');
    }
    
    process.exit(0);
  }
  
  // Multi-agent approach (no squad commands)
  
  // Handle analyze command (only if not in dev mode)
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
    
    // Step 3: Process query with Thread service
    const threadService = new ThreadService();
    
    if (!options.nonInteractive) {
      // Interactive mode: create thread and stream responses
      await threadService.processWithStream(userMessage, process.cwd());
    } else {
      // Non-interactive mode: just create the thread
      const response = await threadService.processQuery(userMessage, process.cwd());
      console.log(colors.info('📝 Thread created successfully!'));
      console.log(colors.info(`Thread ID: ${response.threadId}`));
      console.log(colors.info(`State: ${response.state}`));
      console.log(colors.info('Use interactive mode to see real-time responses.'));
    }
  } catch (error) {
    console.error(colors.error('\n❌ Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(colors.error('Error:'), error.message);
  process.exit(1);
});