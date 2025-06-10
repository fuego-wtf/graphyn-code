import { Command } from 'commander';
import ora from 'ora';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { findClaude, isClaudeConfigured, getClaudeVersion } from '../utils/claude-detector';
import { checkMCPConfiguration } from '../setup/mcp-configurator';
import { FigmaOAuthManager } from '../figma-oauth';
import { colors, createDivider } from '../ui';

interface HealthCheck {
  name: string;
  description?: string;
  check: () => Promise<boolean>;
  fix?: string;
  optional?: boolean;
}

export function createDoctorCommand(): Command {
  const command = new Command('doctor');
  
  command
    .description('Check your Graphyn setup and diagnose issues')
    .option('-v, --verbose', 'Show detailed diagnostic information')
    .action(async (options) => {
      await runDoctorCheck(options);
    });
  
  return command;
}

async function runDoctorCheck(options: { verbose?: boolean }): Promise<void> {
  console.log(colors.bold('\n🏥 Running Graphyn Doctor'));
  console.log(createDivider());
  console.log();
  
  // Define health checks
  const checks: HealthCheck[] = [
    {
      name: 'Node.js version',
      description: 'Node.js 16+ required',
      check: async () => {
        const version = process.version;
        const major = parseInt(version.split('.')[0].substring(1));
        
        if (options.verbose) {
          console.log(colors.dim(`  Current version: ${version}`));
        }
        
        return major >= 16;
      },
      fix: 'Update Node.js to version 16 or higher from https://nodejs.org'
    },
    {
      name: 'Graphyn directories',
      description: 'Required directories exist',
      check: async () => {
        const graphynDir = path.join(os.homedir(), '.graphyn');
        const requiredDirs = [
          graphynDir,
          path.join(graphynDir, 'contexts'),
          path.join(graphynDir, 'prompts'),
          path.join(graphynDir, 'templates')
        ];
        
        for (const dir of requiredDirs) {
          if (!fs.existsSync(dir)) {
            if (options.verbose) {
              console.log(colors.dim(`  Missing: ${dir}`));
            }
            return false;
          }
        }
        
        return true;
      },
      fix: 'Run: graphyn setup'
    },
    {
      name: 'Claude Code',
      description: 'CLI tool installed',
      check: async () => {
        const result = await findClaude();
        
        if (options.verbose && result.found) {
          console.log(colors.dim(`  Found at: ${result.path}`));
          console.log(colors.dim(`  Method: ${result.method}`));
          
          if (result.path) {
            const version = await getClaudeVersion(result.path);
            if (version) {
              console.log(colors.dim(`  Version: ${version}`));
            }
          }
        }
        
        return result.found;
      },
      fix: 'Install Claude Code from https://claude.ai/code',
      optional: true
    },
    {
      name: 'Claude configuration',
      description: 'Claude Code is configured',
      check: async () => {
        const configured = await isClaudeConfigured();
        
        if (options.verbose) {
          const configPath = path.join(os.homedir(), '.claude', 'config.json');
          console.log(colors.dim(`  Config path: ${configPath}`));
          console.log(colors.dim(`  Exists: ${configured}`));
        }
        
        return configured;
      },
      fix: 'Run Claude Code once to create configuration',
      optional: true
    },
    {
      name: 'MCP configuration',
      description: 'Model Context Protocol server configured',
      check: async () => {
        const result = await checkMCPConfiguration();
        
        if (options.verbose) {
          console.log(colors.dim(`  Configured: ${result.configured}`));
          console.log(colors.dim(`  Has proxy: ${result.hasProxy}`));
          console.log(colors.dim(`  Has Figma server: ${result.hasFigmaServer}`));
          if (result.error) {
            console.log(colors.dim(`  Error: ${result.error}`));
          }
        }
        
        return result.configured && result.hasFigmaServer;
      },
      fix: 'Run: graphyn setup',
      optional: true
    },
    {
      name: 'Figma authentication',
      description: 'OAuth tokens available',
      check: async () => {
        const oauthManager = new FigmaOAuthManager();
        const isAuth = await oauthManager.isAuthenticated();
        
        if (options.verbose) {
          const tokenPath = path.join(os.homedir(), '.graphyn', 'figma-token.json');
          console.log(colors.dim(`  Token path: ${tokenPath}`));
          console.log(colors.dim(`  Authenticated: ${isAuth}`));
        }
        
        return isAuth;
      },
      fix: 'Run: graphyn design auth',
      optional: true
    },
    {
      name: 'Platform compatibility',
      description: 'Operating system and Node.js support',
      check: async () => {
        const platform = process.platform;
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
        
        // Platform support levels
        const fullySupported = ['darwin', 'linux'];
        const experimental = ['win32'];
        const unsupported = ['freebsd', 'openbsd', 'sunos', 'aix'];
        
        let platformStatus = 'unknown';
        if (fullySupported.includes(platform)) {
          platformStatus = 'fully supported';
        } else if (experimental.includes(platform)) {
          platformStatus = 'experimental';
        } else if (unsupported.includes(platform)) {
          platformStatus = 'unsupported';
        }
        
        if (options.verbose) {
          console.log(colors.dim(`  Platform: ${platform} (${platformStatus})`));
          console.log(colors.dim(`  Architecture: ${process.arch}`));
          console.log(colors.dim(`  OS: ${os.type()} ${os.release()}`));
          console.log(colors.dim(`  Node.js: ${nodeVersion} (required: 16+)`));
          console.log(colors.dim(`  Shell: ${process.env.SHELL || 'unknown'}`));
          
          // ESM dependency warnings
          if (majorVersion < 16) {
            console.log(colors.dim(`  ⚠️  Some dependencies require Node 16+`));
          }
          
          if (platform === 'win32') {
            console.log(colors.dim(`  ℹ️  Windows support is experimental`));
            console.log(colors.dim(`  ℹ️  PowerShell/cmd compatibility not guaranteed`));
          }
        }
        
        // Return success for supported and experimental platforms
        return fullySupported.includes(platform) || experimental.includes(platform);
      },
      fix: 'Graphyn supports macOS (full), Linux (full), Windows (experimental)'
    }
  ];
  
  // Run all checks
  let failures = 0;
  let warnings = 0;
  
  for (const check of checks) {
    const spinner = ora({
      text: check.name,
      indent: 2
    }).start();
    
    try {
      const passed = await check.check();
      
      if (passed) {
        spinner.succeed(colors.success(check.name));
      } else {
        if (check.optional) {
          spinner.warn(colors.warning(check.name));
          warnings++;
        } else {
          spinner.fail(colors.error(check.name));
          failures++;
        }
        
        if (check.fix) {
          console.log(colors.info(`    Fix: ${check.fix}`));
        }
      }
      
      if (options.verbose && check.description) {
        console.log(colors.dim(`    ${check.description}`));
      }
      
      if (!passed || options.verbose) {
        console.log(); // Add spacing between failed/verbose checks
      }
    } catch (error) {
      spinner.fail(colors.error(`${check.name} (error)`));
      if (options.verbose) {
        console.log(colors.dim(`    Error: ${error}`));
      }
      failures++;
    }
  }
  
  // Summary
  console.log(createDivider());
  
  // Platform compatibility summary
  const platform = process.platform;
  const nodeVersion = process.version;
  const fullySupported = ['darwin', 'linux'];
  const experimental = ['win32'];
  
  if (fullySupported.includes(platform)) {
    console.log(colors.success(`\n🖥️  Platform: ${platform} (fully supported)`));
  } else if (experimental.includes(platform)) {
    console.log(colors.warning(`\n🖥️  Platform: ${platform} (experimental support)`));
    console.log(colors.info('Some features may have limitations on Windows.'));
  } else {
    console.log(colors.error(`\n🖥️  Platform: ${platform} (limited support)`));
  }
  
  console.log(colors.dim(`Node.js: ${nodeVersion}`));
  
  if (failures === 0 && warnings === 0) {
    console.log(colors.success('\n✨ All checks passed! Your Graphyn setup is healthy.'));
  } else if (failures === 0) {
    console.log(colors.warning(`\n⚠️  ${warnings} optional feature${warnings > 1 ? 's' : ''} not configured.`));
    console.log(colors.info('Your core setup is healthy, but some features may be limited.'));
  } else {
    console.log(colors.error(`\n❌ ${failures} check${failures > 1 ? 's' : ''} failed.`));
    console.log(colors.info('Please fix the issues above to ensure Graphyn works properly.'));
  }
  
  console.log();
  console.log(colors.dim('Run "graphyn doctor -v" for detailed diagnostics.'));
  console.log(colors.dim('Run "graphyn setup" to reconfigure your installation.'));
  console.log();
}