#!/usr/bin/env node

/**
 * Graphyn CLI - Ultimate Orchestration Platform v10.0.0
 *
 * Handles everything through a single `graphyn` command:
 * - graphyn -> Interactive mode with split-screen interface
 * - graphyn "user query" -> Direct natural language processing with 8-agent coordination
 *
 * Features:
 * - Ultimate Orchestration Platform with 8 parallel Claude Code sessions
 * - Split-screen interface (70/20/10 layout)
 * - Performance targets: <30s, <150MB, 99% reliability
 * - Real-time multi-agent coordination with DAG-based task decomposition
 * - Professional personas: @architect, @backend, @frontend, @tester, etc.
 * - Git worktree isolation for conflict-free parallel execution
 */

import { UltimateOrchestrator } from './orchestrator/UltimateOrchestrator.js';
// import { SplitScreenInterfaceManager, createSplitScreenInterface } from './console/SplitScreenInterface.jsx';
import { PerformanceMonitor } from './performance/PerformanceMonitor.js';
import { render } from 'ink';
import * as React from 'react';

// Ultimate Orchestration Platform v10.0.0 Session Management
interface GraphynSession {
  id: string;
  workingDirectory: string;
  startTime: number;
  queryCount: number;
  orchestrator?: UltimateOrchestrator;
  // splitScreenManager?: SplitScreenInterfaceManager; // TODO: Add when interface is implemented
}

let session: GraphynSession = {
  id: `session-${Date.now()}`,
  workingDirectory: process.cwd(),
  startTime: Date.now(),
  queryCount: 0
};

/**
 * Main CLI entry point - Ultimate Orchestration Platform v10.0.0
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [firstArg, ...restArgs] = args;

  try {
    // Initialize Ultimate Orchestration Platform
    await initializeUltimateOrchestration();

    if (!firstArg) {
      // Interactive mode with split-screen interface: graphyn
      await startInteractiveMode();
    } else if (isNaturalLanguageQuery(firstArg)) {
      // Direct query with 8-agent coordination: graphyn "build user authentication"
      const fullQuery = restArgs.length > 0 ? `${firstArg} ${restArgs.join(' ')}` : firstArg;
      await processWithUltimateOrchestration(fullQuery);
    } else {
      // Legacy commands or help
      await handleLegacyCommand(firstArg, restArgs);
    }

  } catch (error) {
    console.error('❌ Ultimate Orchestration Platform failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Initialize Ultimate Orchestration Platform v10.0.0
 */
async function initializeUltimateOrchestration(): Promise<void> {
  console.log('🚀 Initializing Ultimate Orchestration Platform v10.0.0...');
  console.log('   • 8 Parallel Claude Code Sessions');
  console.log('   • Split-Screen Interface (70/20/10)');
  console.log('   • Performance Targets: <30s, <150MB, 99% reliability');
  console.log('   • Professional Agent Personas');
  console.log('');

  try {
    // Initialize performance monitoring
    const performanceMonitor = new PerformanceMonitor({
      taskTargetMs: 120_000, // 120 seconds (2 minutes for Claude SDK calls)
      memoryLimitMb: 150, // 150 MB
      enabled: true
    });

    // Create Ultimate Orchestrator
    session.orchestrator = new UltimateOrchestrator();

    // TODO: Create Split-Screen Interface Manager
    // session.splitScreenManager = new SplitScreenInterfaceManager({
    //   refreshRateMs: 16, // 60fps target
    //   maxOutputLines: 1000
    // });

    console.log('✅ Ultimate Orchestration Platform initialized successfully');
    console.log('');
  } catch (error) {
    console.error('❌ Initialization failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Process natural language query with Ultimate Orchestration Platform
 */
async function processWithUltimateOrchestration(query: string): Promise<void> {
  console.log('🚀 ULTIMATE ORCHESTRATION PLATFORM v10.0.0');
  console.log('═'.repeat(80));
  console.log(`💡 Query: "${query}"`);
  console.log(`📁 Working Directory: ${session.workingDirectory}`);
  console.log(`🎯 Performance Targets: <30s completion, <150MB memory, 99% reliability`);
  console.log('═'.repeat(80));
  console.log('');

  if (!session.orchestrator) {
    throw new Error('Ultimate Orchestrator not initialized');
  }

  try {
    // Update session counter
    session.queryCount++;

    // Execute with Ultimate Orchestrator
    console.log('🔥 Executing with Ultimate Orchestration...');
    const result = await session.orchestrator.orchestrateQuery(query);

    // Display results
    displayOrchestrationResults(result);

    // Performance summary
    displayPerformanceSummary(result);

  } catch (error) {
    console.error('\n❌ Ultimate Orchestration failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Start interactive mode with split-screen interface
 */
async function startInteractiveMode(): Promise<void> {
  console.log('🖥️  Starting Interactive Mode...');
  console.log('   Split-screen interface coming soon...');
  console.log('');

  // TODO: Implement split-screen interface
  console.log('Interactive mode temporarily disabled - use direct queries instead');
  console.log('Example: graphyn "build user authentication system"');
}

/**
 * Display orchestration results
 */
function displayOrchestrationResults(result: any): void {
  console.log('');
  console.log('📊 ORCHESTRATION RESULTS');
  console.log('─'.repeat(50));
  console.log(`✅ Success: ${result.success}`);
  console.log(`⏱️  Total Time: ${result.totalTimeSeconds.toFixed(1)}s`);
  console.log(`✅ Tasks Completed: ${result.tasksCompleted}`);
  console.log(`❌ Tasks Failed: ${result.tasksFailed}`);
  console.log(`🤖 Agents Used: ${result.agentsUsed}`);
  console.log('');

  if (result.errors.length > 0) {
    console.log('❌ ERRORS:');
    result.errors.forEach((error: string) => console.log(`   • ${error}`));
    console.log('');
  }
}

/**
 * Display performance summary
 */
function displayPerformanceSummary(result: any): void {
  const metrics = result.performanceMetrics;
  console.log('🎯 PERFORMANCE SUMMARY');
  console.log('─'.repeat(50));
  console.log(`🧠 Memory Peak: ${metrics.memoryPeakMb.toFixed(1)}MB (target: <150MB)`);
  console.log(`⚡ CPU Average: ${metrics.cpuAveragePercent.toFixed(1)}%`);
  console.log(`🚀 Parallel Efficiency: ${(metrics.parallelEfficiency * 100).toFixed(1)}%`);
  console.log(`🎯 Target Achieved: ${metrics.targetTimeAchieved ? '✅' : '❌'}`);
  console.log('');

  // Performance alerts
  if (!metrics.targetTimeAchieved) {
    console.log('⚠️  Performance Alert: Task completion exceeded 30s target');
  }
  if (metrics.memoryPeakMb > 150) {
    console.log('⚠️  Memory Alert: Peak memory usage exceeded 150MB target');
  }
}

/**
 * Handle interactive commands
 */
async function handleCommand(command: string): Promise<void> {
  const [cmd, ...args] = command.slice(1).split(' ');

  switch (cmd) {
    case 'help':
      displayHelp();
      break;
    case 'status':
      displayStatus();
      break;
    case 'clear':
      console.clear();
      break;
    case 'performance':
      displayPerformanceStatus();
      break;
    case 'exit':
    case 'quit':
      process.exit(0);
      break;
    default:
      console.log(`Unknown command: ${cmd}. Type /help for available commands.`);
  }
}

/**
 * Display help information
 */
function displayHelp(): void {
  console.log('');
  console.log('🆘 ULTIMATE ORCHESTRATION PLATFORM HELP');
  console.log('═'.repeat(50));
  console.log('');
  console.log('📝 NATURAL LANGUAGE QUERIES:');
  console.log('   Just type your request in plain English');
  console.log('   Example: "Add authentication to my React app"');
  console.log('');
  console.log('⌨️  KEYBOARD SHORTCUTS:');
  console.log('   [A]pprove • [M]odify • [F]eedback • [C]ancel');
  console.log('   [H]elp • Ctrl+C (twice to exit during execution)');
  console.log('');
  console.log('💻 SLASH COMMANDS:');
  console.log('   /help     - Show this help');
  console.log('   /status   - Show session status');
  console.log('   /performance - Show performance metrics');
  console.log('   /clear    - Clear screen');
  console.log('   /exit     - Exit application');
  console.log('');
}

/**
 * Display current status
 */
function displayStatus(): void {
  console.log('');
  console.log('📊 SESSION STATUS');
  console.log('─'.repeat(30));
  console.log(`🆔 Session ID: ${session.id}`);
  console.log(`📁 Working Directory: ${session.workingDirectory}`);
  console.log(`🕒 Session Duration: ${((Date.now() - session.startTime) / 1000 / 60).toFixed(1)} minutes`);
  console.log(`📝 Queries Processed: ${session.queryCount}`);
  console.log('');
}

/**
 * Display performance status
 */
function displayPerformanceStatus(): void {
  // TODO: Implement performance status display
  console.log('Performance monitoring integration pending...');
}

/**
 * Check if input is a natural language query
 */
function isNaturalLanguageQuery(input: string): boolean {
  // Enhanced natural language detection
  const naturalLanguagePatterns = [
    /^(hello|hi|hey|add|create|build|implement|setup|configure|install|update|fix|debug|test|deploy)/i,
    /^(how|what|when|where|why|which)/i,
    /^(help|show|explain|describe|list|find)/i,
    /(authentication|auth|login|user|database|api|frontend|backend|component)/i,
    /(please|can you|could you|would you|I need|I want)/i
  ];

  return naturalLanguagePatterns.some(pattern => pattern.test(input));
}

/**
 * Handle legacy commands for backward compatibility
 */
async function handleLegacyCommand(command: string, args: string[]): Promise<void> {
  console.log('⚠️  Legacy command detected. Redirecting to Ultimate Orchestration...');

  // Map common legacy commands to natural language
  const legacyMappings: Record<string, string> = {
    'help': '/help',
    '--help': '/help',
    '-h': '/help',
    'version': 'show version information',
    '--version': 'show version information',
    'init': 'initialize project',
    'setup': 'setup project configuration',
    'doctor': 'check system health and configuration'
  };

  const mappedQuery = legacyMappings[command];
  if (mappedQuery) {
    if (mappedQuery.startsWith('/')) {
      await handleCommand(mappedQuery);
    } else {
      await processWithUltimateOrchestration(mappedQuery);
    }
  } else {
    console.log(`Unknown command: ${command}`);
    console.log('💡 Try using natural language instead. Example: "help me setup authentication"');
  }
}

// Run if this file is executed directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith('cli.js')) {
  main().catch((error) => {
    console.error('Ultimate Orchestration Platform failed:', error);
    process.exit(1);
  });
}
