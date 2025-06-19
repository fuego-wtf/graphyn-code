#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import { App } from './app.js';

const cli = meow(`
  Usage
    $ graphyn               Interactive mode
    $ graphyn <agent> <query>   Direct agent query
    
  Agents
    backend    Query backend development agent
    frontend   Query frontend development agent  
    architect  Query system architecture agent
    design     Query design system agent
    cli        Query CLI development agent
    
  Commands
    threads    Manage conversation threads
    auth       Authenticate with Graphyn
    doctor     Check system configuration
    
  Options
    --version  Show version
    --help     Show help
    
  Examples
    $ graphyn
    $ graphyn backend "add user authentication"
    $ graphyn frontend "create dashboard component"
    $ graphyn architect "design microservices"
`, {
  importMeta: import.meta,
  flags: {
    version: {
      type: 'boolean',
      shortFlag: 'v'
    },
    help: {
      type: 'boolean',
      shortFlag: 'h'
    }
  }
});

// Parse command and query
const [command, ...queryParts] = cli.input;
const query = queryParts.join(' ');

// Handle special commands that don't need Ink UI
if (cli.flags.version) {
  console.log(cli.pkg.version);
  process.exit(0);
}

if (cli.flags.help) {
  console.log(cli.help);
  process.exit(0);
}

// Render the Ink app
const { unmount } = render(
  <App command={command} query={query} />
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