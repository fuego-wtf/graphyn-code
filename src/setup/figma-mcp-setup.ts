import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import ora from 'ora';
import open from 'open';
import { FigmaAPIClient, MultiAgentResult } from '../figma-api.js';
import { ClaudeMultiAgentManager, AgentExecutionEvent } from '../claude-multi-agent-manager.js';

const execAsync = promisify(exec);

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold
};

export interface FigmaMCPResult {
  success: boolean;
  message: string;
  isRunning: boolean;
}

/**
 * Check if Figma MCP is already configured
 */
async function checkExistingMCP(): Promise<boolean> {
  try {
    const homeDir = os.homedir();
    const configPath = path.join(homeDir, '.config', 'claude', 'claude_desktop_config.json');
    
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    return config.mcpServers && config.mcpServers['figma-mcp'] !== undefined;
  } catch {
    return false;
  }
}

/**
 * Configure Figma MCP
 */
async function configureFigmaMCP(): Promise<boolean> {
  console.log(colors.bold('\n⚙️  Configuring Figma MCP...\n'));
  
  try {
    const homeDir = os.homedir();
    const configDir = path.join(homeDir, '.config', 'claude');
    const configPath = path.join(configDir, 'claude_desktop_config.json');
    
    // Ensure config directory exists
    await fs.mkdir(configDir, { recursive: true });
    
    // Read existing config or create new
    let config: any = {};
    try {
      const existing = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(existing);
    } catch {
      // Config doesn't exist, start fresh
    }
    
    // Initialize mcpServers if not exists
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    
    // Add Figma MCP configuration
    config.mcpServers['figma-mcp'] = {
      command: 'npx',
      args: ['-y', '@figma/mcp'],
      env: {
        FIGMA_PERSONAL_ACCESS_TOKEN: '${FIGMA_PERSONAL_ACCESS_TOKEN}'
      }
    };
    
    // Write config
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    
    console.log(colors.success('✓ Figma MCP configuration added to Claude Desktop\n'));
    
    return true;
  } catch (error) {
    console.error(colors.error('Failed to configure Figma MCP:'), error);
    return false;
  }
}

/**
 * Setup Figma Personal Access Token
 */
async function setupFigmaToken(): Promise<boolean> {
  console.log(colors.bold('\n🔑 Figma Personal Access Token Setup\n'));
  
  console.log(colors.info('To use Figma MCP, you need a Personal Access Token:'));
  console.log(colors.info('1. Go to Figma → Account Settings'));
  console.log(colors.info('2. Find "Personal access tokens" section'));
  console.log(colors.info('3. Click "Create new token"'));
  console.log(colors.info('4. Give it a name (e.g., "Claude MCP")'));
  console.log(colors.info('5. Copy the token\n'));
  
  const { openFigma } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'openFigma',
      message: 'Open Figma account settings?',
      default: true
    }
  ]);
  
  if (openFigma) {
    await open('https://www.figma.com/settings/account');
  }
  
  const { token } = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      message: 'Enter your Figma Personal Access Token:',
      validate: (input) => input.length > 0 || 'Token is required'
    }
  ]);
  
  // Save token to environment file
  try {
    const envPath = path.join(os.homedir(), '.graphyn', 'env');
    await fs.mkdir(path.dirname(envPath), { recursive: true });
    
    let envContent = '';
    try {
      envContent = await fs.readFile(envPath, 'utf-8');
    } catch {
      // File doesn't exist
    }
    
    // Update or add token
    const lines = envContent.split('\n').filter(line => !line.startsWith('FIGMA_PERSONAL_ACCESS_TOKEN='));
    lines.push(`FIGMA_PERSONAL_ACCESS_TOKEN=${token}`);
    
    await fs.writeFile(envPath, lines.join('\n'));
    
    // Also set in current process
    process.env.FIGMA_PERSONAL_ACCESS_TOKEN = token;
    
    console.log(colors.success('\n✓ Figma token saved securely\n'));
    
    return true;
  } catch (error) {
    console.error(colors.error('Failed to save token:'), error);
    return false;
  }
}

/**
 * Test Figma MCP connection
 */
async function testFigmaMCP(): Promise<boolean> {
  const spinner = ora('Testing Figma MCP connection...').start();
  
  try {
    // Try to run the MCP server
    const { stdout, stderr } = await execAsync('npx -y @figma/mcp list-tools', {
      env: {
        ...process.env,
        FIGMA_PERSONAL_ACCESS_TOKEN: process.env.FIGMA_PERSONAL_ACCESS_TOKEN
      }
    });
    
    if (stdout.includes('get_file') || stdout.includes('figma')) {
      spinner.succeed('Figma MCP is working correctly!');
      return true;
    } else {
      spinner.fail('Figma MCP test failed');
      console.error(colors.error('Output:'), stdout);
      if (stderr) console.error(colors.error('Error:'), stderr);
      return false;
    }
  } catch (error) {
    spinner.fail('Failed to connect to Figma MCP');
    console.error(colors.error('Error:'), error);
    return false;
  }
}

/**
 * Show Figma Desktop integration instructions
 */
async function showFigmaDesktopInstructions(): Promise<void> {
  console.log(colors.bold('\n📱 Figma Desktop Integration\n'));
  
  console.log(colors.info('For the best experience with Figma MCP:'));
  console.log(colors.info('1. Install Figma Desktop app'));
  console.log(colors.info('2. Sign in to your Figma account'));
  console.log(colors.info('3. Keep Figma Desktop running while using Claude Code\n'));
  
  console.log(colors.highlight('Benefits of Figma Desktop:'));
  console.log(colors.info('• Faster file access'));
  console.log(colors.info('• Better performance for large designs'));
  console.log(colors.info('• Automatic updates to designs'));
  console.log(colors.info('• Direct component inspection\n'));
  
  const { installFigma } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'installFigma',
      message: 'Would you like to download Figma Desktop?',
      default: false
    }
  ]);
  
  if (installFigma) {
    await open('https://www.figma.com/downloads/');
    console.log(colors.info('\n✓ Opened Figma download page'));
  }
}

/**
 * Setup Figma MCP
 */
export async function setupFigmaMCP(): Promise<FigmaMCPResult> {
  console.log(colors.bold('\n🎨 Figma MCP Setup\n'));
  
  // Check if already configured
  const isConfigured = await checkExistingMCP();
  
  if (isConfigured) {
    console.log(colors.success('✓ Figma MCP is already configured\n'));
    
    const { reconfigure } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'reconfigure',
        message: 'Would you like to reconfigure Figma MCP?',
        default: false
      }
    ]);
    
    if (!reconfigure) {
      // Test existing setup
      const isWorking = await testFigmaMCP();
      return {
        success: true,
        message: 'Figma MCP already configured',
        isRunning: isWorking
      };
    }
  }
  
  // Configure MCP
  const configured = await configureFigmaMCP();
  if (!configured) {
    return {
      success: false,
      message: 'Failed to configure Figma MCP',
      isRunning: false
    };
  }
  
  // Setup token
  const tokenSetup = await setupFigmaToken();
  if (!tokenSetup) {
    return {
      success: false,
      message: 'Failed to setup Figma token',
      isRunning: false
    };
  }
  
  // Test connection
  const isWorking = await testFigmaMCP();
  
  if (!isWorking) {
    console.log(colors.warning('\n⚠️  Figma MCP test failed. Please check:'));
    console.log(colors.info('1. Your Figma token is valid'));
    console.log(colors.info('2. You have internet connection'));
    console.log(colors.info('3. Claude Desktop is restarted\n'));
  }
  
  // Show desktop instructions
  await showFigmaDesktopInstructions();
  
  console.log(colors.bold('\n🎯 Final Steps:\n'));
  console.log(colors.highlight('1. Restart Claude Desktop to load the MCP configuration'));
  console.log(colors.highlight('2. In Claude Desktop, you should see "figma-mcp" in the MCP menu'));
  console.log(colors.highlight('3. Try asking Claude to analyze a Figma file!\n'));
  
  const { completed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'completed',
      message: 'Have you completed these steps?',
      default: false
    }
  ]);
  
  return {
    success: completed,
    message: completed ? 'Figma MCP setup completed' : 'Figma MCP setup incomplete',
    isRunning: completed && isWorking
  };
}

// ===============================================
// MULTI-AGENT FIGMA WORKFLOW FUNCTIONS
// ===============================================

/**
 * Initialize multi-agent Figma-to-code workflow
 */
export async function initializeFigmaMultiAgentWorkflow(
  figmaToken: string,
  figmaUrl: string,
  options: {
    framework?: 'react' | 'vue' | 'angular';
    backend?: 'node' | 'python' | 'go';
    database?: 'postgres' | 'mongodb' | 'sqlite';
    styling?: 'tailwind' | 'styled-components' | 'css-modules';
    outputDir?: string;
    maxAgents?: number;
    enableTesting?: boolean;
    enableDeployment?: boolean;
  } = {}
): Promise<MultiAgentResult> {
  console.log(colors.bold('\n🎭 Initializing Multi-Agent Figma Workflow\n'));
  
  // Initialize Figma API client with multi-agent support
  const figmaClient = new FigmaAPIClient(figmaToken, true);
  
  // Initialize multi-agent manager
  const agentManager = new ClaudeMultiAgentManager({
    maxConcurrentAgents: options.maxAgents || 6,
    enableGitWorktrees: true,
    enableTmuxIsolation: true,
    workspaceRoot: process.cwd()
  });

  try {
    // Initialize both systems
    await agentManager.initialize();
    await figmaClient.initializeMultiAgentIntegration(agentManager);

    console.log(colors.success('✅ Multi-agent systems initialized'));

    // Set up progress tracking
    const progressCallback = (message: string, agentId?: string) => {
      const prefix = agentId ? colors.highlight(`[${agentId}]`) : colors.info('[COORDINATOR]');
      console.log(`${prefix} ${message}`);
    };

    // Start the multi-agent Figma-to-code generation
    console.log(colors.bold('\n🚀 Starting Multi-Agent Code Generation...\n'));
    
    const result = await figmaClient.generateFullStackFromPrototype(
      figmaUrl,
      {
        framework: options.framework || 'react',
        backend: options.backend,
        database: options.database,
        styling: options.styling || 'tailwind',
        outputDir: options.outputDir || './generated',
        agentConfig: {
          maxConcurrentAgents: options.maxAgents || 6,
          enableTesting: options.enableTesting ?? true,
          enableDeployment: options.enableDeployment ?? false
        }
      },
      progressCallback
    );

    // Display results
    await displayMultiAgentResults(result);

    return result;

  } catch (error: any) {
    console.error(colors.error('❌ Multi-agent workflow failed:'), error.message);
    throw error;
  } finally {
    // Cleanup
    await agentManager.shutdown();
  }
}

/**
 * Display multi-agent workflow results
 */
async function displayMultiAgentResults(result: MultiAgentResult): Promise<void> {
  console.log(colors.bold('\n🎉 Multi-Agent Workflow Results\n'));
  
  if (result.success) {
    console.log(colors.success(`✅ Success! Completed in ${result.totalTimeSeconds.toFixed(1)}s`));
    
    if (result.prototypeAnalysis) {
      console.log(colors.info(`📱 Analyzed ${result.prototypeAnalysis.totalScreens} screens with ${result.prototypeAnalysis.totalComponents} components`));
    }
    
    if (result.taskPlan) {
      console.log(colors.info(`⚙️  Executed ${result.taskPlan.totalTasks} tasks across multiple agents`));
    }
    
    if (result.generatedFiles.length > 0) {
      console.log(colors.info(`📄 Generated ${result.generatedFiles.length} files:`));
      result.generatedFiles.slice(0, 10).forEach(file => {
        console.log(colors.info(`   • ${file}`));
      });
      
      if (result.generatedFiles.length > 10) {
        console.log(colors.info(`   ... and ${result.generatedFiles.length - 10} more files`));
      }
    }
    
    if (result.testResults) {
      console.log(colors.info(`🧪 Tests: ${result.testResults.passed} passed, ${result.testResults.failed} failed, ${result.testResults.coverage}% coverage`));
    }
    
    if (result.deploymentInfo) {
      console.log(colors.success(`🚀 Deployed to: ${result.deploymentInfo.url}`));
    }
    
  } else {
    console.log(colors.error(`❌ Failed: ${result.error}`));
    
    if (result.agentResults.length > 0) {
      const failedTasks = result.agentResults.filter(r => !r.success);
      if (failedTasks.length > 0) {
        console.log(colors.error('\nFailed tasks:'));
        failedTasks.forEach(task => {
          console.log(colors.error(`  • ${task.taskId}: ${task.error}`));
        });
      }
    }
  }
}

/**
 * Interactive setup for multi-agent Figma workflow
 */
export async function interactiveFigmaWorkflowSetup(): Promise<MultiAgentResult | null> {
  console.log(colors.bold('\n🎨 Interactive Multi-Agent Figma Workflow Setup\n'));
  
  // Check if Figma token exists
  let figmaToken = process.env.FIGMA_PERSONAL_ACCESS_TOKEN;
  
  if (!figmaToken) {
    console.log(colors.warning('⚠️  Figma token not found. Please set up your token first.'));
    const tokenSetup = await setupFigmaToken();
    if (!tokenSetup) {
      console.log(colors.error('❌ Cannot proceed without Figma token'));
      return null;
    }
    figmaToken = process.env.FIGMA_PERSONAL_ACCESS_TOKEN!;
  }
  
  // Get user inputs
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'figmaUrl',
      message: 'Enter Figma prototype URL:',
      validate: (input) => {
        if (!input) return 'URL is required';
        if (!input.includes('figma.com')) return 'Please enter a valid Figma URL';
        return true;
      }
    },
    {
      type: 'list',
      name: 'framework',
      message: 'Choose frontend framework:',
      choices: [
        { name: 'React (recommended)', value: 'react' },
        { name: 'Vue.js', value: 'vue' },
        { name: 'Angular', value: 'angular' }
      ],
      default: 'react'
    },
    {
      type: 'list',
      name: 'styling',
      message: 'Choose styling solution:',
      choices: [
        { name: 'Tailwind CSS (recommended)', value: 'tailwind' },
        { name: 'Styled Components', value: 'styled-components' },
        { name: 'CSS Modules', value: 'css-modules' }
      ],
      default: 'tailwind'
    },
    {
      type: 'confirm',
      name: 'includeBackend',
      message: 'Include backend API generation?',
      default: false
    },
    {
      type: 'list',
      name: 'backend',
      message: 'Choose backend technology:',
      choices: [
        { name: 'Node.js + Express', value: 'node' },
        { name: 'Python + FastAPI', value: 'python' },
        { name: 'Go + Gin', value: 'go' }
      ],
      when: (answers) => answers.includeBackend,
      default: 'node'
    },
    {
      type: 'list',
      name: 'database',
      message: 'Choose database:',
      choices: [
        { name: 'PostgreSQL', value: 'postgres' },
        { name: 'MongoDB', value: 'mongodb' },
        { name: 'SQLite', value: 'sqlite' }
      ],
      when: (answers) => answers.includeBackend,
      default: 'postgres'
    },
    {
      type: 'number',
      name: 'maxAgents',
      message: 'Maximum concurrent agents (3-8):',
      default: 6,
      validate: (input) => {
        const num = parseInt(String(input));
        if (isNaN(num) || num < 3 || num > 8) return 'Please enter a number between 3 and 8';
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'enableTesting',
      message: 'Generate comprehensive test suites?',
      default: true
    },
    {
      type: 'confirm',
      name: 'enableDeployment',
      message: 'Set up deployment configuration?',
      default: false
    },
    {
      type: 'input',
      name: 'outputDir',
      message: 'Output directory for generated code:',
      default: './figma-generated-app'
    }
  ]);
  
  // Confirm before starting
  console.log(colors.bold('\n📋 Configuration Summary:\n'));
  console.log(colors.info(`• Framework: ${answers.framework}`));
  console.log(colors.info(`• Styling: ${answers.styling}`));
  if (answers.includeBackend) {
    console.log(colors.info(`• Backend: ${answers.backend} + ${answers.database}`));
  }
  console.log(colors.info(`• Max Agents: ${answers.maxAgents}`));
  console.log(colors.info(`• Testing: ${answers.enableTesting ? 'Enabled' : 'Disabled'}`));
  console.log(colors.info(`• Deployment: ${answers.enableDeployment ? 'Enabled' : 'Disabled'}`));
  console.log(colors.info(`• Output: ${answers.outputDir}`));
  
  const { proceed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: 'Proceed with multi-agent code generation?',
      default: true
    }
  ]);
  
  if (!proceed) {
    console.log(colors.info('✋ Operation cancelled'));
    return null;
  }
  
  // Start the workflow
  return await initializeFigmaMultiAgentWorkflow(
    figmaToken,
    answers.figmaUrl,
    {
      framework: answers.framework,
      backend: answers.includeBackend ? answers.backend : undefined,
      database: answers.includeBackend ? answers.database : undefined,
      styling: answers.styling,
      maxAgents: answers.maxAgents,
      enableTesting: answers.enableTesting,
      enableDeployment: answers.enableDeployment,
      outputDir: answers.outputDir
    }
  );
}

/**
 * Quick start Figma workflow with sensible defaults
 */
export async function quickStartFigmaWorkflow(figmaUrl: string): Promise<MultiAgentResult> {
  const figmaToken = process.env.FIGMA_PERSONAL_ACCESS_TOKEN;
  
  if (!figmaToken) {
    throw new Error('FIGMA_PERSONAL_ACCESS_TOKEN environment variable is required');
  }
  
  console.log(colors.bold('\n⚡ Quick Start: Multi-Agent Figma-to-React\n'));
  
  return await initializeFigmaMultiAgentWorkflow(
    figmaToken,
    figmaUrl,
    {
      framework: 'react',
      styling: 'tailwind',
      maxAgents: 5,
      enableTesting: true,
      enableDeployment: false,
      outputDir: './quick-generated'
    }
  );
}
