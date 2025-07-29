import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import ora from 'ora';
import open from 'open';

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