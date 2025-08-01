import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function detectClaude(): Promise<boolean> {
  try {
    // Check if claude command exists
    await execAsync('which claude');
    return true;
  } catch {
    // Check common installation paths
    const paths = [
      '/usr/local/bin/claude',
      '/usr/bin/claude',
      `${process.env.HOME}/.local/bin/claude`,
      `${process.env.HOME}/.claude/local/claude`,
      '/opt/claude/bin/claude'
    ];
    
    for (const path of paths) {
      try {
        await execAsync(`test -f ${path}`);
        return true;
      } catch {
        // Continue checking
      }
    }
    
    return false;
  }
}

export interface ClaudeResult {
  found: boolean;
  path: string | null;
}

export async function findClaude(): Promise<ClaudeResult> {
  try {
    const { stdout } = await execAsync('which claude');
    return { found: true, path: stdout.trim() };
  } catch {
    // Check common installation paths
    const paths = [
      '/usr/local/bin/claude',
      '/usr/bin/claude',
      `${process.env.HOME}/.local/bin/claude`,
      `${process.env.HOME}/.claude/local/claude`,
      '/opt/claude/bin/claude'
    ];
    
    for (const path of paths) {
      try {
        await execAsync(`test -f ${path}`);
        return { found: true, path };
      } catch {
        // Continue checking
      }
    }
    
    return { found: false, path: null };
  }
}