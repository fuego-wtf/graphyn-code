import chalk from 'chalk';
import { runDoctor } from '../utils/doctor.js';
import { render } from 'ink';
import React from 'react';
import { AutoSetup } from '../ink/components/AutoSetupSimple.js';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold
};

/**
 * Run system diagnostics and offer automatic setup
 */
export async function doctor(options: { skipSetup?: boolean } = {}) {
  console.log(colors.bold('\n🩺 Graphyn Doctor\n'));
  console.log(colors.info('Checking your system for AI development readiness...\n'));
  
  // Run system checks
  const result = await runDoctor();
  
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
    const readline = require('readline').createInterface({
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
 * Launch the automatic setup component
 */
async function launchAutoSetup(doctorResult: any) {
  console.log(colors.info('\n🚀 Starting automatic setup...\n'));
  
  return new Promise((resolve) => {
    const { unmount } = render(
      React.createElement(AutoSetup, {
        needsClaudeCode: doctorResult.needsClaudeCode,
        needsFigmaMCP: doctorResult.needsFigmaMCP,
        onComplete: async () => {
          unmount();
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
          
          resolve(true);
        },
        onCancel: () => {
          unmount();
          console.log(colors.warning('\n⚠️  Setup cancelled.'));
          console.log(colors.info('You can run setup again with: ') + colors.highlight('graphyn doctor'));
          resolve(false);
        }
      })
    );
  });
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