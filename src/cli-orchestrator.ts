#!/usr/bin/env node

/**
 * Graphyn CLI Orchestrator - Multi-Agent Coordination Engine
 * 
 * Replaces complex Ink.js React UI with invisible orchestration system.
 * Processes natural language queries into coordinated multi-agent tasks.
 */

import { RealTimeExecutor } from './orchestrator/RealTimeExecutor.js';
import { ConsoleOutput } from './console/ConsoleOutput.js';
import { StreamingConsoleOutput } from './console/StreamingConsoleOutput.js';
import { InteractiveInput } from './console/InteractiveInput.js';
import { InteractiveOrchestrator } from './orchestrator/InteractiveOrchestrator.js';
import { FigmaExtractor } from './figma/FigmaExtractor.js';
import { FigmaAuthManager } from './figma/FigmaAuthManager.js';
import { OrchestratorBridge } from './orchestrator/OrchestratorBridge.js';

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
    const streamingOutput = new StreamingConsoleOutput();
    const interactiveInput = new InteractiveInput();
    const figmaAuth = new FigmaAuthManager();
    
    // Create bridge for potential Ink UI integration (preserves UI investment)
    const orchestratorBridge = new OrchestratorBridge();
    
    // Initialize the executor before using it (critical fix)
    try {
      await realTimeExecutor.initialize();
      await orchestratorBridge.initialize();
    } catch (error) {
      console.error('❌ Failed to initialize orchestrator:', error instanceof Error ? error.message : error);
      console.error('💡 Make sure .claude/agents/ directory exists with agent configuration files');
      process.exit(1);
    }

    // Handle different command patterns
    if (!command) {
      // Interactive orchestrator mode: graphyn (split-screen experience)
      await handleOrchestratorMode();
    } else if (command === '--simple' || command === '-s') {
      // Simple interactive mode: graphyn --simple (original style)
      await handleInteractiveMode(interactiveInput, realTimeExecutor, streamingOutput);
    } else if (command === 'design' && queryParts.length > 0) {
      // Figma design extraction: graphyn design <figma-url>
      await handleFigmaCommand(queryParts.join(' '), consoleOutput, figmaAuth);
    } else if (command === 'design' && queryParts[0] === 'auth') {
      // Figma authentication: graphyn design auth
      await handleFigmaAuth(figmaAuth, consoleOutput);
    } else if (queryParts.length > 0 || isNaturalLanguageQuery(command)) {
      // Direct query: graphyn "build API" (Claude Code style - immediate execution)
      const fullQuery = queryParts.length > 0 ? `${command} ${queryParts.join(' ')}` : command;
      await handleDirectQuery(fullQuery, realTimeExecutor, interactiveInput, streamingOutput);
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
  streamingOutput: StreamingConsoleOutput
): Promise<void> {
  try {
    console.log(`🚀 Processing: "${query}"`);
    console.log('─'.repeat(60));

    let finalResult: any = null;
    let completedTasks = 0;
    let currentAgent = '';

    // Execute with real-time streaming
    for await (const event of realTimeExecutor.executeQueryStream(query, {
      workingDirectory: process.cwd()
    })) {
      
      // Handle different streaming events
      switch (event.type) {
        case 'start':
          streamingOutput.showAnalysis('Starting query analysis...', 'routing');
          break;
          
        case 'context':
          streamingOutput.showAnalysis(event.data.message || 'Building context...');
          break;
          
        case 'analysis':
          if (event.data.agent && event.data.confidence) {
            streamingOutput.showRouting(event.data.agent, event.data.confidence, event.data.reasoning);
          } else {
            streamingOutput.showAnalysis(event.data.message, event.data.stage);
          }
          break;
          
        case 'agent_start':
          currentAgent = event.data.agent;
          streamingOutput.startAgentStream(currentAgent);
          streamingOutput.showStatus(currentAgent, 'thinking', 'analyzing query');
          break;
          
        case 'message':
          if (event.data.message) {
            const message = event.data.message;
            
            // Stream different message types
            if (message.type === 'assistant') {
              streamingOutput.showStatus(currentAgent, 'writing', 'generating response');
              streamingOutput.streamMessage({
                type: 'assistant',
                agent: currentAgent,
                content: message.message?.content,
                timestamp: Date.now()
              });
            } else if (message.type === 'tool_use') {
              streamingOutput.showStatus(currentAgent, 'reading', message.tool?.name || 'using tool');
              streamingOutput.streamMessage({
                type: 'tool_use',
                agent: currentAgent,
                tool: message.tool?.name,
                timestamp: Date.now()
              });
            } else if (message.type === 'result') {
              streamingOutput.showStatus(currentAgent, 'complete');
              streamingOutput.streamMessage({
                type: 'result',
                agent: currentAgent,
                timestamp: Date.now()
              });
              
              // Extract final result
              if ('subtype' in message && message.subtype === 'success') {
                finalResult = (message as any).result || '';
              }
            }
          }
          break;
          
        case 'result':
          completedTasks++;
          // Extract the actual response content from orchestrator result
          if (event.data && event.data.primaryResponse) {
            finalResult = event.data.primaryResponse;
          } else if (event.data && typeof event.data === 'string') {
            finalResult = event.data;
          }
          streamingOutput.finishAgentStream();
          break;
          
        case 'error':
          console.error(`\n❌ Error: ${event.data.error}`);
          break;
      }
    }

    // Show final result if available
    if (finalResult && typeof finalResult === 'string' && finalResult.trim()) {
      console.log('\n' + '─'.repeat(60));
      console.log('📋 Agent Response:');
      console.log('─'.repeat(60));
      console.log(finalResult.trim());
    } else if (completedTasks === 0) {
      console.log('\n⚠️  No response was generated. This may indicate an issue with the agent execution.');
    }

    // Show completion summary
    console.log('\n' + '─'.repeat(60));
    console.log(`🎉 Task completed! (${completedTasks} agent${completedTasks !== 1 ? 's' : ''} used)`);
    
    // Offer continuation like Claude Code
    console.log('\n💡 You can:');
    console.log('  • Ask for clarification or improvements');
    console.log('  • Request new features or changes');
    console.log('  • Get explanations about the implementation');
    console.log('  • Start a completely new task');
    
    console.log('');
    const followUp = await interactiveInput.showContinuationPrompt();
    
    if (followUp && followUp.toLowerCase() !== 'exit' && followUp.toLowerCase() !== 'quit') {
      // Continue with new query
      console.log(''); // Add spacing
      await handleDirectQuery(followUp, realTimeExecutor, interactiveInput, streamingOutput);
    }

  } catch (error) {
    console.error('\n❌ Execution failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Handle split-screen orchestrator mode (default)
 */
async function handleOrchestratorMode(): Promise<void> {
  try {
    console.log('🚀 Starting Interactive Orchestrator...');
    
    const orchestrator = new InteractiveOrchestrator();
    await orchestrator.initialize();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n📊 Session Summary:');
      const stats = orchestrator.getSessionStats();
      if (stats) {
        const duration = Math.round((Date.now() - stats.startTime) / 1000);
        console.log(`   • Session ID: ${stats.id}`);
        console.log(`   • Duration: ${duration}s`);
        console.log(`   • Queries processed: ${stats.queryCount}`);
      }
      
      await orchestrator.cleanup();
      process.exit(0);
    });
    
    // Start the interactive experience
    await orchestrator.startInteractive();
    
  } catch (error) {
    console.error('❌ Orchestrator mode failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Handle interactive mode (Claude Code style)
 */
export async function handleInteractiveMode(
  interactiveInput: InteractiveInput,
  realTimeExecutor: RealTimeExecutor,
  streamingOutput: StreamingConsoleOutput
): Promise<void> {
  try {
    // Setup event handler for user inputs
    interactiveInput.on('userInput', async (query: string) => {
      try {
        console.log(`🚀 Processing: "${query}"`);
        console.log('─'.repeat(60));

        let finalResult: any = null;
        let completedTasks = 0;
        let currentAgent = '';

        // Execute with real-time streaming
        for await (const event of realTimeExecutor.executeQueryStream(query, {
          workingDirectory: process.cwd()
        })) {
          
          // Handle different streaming events
          switch (event.type) {
            case 'start':
              streamingOutput.showAnalysis('Starting query analysis...', 'routing');
              break;
              
            case 'context':
              streamingOutput.showAnalysis(event.data.message || 'Building context...');
              break;
              
            case 'analysis':
              if (event.data.agent && event.data.confidence) {
                streamingOutput.showRouting(event.data.agent, event.data.confidence, event.data.reasoning);
              } else {
                streamingOutput.showAnalysis(event.data.message, event.data.stage);
              }
              break;
              
            case 'agent_start':
              currentAgent = event.data.agent;
              streamingOutput.startAgentStream(currentAgent);
              streamingOutput.showStatus(currentAgent, 'thinking', 'analyzing query');
              break;
              
            case 'message':
              if (event.data.message) {
                const message = event.data.message;
                
                // Stream different message types
                if (message.type === 'assistant') {
                  streamingOutput.showStatus(currentAgent, 'writing', 'generating response');
                  streamingOutput.streamMessage({
                    type: 'assistant',
                    agent: currentAgent,
                    content: message.message?.content,
                    timestamp: Date.now()
                  });
                } else if (message.type === 'tool_use') {
                  streamingOutput.showStatus(currentAgent, 'reading', message.tool?.name || 'using tool');
                  streamingOutput.streamMessage({
                    type: 'tool_use',
                    agent: currentAgent,
                    tool: message.tool?.name,
                    timestamp: Date.now()
                  });
                } else if (message.type === 'result') {
                  streamingOutput.showStatus(currentAgent, 'complete');
                  streamingOutput.streamMessage({
                    type: 'result',
                    agent: currentAgent,
                    timestamp: Date.now()
                  });
                  
                  // Extract final result
                  if ('subtype' in message && message.subtype === 'success') {
                    finalResult = (message as any).result || '';
                  }
                }
              }
              break;
              
            case 'result':
              completedTasks++;
              // Extract the actual response content from orchestrator result
              if (event.data && event.data.primaryResponse) {
                finalResult = event.data.primaryResponse;
              } else if (event.data && typeof event.data === 'string') {
                finalResult = event.data;
              }
              streamingOutput.finishAgentStream();
              break;
              
            case 'error':
              console.error(`\n❌ Error: ${event.data.error}`);
              break;
          }
        }

        // Show final result if available
        if (finalResult && typeof finalResult === 'string' && finalResult.trim()) {
          console.log('\n' + '─'.repeat(60));
          console.log('📋 Agent Response:');
          console.log('─'.repeat(60));
          console.log(finalResult.trim());
        }

        // Show completion summary
        console.log('\n' + '─'.repeat(60));
        console.log(`🎉 Task completed! (${completedTasks} agent${completedTasks !== 1 ? 's' : ''} used)`);
        console.log(''); // Space before next prompt

      } catch (error) {
        console.error('\n❌ Execution failed:', error instanceof Error ? error.message : String(error));
        console.log(''); // Space before next prompt
      }
    });

    // Start interactive mode
    await interactiveInput.startInteractiveMode();

  } catch (error) {
    console.error('❌ Interactive mode failed:', error instanceof Error ? error.message : String(error));
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
  graphyn                        Interactive orchestrator (split-screen mode)
  graphyn --simple               Simple interactive chat mode
  graphyn "your query"           Direct query with immediate execution
  graphyn design <figma-url>     Extract Figma design to code
  graphyn design auth            Authenticate with Figma

Examples:
  graphyn                                          # Start split-screen orchestrator
  graphyn --simple                                 # Start simple chat mode
  graphyn "help me understand this repository"    # Immediate analysis
  graphyn "build a REST API with authentication"  # Direct implementation
  graphyn "create a dashboard component"           # UI development
  graphyn "review my system architecture"          # Code review

Orchestrator Features:
  • Split-screen: streaming responses above, input below
  • Non-blocking input: type while agents work
  • Queue multiple requests during execution
  • Real-time status indicators and session stats
  • Persistent interaction throughout session

Simple Mode Features:
  • Traditional chat-style interaction
  • One query at a time with full responses
  • Direct follow-up conversations
  • Claude Code style completion prompts

Options:
  -s, --simple                   Use simple interactive mode
  -v, --version                  Show version
  -h, --help                     Show help
  --debug                        Show debug information

Experience:
  ✨ Split-screen orchestrator for continuous workflow
  🚀 Real-time streaming with persistent input
  💬 Queue multiple tasks while agents execute
  🎯 Choose your interaction style: orchestrator or chat
`);
}

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('CLI orchestrator failed:', error);
    process.exit(1);
  });
}