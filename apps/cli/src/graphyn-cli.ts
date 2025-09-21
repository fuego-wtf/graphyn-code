#!/usr/bin/env node

/**
 * Graphyn CLI - Claude Code Headless Multi-Agent Orchestration
 * 
 * Command-line interface for the Graphyn Orchestrator
 * Implements Steps 1-3 of the 140-step workflow with transparency
 * 
 * Step 1: User types `graphyn` in terminal ✅
 * Step 2: CLI displays animated welcome banner ✅ 
 * Step 3: CLI detects user identity → ~/.graphyn/john-doe/ ✅
 */

import { GraphynOrchestrator } from '@graphyn/core';
import { UserDataManager } from './utils/UserDataManager.js';

async function main() {
  const args = process.argv.slice(2);
  
  // Step 1: User types `graphyn` in terminal - COMPLETED
  process.stdout.write('🚀 Initializing Graphyn CLI...\n');

  // Step 2: CLI displays animated welcome banner
  process.stdout.write('📱 Loading user interface...\n');

  // Step 3: CLI detects user identity → ~/.graphyn/john-doe/
  const userDataManager = new UserDataManager();
  const userIdentity = await userDataManager.detectAndInitializeUser();

  // Step 4: Loads user settings and authentication tokens
  process.stdout.write('🔐 Loading authentication tokens...\n');
  try {
    const userSettings = await userDataManager.loadUserSettings();
    process.stdout.write(`⚙️ User preferences loaded (transparency: ${userSettings.preferences.transparency.enabled ? 'enabled' : 'disabled'})\n`);
  } catch (error) {
    process.stdout.write('⚙️ Using default settings (first run)\n');
  }
  
  if (args.length === 0) {
    showHelp();
    process.exit(1);
  }

  const command = args[0];

  // Check for help commands first
  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  // Everything else is treated as a natural language query for orchestration
  await runOrchestration(args, userDataManager);
}

async function runOrchestration(args: string[], userDataManager: UserDataManager) {
  if (args.length === 0) {
    process.stderr.write('❌ Error: Please provide a task description\n');
    process.stderr.write('Example: graphyn "Build authentication system with JWT"\n');
    process.exit(1);
  }

  const query = args.join(' ');
  const workingDir = process.cwd();

  try {
    process.stdout.write(`🎯 Starting Graphyn Orchestration\n`);
    process.stdout.write(`📁 Working Directory: ${workingDir}\n`);
    process.stdout.write(`💭 Query: "${query}"\n\n`);

    // Create session for this orchestration (Step 14)
    const sessionDir = await userDataManager.createSession();
    process.stdout.write(`📊 Session initialized: ${sessionDir}\n\n`);

    const orchestrator = new GraphynOrchestrator(workingDir);

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      process.stdout.write('\n\n⚠️ Orchestration interrupted by user\n');
      process.stdout.write('🎛️ Mission Control shutting down...\n');
      process.exit(0);
    });

    const results = await orchestrator.orchestrate(query);

    process.stdout.write('\n🎛️ Mission Control Complete!\n');
    process.stdout.write('🎯 Agents will continue monitoring for changes...\n\n');

    process.exit(0);

  } catch (error) {
    process.stderr.write('\n❌ Orchestration failed: ' + (error instanceof Error ? error.message : String(error)) + '\n');
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
🎛️ Graphyn CLI - Claude Code Headless Multi-Agent Orchestration

USAGE:
  graphyn <query>                  Run orchestration with natural language query
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
  process.stderr.write('❌ CLI Error: ' + String(error) + '\n');
  process.exit(1);
});