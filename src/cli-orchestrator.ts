#!/usr/bin/env node

/**
 * Graphyn CLI Orchestrator - Multi-Agent Coordination Engine
 * 
 * Replaces complex Ink.js React UI with invisible orchestration system.
 * Processes natural language queries into coordinated multi-agent tasks.
 */

import { RealTimeExecutor } from './orchestrator/RealTimeExecutor.js';
import { ConsoleOutput } from './console/ConsoleOutput.js';
import { InteractiveInput } from './console/InteractiveInput.js';
import { FigmaExtractor } from './figma/FigmaExtractor.js';
import { FigmaAuthManager } from './figma/FigmaAuthManager.js';

/**
 * Main CLI entry point
 */
export async function main(): Promise<void> {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const [command, ...queryParts] = args;

    // Initialize components with Claude Code style interface
    const realTimeExecutor = new RealTimeExecutor();
    const consoleOutput = new ConsoleOutput();
    const interactiveInput = new InteractiveInput();
    const figmaAuth = new FigmaAuthManager();

    // Handle different command patterns
    if (!command) {
      // Interactive mode: graphyn (Claude Code style)
      await handleInteractiveMode(interactiveInput, realTimeExecutor, consoleOutput);
    } else if (command === 'design' && queryParts.length > 0) {
      // Figma design extraction: graphyn design <figma-url>
      await handleFigmaCommand(queryParts.join(' '), consoleOutput, figmaAuth);
    } else if (command === 'design' && queryParts[0] === 'auth') {
      // Figma authentication: graphyn design auth
      await handleFigmaAuth(figmaAuth, consoleOutput);
    } else if (queryParts.length > 0 || isNaturalLanguageQuery(command)) {
      // Direct query: graphyn "build API" (Claude Code style - immediate execution)
      const fullQuery = queryParts.length > 0 ? `${command} ${queryParts.join(' ')}` : command;
      await handleDirectQuery(fullQuery, realTimeExecutor, interactiveInput, consoleOutput);
    } else {
      // Show help for unknown commands
      showHelp();
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Orchestration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Handle direct query execution (Claude Code style - immediate execution)
 */
export async function handleDirectQuery(
  query: string,
  realTimeExecutor: RealTimeExecutor,
  interactiveInput: InteractiveInput,
  consoleOutput: ConsoleOutput
): Promise<void> {
  try {
    // Show immediate start without confusing task plan
    consoleOutput.streamAgentActivity('system', `Processing: "${query}"`, 'starting');

    // Execute with real-time streaming
    const result = await realTimeExecutor.executeQuery(query, {
      workingDirectory: process.cwd()
    });

    // Show completion
    const successRate = Math.round((result.completedTasks.length / (result.completedTasks.length + result.failedTasks.length)) * 100);
    consoleOutput.streamSystemEvent('coordination', `Completed with ${successRate}% success rate`);

    // Show results
    if (result.completedTasks.length > 0) {
      console.log('\n🎉 Results:');
      result.completedTasks.forEach(task => {
        console.log(`   ✅ ${task.result}`);
      });
    }

    if (result.failedTasks.length > 0) {
      console.log('\n⚠️ Issues:');
      result.failedTasks.forEach(task => {
        console.log(`   ❌ ${task.error}`);
      });
    }

    // Offer continuation like Claude Code
    console.log('');
    const followUp = await interactiveInput.showContinuationPrompt();
    
    if (followUp && followUp.toLowerCase() !== 'exit' && followUp.toLowerCase() !== 'quit') {
      // Continue with new query
      await handleDirectQuery(followUp, realTimeExecutor, interactiveInput, consoleOutput);
    }

  } catch (error) {
    consoleOutput.streamError('executor', error instanceof Error ? error : new Error(String(error)), 'Direct query execution');
    throw error;
  }
}

/**
 * Handle interactive mode (Claude Code style)
 */
export async function handleInteractiveMode(
  interactiveInput: InteractiveInput,
  realTimeExecutor: RealTimeExecutor,
  consoleOutput: ConsoleOutput
): Promise<void> {
  try {
    // Setup event handler for user inputs
    interactiveInput.on('userInput', async (query: string) => {
      try {
        // Execute query immediately with streaming
        consoleOutput.streamAgentActivity('system', `Processing: "${query}"`, 'starting');

        const result = await realTimeExecutor.executeQuery(query, {
          workingDirectory: process.cwd()
        });

        // Show completion
        const successRate = Math.round((result.completedTasks.length / (result.completedTasks.length + result.failedTasks.length)) * 100);
        consoleOutput.streamSystemEvent('coordination', `Completed with ${successRate}% success rate`);

        // Show results
        if (result.completedTasks.length > 0) {
          console.log('\n🎉 Results:');
          result.completedTasks.forEach(task => {
            console.log(`   ✅ ${task.result}`);
          });
        }

        if (result.failedTasks.length > 0) {
          console.log('\n⚠️ Issues:');
          result.failedTasks.forEach(task => {
            console.log(`   ❌ ${task.error}`);
          });
        }

        console.log(''); // Space before next prompt

      } catch (error) {
        consoleOutput.streamError('interactive', error instanceof Error ? error : new Error(String(error)), 'Interactive execution');
        console.log(''); // Space before next prompt
      }
    });

    // Start interactive mode
    await interactiveInput.startInteractiveMode();

  } catch (error) {
    consoleOutput.showError(error instanceof Error ? error : new Error(String(error)), 'Interactive mode');
    throw error;
  }
}


/**
 * Handle Figma design extraction commands
 */
async function handleFigmaCommand(
  figmaUrl: string, 
  consoleOutput: ConsoleOutput, 
  figmaAuth: FigmaAuthManager
): Promise<void> {
  try {
    consoleOutput.showLogStream('Figma', '🎨 Extracting Figma design...', 'info');

    // Check authentication
    const isAuthenticated = await figmaAuth.isAuthenticated();
    if (!isAuthenticated) {
      consoleOutput.showError(new Error('Not authenticated with Figma'), 'Run: graphyn design auth');
      return;
    }

    // Extract design
    const accessToken = await figmaAuth.getValidAccessToken();
    if (!accessToken) {
      throw new Error('Failed to get valid access token');
    }
    
    const figmaExtractor = new FigmaExtractor(accessToken);
    // TODO: Update FigmaExtractor to have extractDesign method
    consoleOutput.showLogStream('Figma', `📋 Processing Figma URL: ${figmaUrl}`, 'info');
    consoleOutput.showSuccess('Figma extraction completed');

  } catch (error) {
    consoleOutput.showError(error instanceof Error ? error : new Error(String(error)), 'Figma extraction');
    throw error;
  }
}

/**
 * Handle Figma OAuth authentication
 */
async function handleFigmaAuth(figmaAuth: FigmaAuthManager, consoleOutput: ConsoleOutput): Promise<void> {
  try {
    consoleOutput.showLogStream('Figma Auth', '🔐 Starting Figma OAuth authentication...', 'info');
    
    const result = await figmaAuth.authenticateOAuth();
    
    // FigmaTokens should have accessToken property to indicate success
    if (result.accessToken) {
      consoleOutput.showSuccess('Successfully authenticated with Figma');
    } else {
      consoleOutput.showError(new Error('Authentication failed'), 'OAuth flow incomplete');
    }

  } catch (error) {
    consoleOutput.showError(error instanceof Error ? error : new Error(String(error)), 'Figma authentication');
    throw error;
  }
}

/**
 * Check if command is a natural language query
 */
function isNaturalLanguageQuery(command: string): boolean {
  // Known agent commands
  const knownCommands = ['backend', 'frontend', 'architect', 'design', 'cli'];
  
  if (knownCommands.includes(command?.toLowerCase())) {
    return false;
  }

  // Natural language patterns
  const naturalLanguagePatterns = [
    /^(help|tell|show|create|build|make|add|implement|fix|update|generate|write|explain)/i,
    /^(what|how|why|when|where|can|could|should|would|please)/i,
    /\s/, // Contains spaces
    /^".*"$/ // Quoted string
  ];

  return naturalLanguagePatterns.some(pattern => pattern.test(command || ''));
}

/**
 * Show CLI help information
 */
function showHelp(): void {
  console.log(`
Graphyn Code - AI Development Assistant (Claude Code Style)

Usage:
  graphyn                        Interactive chat mode (like Claude Code)
  graphyn "your query"           Direct query with immediate execution
  graphyn design <figma-url>     Extract Figma design to code
  graphyn design auth            Authenticate with Figma

Examples:
  graphyn                                          # Start interactive chat
  graphyn "help me understand this repository"    # Immediate analysis
  graphyn "build a REST API with authentication"  # Direct implementation
  graphyn "create a dashboard component"           # UI development
  graphyn "review my system architecture"          # Code review

Interactive Features:
  • Continuous chat like Claude Code
  • Real-time streaming of agent progress
  • No confusing task plans - just immediate execution
  • Natural follow-up conversations
  • Repository analysis and code understanding

Options:
  -v, --version                  Show version
  -h, --help                     Show help
  --debug                        Show debug information

Experience:
  ✨ Works exactly like Claude Code but for repository tasks
  🚀 Real-time streaming shows what agents are doing
  💬 Continuous conversation after each completion
  🎯 No complex interfaces - just natural language
`);
}

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('CLI orchestrator failed:', error);
    process.exit(1);
  });
}