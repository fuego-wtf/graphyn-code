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
  console.log('0.1.50');
  process.exit(0);
}

// Show help
if (normalizedCommand === '--help' || normalizedCommand === '-h' || normalizedCommand === 'help') {
  console.log(`
Graphyn Code - AI Development Tool for Claude Code

Usage:
  graphyn                        Interactive mode
  graphyn init                   Initialize GRAPHYN.md in your project
  graphyn <agent> <query>        Direct agent query
  graphyn design <figma-url>     Generate pixel-perfect components
  
Commands:
  graphyn threads                Manage conversation threads
  graphyn auth [key]             Authenticate with API key
  graphyn doctor                 System health check
  graphyn status                 Show project status
  graphyn history                View recent interactions
  graphyn share agent            Share agent with team
  graphyn sync <action>          Sync GRAPHYN.md (pull|push|edit)
  graphyn whoami                 Show authentication status
  graphyn logout                 Remove authentication

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
  graphyn init                   Initialize project documentation
  graphyn design figma.com/...   Extract Figma component
  graphyn backend "add auth"     Query backend agent
  graphyn threads                Manage active threads
  graphyn sync pull              Get latest GRAPHYN.md template
`);
  process.exit(0);
}

// Check if we can use raw mode
if (!process.stdin.isTTY && !process.env.FORCE_COLOR) {
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
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      unmount();
      process.exit(0);
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