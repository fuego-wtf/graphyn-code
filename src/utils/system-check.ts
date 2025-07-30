import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export interface QuietDoctorResult {
  canProceed: boolean;
  needsClaudeCode: boolean;
  needsTmux: boolean;
  needsFigmaMCP: boolean;
}

/**
 * Silently check system requirements without any console output
 */
export async function checkSystemRequirements(): Promise<QuietDoctorResult> {
  let hasNode = false;
  let hasClaudeCode = false;
  let hasTmux = false;
  
  // Check Node.js
  try {
    const { stdout } = await execAsync('node --version');
    const version = stdout.trim();
    const major = parseInt(version.split('.')[0].substring(1));
    hasNode = major >= 16;
  } catch {
    hasNode = false;
  }
  
  // Check tmux
  try {
    await execAsync('tmux -V');
    hasTmux = true;
  } catch {
    hasTmux = false;
  }
  
  // Check Claude Code in various locations
  const claudeCommands = ['claude', 'claude-code', 'claudecode'];
  const homeDir = os.homedir();
  const additionalPaths = [
    path.join(homeDir, '.claude', 'local', 'claude'),
    path.join(homeDir, '.local', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/opt/claude/claude'
  ];
  
  // Check standard commands
  for (const cmd of claudeCommands) {
    try {
      await execAsync(`which ${cmd}`);
      hasClaudeCode = true;
      break;
    } catch {
      // Continue checking
    }
  }
  
  // Check additional paths if not found
  if (!hasClaudeCode) {
    for (const claudePath of additionalPaths) {
      try {
        await fs.access(claudePath, fs.constants.X_OK);
        hasClaudeCode = true;
        break;
      } catch {
        // Continue checking
      }
    }
  }
  
  return {
    canProceed: hasNode && hasClaudeCode && hasTmux,
    needsClaudeCode: !hasClaudeCode,
    needsTmux: !hasTmux,
    needsFigmaMCP: false // Optional, don't block on this
  };
}