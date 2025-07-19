import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

export interface ClaudeDetectionResult {
  found: boolean;
  path?: string;
  method?: 'PATH' | 'known-location';
  version?: string;
}

/**
 * Detect Claude Code installation across different platforms
 */
export async function findClaude(): Promise<ClaudeDetectionResult> {
  // First, check if 'claude' is available in PATH
  try {
    execSync('which claude', { stdio: 'ignore' });
    return { 
      found: true, 
      path: 'claude',
      method: 'PATH' 
    };
  } catch {
    // Not in PATH, check known installation locations
  }

  // Platform-specific known locations
  const knownLocations = getKnownClaudeLocations();
  
  for (const location of knownLocations) {
    if (fs.existsSync(location)) {
      try {
        // Verify it's executable
        fs.accessSync(location, fs.constants.X_OK);
        return {
          found: true,
          path: location,
          method: 'known-location'
        };
      } catch {
        // File exists but not executable
        continue;
      }
    }
  }

  return { found: false };
}

/**
 * Get platform-specific Claude installation paths
 */
function getKnownClaudeLocations(): string[] {
  const platform = process.platform;
  const homeDir = os.homedir();
  
  const locations: string[] = [];
  
  // Common locations across platforms
  locations.push(path.join(homeDir, '.claude', 'local', 'claude'));
  
  switch (platform) {
    case 'darwin': // macOS
      locations.push(
        '/usr/local/bin/claude',
        '/opt/homebrew/bin/claude',
        path.join(homeDir, 'Applications', 'Claude.app', 'Contents', 'MacOS', 'claude'),
        '/Applications/Claude.app/Contents/MacOS/claude'
      );
      break;
      
    case 'win32': // Windows
      locations.push(
        'C:\\Program Files\\Claude\\claude.exe',
        'C:\\Program Files (x86)\\Claude\\claude.exe',
        path.join(homeDir, 'AppData', 'Local', 'Claude', 'claude.exe'),
        path.join(homeDir, 'AppData', 'Local', 'Programs', 'Claude', 'claude.exe')
      );
      break;
      
    case 'linux':
      locations.push(
        '/usr/bin/claude',
        '/usr/local/bin/claude',
        '/opt/claude/claude',
        path.join(homeDir, '.local', 'bin', 'claude'),
        path.join(homeDir, 'bin', 'claude')
      );
      break;
  }
  
  return locations;
}

/**
 * Get Claude version if possible
 */
export async function getClaudeVersion(claudePath: string): Promise<string | null> {
  try {
    const { execSync } = require('child_process');
    const version = execSync(`"${claudePath}" --version`, { 
      encoding: 'utf8',
      timeout: 5000 
    }).trim();
    return version;
  } catch {
    return null;
  }
}

/**
 * Check if Claude Code is properly configured
 */
export async function isClaudeConfigured(): Promise<boolean> {
  const configPath = path.join(os.homedir(), '.claude', 'config.json');
  return fs.existsSync(configPath);
}

/**
 * Get installation instructions for current platform
 */
export function getInstallInstructions(): string {
  const platform = process.platform;
  
  const baseInstructions = `
Claude Code is not installed or not in your PATH.

To install Claude Code:
1. Visit: https://claude.ai/code
2. Download the installer for your platform
`;

  switch (platform) {
    case 'darwin':
      return baseInstructions + `
3. Open the downloaded .dmg file
4. Drag Claude to your Applications folder
5. Run Claude once to complete setup

To add to PATH (optional):
echo 'export PATH="$HOME/.claude/local:$PATH"' >> ~/.zshrc
source ~/.zshrc`;

    case 'win32':
      return baseInstructions + `
3. Run the downloaded installer
4. Follow the installation wizard
5. The installer should add Claude to your PATH automatically

If Claude is not in PATH after installation:
1. Open System Properties > Environment Variables
2. Add Claude installation directory to PATH

⚠️  Note: Windows support is experimental
PowerShell/cmd compatibility may vary. Consider using WSL for best experience.`;

    case 'linux':
      return baseInstructions + `
3. Extract the downloaded archive
4. Move claude binary to ~/.local/bin/ or /usr/local/bin/
5. Make it executable: chmod +x claude

To add to PATH:
echo 'export PATH="$HOME/.claude/local:$PATH"' >> ~/.bashrc
source ~/.bashrc`;

    default:
      return baseInstructions;
  }
}