#!/usr/bin/env node

/**
 * Graphyn CLI - Claude Code Headless Multi-Agent Orchestration
 * 
 * Command-line interface for the Graphyn Orchestrator
 * Inspired by claude-squad with mission control streaming
 */

import { GraphynOrchestrator } from '@graphyn/core';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showHelp();
    process.exit(1);
  }

  const command = args[0];
  
  switch (command) {
    case 'orchestrate':
    case 'run':
      await runOrchestration(args.slice(1));
      break;
      
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
      
    default:
      // Treat as orchestration query directly
      await runOrchestration(args);
  }
}

async function runOrchestration(args: string[]) {
  if (args.length === 0) {
    console.error('❌ Error: Please provide a task description');
    console.error('Example: graphyn "Build authentication system with JWT"');
    process.exit(1);
  }

  const query = args.join(' ');
  const workingDir = process.cwd();
  
  try {
    console.log(`🎯 Starting Graphyn Orchestration`);
    console.log(`📁 Working Directory: ${workingDir}`);
    console.log(`💭 Query: "${query}"\n`);
    
    const orchestrator = new GraphynOrchestrator(workingDir);
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log('\n\n⚠️ Orchestration interrupted by user');
      console.log('🎛️ Mission Control shutting down...');
      process.exit(0);
    });
    
    const results = await orchestrator.orchestrate(query);
    
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

// Run the CLI
main().catch(error => {
  console.error('❌ CLI Error:', error);
  process.exit(1);
});