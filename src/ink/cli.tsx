#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

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
  graphyn init                   Initialize Graphyn in your project
  graphyn <agent> <query>        Direct agent query
  graphyn design <figma-url>     Generate pixel-perfect components
  graphyn share agent            Share agent with your team
  graphyn threads                Manage threads
  graphyn auth [key]             Authenticate
  graphyn doctor                 System check

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
  graphyn init
  graphyn design figma.com/file/xyz/Button
  graphyn backend "add user authentication"
  graphyn frontend "create dashboard"
  graphyn auth gph_xxxxx
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
  // Render the Ink app
  const { unmount } = render(<App command={normalizedCommand} query={query} />);

  // Handle process termination
  process.on('SIGINT', () => {
    unmount();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    unmount();
    process.exit(0);
  });
}