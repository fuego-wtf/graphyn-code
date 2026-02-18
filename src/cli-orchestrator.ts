#!/usr/bin/env node

/**
 * Graphyn CLI Orchestrator - Multi-Agent Coordination Engine
 * 
 * Project-agnostic multi-agent orchestration with Context7-style deep analysis.
 * Supports initialization, task planning, execution, and coordination across any project type.
 */

import { RealTimeExecutor } from './orchestrator/RealTimeExecutor.js';
import { AgentOrchestrator } from './orchestrator/AgentOrchestrator.js';
import { ConsoleOutput } from './console/ConsoleOutput.js';
import { StreamingConsoleOutput } from './console/StreamingConsoleOutput.js';
import { InteractiveInput } from './console/InteractiveInput.js';
// Import project-agnostic orchestration commands
import {
  handleInitCommand,
  handlePlanCommand,
  handleExecuteCommand,
  handleStatusCommand,
  handleAgentsCommand,
  handleConfigureCommand,
  handleCoordinateCommand,
  handleHelpCommand
} from './commands/orchestration-commands.js';

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
    // Create agent orchestrator for multi-agent coordination
    const agentOrchestrator = new AgentOrchestrator();
    
    // Initialize components before using them (critical fix)
    try {
      await realTimeExecutor.initialize();
      await agentOrchestrator.initialize();
    } catch (error) {
      console.error('❌ Failed to initialize orchestrator:', error instanceof Error ? error.message : error);
      console.error('💡 Make sure .claude/agents/ directory exists with agent configuration files');
      process.exit(1);
    }

    // Handle different command patterns
    if (!command) {
      // Interactive orchestrator mode: graphyn (split-screen experience)
      await startInteractiveOrchestrator();
    } else if (command === 'init') {
      // Project initialization: graphyn init
      await handleInitCommand({ force: args.includes('--force'), template: getArgValue(args, '--template'), agents: getArgValue(args, '--agents')?.split(',') });
    } else if (command === 'plan') {
      // Task planning: graphyn plan "add authentication"
      const request = queryParts.join(' ');
      if (!request) {
        console.error('❌ Request required for planning');
        process.exit(1);
      }
      await handlePlanCommand(request, { 
        complexity: getArgValue(args, '--complexity'),
        maxTasks: parseInt(getArgValue(args, '--max-tasks') || '10'),
        dryRun: args.includes('--dry-run'),
        save: args.includes('--save')
      });
    } else if (command === 'execute') {
      // Plan execution: graphyn execute [plan-id]
      const planId = queryParts[0];
      await handleExecuteCommand(planId, {
        maxConcurrency: parseInt(getArgValue(args, '--concurrency') || '3'),
        timeout: parseInt(getArgValue(args, '--timeout') || '300000'),
        interactive: args.includes('--interactive')
      });
    } else if (command === 'coordinate') {
      // One-step coordination: graphyn coordinate "build user dashboard"
      const request = queryParts.join(' ');
      if (!request) {
        console.error('❌ Request required for coordination');
        process.exit(1);
      }
      await handleCoordinateCommand(request, { complexity: getArgValue(args, '--complexity') });
    } else if (command === 'status') {
      // Orchestration status: graphyn status
      await handleStatusCommand();
    } else if (command === 'agents') {
      // Agent management: graphyn agents list|create|update|delete
      const action = queryParts[0] || 'list';
      const agentOptions = {
        name: getArgValue(args, '--name'),
        type: getArgValue(args, '--type'),
        specialization: getArgValue(args, '--tech'),
        agentId: queryParts[1]
      };
      await handleAgentsCommand(action, agentOptions);
    } else if (command === 'configure') {
      // Configuration: graphyn configure --concurrency=5
      await handleConfigureCommand({
        maxConcurrency: parseInt(getArgValue(args, '--concurrency') || '3'),
        timeout: parseInt(getArgValue(args, '--timeout') || '300000'),
        logLevel: getArgValue(args, '--log-level')
      });
    } else if (command === '--simple' || command === '-s') {
      // Simple interactive mode: graphyn --simple (original style)
      await handleInteractiveMode(interactiveInput, realTimeExecutor, streamingOutput);
    } else if (command === 'help' || command === '--help' || command === '-h') {
      // Help: graphyn help
      handleHelpCommand();
    } else if (queryParts.length > 0 || isNaturalLanguageQuery(command)) {
      // Direct query: graphyn "build API" -> Use split-screen interface (Enhanced UX)
      const fullQuery = queryParts.length > 0 ? `${command} ${queryParts.join(' ')}` : command;
      await handleSplitScreenQuery(fullQuery, realTimeExecutor);
    } else {
      // Show help for unknown commands
      handleHelpCommand();
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
 * Handle split-screen query execution (Enhanced UX Phase 2)
 * 
 * FIXED: Now uses streaming executeQueryStream instead of blocking executeQuery.
 * Provides real-time character streaming eliminating 10+ second freezes.
 */
async function handleSplitScreenQuery(
  query: string,
  realTimeExecutor: RealTimeExecutor
): Promise<void> {
  try {
    console.log('🚀 Processing query with real-time streaming...');
    console.log('─'.repeat(60));
    console.log(`💡 Query: "${query}"\n`);
    
    // Initialize streaming output for real-time feedback
    const streamingOutput = new StreamingConsoleOutput();
    let finalResult: any = null;
    let completedTasks = 0;
    let currentAgent = '';

    // FIXED: Use streaming version instead of blocking executeQuery
    for await (const event of realTimeExecutor.executeQueryStream(query, {
      workingDirectory: process.cwd()
    })) {
      
      // Handle different streaming events with real-time feedback
      switch (event.type) {
        case 'start':
          streamingOutput.showAnalysis('🔍 Starting query analysis...', 'routing');
          break;
          
        case 'context':
          streamingOutput.showAnalysis(event.data.message || '📋 Building repository context...');
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
            
            // Stream different message types with real-time updates
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
    console.log(`🎉 Query completed! (${completedTasks} agent${completedTasks !== 1 ? 's' : ''} used)`);
    
  } catch (error) {
    console.error('❌ Split-screen query failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Handle split-screen orchestrator mode (default)
 */
export async function startInteractiveOrchestrator(): Promise<void> {
  try {
    console.log('🚀 Starting Interactive Orchestrator...');
    
    const orchestrator = new AgentOrchestrator();
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
 * Get value for a command line argument
 */
function getArgValue(args: string[], argName: string): string | undefined {
  const argIndex = args.findIndex(arg => arg.startsWith(argName));
  if (argIndex === -1) return undefined;
  
  const arg = args[argIndex];
  if (arg.includes('=')) {
    return arg.split('=')[1];
  }
  
  // Next argument is the value
  if (argIndex + 1 < args.length && !args[argIndex + 1].startsWith('-')) {
    return args[argIndex + 1];
  }
  
  return undefined;
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
Graphyn Code - Project-Agnostic Multi-Agent Orchestration

Usage:
  graphyn                        Interactive orchestrator (split-screen mode)
  graphyn init [options]         Initialize project for orchestration
  graphyn plan <request>         Plan tasks from natural language
  graphyn execute [plan-id]      Execute orchestration plan
  graphyn coordinate <request>   Plan and execute in one step
  graphyn status                 Show orchestration status
  graphyn agents <action>        Manage specialized agents
  graphyn configure [options]    Configure orchestration settings

Orchestration Commands:
  init --force --template=<type> --agents=<list>   Initialize with options
  plan "add authentication" --complexity=moderate  Plan complex tasks
  execute plan-123456 --concurrency=5             Execute saved plan
  coordinate "optimize performance" --dry-run      Test coordination
  agents list                                      List available agents
  agents create --type=backend --tech=django      Create specialized agent
  configure --concurrency=8 --timeout=600000      Update settings

Legacy Commands:
  graphyn --simple               Simple interactive chat mode
  graphyn "your query"           Direct query with immediate execution

Project-Agnostic Features:
  🎯 Context7-style deep project analysis
  🤖 Dynamic agent specialization based on tech stack
  📋 Universal task decomposition for any project type
  ⚡ Real-time multi-agent coordination (up to 8 agents)
  🔧 Automatic MCP configuration generation
  💾 Persistent task planning and execution history

Options:
  -s, --simple                   Use simple interactive mode
  -v, --version                  Show version
  -h, --help                     Show help
  --debug                        Show debug information
  --force                        Force overwrite existing configuration
  --dry-run                      Show plan without executing
  --save                         Save plan for later execution

Experience:
  ✨ Works with any technology stack (React, Vue, Django, Go, etc.)
  🚀 Intelligent task planning based on project architecture
  💬 Natural language to coordinated multi-agent execution
  🎯 Technology-aware agent selection and specialization
`);
}

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('CLI orchestrator failed:', error);
    process.exit(1);
  });
}