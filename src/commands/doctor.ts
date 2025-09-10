import chalk from 'chalk';
import { runDoctor } from '../utils/doctor.js';
import { createInterface } from 'readline';
import { runSDKDiagnostics, printDiagnosticResults } from '../utils/claude-sdk-diagnostics.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  yellow: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold
};

/**
 * Run system diagnostics and offer automatic setup
 */
export async function doctor(options: { skipSetup?: boolean; claude?: boolean } = {}) {
  console.log(colors.bold('\n🩺 Graphyn Doctor\n'));
  console.log(colors.info('Checking your system for AI development readiness...\n'));
  
  // Run system checks
  const result = await runDoctor();
  
  // If --claude flag is used, run Claude Code SDK specific diagnostics
  if (options.claude) {
    console.log(colors.bold('\n🤖 Running Claude Code SDK Diagnostics...\n'));
    
    const sdkReport = await runSDKDiagnostics();
    printDiagnosticResults(sdkReport);
    
    if (!sdkReport.canProceed) {
      console.log(colors.error('❌ Critical issues found with Claude Code SDK configuration.'));
      console.log(colors.info('Please resolve the issues above before using Claude Code features.\n'));
      return;
    } else if (sdkReport.overall !== 'healthy') {
      console.log(colors.warning('⚠️  Claude Code SDK has some issues but may still work.'));
      console.log(colors.info('Consider addressing the warnings above for better performance.\n'));
    } else {
      console.log(colors.success('✅ Claude Code SDK is properly configured and ready to use!\n'));
    }
    
    return;
  }
  
  // If everything is good, just return
  if (result.canProceed && !result.needsClaudeCode && !result.needsFigmaMCP) {
    console.log(colors.success('🎉 Your system is ready for AI development!'));
    console.log(colors.info('\nYou can now use:'));
    console.log(colors.highlight('  graphyn <your request>    ') + colors.info('Create AI dev squads'));
    console.log(colors.highlight('  graphyn auth              ') + colors.info('Authenticate with Graphyn'));
    console.log(colors.highlight('  graphyn help              ') + colors.info('Show all commands'));
    return;
  }
  
  // If setup is needed and not skipped, offer automatic setup
  if (!options.skipSetup && (result.needsClaudeCode || result.needsTmux || result.needsFigmaMCP)) {
    console.log(colors.warning('\n⚠️  Some components need to be installed.\n'));
    
    // Check if user wants automatic setup
    const setupDecision = await promptForSetup(result.needsClaudeCode, result.needsTmux, result.needsFigmaMCP);
    
    if (setupDecision) {
      // Launch automatic setup
      await launchAutoSetup(result);
    } else {
      // Show manual setup instructions
      showManualSetupInstructions(result);
    }
  } else if (result.needsClaudeCode || result.needsTmux || result.needsFigmaMCP) {
    // If setup is skipped, show what's missing
    showManualSetupInstructions(result);
  }
}

/**
 * Prompt user for automatic setup
 */
async function promptForSetup(needsClaudeCode: boolean, needsTmux: boolean, needsFigmaMCP: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const components = [];
    if (needsClaudeCode) components.push('Claude Code');
    if (needsTmux) components.push('tmux');
    if (needsFigmaMCP) components.push('Figma MCP');
    
    const question = `Would you like to automatically install ${components.join(' and ')}? (Y/n) `;
    
    readline.question(colors.highlight(question), (answer: string) => {
      readline.close();
      const normalizedAnswer = answer.trim().toLowerCase();
      resolve(normalizedAnswer === '' || normalizedAnswer === 'y' || normalizedAnswer === 'yes');
    });
  });
}

/**
 * Launch the automatic setup (command-line version)
 */
async function launchAutoSetup(doctorResult: any) {
  console.log(colors.info('\n🚀 Starting automatic setup...\n'));
  
  console.log('The following components need to be installed:');
  if (doctorResult.needsClaudeCode) {
    console.log(colors.yellow('  • Claude Code (required)'));
  }
  if (doctorResult.needsFigmaMCP) {
    console.log(colors.info('  • Figma MCP (optional)'));
  }
  console.log('\nThis will open your browser to download Claude Code.');
  
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  try {
    // Ask for confirmation
    const proceed = await new Promise<boolean>((resolve) => {
      rl.question(colors.highlight('\nProceed with installation? (Y/n): '), (answer) => {
        resolve(answer.toLowerCase() !== 'n' && answer.toLowerCase() !== 'no');
      });
    });
    
    if (!proceed) {
      console.log(colors.warning('\n⚠️  Setup cancelled.'));
      console.log(colors.info('You can run setup again with: ') + colors.highlight('graphyn doctor'));
      return false;
    }
    
    // Open Claude Code download page
    const platform = os.platform();
    const url = 'https://claude.ai/download';
    
    let command;
    if (platform === 'darwin') {
      command = `open "${url}"`;
    } else if (platform === 'win32') {
      command = `start "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }
    
    console.log(colors.info('\n📥 Opening browser to download Claude Code...'));
    await execAsync(command);
    
    console.log('\nPlease complete the following steps:');
    console.log('1. Download Claude Code from the browser page that just opened');
    console.log('2. Install Claude Code following the instructions');
    console.log('3. Make sure the \'claude\' command is available in your terminal');
    console.log(colors.info('\nYou can test by opening a new terminal and typing: claude --version'));
    
    // Ask for completion confirmation
    const completed = await new Promise<boolean>((resolve) => {
      rl.question(colors.highlight('\nHave you completed the installation? (Y/n): '), (answer) => {
        resolve(answer.toLowerCase() !== 'n' && answer.toLowerCase() !== 'no');
      });
    });
    
    if (completed) {
      console.log(colors.success('\n✅ Setup completed successfully!\n'));
      
      // Run doctor again to verify
      console.log(colors.info('Verifying installation...\n'));
      const verifyResult = await runDoctor();
      
      if (verifyResult.canProceed) {
        console.log(colors.success('🎉 Your system is now ready for AI development!'));
        console.log(colors.info('\nYou can now use:'));
        console.log(colors.highlight('  graphyn <your request>    ') + colors.info('Create AI dev squads'));
        console.log(colors.highlight('  graphyn auth              ') + colors.info('Authenticate with Graphyn'));
        console.log(colors.highlight('  graphyn help              ') + colors.info('Show all commands'));
      } else {
        console.log(colors.warning('\n⚠️  Some issues remain. Please check the output above.'));
      }
      
      return true;
    } else {
      console.log(colors.warning('\n⚠️  Setup not completed.'));
      console.log(colors.info('You can run setup again with: ') + colors.highlight('graphyn doctor'));
      return false;
    }
    
  } catch (error) {
    console.error(colors.error('\n❌ Setup failed:'), error instanceof Error ? error.message : error);
    console.log(colors.info('You can run setup again with: ') + colors.highlight('graphyn doctor'));
    return false;
  } finally {
    rl.close();
  }
}

/**
 * Show manual setup instructions
 */
function showManualSetupInstructions(result: any) {
  console.log(colors.bold('\n📋 Manual Setup Instructions:\n'));
  
  if (result.needsClaudeCode) {
    console.log(colors.warning('Claude Code is required:'));
    console.log(colors.info('  1. Visit: ') + colors.highlight('https://claude.ai/download'));
    console.log(colors.info('  2. Download and install Claude for your platform'));
    console.log(colors.info('  3. Make sure the ') + colors.highlight('claude') + colors.info(' command is available in your PATH\n'));
  }
  
  if (result.needsTmux) {
    console.log(colors.warning('tmux is required for squad workspace:'));
    console.log(colors.info('  • macOS: ') + colors.highlight('brew install tmux'));
    console.log(colors.info('  • Ubuntu/Debian: ') + colors.highlight('sudo apt-get install tmux'));
    console.log(colors.info('  • Fedora: ') + colors.highlight('sudo dnf install tmux'));
    console.log(colors.info('  • Arch: ') + colors.highlight('sudo pacman -S tmux\n'));
  }
  
  if (result.needsFigmaMCP) {
    console.log(colors.warning('For design-to-code features (optional):'));
    console.log(colors.info('  1. Install Figma Desktop from: ') + colors.highlight('https://www.figma.com/downloads/'));
    console.log(colors.info('  2. Configure MCP in Claude settings'));
    console.log(colors.info('  3. Run: ') + colors.highlight('graphyn mcp install') + colors.info(' to set up MCP servers\n'));
  }
  
  console.log(colors.info('After installation, run ') + colors.highlight('graphyn doctor') + colors.info(' again to verify.\n'));
}