/**
 * Phase 3 Integration Example
 * 
 * Demonstrates how to use the new console output, Claude integration,
 * and supporting systems replacing the complex Ink.js UI
 */

import { createPhase3Integration } from './Phase3Integration';
import { TaskExecution } from './types';

/**
 * Example: Basic task execution with console output
 */
async function basicConsoleExample() {
  const integration = createPhase3Integration({
    enableConsoleOutput: true,
    consoleLogLevel: 'detailed',
    claudeMaxSessions: 3
  });

  // Create example tasks
  const tasks: TaskExecution[] = [
    {
      id: 'task-001',
      description: 'Set up project architecture',
      agent: 'architect',
      dependencies: [],
      priority: 10,
      estimatedDuration: 300,
      status: 'pending',
      progress: 0,
      logs: [],
      retryCount: 0,
      maxRetries: 3
    },
    {
      id: 'task-002', 
      description: 'Build API endpoints',
      agent: 'backend',
      dependencies: ['task-001'],
      priority: 8,
      estimatedDuration: 600,
      status: 'pending',
      progress: 0,
      logs: [],
      retryCount: 0,
      maxRetries: 3
    },
    {
      id: 'task-003',
      description: 'Create UI components',
      agent: 'frontend',
      dependencies: ['task-001'],
      priority: 7,
      estimatedDuration: 450,
      status: 'pending',
      progress: 0,
      logs: [],
      retryCount: 0,
      maxRetries: 3
    }
  ];

  console.log('🚀 Starting Basic Console Example\n');

  await integration.executeTasksWithIntegration(tasks, {
    showProgress: true,
    enableClaudeCoordination: false,
    enableGitAutomation: false
  });

  await integration.shutdown();
}

/**
 * Example: Full Claude integration with agent coordination
 */
async function claudeCoordinationExample() {
  const integration = createPhase3Integration({
    enableConsoleOutput: true,
    consoleLogLevel: 'verbose',
    claudeMaxSessions: 5,
    claudeSessionTimeout: 30 * 60 * 1000,
    claudeEnableLogging: true
  });

  const tasks: TaskExecution[] = [
    {
      id: 'design-001',
      description: 'Create design system tokens',
      agent: 'design',
      dependencies: [],
      priority: 9,
      status: 'pending',
      progress: 0,
      logs: [],
      retryCount: 0,
      maxRetries: 3
    },
    {
      id: 'arch-001',
      description: 'Design component architecture',
      agent: 'architect', 
      dependencies: ['design-001'],
      priority: 8,
      status: 'pending',
      progress: 0,
      logs: [],
      retryCount: 0,
      maxRetries: 3
    },
    {
      id: 'fe-001',
      description: 'Implement React components',
      agent: 'frontend',
      dependencies: ['arch-001', 'design-001'],
      priority: 7,
      status: 'pending',
      progress: 0,
      logs: [],
      retryCount: 0,
      maxRetries: 3
    }
  ];

  console.log('🧠 Starting Claude Coordination Example\n');

  await integration.executeTasksWithIntegration(tasks, {
    showProgress: true,
    enableClaudeCoordination: true,
    enableGitAutomation: false
  });

  await integration.shutdown();
}

/**
 * Example: Full automation with Git integration
 */
async function fullAutomationExample() {
  const integration = createPhase3Integration({
    enableConsoleOutput: true,
    consoleLogLevel: 'detailed',
    claudeMaxSessions: 3,
    claudeEnableLogging: true,
    gitRepoPath: process.cwd(),
    gitDefaultBranch: 'main',
    gitEnableAutoCommit: true,
    gitEnableAutoPR: false
  });

  const tasks: TaskExecution[] = [
    {
      id: 'refactor-001',
      description: 'Refactor authentication module',
      agent: 'backend',
      dependencies: [],
      priority: 8,
      tags: ['refactoring', 'auth'],
      status: 'pending',
      progress: 0,
      logs: [],
      retryCount: 0,
      maxRetries: 3
    },
    {
      id: 'test-001',
      description: 'Add comprehensive tests',
      agent: 'test-writer',
      dependencies: ['refactor-001'],
      priority: 7,
      tags: ['testing', 'quality'],
      status: 'pending',
      progress: 0,
      logs: [],
      retryCount: 0,
      maxRetries: 3
    }
  ];

  console.log('⚡ Starting Full Automation Example\n');

  await integration.executeTasksWithIntegration(tasks, {
    showProgress: true,
    enableClaudeCoordination: true,
    enableGitAutomation: true,
    branchPrefix: 'orchestrator-refactor'
  });

  await integration.shutdown();
}

/**
 * Example: Figma design extraction
 */
async function figmaExtractionExample() {
  // This would require actual Figma credentials
  const integration = createPhase3Integration({
    enableConsoleOutput: true,
    figmaToken: process.env.FIGMA_TOKEN, // Set in environment
    consoleLogLevel: 'detailed'
  });

  if (!process.env.FIGMA_TOKEN) {
    console.log('⚠️  FIGMA_TOKEN not set, skipping Figma example');
    return;
  }

  console.log('🎨 Starting Figma Extraction Example\n');

  try {
    const figmaUrl = 'https://figma.com/design/your-file-key/Design-System?node-id=1:2';
    
    const result = await integration.extractFromFigma(figmaUrl, {
      includePrototypeFlow: true,
      includeDesignTokens: true,
      includeScreenshots: true,
      outputDir: './figma-export'
    });

    console.log('✅ Figma extraction completed:');
    console.log(`   - File: ${result.fileInfo.fileName}`);
    console.log(`   - Components: ${result.componentMap?.atomicComponents.length || 0}`);
    console.log(`   - Design Tokens: ${Object.keys(result.componentMap?.designTokens.colors || {}).length}`);
    
  } catch (error: any) {
    console.error('❌ Figma extraction failed:', error.message);
  }

  await integration.shutdown();
}

/**
 * Example: System status monitoring
 */
async function systemStatusExample() {
  const integration = createPhase3Integration({
    enableConsoleOutput: true,
    claudeMaxSessions: 2,
    figmaToken: process.env.FIGMA_TOKEN
  });

  console.log('📊 System Status Example\n');

  const status = integration.getStatus();
  
  console.log('System Status:');
  console.log(`  📺 Console Output: ${status.console ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`  🧠 Claude: ${status.claude.available ? '✅ Available' : '❌ Unavailable'} (${status.claude.sessions} sessions)`);
  console.log(`  📂 Git: ${status.git.available ? '✅ Available' : '❌ Unavailable'}`);
  console.log(`  🎨 Figma: ${status.figma.available ? '✅ Available' : '❌ Unavailable'} (${status.figma.authenticated ? 'Authenticated' : 'Not authenticated'})`);
  console.log(`  🤖 Agents: ${status.agents.count} configured`);

  await integration.shutdown();
}

/**
 * Run all examples (commented out for safety)
 */
async function runExamples() {
  try {
    // Basic console output without Claude
    await basicConsoleExample();
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // System status check
    await systemStatusExample();
    
    // Uncomment to run other examples:
    // await claudeCoordinationExample();
    // await fullAutomationExample(); 
    // await figmaExtractionExample();
    
  } catch (error: any) {
    console.error('❌ Example execution failed:', error.message);
    console.error(error.stack);
  }
}

// Export for CLI usage
export {
  basicConsoleExample,
  claudeCoordinationExample,
  fullAutomationExample,
  figmaExtractionExample,
  systemStatusExample,
  runExamples
};

// Run examples if called directly
if (require.main === module) {
  runExamples();
}