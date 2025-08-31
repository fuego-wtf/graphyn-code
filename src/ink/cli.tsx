#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { APIProvider } from './contexts/APIContext.js';

// Parse command line arguments
let [, , rawCommand, ...args] = process.argv;

// Parse flags from rawCommand and args
let isDev = false;
let isDebug = false;

// Check if rawCommand is a flag
if (rawCommand === '--dev') {
  isDev = true;
  rawCommand = args.shift() || ''; // Move first arg to rawCommand
}

// After processing --dev, check if the new rawCommand is --debug
if (rawCommand === '--debug') {
  isDebug = true;
  rawCommand = args.shift() || ''; // Move first arg to rawCommand
}

// Also check for flags in args array (for cases like: "query" --dev --debug)
const devFlagIndex = args.indexOf('--dev');
if (devFlagIndex !== -1) {
  isDev = true;
  args.splice(devFlagIndex, 1);
}

const debugFlagIndex = args.indexOf('--debug');
if (debugFlagIndex !== -1) {
  isDebug = true;
  args.splice(debugFlagIndex, 1);
}

// Set debug mode globally
if (isDebug) {
  process.env.DEBUG_GRAPHYN = 'true';
}

// Set development environment variables immediately after parsing flags
if (isDev) {
  process.env.NODE_ENV = 'development';
  process.env.GRAPHYN_DEV_MODE = 'true';
  process.env.GRAPHYN_API_URL = 'http://localhost:4000';
  process.env.GRAPHYN_APP_URL = 'http://localhost:3000';
  
  // Debug output to confirm variables are set
  if (process.env.DEBUG_GRAPHYN) {
    console.log('[CLI Debug] Dev mode environment variables set:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- GRAPHYN_DEV_MODE:', process.env.GRAPHYN_DEV_MODE);
    console.log('- GRAPHYN_API_URL:', process.env.GRAPHYN_API_URL);
    console.log('- GRAPHYN_APP_URL:', process.env.GRAPHYN_APP_URL);
  }
}

// Check if this is a natural language query - AGGRESSIVE DETECTION
// Treat anything that's not a known command as natural language
const knownCommands = ['backend', 'frontend', 'architect', 'design', 'cli', 'analyze', 'revive', '--version', '-v', '--help', '-h', 'help'];

const isNaturalLanguage = rawCommand && (
  // Quoted queries (single quoted string passed as full command)
  (rawCommand.startsWith('"') && rawCommand.endsWith('"') && rawCommand.length > 2) ||
  (rawCommand.startsWith('"') && args[args.length - 1]?.endsWith('"')) ||
  // Multi-word commands (contains spaces) - most natural language
  rawCommand.includes(' ') ||
  // Commands starting with common words
  /^(help|tell|show|create|build|make|add|implement|fix|update|generate|write|explain|what|how|why|when|where|can|could|should|would|please|i |the |a |an )/i.test(rawCommand) ||
  // Any unrecognized single word with arguments
  (args.length > 0 && !knownCommands.includes(rawCommand?.toLowerCase() || '')) ||
  // Any unrecognized single word that's not in known commands
  (!knownCommands.includes(rawCommand?.toLowerCase() || ''))
);

if (process.env.DEBUG_GRAPHYN) {
  console.log('🔍 Natural language detection:');
  console.log('- rawCommand:', JSON.stringify(rawCommand));
  console.log('- args:', JSON.stringify(args));
  console.log('- isNaturalLanguage:', isNaturalLanguage);
}

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
let normalizedCommand = command ? (agentAliases[command] || command) : undefined;

// Show version
if (normalizedCommand === '--version' || normalizedCommand === '-v') {
  console.log('0.1.70');
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
const agents = ['backend', 'frontend', 'architect', 'design', 'cli'];
const isDirectAgentCommand = agents.includes(normalizedCommand) && query;

// Commands that should always use fallback mode
const fallbackCommands = ['orchestrate']; // Remove 'squad' so it uses interactive mode
const isFallbackCommand = fallbackCommands.includes(normalizedCommand);

// Check if graphyn was called without any arguments (builder mode)
const isBuilderMode = !normalizedCommand;

// Enhanced TTY detection for better terminal support
const isInteractive = Boolean(
  process.stdin.isTTY || 
  process.env.FORCE_COLOR ||
  process.env.FORCE_INTERACTIVE || // Allow forcing interactive mode
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

// Handle forced interactive mode with initial query
if (process.env.FORCE_INTERACTIVE && process.env.GRAPHYN_INITIAL_QUERY) {
  // Override command and query for mission control mode
  normalizedCommand = 'squad'; // Set to squad mode for mission control
  query = process.env.GRAPHYN_INITIAL_QUERY;
}

// Determine if we should use fallback mode
let useFallback = false;

if (isDirectAgentCommand || isFallbackCommand) {
  // Direct agent commands and fallback commands always use fallback
  useFallback = true;
} else if (isBuilderMode) {
  // Builder mode: only use fallback if truly non-interactive or in CI
  useFallback = !isInteractive || isCI;
} else {
  // Other commands: use fallback if non-interactive
  useFallback = !isInteractive || isCI;
}

// Never use fallback when FORCE_INTERACTIVE is set
if (process.env.FORCE_INTERACTIVE) {
  useFallback = false;
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
  console.log('- Fallback command:', isFallbackCommand ? 'YES' : 'NO');
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