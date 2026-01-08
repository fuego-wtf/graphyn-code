import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { colors } from '../ui';

interface MCPConfig {
  mcpServers?: Record<string, any>;
  'chat.mcp.discovery.enabled'?: boolean;
  'chat.agent.enabled'?: boolean;
}

/**
 * Setup MCP server configuration automatically
 */
export async function setupMCPServer(): Promise<boolean> {
  console.log(colors.info('\n🔧 Configuring MCP server...'));
  
  const configPath = path.join(os.homedir(), '.claude', 'mcp_servers.json');
  const configDir = path.dirname(configPath);
  
  try {
    // Create .claude directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(colors.dim(`Created directory: ${configDir}`));
    }
    
    // Check for mcp-proxy executable
    const proxyPath = await findMCPProxy();
    
    if (!proxyPath) {
      console.log(colors.warning('\n⚠️  MCP proxy not found.'));
      console.log(colors.info('To install globally:'));
      console.log(colors.primary('  npm install -g @anthropic-ai/mcp-proxy'));
      console.log();
      console.log(colors.info('Or install locally:'));
      console.log(colors.primary('  npm install @anthropic-ai/mcp-proxy'));
      console.log();
      return false;
    }
    
    console.log(colors.success(`✓ Found MCP proxy: ${proxyPath}`));
    
    // Read existing config or create new
    let config: MCPConfig = {};
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf8');
        config = JSON.parse(content);
        console.log(colors.dim('Loaded existing configuration'));
      } catch (error) {
        console.log(colors.warning('Existing config corrupted, creating new one'));
      }
    }
    
    // Add Figma MCP server configuration
    config.mcpServers = config.mcpServers || {};
    config.mcpServers['figma-proxy'] = {
      command: proxyPath,
      args: ['http://127.0.0.1:3845/sse']
    };
    
    // Enable MCP features
    config['chat.mcp.discovery.enabled'] = true;
    config['chat.agent.enabled'] = true;
    
    // Write configuration
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(colors.success(`✓ Configuration saved to: ${configPath}`));
    
    // Show what was added
    console.log(colors.dim('\nAdded configuration:'));
    console.log(colors.dim(JSON.stringify(config.mcpServers['figma-proxy'], null, 2)));
    
    console.log(colors.info('\n💡 Note: Restart Claude Code to apply these changes.'));
    
    return true;
  } catch (error) {
    console.log(colors.error(`\n✗ Failed to configure MCP: ${error}`));
    return false;
  }
}

/**
 * Find MCP proxy executable
 */
async function findMCPProxy(): Promise<string | null> {
  const possiblePaths = [
    // Local installation
    path.join(os.homedir(), '.local', 'bin', 'mcp-proxy'),
    // Global npm installation
    '/usr/local/bin/mcp-proxy',
    '/usr/bin/mcp-proxy',
    // Windows paths
    'C:\\Program Files\\nodejs\\mcp-proxy.cmd',
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'mcp-proxy.cmd'),
    // macOS Homebrew
    '/opt/homebrew/bin/mcp-proxy',
    // Check node_modules (local installation)
    path.join(process.cwd(), 'node_modules', '.bin', 'mcp-proxy')
  ];
  
  // Check each possible path
  for (const proxyPath of possiblePaths) {
    if (fs.existsSync(proxyPath)) {
      try {
        fs.accessSync(proxyPath, fs.constants.X_OK);
        return proxyPath;
      } catch {
        // File exists but not executable
      }
    }
  }
  
  // Try to find in PATH using 'which' (Unix) or 'where' (Windows)
  try {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'where mcp-proxy' : 'which mcp-proxy';
    const foundPath = execSync(command, { encoding: 'utf8', timeout: 5000 }).trim().split('\n')[0];
    if (foundPath && fs.existsSync(foundPath)) {
      return foundPath;
    }
  } catch {
    // Not in PATH
  }
  
  return null;
}

/**
 * Check if MCP is properly configured
 */
export async function checkMCPConfiguration(): Promise<{
  configured: boolean;
  hasProxy: boolean;
  hasFigmaServer: boolean;
  error?: string;
}> {
  const configPath = path.join(os.homedir(), '.claude', 'mcp_servers.json');
  
  const result = {
    configured: false,
    hasProxy: false,
    hasFigmaServer: false
  };
  
  // Check if config exists
  if (!fs.existsSync(configPath)) {
    return { ...result, error: 'Configuration file not found' };
  }
  
  try {
    // Parse config
    const content = fs.readFileSync(configPath, 'utf8');
    const config: MCPConfig = JSON.parse(content);
    
    result.configured = true;
    
    // Check for Figma server
    if (config.mcpServers) {
      result.hasFigmaServer = !!(config.mcpServers['figma-proxy'] || config.mcpServers['figma-dev-mode-mcp-server']);
    }
    
    // Check if proxy exists
    const proxyPath = await findMCPProxy();
    result.hasProxy = !!proxyPath;
    
    return result;
  } catch (error) {
    return { ...result, error: `Failed to parse config: ${error}` };
  }
}