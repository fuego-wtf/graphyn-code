#!/usr/bin/env node
/**
 * Graphyn CLI - Unified Simple Entry Point
 * 
 * Replaces complex cli.tsx + cli-fallback.ts with single streamlined interface
 * Preserves GraphNeuralSystem integration and backwards compatibility
 */

import { GraphNeuralSystem, GraphNeuralRequest } from './orchestrator/graph-neural-system.js';
import { analyzeRepository } from './commands/analyze.js';
import { doctor } from './commands/doctor.js';
import { init } from './commands/init.js';
import { runMCPServer } from './commands/mcp-server.js';
import { mcpConfig } from './commands/mcp-config.js';
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
 * Stream GraphNeuralSystem execution with real-time output
 */
async function streamGraphExecution(query: string, options: CLIOptions): Promise<void> {
  console.log(colors.highlight('\n🧠 Graph-Neural AI Orchestration\n'));
  console.log(colors.info(`Query: ${query}\n`));
  
  try {
    // Initialize GraphNeuralSystem directly
    const graphSystem = new GraphNeuralSystem();
    
    // Prepare request
    const request: GraphNeuralRequest = {
      query,
      context: {
        repository: process.cwd(),
        framework: 'auto-detect',
        language: 'auto-detect'
      },
      options: {
        mode: 'neural',
        maxNodes: 8,
        parallelismLevel: 'high',
        enableVisualization: true
      }
    };
    
    // Execute and stream progress
    const sessionId = `session_${Date.now()}`;
    
    // Start execution (non-blocking)
    const resultPromise = graphSystem.execute(request);
    
    // Stream progress updates
    try {
      const progressStream = graphSystem.streamProgress(sessionId);
      
      // Display progress
      for await (const progress of progressStream) {
        const percent = Math.round(progress.progress * 100);
        const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
        process.stdout.write(`\r[${bar}] ${percent}% - ${progress.phase}: ${progress.currentNode || 'processing'}`);
      }
    } catch (progressError) {
      // Progress streaming failed, but execution might still succeed
      console.log(colors.info('⚠️  Progress streaming unavailable, executing silently...'));
    }
    
    // Wait for completion
    const result = await resultPromise;
    
    console.log('\n'); // New line after progress
    
    if (result.success) {
      console.log(colors.success('✅ Graph execution complete!\n'));
      
      if (result.metrics) {
        console.log(colors.info(`⚡ Execution time: ${result.metrics.totalExecutionTime}ms`));
        console.log(colors.info(`🧠 Neural enrichment: ${result.metrics.neuralEnrichmentOverhead}ms`));
        console.log(colors.info(`🔗 Network effects: ${result.metrics.networkEffects}`));
        console.log(colors.info(`⚡ Parallelism: ${Math.round(result.metrics.parallelismUtilization * 100)}%\n`));
      }
    } else {
      throw new Error(result.error || 'Graph execution failed');
    }
    
  } catch (error) {
    console.log('\n'); // New line after any progress
    console.error(colors.error('❌ Graph execution failed:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Handle legacy agent commands for backwards compatibility
 */
async function handleLegacyCommand(command: string, args: string[], options: CLIOptions): Promise<void> {
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
    await streamGraphExecution(fullQuery, options);
  } else {
    console.error(colors.error(`Unknown command: ${command}`));
    process.exit(1);
  }
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const { options, query } = parseArgs(rawArgs);
  
  // Show version
  if (query === '--version' || query === '-v') {
    console.log('0.1.70');
    return;
  }
  
  // Show help
  if (query === '--help' || query === '-h' || query === 'help') {
    console.log(`
${colors.bold('Graphyn Code - AI Development Orchestrator')}

${colors.highlight('Usage:')}
  graphyn "natural language query"    Execute AI orchestration
  graphyn <command> [args]            Run specific command
  
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
  mcp                 Start MCP server
  mcp config          Configure MCP settings
  
${colors.highlight('Options:')}
  --dev               Development mode
  --debug             Show debug information
  --non-interactive   Skip interactive prompts
`);
    return;
  }
  
  // Handle specific commands
  if (query.startsWith('analyze')) {
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
    return;
  }
  
  if (query === 'doctor') {
    await doctor();
    return;
  }
  
  if (query === 'init' || query.startsWith('init ')) {
    const initOptions: any = {};
    if (query.includes('--skip-auth')) initOptions.skipAuth = true;
    if (query.includes('--force')) initOptions.force = true;
    await init(initOptions);
    return;
  }
  
  if (query === 'auth' || query.startsWith('auth ')) {
    console.log(colors.warning('⚠️  Authentication disabled - system is fully offline'));
    console.log(colors.info('ℹ️  All features available without authentication'));
    return;
  }
  
  if (query === 'mcp' || query === 'mcp-server') {
    await runMCPServer();
    return;
  }
  
  if (query === 'mcp config' || query.startsWith('mcp config ')) {
    const configOptions: any = {};
    if (query.includes('--update')) configOptions.update = true;
    if (query.includes('--validate')) configOptions.validate = true;
    await mcpConfig(configOptions);
    return;
  }
  
  // Handle legacy agent commands
  const firstWord = query.split(' ')[0].toLowerCase();
  const agentCommands = ['backend', 'frontend', 'architect', 'design', 'cli'];
  if (agentCommands.includes(firstWord)) {
    const args = query.split(' ').slice(1);
    await handleLegacyCommand(firstWord, args, options);
    return;
  }
  
  // Handle natural language queries - route to GraphNeuralSystem
  if (query && (isNaturalLanguage(query) || query.length > 0)) {
    await streamGraphExecution(query, options);
    return;
  }
  
  // No query provided - show help
  console.log(colors.highlight('🤖 Graphyn Code - AI Development Orchestrator'));
  console.log(colors.info('Type a natural language query or command. Use --help for more info.\n'));
}

// Execute CLI
main().catch(error => {
  console.error(colors.error('CLI Error:'), error.message);
  process.exit(1);
});