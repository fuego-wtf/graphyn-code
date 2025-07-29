import chalk from 'chalk';
import inquirer from 'inquirer';
import { spawn } from 'child_process';
import ora from 'ora';
import open from 'open';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold
};

export interface ClaudeInstallResult {
  success: boolean;
  message: string;
}

/**
 * Check if user has Claude Pro subscription
 */
async function checkClaudeSubscription(): Promise<boolean> {
  console.log(colors.bold('\n🔍 Checking Claude subscription...\n'));
  
  const { hasClaudePro } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'hasClaudePro',
      message: 'Do you have an active Claude Pro subscription?',
      default: false
    }
  ]);
  
  if (!hasClaudePro) {
    console.log(colors.warning('\n⚠️  Claude Code requires a Claude Pro subscription.'));
    console.log(colors.info('You can subscribe at: https://claude.ai/upgrade\n'));
    
    const { openSubscribe } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'openSubscribe',
        message: 'Would you like to open the Claude subscription page?',
        default: true
      }
    ]);
    
    if (openSubscribe) {
      await open('https://claude.ai/upgrade');
      console.log(colors.info('\n✓ Opened Claude subscription page in browser'));
      
      // Wait for user to complete subscription
      const { completed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'completed',
          message: 'Have you completed the Claude Pro subscription?',
          default: false
        }
      ]);
      
      return completed;
    }
  }
  
  return hasClaudePro;
}

/**
 * Install Claude Code
 */
export async function installClaudeCode(): Promise<ClaudeInstallResult> {
  console.log(colors.bold('\n🤖 Claude Code Installation\n'));
  
  // Check subscription first
  const hasSubscription = await checkClaudeSubscription();
  if (!hasSubscription) {
    return {
      success: false,
      message: 'Claude Pro subscription required'
    };
  }
  
  console.log(colors.info('\nClaude Code can be installed through:'));
  console.log(colors.info('1. Homebrew (macOS/Linux) - Recommended'));
  console.log(colors.info('2. Direct download from GitHub'));
  console.log(colors.info('3. Build from source\n'));
  
  const { installMethod } = await inquirer.prompt([
    {
      type: 'list',
      name: 'installMethod',
      message: 'Select installation method:',
      choices: [
        { name: 'Homebrew (Recommended)', value: 'homebrew' },
        { name: 'Download from GitHub', value: 'github' },
        { name: 'Build from source', value: 'source' },
        { name: 'Skip installation', value: 'skip' }
      ]
    }
  ]);
  
  switch (installMethod) {
    case 'homebrew':
      return await installViaHomebrew();
    case 'github':
      return await installViaGitHub();
    case 'source':
      return await installFromSource();
    case 'skip':
      return {
        success: false,
        message: 'Installation skipped'
      };
    default:
      return {
        success: false,
        message: 'Invalid installation method'
      };
  }
}

/**
 * Install via Homebrew
 */
async function installViaHomebrew(): Promise<ClaudeInstallResult> {
  const spinner = ora('Installing Claude Code via Homebrew...').start();
  
  return new Promise((resolve) => {
    // First check if homebrew is installed
    const checkBrew = spawn('which', ['brew']);
    
    checkBrew.on('close', (code) => {
      if (code !== 0) {
        spinner.fail('Homebrew not found');
        console.log(colors.warning('\n⚠️  Homebrew is not installed.'));
        console.log(colors.info('Install from: https://brew.sh\n'));
        resolve({
          success: false,
          message: 'Homebrew not installed'
        });
        return;
      }
      
      // Install Claude Code
      console.log('\n');
      const install = spawn('brew', ['install', 'claude-code'], {
        stdio: 'inherit'
      });
      
      install.on('close', (code) => {
        if (code === 0) {
          spinner.succeed('Claude Code installed successfully!');
          resolve({
            success: true,
            message: 'Claude Code installed via Homebrew'
          });
        } else {
          spinner.fail('Installation failed');
          resolve({
            success: false,
            message: 'Homebrew installation failed'
          });
        }
      });
    });
  });
}

/**
 * Install via GitHub download
 */
async function installViaGitHub(): Promise<ClaudeInstallResult> {
  console.log(colors.bold('\n📥 Manual Installation Steps:\n'));
  
  console.log('1. Visit: https://github.com/anthropics/claude-code/releases');
  console.log('2. Download the appropriate version for your system:');
  console.log('   - macOS: claude-code-darwin-arm64.tar.gz (Apple Silicon) or claude-code-darwin-x64.tar.gz (Intel)');
  console.log('   - Linux: claude-code-linux-x64.tar.gz');
  console.log('   - Windows: claude-code-win32-x64.zip');
  console.log('3. Extract the archive');
  console.log('4. Move the binary to your PATH (e.g., /usr/local/bin)');
  console.log('5. Make it executable: chmod +x /usr/local/bin/claude-code\n');
  
  const { openPage } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'openPage',
      message: 'Open the GitHub releases page?',
      default: true
    }
  ]);
  
  if (openPage) {
    await open('https://github.com/anthropics/claude-code/releases');
  }
  
  console.log(colors.info('\n✓ Follow the manual installation steps above'));
  
  const { completed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'completed',
      message: 'Have you completed the installation?',
      default: false
    }
  ]);
  
  return {
    success: completed,
    message: completed ? 'Manual installation completed' : 'Manual installation not completed'
  };
}

/**
 * Install from source
 */
async function installFromSource(): Promise<ClaudeInstallResult> {
  console.log(colors.bold('\n🔨 Building from Source:\n'));
  
  console.log('Prerequisites:');
  console.log('- Git');
  console.log('- Node.js 18+');
  console.log('- npm or yarn\n');
  
  console.log('Steps:');
  console.log('1. git clone https://github.com/anthropics/claude-code.git');
  console.log('2. cd claude-code');
  console.log('3. npm install');
  console.log('4. npm run build');
  console.log('5. npm link\n');
  
  const { proceed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: 'Would you like to proceed with source installation?',
      default: true
    }
  ]);
  
  if (!proceed) {
    return {
      success: false,
      message: 'Source installation cancelled'
    };
  }
  
  // Clone and build in a new terminal
  console.log(colors.info('\n🚀 Opening new terminal for installation...\n'));
  
  const platform = process.platform;
  let command: string;
  let args: string[];
  
  const installScript = `
    git clone https://github.com/anthropics/claude-code.git /tmp/claude-code &&
    cd /tmp/claude-code &&
    npm install &&
    npm run build &&
    npm link &&
    echo "✅ Claude Code installed successfully!" &&
    echo "Press any key to close this window..." &&
    read -n 1
  `;
  
  if (platform === 'darwin') {
    // macOS
    command = 'osascript';
    args = [
      '-e',
      `tell application "Terminal" to do script "${installScript}"`
    ];
  } else if (platform === 'linux') {
    // Linux
    command = 'gnome-terminal';
    args = ['--', 'bash', '-c', installScript];
  } else {
    // Windows
    command = 'cmd';
    args = ['/c', 'start', 'cmd', '/k', installScript.replace(/&&/g, '^&^&')];
  }
  
  spawn(command, args, { detached: true });
  
  console.log(colors.info('✓ Installation terminal opened'));
  
  const { completed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'completed',
      message: 'Has the installation completed?',
      default: false
    }
  ]);
  
  return {
    success: completed,
    message: completed ? 'Built from source successfully' : 'Source build not completed'
  };
}