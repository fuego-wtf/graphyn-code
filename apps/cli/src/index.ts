#!/usr/bin/env node

/**
 * Graphyn CLI - Migrated from src/graphyn-cli.ts
 * Command-line interface for Claude Code Headless Multi-Agent Orchestration
 */

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { createOrchestrateCommand, OrchestrateCommand } from './commands/orchestrate.js';
import { createTransparencyCommands } from './commands/transparency.js';
import { exportCommand } from './commands/export.js';
import createMCPAgentsCommand from './commands/mcp-agents.js';
import createFigmaAnalyzeCommand from './commands/figma-analyze.js';
import { classifyQuery } from '@graphyn/core';
import { createInteractiveSession } from './commands/interactive-session.js';

const program = new Command();

// ASCII art banner
function showBanner() {
  console.log(chalk.cyan(figlet.textSync('Graphyn', { horizontalLayout: 'full' })));
  console.log(chalk.gray('🎛️ Claude Code Headless Multi-Agent Orchestration\n'));
}

// Main orchestration command with real agent integration
program.addCommand(createOrchestrateCommand());

// Add transparency monitoring commands
program.addCommand(createTransparencyCommands());

// Add session export and analytics commands
program.addCommand(exportCommand);

// Add MCP agents coordination
program.addCommand(createMCPAgentsCommand());

// Add Figma design-to-code workflow suite
program.addCommand(createFigmaAnalyzeCommand());

// Direct query execution (for backward compatibility)
program
  .arguments('<query...>')
  .action(async (queryParts: string[]) => {
    await handleDirectQuery(queryParts);
  });

// Initialize command
program
  .command('init')
  .description('Initialize a new Graphyn workspace')
  .action(async () => {
    console.log('🚀 Initializing Graphyn workspace...');
    // TODO: Implement initialization logic using @graphyn/workspace
  });

// Session management
program
  .command('session')
  .description('Manage orchestration sessions')
  .action(async () => {
    console.log('📋 Session management - Coming soon');
    // TODO: Implement session management using @graphyn/session
  });

// Flow execution
program
  .command('flow <query>')
  .description('Execute a task flow with natural language query')
  .action(async (query: string) => {
    console.log('🎯 Flow execution - Coming soon');
    console.log('Query:', query);
    // TODO: Implement flow execution using @graphyn/flow
  });

// Mission Control dashboard
program
  .command('dashboard')
  .description('Launch Mission Control dashboard')
  .action(async () => {
    console.log('🎛️ Mission Control dashboard - Coming soon');
    // TODO: Implement dashboard launch
  });

// System diagnostics
program
  .command('doctor')
  .description('Run system diagnostics and health checks')
  .action(async () => {
    console.log('🏥 System diagnostics - Coming soon');
    // TODO: Implement system diagnostics
  });

// Orchestration execution function (migrated from original)
async function handleDirectQuery(queryParts: string[]): Promise<void> {
  if (queryParts.length === 0) {
    showBanner();
    showHelp();
    process.exit(1);
    return;
  }

  const rawQuery = queryParts.join(' ');
  const classification = classifyQuery(rawQuery);

  switch (classification.intent) {
    case 'help': {
      showBanner();
      showHelp();
      process.exit(0);
      return;
    }
    case 'version': {
      console.log(program.version());
      process.exit(0);
      return;
    }
    case 'orchestrate': {
      showBanner();
      const interactiveSession = createInteractiveSession();
      try {
        await interactiveSession.handleDirectQuery(classification.query);
        // Interactive mode handles its own lifecycle - no process.exit needed
      } catch (error) {
        console.error('\n❌ Interactive session failed:', error instanceof Error ? error.message : String(error));
        interactiveSession.cleanup();
        process.exit(1);
      }
      return;
    }
    default: {
      showBanner();
      console.error('❌ Unable to understand the requested action.');
      showHelp();
      process.exit(1);
    }
  }
}

function showHelp() {
  console.log(`
🎛️ Graphyn CLI - Claude Code Headless Multi-Agent Orchestration

USAGE:
  graphyn <query>                  Run orchestration with natural language query
  graphyn orchestrate <query>      Same as above (explicit command)
  graphyn transparency <cmd>       Monitor agent execution and logs
  graphyn export <session-id>      Export session with analytics
  graphyn figma <cmd>              Figma design-to-code workflow suite
  graphyn init                     Initialize workspace
  graphyn agents                   Manage agents
  graphyn flow <query>             Execute task flow
  graphyn dashboard                Launch Mission Control
  graphyn doctor                   System diagnostics
  graphyn help                     Show this help message

EXAMPLES:
  graphyn "Build authentication system with JWT"
  graphyn "Create REST API with user management"
  graphyn transparency tail -f       # Follow live transparency events
  graphyn transparency tree          # Show process execution tree
  graphyn export session-123 --format zip  # Export session as ZIP with analytics
  graphyn figma auth login           # Authenticate with Figma
  graphyn figma extract <url>        # Extract components from Figma
  graphyn figma export <path>        # Export components to various formats
  graphyn figma workflow <url>       # Complete auth → extract → export workflow

FEATURES:
  ✨ Natural language task understanding
  🤖 Specialized agent deployment (Backend, Security, Testing, etc.)
  🎛️ Real-time Mission Control dashboard
  ⚡ Parallel execution with dependency management
  💬 Human-in-the-loop feedback system
  📊 Efficiency metrics and progress tracking
  🎨 Figma design-to-code automation

FIGMA INTEGRATION:
  Complete design-to-code workflow with OAuth authentication,
  component extraction, i18n support, and multiple export formats.

MISSION CONTROL:
  The interface shows live agent execution with streaming updates.
  Press Ctrl+C to gracefully shut down the orchestration.

For more information, visit: https://github.com/your-repo/graphyn
`);
}

// Main execution
program
  .name('graphyn')
  .description('🎛️ Claude Code Headless Multi-Agent Orchestration')
  .version('0.1.70')
  .option('--help', 'Show help information')
  .hook('preAction', () => {
    // Only show banner for specific commands, not for direct queries
    const command = process.argv[2];
    const isDirectCommand = ['init', 'agents', 'flow', 'dashboard', 'doctor', 'session', 'transparency', 'export'].includes(command);
    if (isDirectCommand) {
      showBanner();
    }
  });

// Handle help and no arguments for main CLI only
if (process.argv.length <= 2) {
  showBanner();
  showHelp();
  process.exit(0);
} else if ((process.argv.includes('--help') || process.argv.includes('-h')) && process.argv.length === 3) {
  // Only show main help if --help is the only argument
  showBanner();
  showHelp();
  process.exit(0);
} else {
  program.parse();
}
