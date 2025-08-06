#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { APIProvider } from './contexts/APIContext.js';

// Parse command line arguments
let [, , rawCommand, ...args] = process.argv;

// Check for --dev flag in both rawCommand and args
let isDev = false;
let isDebug = false;

if (rawCommand === '--dev') {
  isDev = true;
  rawCommand = args.shift(); // Move first arg to rawCommand
} else if (rawCommand === '--debug') {
  isDebug = true;
  rawCommand = args.shift(); // Move first arg to rawCommand
} else {
  const devFlagIndex = args.indexOf('--dev');
  isDev = devFlagIndex !== -1;
  if (isDev) {
    args.splice(devFlagIndex, 1);
  }
  
  const debugFlagIndex = args.indexOf('--debug');
  isDebug = debugFlagIndex !== -1;
  if (isDebug) {
    args.splice(debugFlagIndex, 1);
  }
}

// Set debug mode globally
if (isDebug) {
  process.env.DEBUG_GRAPHYN = 'true';
}

// Check if this is a natural language query (wrapped in quotes or starting with "I")
const isNaturalLanguage = rawCommand && (
  (rawCommand.startsWith('"') && args[args.length - 1]?.endsWith('"')) ||
  rawCommand.toLowerCase().startsWith('i ') ||
  (rawCommand === 'I' && args.length > 0)
);

let command: string | undefined;
let query: string;
let agentTypes: string[] = [];
let cliQuery: string = '';

if (isNaturalLanguage) {
  // Treat entire input as a natural language query
  command = 'squad';
  query = [rawCommand, ...args].join(' ').replace(/^"|"$/g, '');
} else if (rawCommand?.toLowerCase() === 'spawn') {
  // Handle spawn command with multiple agent types
  command = 'spawn';
  query = ''; // Set to empty as the App component will handle spawn differently
  
  // Parse agentTypes and optional query from args
  // Find the last argument that starts with a quote or contains spaces (likely the query)
  let queryStartIndex = -1;
  for (let i = args.length - 1; i >= 0; i--) {
    if (args[i].includes(' ') || args[i].startsWith('"') || args[i].startsWith("'")) {
      queryStartIndex = i;
      break;
    }
  }
  
  if (queryStartIndex === -1) {
    // No quoted query found, treat all args as agent types
    agentTypes = args;
    cliQuery = '';
  } else {
    // Split between agent types and query
    agentTypes = args.slice(0, queryStartIndex);
    cliQuery = args.slice(queryStartIndex).join(' ').replace(/^["']|["']$/g, '');
  }
} else {
  command = rawCommand?.toLowerCase(); // Make command case-insensitive
  query = args.join(' ');
}

// Define agent aliases
const agentAliases: Record<string, string> = {
  'a': 'architect',
  'b': 'backend',
  'f': 'frontend',
  'd': 'design',
  'c': 'cli'
};

// Normalize command if it's an alias
const normalizedCommand = agentAliases[command] || command;

// Show version
if (normalizedCommand === '--version' || normalizedCommand === '-v') {
  console.log('0.1.60');
  process.exit(0);
}

// Show help
if (normalizedCommand === '--help' || normalizedCommand === '-h' || normalizedCommand === 'help') {
  console.log(`
Graphyn Code - AI Development Tool for Claude Code

Usage:
  graphyn                        Interactive mode
  graphyn <agent> <query>        Direct agent query
  graphyn design <figma-url>     Extract Figma components
  graphyn auth [key]             Set API key (optional)
  graphyn spawn <agents...> [query]  Spawn multiple agents with query

Agents:
  backend (b)                    Backend development agent
  frontend (f)                   Frontend development agent
  architect (a)                  System architecture agent
  design (d)                     Design system agent
  cli (c)                        CLI development agent

Options:
  -v, --version                  Show version
  -h, --help                     Show help
  --dev                          Use local development servers
  --debug                        Show debug information

Examples:
  graphyn backend "add auth"     Backend development
  graphyn frontend "react hook"  Frontend development
  graphyn architect "design api" Architecture review
  graphyn design figma.com/...   Extract components
  graphyn spawn backend frontend "add auth feature"  Multi-agent spawn
`);
  process.exit(0);
}

// Check if this is a direct agent command - always use fallback for these
const agents = ['backend', 'frontend', 'architect', 'design', 'cli', 'squad'];
const isDirectAgentCommand = agents.includes(normalizedCommand) && query;

// Check if graphyn was called without any arguments (builder mode)
const isBuilderMode = !normalizedCommand;

// Check if we can use raw mode
// Also check for Warp terminal which might have special TTY handling
const isWarp = process.env.TERM_PROGRAM === 'WarpTerminal';

// Debug output for terminal detection (only when DEBUG_GRAPHYN is set)
if (process.env.DEBUG_GRAPHYN) {
  console.log('Terminal Debug Info:');
  console.log('- rawCommand:', rawCommand);
  console.log('- normalizedCommand:', normalizedCommand);
  console.log('- isBuilderMode:', isBuilderMode);
  console.log('- TTY:', process.stdin.isTTY ? 'YES' : 'NO');
  console.log('- TERM_PROGRAM:', process.env.TERM_PROGRAM || 'none');
  console.log('- Is Warp:', isWarp ? 'YES' : 'NO');
  console.log('- Direct agent command:', isDirectAgentCommand ? 'YES' : 'NO');
  console.log('- Using fallback:', (!process.stdin.isTTY && !process.env.FORCE_COLOR || isWarp || isDirectAgentCommand) ? 'YES' : 'NO');
}

// Use fallback for: non-TTY, Warp terminal, or direct agent commands (but not builder mode)
if (!process.stdin.isTTY && !process.env.FORCE_COLOR || isWarp || (isDirectAgentCommand && !isBuilderMode)) {
  // Fall back to non-interactive mode
  import('child_process').then(({ execSync }) => {
    const fallbackPath = new URL('./cli-fallback.js', import.meta.url).pathname;
    try {
      execSync(`node ${fallbackPath} ${process.argv.slice(2).join(' ')}`, {
        stdio: 'inherit'
      });
    } catch (error) {
      process.exit(1);
    }
    process.exit(0);
  });
} else {
  // Render the Ink app with API Provider and error handling
  try {
    const { unmount } = render(
      <APIProvider>
        <App 
          command={normalizedCommand} 
          query={query} 
          agentTypes={agentTypes}
          cliQuery={cliQuery}
        />
      </APIProvider>
    );

    // Handle process termination
    process.on('SIGINT', () => {
      unmount();
      process.exit(130); // 128 + 2 (SIGINT) - proper signal exit code
    });

    process.on('SIGTERM', () => {
      unmount();
      process.exit(143); // 128 + 15 (SIGTERM) - proper signal exit code
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('Uncaught error:', error.message);
      unmount();
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      unmount();
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start application:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}