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
      '~/.local/bin/claude',
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
EOF < /dev/null