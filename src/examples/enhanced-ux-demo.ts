#!/usr/bin/env node
/**
 * Enhanced UX Phase 2 Demo
 * 
 * Demonstrates the complete Enhanced UX Phase 2 implementation including:
 * - Split-screen interface with real-time updates
 * - Task decomposition with agent assignments
 * - Approval workflow with keyboard navigation
 * - Exit protection with execution awareness
 * - Repository context analysis
 */

import { EnhancedInteractiveOrchestrator } from '../orchestrator/EnhancedInteractiveOrchestrator.js';
import { ANSIController } from '../ui/split-screen/ANSIController.js';

class EnhancedUXDemo {
  private orchestrator: EnhancedInteractiveOrchestrator;

  constructor() {
    this.orchestrator = new EnhancedInteractiveOrchestrator();
    this.setupDemoHandlers();
  }

  /**
   * Setup event handlers for demo purposes
   */
  private setupDemoHandlers(): void {
    this.orchestrator.on('sessionStarted', (session) => {
      console.log(`📊 Demo session started: ${session.id} (${session.mode} mode)`);
    });

    this.orchestrator.on('repositoryContextUpdated', (event) => {
      console.log(`🔍 Repository context updated: ${event.newDirectory}`);
      console.log(`   Project type: ${event.context.projectType || 'unknown'}`);
      console.log(`   Languages: ${event.context.mainLanguages?.join(', ') || 'none detected'}`);
    });

    this.orchestrator.on('executionComplete', (data) => {
      console.log(`✅ Execution completed successfully`);
    });

    this.orchestrator.on('executionError', (error) => {
      console.error(`❌ Execution error: ${error.message || error}`);
    });
  }

  /**
   * Display welcome message and demo information
   */
  private displayWelcome(): void {
    let output = '';
    
    // Clear screen and position cursor
    output += ANSIController.clearScreen();
    output += ANSIController.moveCursor(1, 1);
    
    // Title
    output += ANSIController.color('🎯 Graphyn CLI - Enhanced UX Phase 2 Demo', { 
      foreground: 'cyan', 
      style: 'bold' 
    }) + '\n\n';
    
    // Features overview
    output += ANSIController.color('🚀 New Features Demonstrated:', { foreground: 'yellow' }) + '\n';
    output += ANSIController.color('  • Split-screen interface (70%/20%/10% layout)', { foreground: 'white' }) + '\n';
    output += ANSIController.color('  • Task decomposition with intelligent agent assignment', { foreground: 'white' }) + '\n';
    output += ANSIController.color('  • Approval workflow with keyboard navigation', { foreground: 'white' }) + '\n';
    output += ANSIController.color('  • Exit protection with execution awareness', { foreground: 'white' }) + '\n';
    output += ANSIController.color('  • Repository context analysis and dynamic prompts', { foreground: 'white' }) + '\n';
    output += ANSIController.color('  • Real-time streaming with agent status tracking', { foreground: 'white' }) + '\n\n';
    
    // Controls
    output += ANSIController.color('🎮 Demo Controls:', { foreground: 'green' }) + '\n';
    output += ANSIController.color('  [↑/↓]     Navigate tasks in approval mode', { foreground: 'gray' }) + '\n';
    output += ANSIController.color('  [SPACE]    Toggle task approval', { foreground: 'gray' }) + '\n';
    output += ANSIController.color('  [A]        Approve all tasks', { foreground: 'gray' }) + '\n';
    output += ANSIController.color('  [M]        Modify execution plan', { foreground: 'gray' }) + '\n';
    output += ANSIController.color('  [F]        Provide feedback', { foreground: 'gray' }) + '\n';
    output += ANSIController.color('  [C]        Cancel execution', { foreground: 'gray' }) + '\n';
    output += ANSIController.color('  [Ctrl+C]   Exit with protection', { foreground: 'gray' }) + '\n\n';
    
    // Try examples
    output += ANSIController.color('💡 Try These Example Queries:', { foreground: 'magenta' }) + '\n';
    output += ANSIController.color('  "build a REST API with authentication"', { foreground: 'white' }) + '\n';
    output += ANSIController.color('  "create a React component library"', { foreground: 'white' }) + '\n';
    output += ANSIController.color('  "add testing to my project"', { foreground: 'white' }) + '\n';
    output += ANSIController.color('  "optimize database performance"', { foreground: 'white' }) + '\n';
    output += ANSIController.color('  "setup CI/CD pipeline"', { foreground: 'white' }) + '\n\n';
    
    // Ready message
    output += ANSIController.color('🎬 Demo will start in 3 seconds...', { 
      foreground: 'yellow',
      style: 'bold'
    }) + '\n';
    
    process.stdout.write(output);
  }

  /**
   * Start the enhanced UX demo
   */
  async startDemo(): Promise<void> {
    try {
      // Check terminal dimensions
      const minWidth = 80;
      const minHeight = 24;
      const currentWidth = process.stdout.columns || 80;
      const currentHeight = process.stdout.rows || 24;

      if (currentWidth < minWidth || currentHeight < minHeight) {
        console.error(ANSIController.color(
          `❌ Terminal too small for Enhanced UX demo.\n` +
          `   Current: ${currentWidth}x${currentHeight}\n` +
          `   Required: ${minWidth}x${minHeight}\n` +
          `   Please resize your terminal and try again.`,
          { foreground: 'red' }
        ));
        process.exit(1);
      }

      // Display welcome message
      this.displayWelcome();
      
      // Wait for user to read
      await this.sleep(3000);
      
      // Start enhanced interactive session
      console.log(ANSIController.color('\n🚀 Starting Enhanced UX Phase 2...', { 
        foreground: 'green',
        style: 'bold'
      }));
      
      await this.orchestrator.startInteractive({ splitScreen: true });
      
    } catch (error) {
      console.error(ANSIController.color(
        `❌ Failed to start Enhanced UX demo: ${error instanceof Error ? error.message : error}`,
        { foreground: 'red' }
      ));
      
      console.log(ANSIController.color(
        '\n💡 Troubleshooting:\n' +
        '  • Ensure terminal supports ANSI escape sequences\n' +
        '  • Try running in a different terminal (iTerm2, Terminal.app, etc.)\n' +
        '  • Check that terminal dimensions are adequate\n',
        { foreground: 'yellow' }
      ));
      
      process.exit(1);
    }
  }

  /**
   * Simulate demonstration scenarios
   */
  async runDemoScenarios(): Promise<void> {
    console.log('\n🎭 Running demo scenarios...\n');
    
    // Scenario 1: Task Decomposition Demo
    console.log(ANSIController.color('📋 Scenario 1: Task Decomposition', { foreground: 'cyan' }));
    await this.demoTaskDecomposition();
    
    await this.sleep(2000);
    
    // Scenario 2: Agent Assignment Demo  
    console.log(ANSIController.color('🤖 Scenario 2: Agent Assignment', { foreground: 'cyan' }));
    await this.demoAgentAssignment();
    
    await this.sleep(2000);
    
    // Scenario 3: Approval Workflow Demo
    console.log(ANSIController.color('✅ Scenario 3: Approval Workflow', { foreground: 'cyan' }));
    await this.demoApprovalWorkflow();
    
    await this.sleep(2000);
    
    // Scenario 4: Exit Protection Demo
    console.log(ANSIController.color('🚪 Scenario 4: Exit Protection', { foreground: 'cyan' }));
    await this.demoExitProtection();
  }

  /**
   * Demo task decomposition capabilities
   */
  private async demoTaskDecomposition(): Promise<void> {
    this.orchestrator.addOutput(
      '🎯 Demonstrating intelligent task decomposition...',
      'demo',
      'text'
    );
    
    // Add sample task decomposition
    this.orchestrator.addOutput(
      'Query: "build a REST API with authentication"',
      'user',
      'text'
    );
    
    await this.sleep(1000);
    
    this.orchestrator.addOutput(
      '📋 Generated 6 tasks across 4 agents:\n' +
      '  @architect: Design API architecture (15min)\n' +
      '  @backend: Implement endpoints & auth (25min)\n' +
      '  @security: Security audit & hardening (12min)\n' +
      '  @tester: Test suite creation (18min)\n' +
      '  @docs: API documentation (10min)\n' +
      '  @devops: Deployment configuration (8min)',
      'system',
      'success'
    );
  }

  /**
   * Demo agent assignment logic
   */
  private async demoAgentAssignment(): Promise<void> {
    this.orchestrator.addOutput(
      '🤖 Demonstrating intelligent agent assignment...',
      'demo',
      'text'
    );
    
    await this.sleep(1000);
    
    this.orchestrator.addOutput(
      '🧠 Agent selection factors:\n' +
      '  • Specialty matching (90% relevance)\n' +
      '  • Current workload balancing\n' +
      '  • Historical performance (95% success rate)\n' +
      '  • Task complexity assessment',
      'system',
      'text'
    );
    
    await this.sleep(1000);
    
    this.orchestrator.addOutput(
      '⚡ Optimal assignment completed:\n' +
      '  • Parallel execution possible: 3 tracks\n' +
      '  • Critical path: 40 minutes\n' +
      '  • Confidence score: 87%',
      'system',
      'success'
    );
  }

  /**
   * Demo approval workflow
   */
  private async demoApprovalWorkflow(): Promise<void> {
    this.orchestrator.addOutput(
      '✅ Demonstrating approval workflow navigation...',
      'demo',
      'text'
    );
    
    await this.sleep(1000);
    
    this.orchestrator.addOutput(
      '🎮 Keyboard controls active:\n' +
      '  ↑/↓ - Navigate tasks\n' +
      '  SPACE - Toggle approval\n' +
      '  A - Approve all tasks\n' +
      '  Enter - Execute approved tasks',
      'system',
      'text'
    );
    
    await this.sleep(1000);
    
    this.orchestrator.addOutput(
      '📊 Approval status: 4/6 tasks approved\n' +
      '⏱️ Estimated execution: 32 minutes\n' +
      '🚀 Ready for parallel execution',
      'system',
      'text'
    );
  }

  /**
   * Demo exit protection
   */
  private async demoExitProtection(): Promise<void> {
    this.orchestrator.addOutput(
      '🚪 Demonstrating exit protection system...',
      'demo', 
      'text'
    );
    
    await this.sleep(1000);
    
    this.orchestrator.addOutput(
      '🛡️ Exit protection features:\n' +
      '  • Two-step confirmation process\n' +
      '  • Execution awareness (prevents data loss)\n' +
      '  • Force exit detection (double Ctrl+C)\n' +
      '  • Session state preservation',
      'system',
      'text'
    );
    
    await this.sleep(1000);
    
    this.orchestrator.addOutput(
      '💡 Try pressing Ctrl+C during execution to see protection in action!',
      'system',
      'text'
    );
  }

  /**
   * Utility function to add delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean shutdown
   */
  async cleanup(): Promise<void> {
    await this.orchestrator.cleanup();
  }
}

// Main execution
async function main() {
  const demo = new EnhancedUXDemo();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down Enhanced UX demo...');
    await demo.cleanup();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await demo.cleanup();
    process.exit(0);
  });
  
  // Handle uncaught errors
  process.on('uncaughtException', async (error) => {
    console.error('💥 Uncaught exception:', error);
    await demo.cleanup();
    process.exit(1);
  });
  
  process.on('unhandledRejection', async (reason) => {
    console.error('💥 Unhandled rejection:', reason);
    await demo.cleanup();
    process.exit(1);
  });
  
  try {
    await demo.startDemo();
  } catch (error) {
    console.error('❌ Demo failed:', error);
    await demo.cleanup();
    process.exit(1);
  }
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { EnhancedUXDemo };