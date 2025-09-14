/**
 * Multi-Agent Figma-to-Code CLI Command
 * 
 * Integrates all the multi-agent components to provide a seamless
 * CLI experience for generating full-stack applications from Figma prototypes
 * using multiple specialized Claude Code agents.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { promises as fs } from 'fs';
import path from 'path';
import {
  setupFigmaMCP,
  interactiveFigmaWorkflowSetup,
  quickStartFigmaWorkflow,
  initializeFigmaMultiAgentWorkflow
} from '../setup/figma-mcp-setup.js';
import { MultiAgentResult } from '../figma-api.js';
import { ClaudeMultiAgentManager, AgentExecutionEvent } from '../claude-multi-agent-manager.js';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold,
  dim: chalk.dim
};

/**
 * Create the main Figma multi-agent command
 */
export function createFigmaMultiAgentCommand(): Command {
  const figmaCommand = new Command('figma')
    .description('Multi-agent Figma-to-code generation using Claude Code')
    .addHelpText('after', `
Examples:
  $ graphyn figma setup                                    # Configure Figma MCP integration
  $ graphyn figma generate <figma-url>                     # Interactive workflow setup
  $ graphyn figma quick <figma-url>                        # Quick start with React + Tailwind
  $ graphyn figma generate <figma-url> --framework vue     # Specify framework
  $ graphyn figma status                                   # Show agent and MCP status
  $ graphyn figma agents                                   # List active agents

Multi-Agent Features:
  • Parallel execution with 3-8 specialized Claude Code agents
  • Automatic task decomposition and dependency management
  • Real-time progress tracking with agent coordination
  • Git worktree isolation and tmux session management
  • Professional development team simulation
    `);

  // Setup command - configure Figma MCP
  figmaCommand
    .command('setup')
    .description('Setup Figma MCP integration and multi-agent environment')
    .option('--force', 'Force reconfiguration even if already set up')
    .action(async (options) => {
      console.log(colors.bold('\n🎨 Multi-Agent Figma Setup\n'));
      
      try {
        // Setup Figma MCP
        const setupResult = await setupFigmaMCP();
        
        if (setupResult.success) {
          console.log(colors.success('\n✅ Figma MCP setup completed successfully!'));
          
          // Test multi-agent manager initialization
          const spinner = ora('Testing multi-agent manager initialization...').start();
          
          try {
            const agentManager = new ClaudeMultiAgentManager();
            await agentManager.initialize();
            await agentManager.shutdown();
            
            spinner.succeed('Multi-agent manager ready!');
            
            console.log(colors.highlight('\n🎯 Ready for multi-agent Figma workflows!'));
            console.log(colors.info('Next steps:'));
            console.log(colors.info('  • Use `graphyn figma generate <url>` for interactive setup'));
            console.log(colors.info('  • Use `graphyn figma quick <url>` for quick start'));
            
          } catch (error: any) {
            spinner.fail(`Multi-agent manager test failed: ${error.message}`);
            console.log(colors.warning('Figma MCP is configured, but multi-agent features may not work properly.'));
          }
          
        } else {
          console.log(colors.error('❌ Figma MCP setup failed'));
          console.log(colors.info('Please check the error messages above and try again.'));
        }
        
      } catch (error: any) {
        console.error(colors.error('❌ Setup failed:'), error.message);
        process.exit(1);
      }
    });

  // Generate command - interactive workflow
  figmaCommand
    .command('generate <figma-url>')
    .description('Generate full-stack app from Figma prototype with interactive setup')
    .option('-f, --framework <framework>', 'Frontend framework (react, vue, angular)', 'react')
    .option('-s, --styling <styling>', 'Styling solution (tailwind, styled-components, css-modules)', 'tailwind')
    .option('-b, --backend <backend>', 'Backend technology (node, python, go)')
    .option('-d, --database <database>', 'Database (postgres, mongodb, sqlite)')
    .option('-o, --output <dir>', 'Output directory', './figma-generated')
    .option('-a, --agents <number>', 'Max concurrent agents (3-8)', '6')
    .option('--no-testing', 'Disable test generation')
    .option('--deployment', 'Enable deployment configuration')
    .option('--interactive', 'Use interactive setup (default)')
    .option('--auto', 'Skip interactive prompts and use provided options')
    .action(async (figmaUrl, options) => {
      console.log(colors.bold('\n🎭 Multi-Agent Figma Code Generation\n'));
      
      try {
        validateFigmaUrl(figmaUrl);
        
        let result: MultiAgentResult | null;
        
        if (options.auto) {
          // Use command-line options directly
          const figmaToken = process.env.FIGMA_PERSONAL_ACCESS_TOKEN;
          if (!figmaToken) {
            throw new Error('FIGMA_PERSONAL_ACCESS_TOKEN environment variable is required for --auto mode');
          }
          
          console.log(colors.info('🤖 Starting automated multi-agent workflow...'));
          displayConfigSummary(options);
          
          result = await initializeFigmaMultiAgentWorkflow(figmaToken, figmaUrl, {
            framework: options.framework as any,
            backend: options.backend as any,
            database: options.database as any,
            styling: options.styling as any,
            outputDir: options.output,
            maxAgents: parseInt(options.agents),
            enableTesting: options.testing,
            enableDeployment: options.deployment
          });
        } else {
          // Use interactive setup
          console.log(colors.info('Starting interactive workflow setup...'));
          result = await interactiveFigmaWorkflowSetup();
        }
        
        if (result && result.success) {
          await displaySuccessMessage(result);
        } else if (result) {
          await displayFailureMessage(result);
          process.exit(1);
        } else {
          console.log(colors.info('Operation cancelled by user.'));
        }
        
      } catch (error: any) {
        console.error(colors.error('❌ Generation failed:'), error.message);
        process.exit(1);
      }
    });

  // Quick command - quick start with defaults
  figmaCommand
    .command('quick <figma-url>')
    .description('Quick start: Generate React + Tailwind app with sensible defaults')
    .option('-o, --output <dir>', 'Output directory', './quick-figma-app')
    .action(async (figmaUrl, options) => {
      console.log(colors.bold('\n⚡ Quick Start: Multi-Agent Figma-to-React\n'));
      
      try {
        validateFigmaUrl(figmaUrl);
        
        console.log(colors.info('Configuration:'));
        console.log(colors.info('  • Framework: React'));
        console.log(colors.info('  • Styling: Tailwind CSS'));
        console.log(colors.info('  • Agents: 5 concurrent'));
        console.log(colors.info('  • Testing: Enabled'));
        console.log(colors.info('  • Output:', options.output));
        console.log();
        
        const result = await quickStartFigmaWorkflow(figmaUrl);
        
        if (result.success) {
          await displaySuccessMessage(result);
        } else {
          await displayFailureMessage(result);
          process.exit(1);
        }
        
      } catch (error: any) {
        console.error(colors.error('❌ Quick start failed:'), error.message);
        process.exit(1);
      }
    });

  // Status command - show system status
  figmaCommand
    .command('status')
    .description('Show Figma MCP and multi-agent system status')
    .action(async () => {
      console.log(colors.bold('\n📊 Multi-Agent Figma System Status\n'));
      
      const statusSpinner = ora('Checking system status...').start();
      
      try {
        // Check Figma token
        const figmaToken = process.env.FIGMA_PERSONAL_ACCESS_TOKEN;
        const tokenStatus = figmaToken ? 'Configured' : 'Missing';
        
        // Test multi-agent manager
        let agentManagerStatus = 'Unknown';
        let agentCount = 0;
        
        try {
          const agentManager = new ClaudeMultiAgentManager();
          await agentManager.initialize();
          agentCount = agentManager.getAgentsStatus().length;
          agentManagerStatus = 'Ready';
          await agentManager.shutdown();
        } catch (error) {
          agentManagerStatus = 'Error';
        }
        
        statusSpinner.stop();
        
        console.log(colors.highlight('🎨 Figma Integration:'));
        console.log(colors.info(`  Token: ${tokenStatus}`));
        console.log(colors.info(`  MCP Status: ${figmaToken ? 'Ready' : 'Not configured'}`));
        console.log();
        
        console.log(colors.highlight('🤖 Multi-Agent System:'));
        console.log(colors.info(`  Manager Status: ${agentManagerStatus}`));
        console.log(colors.info(`  Active Agents: ${agentCount}`));
        console.log(colors.info(`  Git Worktrees: ${process.platform !== 'win32' ? 'Supported' : 'Not supported'}`));
        console.log(colors.info(`  Tmux Sessions: ${process.platform !== 'win32' ? 'Supported' : 'Not supported'}`));
        console.log();
        
        if (!figmaToken) {
          console.log(colors.warning('⚠️  Run `graphyn figma setup` to configure Figma integration'));
        } else if (agentManagerStatus === 'Error') {
          console.log(colors.warning('⚠️  Multi-agent system has issues. Check dependencies.'));
        } else {
          console.log(colors.success('✅ System ready for multi-agent Figma workflows'));
        }
        
      } catch (error: any) {
        statusSpinner.fail('Status check failed');
        console.error(colors.error('Error:', error.message));
      }
    });

  // Agents command - list active agents
  figmaCommand
    .command('agents')
    .description('List active agents and their status')
    .action(async () => {
      console.log(colors.bold('\n🤖 Active Multi-Agent Sessions\n'));
      
      try {
        const agentManager = new ClaudeMultiAgentManager();
        await agentManager.initialize();
        
        const agents = agentManager.getAgentsStatus();
        
        if (agents.length === 0) {
          console.log(colors.info('No active agents.'));
          console.log(colors.dim('Start a workflow with `graphyn figma generate <url>` to spawn agents.'));
        } else {
          console.log(colors.highlight(`Found ${agents.length} active agents:\n`));
          
          agents.forEach((agent, index) => {
            console.log(colors.info(`${index + 1}. ${agent.agentId}`));
            console.log(colors.dim(`   Type: ${agent.agentType}`));
            console.log(colors.dim(`   Status: ${agent.status}`));
            console.log(colors.dim(`   Worktree: ${agent.worktreePath}`));
            if (agent.currentTask) {
              console.log(colors.dim(`   Current Task: ${agent.currentTask.title}`));
            }
            console.log(colors.dim(`   Created: ${agent.createdAt.toLocaleString()}`));
            console.log();
          });
        }
        
        await agentManager.shutdown();
        
      } catch (error: any) {
        console.error(colors.error('❌ Failed to list agents:'), error.message);
      }
    });

  return figmaCommand;
}

/**
 * Validate Figma URL format
 */
function validateFigmaUrl(url: string): void {
  if (!url) {
    throw new Error('Figma URL is required');
  }
  
  if (!url.includes('figma.com')) {
    throw new Error('Invalid Figma URL. Please provide a valid Figma prototype or file URL.');
  }
}

/**
 * Display configuration summary
 */
function displayConfigSummary(options: any): void {
  console.log(colors.highlight('Configuration:'));
  console.log(colors.info(`  • Framework: ${options.framework}`));
  console.log(colors.info(`  • Styling: ${options.styling}`));
  if (options.backend) {
    console.log(colors.info(`  • Backend: ${options.backend}${options.database ? ` + ${options.database}` : ''}`));
  }
  console.log(colors.info(`  • Max Agents: ${options.agents}`));
  console.log(colors.info(`  • Testing: ${options.testing ? 'Enabled' : 'Disabled'}`));
  console.log(colors.info(`  • Deployment: ${options.deployment ? 'Enabled' : 'Disabled'}`));
  console.log(colors.info(`  • Output: ${options.output}`));
  console.log();
}

/**
 * Display success message and next steps
 */
async function displaySuccessMessage(result: MultiAgentResult): Promise<void> {
  console.log(colors.bold('\n🎉 Multi-Agent Generation Complete!\n'));
  
  console.log(colors.success(`✅ Success! Generated in ${result.totalTimeSeconds.toFixed(1)}s`));
  
  if (result.prototypeAnalysis) {
    console.log(colors.info(`📱 ${result.prototypeAnalysis.totalScreens} screens, ${result.prototypeAnalysis.totalComponents} components`));
  }
  
  if (result.taskPlan) {
    console.log(colors.info(`⚙️  ${result.taskPlan.totalTasks} tasks across ${result.agentResults.length} agents`));
  }
  
  if (result.generatedFiles.length > 0) {
    console.log(colors.info(`📄 ${result.generatedFiles.length} files generated`));
  }
  
  console.log(colors.bold('\n📋 Next Steps:\n'));
  
  if (result.finalResult?.files) {
    const hasPackageJson = result.finalResult.files.some(f => f.includes('package.json'));
    
    if (hasPackageJson) {
      console.log(colors.highlight('1. Install dependencies:'));
      console.log(colors.dim('   cd ./figma-generated && npm install'));
      console.log();
      
      console.log(colors.highlight('2. Start development server:'));
      console.log(colors.dim('   npm run dev'));
      console.log();
      
      if (result.testResults) {
        console.log(colors.highlight('3. Run tests:'));
        console.log(colors.dim('   npm test'));
        console.log();
      }
      
      if (result.deploymentInfo) {
        console.log(colors.highlight('4. Deploy to production:'));
        console.log(colors.dim('   npm run deploy'));
        console.log();
      }
    }
  }
  
  console.log(colors.highlight('📚 Generated Structure:'));
  const importantFiles = result.generatedFiles.filter(f => 
    f.includes('README.md') || 
    f.includes('package.json') ||
    f.includes('.tsx') ||
    f.includes('.ts') ||
    f.endsWith('.md')
  ).slice(0, 8);
  
  importantFiles.forEach(file => {
    console.log(colors.dim(`   • ${file}`));
  });
  
  if (result.generatedFiles.length > importantFiles.length) {
    console.log(colors.dim(`   ... and ${result.generatedFiles.length - importantFiles.length} more files`));
  }
}

/**
 * Display failure message and troubleshooting
 */
async function displayFailureMessage(result: MultiAgentResult): Promise<void> {
  console.log(colors.bold('\n❌ Multi-Agent Generation Failed\n'));
  
  if (result.error) {
    console.log(colors.error(`Error: ${result.error}`));
    console.log();
  }
  
  if (result.agentResults.length > 0) {
    const failedTasks = result.agentResults.filter(r => !r.success);
    const succeededTasks = result.agentResults.filter(r => r.success);
    
    console.log(colors.info(`📊 Task Results: ${succeededTasks.length} succeeded, ${failedTasks.length} failed`));
    
    if (failedTasks.length > 0) {
      console.log(colors.error('\n💥 Failed Tasks:'));
      failedTasks.forEach(task => {
        console.log(colors.error(`  • ${task.taskId}: ${task.error}`));
      });
    }
  }
  
  console.log(colors.bold('\n🔧 Troubleshooting:\n'));
  console.log(colors.info('1. Check your Figma token and permissions'));
  console.log(colors.info('2. Ensure the Figma URL is accessible'));
  console.log(colors.info('3. Verify Claude CLI is properly installed'));
  console.log(colors.info('4. Try with fewer concurrent agents'));
  console.log(colors.info('5. Check system resources (memory, disk space)'));
  console.log();
  console.log(colors.dim('For detailed logs, check the agent worktree directories in /tmp/claude-agents/'));
}

/**
 * Progress callback for real-time updates
 */
export function createProgressCallback(): (message: string, agentId?: string) => void {
  return (message: string, agentId?: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = agentId ? colors.highlight(`[${agentId}]`) : colors.info('[COORDINATOR]');
    console.log(`${colors.dim(timestamp)} ${prefix} ${message}`);
  };
}

export default createFigmaMultiAgentCommand;
