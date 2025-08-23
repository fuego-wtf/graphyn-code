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
  rawCommand = args.shift() || ''; // Move first arg to rawCommand
} else if (rawCommand === '--debug') {
  isDebug = true;
  rawCommand = args.shift() || ''; // Move first arg to rawCommand
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

if (isNaturalLanguage) {
  // Treat entire input as a natural language query
  command = 'squad';
  query = [rawCommand || '', ...args].join(' ').replace(/^"|"$/g, '');
} else {
  command = rawCommand?.toLowerCase() || undefined; // Make command case-insensitive
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
const normalizedCommand = command ? (agentAliases[command] || command) : undefined;

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
  graphyn                        Interactive mode (includes agent revival)
  graphyn "your query"           Direct natural language query

Examples:
  graphyn                        Launch interactive builder
  graphyn "add user auth"        Natural language development
  graphyn "review my API"        Architecture review
  graphyn "extract figma.com/..." Design extraction

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
`);
  process.exit(0);
}

// Check if this is a direct agent command - always use fallback for these
const agents = ['backend', 'frontend', 'architect', 'design', 'cli', 'squad'];
const isDirectAgentCommand = agents.includes(normalizedCommand) && query;

// Check if graphyn was called without any arguments (builder mode)
const isBuilderMode = !normalizedCommand;

// Enhanced TTY detection for better terminal support
const isInteractive = Boolean(
  process.stdin.isTTY || 
  process.env.FORCE_COLOR ||
  (process.env.TERM && process.env.TERM !== 'dumb')
);

// Check for CI environments
const isCI = Boolean(
  process.env.CI ||
  process.env.CONTINUOUS_INTEGRATION ||
  process.env.GITHUB_ACTIONS ||
  process.env.GITLAB_CI ||
  process.env.CIRCLECI ||
  process.env.JENKINS_URL
);

// Determine if we should use fallback mode
let useFallback = false;

if (isDirectAgentCommand) {
  // Direct agent commands always use fallback
  useFallback = true;
} else if (isBuilderMode) {
  // Builder mode: only use fallback if truly non-interactive or in CI
  useFallback = !isInteractive || isCI;
} else {
  // Other commands: use fallback if non-interactive
  useFallback = !isInteractive || isCI;
}

// Debug output for terminal detection (only when DEBUG_GRAPHYN is set)
if (process.env.DEBUG_GRAPHYN) {
  console.log('Terminal Debug Info:');
  console.log('- rawCommand:', rawCommand);
  console.log('- normalizedCommand:', normalizedCommand);
  console.log('- isBuilderMode:', isBuilderMode);
  console.log('- TTY:', process.stdin.isTTY ? 'YES' : 'NO');
  console.log('- TERM:', process.env.TERM || 'none');
  console.log('- TERM_PROGRAM:', process.env.TERM_PROGRAM || 'none');
  console.log('- isInteractive:', isInteractive ? 'YES' : 'NO');
  console.log('- isCI:', isCI ? 'YES' : 'NO');
  console.log('- Direct agent command:', isDirectAgentCommand ? 'YES' : 'NO');
  console.log('- Using fallback:', useFallback ? 'YES' : 'NO');
}

// Use fallback for non-interactive environments or direct agent commands
if (useFallback) {
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
        <App command={normalizedCommand} query={query} />
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