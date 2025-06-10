import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import inquirer from 'inquirer';
import ora from 'ora';
import { findClaude, getInstallInstructions, isClaudeConfigured } from '../utils/claude-detector';
import { colors, createBanner, createSuccessBox, createDivider } from '../ui';
import { setupMCPServer } from './mcp-configurator';
import { FigmaOAuthManager } from '../figma-oauth';

interface SetupStep {
  name: string;
  check: () => Promise<{ ready: boolean; message?: string }>;
  setup?: () => Promise<boolean>;
  required: boolean;
}

/**
 * Check if this is the first run
 */
export async function isFirstRun(): Promise<boolean> {
  const configPath = path.join(os.homedir(), '.graphyn', '.configured');
  return !fs.existsSync(configPath);
}

/**
 * Mark setup as complete
 */
async function markSetupComplete(): Promise<void> {
  const graphynDir = path.join(os.homedir(), '.graphyn');
  const configPath = path.join(graphynDir, '.configured');
  
  // Ensure directory exists
  if (!fs.existsSync(graphynDir)) {
    fs.mkdirSync(graphynDir, { recursive: true });
  }
  
  // Create directories for future use
  const dirs = [
    path.join(graphynDir, 'prompts'),
    path.join(graphynDir, 'templates'),
    path.join(graphynDir, 'cache'),
    path.join(graphynDir, 'sessions'),
    path.join(graphynDir, 'history'),
    path.join(graphynDir, 'contexts')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Write configuration
  const config = {
    version: 1,
    setupDate: new Date().toISOString(),
    platform: process.platform,
    nodeVersion: process.version
  };
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Run the first-time setup wizard
 */
export async function runFirstTimeSetup(): Promise<void> {
  // Show banner
  const banner = await createBanner();
  console.log(banner);
  console.log();
  console.log(colors.bold('Welcome to Graphyn Code! Let\'s set up your environment.'));
  console.log(createDivider());
  
  // Show platform compatibility info
  const platform = process.platform;
  const fullySupported = ['darwin', 'linux'];
  const experimental = ['win32'];
  
  if (fullySupported.includes(platform)) {
    console.log(colors.success(`🖥️  Platform: ${platform} (fully supported)`));
  } else if (experimental.includes(platform)) {
    console.log(colors.warning(`🖥️  Platform: ${platform} (experimental support)`));
    console.log(colors.info('Some features may have limitations on Windows.'));
  } else {
    console.log(colors.error(`🖥️  Platform: ${platform} (limited support)`));
    console.log(colors.info('Consider using a supported platform for best experience.'));
  }
  
  console.log();
  
  // Define setup steps
  const steps: SetupStep[] = [
    {
      name: 'Claude Code',
      required: false,
      check: async () => {
        const claudeResult = await findClaude();
        if (claudeResult.found) {
          const configured = await isClaudeConfigured();
          return { 
            ready: true, 
            message: configured ? 'Installed and configured' : 'Installed (not configured)'
          };
        }
        return { ready: false, message: 'Not installed' };
      },
      setup: async () => {
        console.log(getInstallInstructions());
        console.log();
        
        const { proceed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'proceed',
          message: 'Continue without Claude Code?',
          default: false
        }]);
        
        return proceed;
      }
    },
    {
      name: 'MCP Server Configuration',
      required: false,
      check: async () => {
        const configPath = path.join(os.homedir(), '.claude', 'mcp_servers.json');
        if (fs.existsSync(configPath)) {
          try {
            const content = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            const hasFigma = content.mcpServers?.['figma-proxy'] || content.mcpServers?.['figma-dev-mode-mcp-server'];
            return { ready: hasFigma, message: hasFigma ? 'Configured' : 'Not configured for Figma' };
          } catch {
            return { ready: false, message: 'Configuration corrupted' };
          }
        }
        return { ready: false, message: 'Not configured' };
      },
      setup: async () => {
        const { setupMCP } = await inquirer.prompt([{
          type: 'confirm',
          name: 'setupMCP',
          message: 'Configure MCP server for Figma integration?',
          default: true
        }]);
        
        if (setupMCP) {
          return await setupMCPServer();
        }
        return true;
      }
    },
    {
      name: 'Figma Authentication',
      required: false,
      check: async () => {
        const oauthManager = new FigmaOAuthManager();
        const isAuth = await oauthManager.isAuthenticated();
        return { ready: isAuth, message: isAuth ? 'Authenticated' : 'Not authenticated' };
      },
      setup: async () => {
        const { setupFigma } = await inquirer.prompt([{
          type: 'confirm',
          name: 'setupFigma',
          message: 'Set up Figma integration now?',
          default: true
        }]);
        
        if (setupFigma) {
          const oauthManager = new FigmaOAuthManager();
          try {
            const success = await oauthManager.authenticate();
            return success;
          } catch (error) {
            console.log(colors.error(`\nAuthentication failed: ${error}`));
            return true; // Continue anyway
          }
        }
        return true;
      }
    }
  ];
  
  // Run through each step
  let allReady = true;
  for (const step of steps) {
    const spinner = ora(`Checking ${step.name}...`).start();
    
    try {
      const result = await step.check();
      
      if (result.ready) {
        spinner.succeed(`${step.name}: ${result.message || 'Ready'}`);
      } else {
        spinner.warn(`${step.name}: ${result.message || 'Needs setup'}`);
        allReady = false;
        
        if (step.setup) {
          console.log();
          const setupSuccess = await step.setup();
          if (!setupSuccess && step.required) {
            console.log(colors.error('\nSetup cancelled. You can run setup again with: graphyn setup'));
            process.exit(1);
          }
        }
      }
    } catch (error) {
      spinner.fail(`${step.name}: Error checking status`);
      console.error(colors.dim(`  ${error}`));
      if (step.required) {
        process.exit(1);
      }
    }
  }
  
  // Mark setup as complete
  await markSetupComplete();
  
  console.log();
  if (allReady) {
    console.log(createSuccessBox('Setup complete! All features are ready to use.'));
  } else {
    console.log(createSuccessBox('Initial setup complete!'));
    console.log(colors.info('\n💡 Some features may need additional configuration.'));
    console.log(colors.info('Run "graphyn doctor" to check your setup status.'));
    console.log(colors.info('Run "graphyn setup" to reconfigure at any time.'));
  }
  
  console.log();
  console.log(colors.bold('🚀 Quick Start:'));
  console.log(colors.primary('  graphyn backend "create a REST API"'));
  console.log(colors.primary('  graphyn frontend "build a dashboard"'));
  console.log(colors.primary('  graphyn architect "design a microservices system"'));
  console.log(colors.primary('  graphyn design <figma-url>'));
  console.log();
  console.log(colors.dim('Run "graphyn --help" to see all commands.'));
  console.log();
}