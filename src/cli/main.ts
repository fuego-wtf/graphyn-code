#!/usr/bin/env node

/**
 * Graphyn CLI - Clean, Professional Entry Point
 * 
 * Inspired by Warp Agent's minimal, professional UX
 * Replaces all previous CLI variants with a single, clean interface
 */

import { parseArgs } from 'node:util';
import { UltimateOrchestrator } from '../orchestrator/UltimateOrchestrator.js';
import { createInterface } from 'readline';

interface CliOptions {
  continuous: boolean;
  help: boolean;
  version: boolean;
  query?: string;
}

interface SessionState {
  id: string;
  startTime: number;
  queryCount: number;
  orchestrator?: UltimateOrchestrator;
}

let session: SessionState = {
  id: generateSessionId(),
  startTime: Date.now(),
  queryCount: 0
};

/**
 * Main CLI entry point
 */
export async function main(): Promise<void> {
  try {
    const options = parseCliArgs();
    
    if (options.help) {
      showHelp();
      return;
    }
    
    if (options.version) {
      showVersion();
      return;
    }

    // Initialize orchestrator
    await initializeOrchestrator();

    if (options.query) {
      // One-shot mode: execute query and exit
      await executeOneShot(options.query);
    } else {
      // Continuous mode: interactive session
      await startContinuousMode();
    }
    
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  
  // Handle natural language query as first positional argument
  if (args.length > 0 && !args[0].startsWith('-')) {
    return {
      continuous: false,
      help: false,
      version: false,
      query: args.join(' ')
    };
  }

  // Parse flags
  try {
    const { values } = parseArgs({
      args,
      options: {
        continuous: { type: 'boolean', short: 'c' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' }
      },
      allowPositionals: true
    });

    return {
      continuous: values.continuous || false,
      help: values.help || false,
      version: values.version || false,
      query: undefined
    };
  } catch (error) {
    throw new Error(`Invalid arguments: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Initialize orchestrator with minimal output
 */
async function initializeOrchestrator(): Promise<void> {
  try {
    session.orchestrator = new UltimateOrchestrator({
      workingDirectory: process.cwd(),
      maxParallelAgents: 8,
      enablePerformanceMonitoring: true
    });
  } catch (error) {
    throw new Error(`Failed to initialize: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Execute single query and exit
 */
async function executeOneShot(query: string): Promise<void> {
  console.log(`→ ${query}`);
  
  try {
    if (!session.orchestrator) {
      throw new Error('Orchestrator not initialized');
    }

    const result = await session.orchestrator.orchestrateQuery(query);
    
    if (result.success) {
      console.log(`✓ Completed in ${result.totalTimeSeconds.toFixed(1)}s`);
    } else {
      console.log(`✗ Failed after ${result.totalTimeSeconds.toFixed(1)}s`);
      if (result.errors.length > 0) {
        result.errors.forEach(error => console.log(`  ${error}`));
      }
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Start continuous interactive mode
 */
async function startContinuousMode(): Promise<void> {
  // Clean, minimal welcome
  console.log(`\x1b[1mgraphyn\x1b[0m - AI Development Assistant`);
  console.log(`Working directory: ${process.cwd()}`);
  console.log('');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'graphyn> '
  });

  // Graceful shutdown
  rl.on('SIGINT', async () => {
    console.log('\n');
    await cleanup();
    process.exit(0);
  });

  rl.on('line', async (input) => {
    const query = input.trim();
    
    if (!query) {
      rl.prompt();
      return;
    }

    rl.pause();
    
    try {
      if (await handleSpecialCommands(query)) {
        rl.resume();
        rl.prompt();
        return;
      }

      await executeQuery(query);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      rl.resume();
      rl.prompt();
    }
  });

  rl.prompt();
}

/**
 * Handle special commands (help, status, quit)
 */
async function handleSpecialCommands(query: string): Promise<boolean> {
  const cmd = query.toLowerCase();
  
  switch (cmd) {
    case 'help':
      showHelp();
      return true;
      
    case 'status':
      showStatus();
      return true;
      
    case 'quit':
    case 'exit':
      console.log('');
      await cleanup();
      process.exit(0);
      
    case 'clear':
      console.clear();
      console.log(`\x1b[1mgraphyn\x1b[0m - AI Development Assistant`);
      console.log(`Working directory: ${process.cwd()}`);
      console.log('');
      return true;
  }
  
  return false;
}

/**
 * Execute query in continuous mode
 */
async function executeQuery(query: string): Promise<void> {
  session.queryCount++;
  console.log(`→ ${query}`);
  
  const start = Date.now();
  
  try {
    if (!session.orchestrator) {
      throw new Error('Orchestrator not initialized');
    }

    const result = await session.orchestrator.orchestrateQuery(query);
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    
    if (result.success) {
      console.log(`✓ Completed in ${duration}s`);
    } else {
      console.log(`✗ Failed after ${duration}s`);
      if (result.errors.length > 0) {
        result.errors.forEach(error => console.log(`  ${error}`));
      }
    }
  } catch (error) {
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`✗ Error after ${duration}s: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  console.log(''); // Add spacing
}

/**
 * Show help information
 */
function showHelp(): void {
  console.log(`
Usage:
  graphyn [query]              Execute query and exit
  graphyn -c, --continuous     Start interactive session
  
Commands (in interactive mode):
  help        Show this help
  status      Show session info
  clear       Clear screen  
  quit, exit  Exit

Examples:
  graphyn "add user authentication"
  graphyn "fix this bug in my code"
  graphyn --continuous
`);
}

/**
 * Show version information
 */
function showVersion(): void {
  // Read from package.json
  console.log('0.1.70');
}

/**
 * Show session status
 */
function showStatus(): void {
  const duration = Date.now() - session.startTime;
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  
  console.log('');
  console.log('Session Info:');
  console.log(`  Duration: ${minutes}m ${seconds}s`);
  console.log(`  Queries: ${session.queryCount}`);
  console.log('');
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Cleanup resources
 */
async function cleanup(): Promise<void> {
  if (session.orchestrator) {
    try {
      await session.orchestrator.emergencyStop();
    } catch (error) {
      // Silent cleanup errors
    }
  }
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith('main.js')) {
  main().catch((error) => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
