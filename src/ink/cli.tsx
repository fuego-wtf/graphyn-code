#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { APIProvider } from './contexts/APIContext.js';

// Parse command line arguments
const [, , rawCommand, ...args] = process.argv;
const command = rawCommand?.toLowerCase(); // Make command case-insensitive
const query = args.join(' ');

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

Agents:
  backend (b)                    Backend development agent
  frontend (f)                   Frontend development agent
  architect (a)                  System architecture agent
  design (d)                     Design system agent
  cli (c)                        CLI development agent

Options:
  -v, --version                  Show version
  -h, --help                     Show help

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

// Check if we can use raw mode
// Also check for Warp terminal which might have special TTY handling
const isWarp = process.env.TERM_PROGRAM === 'WarpTerminal';

// Debug output for terminal detection
if (process.env.DEBUG_GRAPHYN) {
  console.log('Terminal Debug Info:');
  console.log('- TTY:', process.stdin.isTTY ? 'YES' : 'NO');
  console.log('- TERM_PROGRAM:', process.env.TERM_PROGRAM || 'none');
  console.log('- Is Warp:', isWarp ? 'YES' : 'NO');
  console.log('- Direct agent command:', isDirectAgentCommand ? 'YES' : 'NO');
  console.log('- Using fallback:', (!process.stdin.isTTY && !process.env.FORCE_COLOR || isWarp || isDirectAgentCommand) ? 'YES' : 'NO');
}

// Use fallback for: non-TTY, Warp terminal, or direct agent commands
if (!process.stdin.isTTY && !process.env.FORCE_COLOR || isWarp || isDirectAgentCommand) {
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