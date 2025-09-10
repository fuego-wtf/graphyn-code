#!/usr/bin/env node
/**
 * Graphyn CLI - Unified Entry Point
 * 
 * Consolidates all CLI functionality into a single, clean entry point
 * Routes to appropriate handlers while preserving all existing features
 */

import chalk from 'chalk';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold
};

interface CLIOptions {
  dev?: boolean;
  debug?: boolean;
  nonInteractive?: boolean;
  new?: boolean;
}

/**
 * Parse command line arguments into options and query
 */
function parseArgs(args: string[]): { options: CLIOptions; query: string } {
  const options: CLIOptions = {};
  const queryParts: string[] = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--dev') {
      options.dev = true;
    } else if (arg === '--debug') {
      options.debug = true;
    } else if (arg === '--non-interactive' || arg === '-n') {
      options.nonInteractive = true;
    } else if (arg === '--new') {
      options.new = true;
    } else {
      // Everything else is part of the query
      queryParts.push(...args.slice(i));
      break;
    }
  }
  
  return {
    options,
    query: queryParts.join(' ').trim()
  };
}

/**
 * Show CLI version
 */
function showVersion(): void {
  console.log('0.1.70');
}

/**
 * Show comprehensive help message
 */
function showHelp(): void {
  console.log(`
${colors.bold('Graphyn Code - AI Development Orchestrator')}

${colors.highlight('Usage:')}
  graphyn "natural language query"    Execute AI orchestration
  graphyn <command> [args]            Run specific command
  graphyn                            Interactive mode
  
${colors.highlight('Examples:')}
  graphyn "create a todo app with auth"
  graphyn "help me understand this repo"
  graphyn backend "add user authentication"
  graphyn analyze --mode summary
  
${colors.highlight('Commands:')}
  analyze [options]    Analyze repository
  doctor              Check system requirements
  init [options]      Initialize project
  auth                Authenticate (disabled - offline mode)
  logout              Log out (disabled - offline mode)
  mcp                 Start MCP server
  mcp config          Configure MCP settings
  
${colors.highlight('Agent Commands:')}
  backend <query>     Route to backend development agent
  frontend <query>    Route to frontend development agent
  architect <query>   Route to system architecture agent
  design <query>      Route to UI/UX design agent
  cli <query>         Route to CLI development agent
  
${colors.highlight('Options:')}
  --dev               Development mode (local analysis only)
  --debug             Show debug information
  --non-interactive   Skip interactive prompts
  --new               Force new session
  
${colors.highlight('MCP Integration:')}
  graphyn mcp         Start MCP server for Claude Code
  graphyn mcp config  Generate MCP configuration
`);
}

/**
 * Route specific commands to appropriate handlers
 */
async function routeCommand(query: string, options: CLIOptions): Promise<boolean> {
  // Version and help
  if (query === '--version' || query === '-v') {
    showVersion();
    return true;
  }
  
  if (query === '--help' || query === '-h' || query === 'help') {
    showHelp();
    return true;
  }
  
  // Specific commands
  if (query.startsWith('analyze')) {
    const { analyzeRepository } = await import('./commands/analyze.js');
    const analyzeArgs = query.split(' ').slice(1);
    const analyzeOptions: any = { dev: options.dev };
    
    // Parse analyze-specific options
    for (let i = 0; i < analyzeArgs.length; i++) {
      if (analyzeArgs[i] === '--mode' && analyzeArgs[i + 1]) {
        analyzeOptions.mode = analyzeArgs[i + 1];
        i++;
      } else if (analyzeArgs[i] === '--save') {
        analyzeOptions.save = true;
      }
    }
    
    await analyzeRepository(analyzeOptions);
    return true;
  }
  
  if (query === 'doctor' || query.startsWith('doctor ')) {
    const { doctor } = await import('./commands/doctor.js');
    const doctorOptions: any = {};
    if (query.includes('--claude')) doctorOptions.claude = true;
    if (query.includes('--skip-setup')) doctorOptions.skipSetup = true;
    await doctor(doctorOptions);
    return true;
  }
  
  if (query === 'init' || query.startsWith('init ')) {
    const { init } = await import('./commands/init.js');
    const initOptions: any = {};
    if (query.includes('--skip-auth')) initOptions.skipAuth = true;
    if (query.includes('--skip-agents')) initOptions.skipAgentRevival = true;
    if (query.includes('--skip-mcp')) initOptions.skipMCP = true;
    if (query.includes('--force')) initOptions.force = true;
    await init(initOptions);
    return true;
  }
  
  if (query === 'auth' || query.startsWith('auth ')) {
    console.log(colors.warning('⚠️  Authentication disabled - system is fully offline'));
    console.log(colors.info('ℹ️  All features available without authentication'));
    return true;
  }
  
  if (query === 'logout') {
    console.log(colors.warning('⚠️  Authentication disabled - system is fully offline'));
    console.log(colors.info('ℹ️  No logout necessary'));
    return true;
  }
  
  if (query === 'mcp' || query === 'mcp-server') {
    const { runMCPServer } = await import('./commands/mcp-server.js');
    await runMCPServer();
    return true;
  }
  
  if (query === 'mcp config' || query.startsWith('mcp config ')) {
    const { mcpConfig } = await import('./commands/mcp-config.js');
    const configOptions: any = {};
    if (query.includes('--update')) configOptions.update = true;
    if (query.includes('--validate')) configOptions.validate = true;
    if (query.includes('--force')) configOptions.force = true;
    await mcpConfig(configOptions);
    return true;
  }
  
  return false; // Command not handled
}

/**
 * Detect if input is natural language query
 */
function isNaturalLanguage(query: string): boolean {
  if (!query) return false;
  
  // Known specific commands
  const knownCommands = [
    'backend', 'frontend', 'architect', 'design', 'cli',
    'analyze', 'doctor', 'init', 'auth', 'logout', 
    'mcp', 'mcp-server', 'mcp config',
    '--version', '-v', '--help', '-h', 'help'
  ];
  
  // Check if it's a known command
  const firstWord = query.split(' ')[0].toLowerCase();
  if (knownCommands.includes(firstWord) || knownCommands.includes(query.toLowerCase())) {
    return false;
  }
  
  // Natural language indicators
  return (
    query.includes(' ') ||
    /^(help|tell|show|create|build|make|add|implement|fix|update|generate|write|explain|what|how|why|when|where|can|could|should|would|please|i |the |a |an )/i.test(query) ||
    (query.startsWith('"') && query.endsWith('"'))
  );
}

/**
 * Handle legacy agent commands for backwards compatibility
 */
async function handleLegacyAgentCommand(command: string, args: string[], options: CLIOptions): Promise<void> {
  const agentMap: Record<string, string> = {
    'backend': 'backend development',
    'frontend': 'frontend development', 
    'architect': 'system architecture',
    'design': 'UI/UX design',
    'cli': 'CLI tool development'
  };
  
  const agentQuery = agentMap[command];
  if (agentQuery && args.length > 0) {
    const fullQuery = `${agentQuery}: ${args.join(' ')}`;
    // Route to orchestrator for agent queries
    await routeToOrchestrator(fullQuery, options);
  } else {
    console.error(colors.error(`Unknown agent command: ${command}`));
    console.log(colors.info('Available agents: backend, frontend, architect, design, cli'));
    process.exit(1);
  }
}

/**
 * Route queries to the CLI orchestrator
 */
async function routeToOrchestrator(query: string, options: CLIOptions): Promise<void> {
  try {
    // Import the CLI orchestrator and route the query
    const { main: orchestratorMain } = await import('./cli-orchestrator.js');
    
    // Set up process.argv for the orchestrator
    const originalArgv = process.argv;
    const orchestratorArgs = ['node', 'cli-orchestrator.ts'];
    
    // Add options
    if (options.dev) orchestratorArgs.push('--dev');
    if (options.debug) orchestratorArgs.push('--debug');
    if (options.nonInteractive) orchestratorArgs.push('--non-interactive');
    if (options.new) orchestratorArgs.push('--new');
    
    // Add query
    if (query) orchestratorArgs.push(query);
    
    process.argv = orchestratorArgs;
    
    // Call the orchestrator
    await orchestratorMain();
    
    // Restore original argv
    process.argv = originalArgv;
    
  } catch (error) {
    console.error(colors.error('❌ Orchestration failed:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Start interactive console mode
 */
async function startInteractiveMode(): Promise<void> {
  try {
    // Import and start the interactive orchestrator
    const { startInteractiveOrchestrator } = await import('./cli-orchestrator.js');
    await startInteractiveOrchestrator();
  } catch (error) {
    console.error(colors.error('❌ Interactive mode failed:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const { options, query } = parseArgs(rawArgs);
  
  // Route specific commands first
  const commandHandled = await routeCommand(query, options);
  if (commandHandled) {
    return;
  }
  
  // Handle legacy agent commands
  const firstWord = query.split(' ')[0].toLowerCase();
  const agentCommands = ['backend', 'frontend', 'architect', 'design', 'cli'];
  if (agentCommands.includes(firstWord)) {
    const args = query.split(' ').slice(1);
    await handleLegacyAgentCommand(firstWord, args, options);
    return;
  }
  
  // Handle natural language queries or orchestrator mode
  if (query && (isNaturalLanguage(query) || query.length > 0)) {
    await routeToOrchestrator(query, options);
    return;
  }
  
  // No query provided - start interactive mode
  console.log(colors.highlight('🤖 Graphyn Code - AI Development Orchestrator'));
  console.log(colors.info('Starting interactive mode. Type a query or command. Use --help for more info.\n'));
  
  await startInteractiveMode();
}

// Execute CLI with error handling
main().catch(error => {
  console.error(colors.error('CLI Error:'), error instanceof Error ? error.message : error);
  process.exit(1);
});