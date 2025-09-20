#!/usr/bin/env node

/**
 * Graphyn CLI - Migrated from src/graphyn-cli.ts
 * Command-line interface for Claude Code Headless Multi-Agent Orchestration
 */

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { createOrchestrateCommand } from './commands/orchestrate.js';

const program = new Command();

// ASCII art banner
function showBanner() {
  console.log(chalk.cyan(figlet.textSync('Graphyn', { horizontalLayout: 'full' })));
  console.log(chalk.gray('🎛️ Claude Code Headless Multi-Agent Orchestration\n'));
}

// Main orchestration command with real agent integration
program.addCommand(createOrchestrateCommand());

// Direct query execution (for backward compatibility)
program
  .arguments('<query...>')
  .action(async (queryParts: string[]) => {
    await runOrchestration(queryParts);
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

// Agent management
program
  .command('agents')
  .description('Manage and deploy specialized agents')
  .action(async () => {
    console.log('🤖 Agent management - Coming soon');
    // TODO: Implement agent management using @graphyn/agents
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
async function runOrchestration(queryParts: string[]) {
  if (queryParts.length === 0) {
    console.error('❌ Error: Please provide a task description');
    console.error('Example: graphyn "Build authentication system with JWT"');
    process.exit(1);
  }

  const query = queryParts.join(' ');
  const workingDir = process.cwd();
  
  try {
    console.log(`🎯 Starting Graphyn Orchestration`);
    console.log(`📁 Working Directory: ${workingDir}`);
    console.log(`💭 Query: "${query}"\n`);
    
    // TODO: Initialize orchestrator from @graphyn/core
    console.log('⚠️ Orchestrator implementation migrated to @graphyn/core package');
    console.log('🚧 Integration with new architecture in progress...\n');
    
    // const { GraphynOrchestrator } = await import('@graphyn/core');
    // const orchestrator = new GraphynOrchestrator(workingDir);
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log('\n\n⚠️ Orchestration interrupted by user');
      console.log('🎛️ Mission Control shutting down...');
      process.exit(0);
    });
    
    // const results = await orchestrator.orchestrate(query);
    
    console.log('\n🎛️ Mission Control Complete!');
    console.log('🎯 Agents will continue monitoring for changes...\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Orchestration failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
🎛️ Graphyn CLI - Claude Code Headless Multi-Agent Orchestration

USAGE:
  graphyn <query>                  Run orchestration with natural language query
  graphyn orchestrate <query>      Same as above (explicit command)
  graphyn init                     Initialize workspace
  graphyn agents                   Manage agents
  graphyn flow <query>             Execute task flow
  graphyn dashboard                Launch Mission Control
  graphyn doctor                   System diagnostics
  graphyn help                     Show this help message

EXAMPLES:
  graphyn "Build authentication system with JWT"
  graphyn "Create REST API with user management"
  graphyn "Add security scanning to existing codebase"
  graphyn "Implement comprehensive test suite"
  
FEATURES:
  ✨ Natural language task understanding
  🤖 Specialized agent deployment (Backend, Security, Testing, etc.)
  🎛️ Real-time Mission Control dashboard
  ⚡ Parallel execution with dependency management
  💬 Human-in-the-loop feedback system
  📊 Efficiency metrics and progress tracking

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
    const isDirectCommand = ['init', 'agents', 'flow', 'dashboard', 'doctor', 'session'].includes(command);
    if (isDirectCommand) {
      showBanner();
    }
  });

// Handle help and no arguments
if (process.argv.length <= 2 || process.argv.includes('--help') || process.argv.includes('-h')) {
  showBanner();
  showHelp();
  process.exit(0);
} else {
  program.parse();
}