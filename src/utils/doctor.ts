import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold
};

export interface SystemCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  required: boolean;
}

export interface DoctorResult {
  checks: SystemCheck[];
  canProceed: boolean;
  needsClaudeCode: boolean;
  needsFigmaMCP: boolean;
  hasRepository: boolean;
}

/**
 * Check if a command exists
 */
async function commandExists(command: string): Promise<boolean> {
  try {
    await execAsync(`which ${command}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check Claude Code installation
 */
async function checkClaudeCode(): Promise<SystemCheck> {
  try {
    // Check multiple possible Claude Code commands
    const claudeCommands = ['claude', 'claude-code', 'claudecode'];
    
    for (const cmd of claudeCommands) {
      if (await commandExists(cmd)) {
        try {
          const { stdout } = await execAsync(`${cmd} --version`);
          return {
            name: 'Claude Code',
            status: 'pass',
            message: `✓ Claude Code installed (${stdout.trim()})`,
            required: true
          };
        } catch {
          // Command exists but might not support --version
          return {
            name: 'Claude Code',
            status: 'pass',
            message: '✓ Claude Code installed',
            required: true
          };
        }
      }
    }
    
    return {
      name: 'Claude Code',
      status: 'fail',
      message: '✗ Claude Code not found. Required for AI assistance.',
      required: true
    };
  } catch (error) {
    return {
      name: 'Claude Code',
      status: 'fail',
      message: '✗ Error checking Claude Code installation',
      required: true
    };
  }
}

/**
 * Check Node.js version
 */
async function checkNodeVersion(): Promise<SystemCheck> {
  try {
    const { stdout } = await execAsync('node --version');
    const version = stdout.trim();
    const major = parseInt(version.split('.')[0].substring(1));
    
    if (major >= 16) {
      return {
        name: 'Node.js',
        status: 'pass',
        message: `✓ Node.js ${version}`,
        required: true
      };
    } else {
      return {
        name: 'Node.js',
        status: 'fail',
        message: `✗ Node.js ${version} (requires v16+)`,
        required: true
      };
    }
  } catch {
    return {
      name: 'Node.js',
      status: 'fail',
      message: '✗ Node.js not found',
      required: true
    };
  }
}

/**
 * Check Git installation and repository
 */
async function checkGit(): Promise<SystemCheck & { isRepo: boolean }> {
  try {
    const { stdout: gitVersion } = await execAsync('git --version');
    
    // Check if current directory is a git repo
    let isRepo = false;
    try {
      await execAsync('git rev-parse --git-dir');
      isRepo = true;
    } catch {
      // Not a git repo
    }
    
    return {
      name: 'Git',
      status: 'pass',
      message: `✓ ${gitVersion.trim()}${isRepo ? ' (in repository)' : ''}`,
      required: false,
      isRepo
    };
  } catch {
    return {
      name: 'Git',
      status: 'warning',
      message: '⚠ Git not found (optional for repository analysis)',
      required: false,
      isRepo: false
    };
  }
}

/**
 * Check for MCP configuration
 */
async function checkMCPSetup(): Promise<SystemCheck> {
  try {
    const homeDir = os.homedir();
    const mcpConfigPath = path.join(homeDir, '.config', 'claude', 'claude_desktop_config.json');
    
    try {
      const configContent = await fs.readFile(mcpConfigPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      if (config.mcpServers && Object.keys(config.mcpServers).length > 0) {
        const servers = Object.keys(config.mcpServers).join(', ');
        return {
          name: 'MCP Configuration',
          status: 'pass',
          message: `✓ MCP servers configured: ${servers}`,
          required: false
        };
      } else {
        return {
          name: 'MCP Configuration',
          status: 'warning',
          message: '⚠ No MCP servers configured',
          required: false
        };
      }
    } catch {
      return {
        name: 'MCP Configuration',
        status: 'warning',
        message: '⚠ MCP configuration not found',
        required: false
      };
    }
  } catch (error) {
    return {
      name: 'MCP Configuration',
      status: 'warning',
      message: '⚠ Could not check MCP configuration',
      required: false
    };
  }
}

/**
 * Check Figma Desktop
 */
async function checkFigmaDesktop(): Promise<SystemCheck> {
  const platform = os.platform();
  
  try {
    if (platform === 'darwin') {
      // macOS
      try {
        await fs.access('/Applications/Figma.app');
        return {
          name: 'Figma Desktop',
          status: 'pass',
          message: '✓ Figma Desktop installed',
          required: false
        };
      } catch {
        return {
          name: 'Figma Desktop',
          status: 'warning',
          message: '⚠ Figma Desktop not found (optional for design extraction)',
          required: false
        };
      }
    } else if (platform === 'win32') {
      // Windows - check common locations
      const possiblePaths = [
        path.join(process.env.LOCALAPPDATA || '', 'Figma'),
        path.join(process.env.PROGRAMFILES || '', 'Figma'),
      ];
      
      for (const figmaPath of possiblePaths) {
        try {
          await fs.access(figmaPath);
          return {
            name: 'Figma Desktop',
            status: 'pass',
            message: '✓ Figma Desktop installed',
            required: false
          };
        } catch {
          // Continue checking
        }
      }
    }
    
    return {
      name: 'Figma Desktop',
      status: 'warning',
      message: '⚠ Figma Desktop not detected (optional)',
      required: false
    };
  } catch {
    return {
      name: 'Figma Desktop',
      status: 'warning',
      message: '⚠ Could not check Figma Desktop',
      required: false
    };
  }
}

/**
 * Run system doctor checks
 */
export async function runDoctor(): Promise<DoctorResult> {
  console.log(colors.bold('\n🔍 Running system diagnostics...\n'));
  
  const checks: SystemCheck[] = [];
  
  // Run all checks
  checks.push(await checkNodeVersion());
  
  const claudeCheck = await checkClaudeCode();
  checks.push(claudeCheck);
  
  const gitCheck = await checkGit();
  checks.push(gitCheck);
  
  const mcpCheck = await checkMCPSetup();
  checks.push(mcpCheck);
  
  const figmaCheck = await checkFigmaDesktop();
  checks.push(figmaCheck);
  
  // Display results
  console.log(colors.bold('System Check Results:\n'));
  
  for (const check of checks) {
    const icon = check.status === 'pass' ? '✓' : check.status === 'warning' ? '⚠' : '✗';
    const color = check.status === 'pass' ? colors.success : check.status === 'warning' ? colors.warning : colors.error;
    
    console.log(color(`${icon} ${check.name}`));
    console.log(colors.info(`  ${check.message}\n`));
  }
  
  // Determine what needs to be done
  const requiredFailed = checks.filter(c => c.required && c.status === 'fail');
  const canProceed = requiredFailed.length === 0;
  const needsClaudeCode = claudeCheck.status === 'fail';
  const needsFigmaMCP = mcpCheck.status !== 'pass' || figmaCheck.status !== 'pass';
  const hasRepository = gitCheck.isRepo;
  
  if (!canProceed) {
    console.log(colors.error('❌ Required components missing. Setup needed.\n'));
  } else if (checks.some(c => c.status === 'warning')) {
    console.log(colors.warning('⚠️  Optional components missing. Some features may be limited.\n'));
  } else {
    console.log(colors.success('✅ All systems operational!\n'));
  }
  
  return {
    checks,
    canProceed,
    needsClaudeCode,
    needsFigmaMCP,
    hasRepository
  };
}