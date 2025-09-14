/**
 * MCP Server Auto-Installer with Validation
 * 
 * Automatically installs missing MCP servers using NPX and validates
 * they can start properly before being passed to Claude Code SDK.
 */

import { spawn, execSync, exec, ChildProcess } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { getMCPServerConfig, buildMCPServerCommand, type MCPServer, type MCPServerConfig } from './server-registry.js';

const execAsync = promisify(exec);

interface InstallationResult {
  success: boolean;
  serverName: string;
  package: string;
  version?: string;
  error?: string;
  duration: number;
}

interface ValidationResult {
  success: boolean;
  serverName: string;
  error?: string;
  capabilities?: string[];
  duration: number;
}

/**
 * Check if MCP server is installed locally
 */
export async function checkMCPServerInstalled(serverName: string): Promise<boolean> {
  const config = getMCPServerConfig(serverName);
  if (!config) return false;

  try {
    // Method 1: Check in node_modules/.bin for npx-installed servers
    const npmPath = path.join(process.cwd(), 'node_modules', '.bin', config.package);
    try {
      await fs.access(npmPath);
      return true;
    } catch {
      // Continue to next check
    }

    // Method 2: Check global npm packages
    try {
      const { stdout } = await execAsync(`npm list -g ${config.package} --depth=0`);
      return stdout.includes(config.package);
    } catch {
      // Continue to next check
    }

    // Method 3: Try npx dry-run to see if package exists
    try {
      const { stdout } = await execAsync(`npx --dry-run ${config.package} --help`, {
        timeout: 5000
      });
      return !stdout.includes('not found') && !stdout.includes('Unable to resolve');
    } catch {
      return false;
    }
  } catch (error) {
    console.warn(`Error checking installation for ${serverName}:`, error);
    return false;
  }
}

/**
 * Auto-install MCP server if missing using NPX
 */
export async function autoInstallMCPServer(
  serverName: string,
  options: {
    force?: boolean;
    timeout?: number;
    silent?: boolean;
  } = {}
): Promise<InstallationResult> {
  const startTime = Date.now();
  const config = getMCPServerConfig(serverName);
  
  if (!config) {
    return {
      success: false,
      serverName,
      package: 'unknown',
      error: `Server '${serverName}' not found in registry`,
      duration: Date.now() - startTime
    };
  }

  if (!options.silent) {
    console.log(`📦 Installing MCP server: ${config.package}...`);
  }

  try {
    // Check if already installed (unless force)
    if (!options.force && await checkMCPServerInstalled(serverName)) {
      if (!options.silent) {
        console.log(`✅ MCP server ${config.package} already available`);
      }
      
      return {
        success: true,
        serverName,
        package: config.package,
        duration: Date.now() - startTime
      };
    }

    // Use npx with -y flag for automatic installation without prompts
    const installCommand = `npx -y ${config.package} --version`;
    
    const { stdout, stderr } = await execAsync(installCommand, {
      timeout: options.timeout || 30000, // 30 second timeout
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
    // Try to extract version from output
    const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/);
    const version = versionMatch ? versionMatch[1] : undefined;
    
    if (!options.silent) {
      console.log(`✅ MCP server ${config.package} ready${version ? ` (v${version})` : ''}`);
    }

    return {
      success: true,
      serverName,
      package: config.package,
      version,
      duration: Date.now() - startTime
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (!options.silent) {
      console.warn(`⚠️ Could not auto-install ${config.package}: ${errorMessage}`);
      console.warn('Will attempt runtime installation with npx -y');
    }

    // This isn't a hard failure - NPX will try to install at runtime
    return {
      success: false,
      serverName,
      package: config.package,
      error: `Installation warning: ${errorMessage}`,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Validate MCP server can start and respond
 */
export async function validateMCPServerStartup(
  serverName: string,
  server: MCPServer,
  options: {
    timeout?: number;
    silent?: boolean;
  } = {}
): Promise<ValidationResult> {
  const startTime = Date.now();
  const config = getMCPServerConfig(serverName);
  
  if (!config) {
    return {
      success: false,
      serverName,
      error: `Server '${serverName}' not found in registry`,
      duration: Date.now() - startTime
    };
  }

  if (!options.silent) {
    console.log(`🔧 Validating MCP server: ${serverName}...`);
  }

  try {
    // Test if server can be spawned with --help flag
    const testArgs = [...server.args, '--help'];
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        testProcess?.kill();
        resolve({
          success: false,
          serverName,
          error: `Validation timeout after ${options.timeout || 5000}ms`,
          duration: Date.now() - startTime
        });
      }, options.timeout || 5000);

      let testProcess: ChildProcess | null = null;
      
      try {
        testProcess = spawn(server.command, testArgs, {
          env: { ...process.env, ...server.env },
          cwd: server.working_directory || process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        testProcess.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        testProcess.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        testProcess.on('exit', (code) => {
          clearTimeout(timeout);
          
          // Exit code 0 or help output indicates successful validation
          const hasHelpOutput = stdout.includes('help') || stdout.includes('usage') || stdout.includes('options');
          const isSuccess = code === 0 || hasHelpOutput;
          
          if (!options.silent && isSuccess) {
            console.log(`✅ MCP server '${serverName}' validated successfully`);
          }
          
          resolve({
            success: isSuccess,
            serverName,
            error: isSuccess ? undefined : `Exit code ${code}: ${stderr}`,
            capabilities: config.tools,
            duration: Date.now() - startTime
          });
        });

        testProcess.on('error', (error) => {
          clearTimeout(timeout);
          resolve({
            success: false,
            serverName,
            error: error.message,
            duration: Date.now() - startTime
          });
        });

      } catch (error) {
        clearTimeout(timeout);
        resolve({
          success: false,
          serverName,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime
        });
      }
    });

  } catch (error) {
    return {
      success: false,
      serverName,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime
    };
  }
}

/**
 * Install and validate multiple MCP servers
 */
export async function installAndValidateMCPServers(
  serverNames: string[],
  options: {
    parallel?: boolean;
    timeout?: number;
    silent?: boolean;
    skipValidation?: boolean;
  } = {}
): Promise<{
  installations: InstallationResult[];
  validations: ValidationResult[];
  successCount: number;
  failureCount: number;
}> {
  const installations: InstallationResult[] = [];
  const validations: ValidationResult[] = [];

  if (!options.silent) {
    console.log(`🚀 Installing ${serverNames.length} MCP servers...`);
  }

  // Install servers (parallel or sequential)
  if (options.parallel) {
    const installPromises = serverNames.map(serverName => 
      autoInstallMCPServer(serverName, options)
    );
    installations.push(...await Promise.all(installPromises));
  } else {
    for (const serverName of serverNames) {
      const result = await autoInstallMCPServer(serverName, options);
      installations.push(result);
    }
  }

  // Validate servers if not skipped
  if (!options.skipValidation) {
    for (const installation of installations) {
      if (installation.success) {
        const config = getMCPServerConfig(installation.serverName);
        if (config) {
          const server = buildMCPServerCommand(installation.serverName, config);
          const validation = await validateMCPServerStartup(
            installation.serverName,
            server,
            options
          );
          validations.push(validation);
        }
      }
    }
  }

  const successCount = installations.filter(i => i.success).length;
  const failureCount = installations.length - successCount;

  if (!options.silent) {
    console.log(`✨ MCP installation complete: ${successCount} success, ${failureCount} failed`);
  }

  return {
    installations,
    validations,
    successCount,
    failureCount
  };
}

/**
 * Get installation status for all servers
 */
export async function getMCPInstallationStatus(serverNames: string[]): Promise<Record<string, {
  installed: boolean;
  config: MCPServerConfig | undefined;
  package: string;
}>> {
  const status: Record<string, {
    installed: boolean;
    config: MCPServerConfig | undefined;
    package: string;
  }> = {};

  for (const serverName of serverNames) {
    const config = getMCPServerConfig(serverName);
    const installed = config ? await checkMCPServerInstalled(serverName) : false;
    
    status[serverName] = {
      installed,
      config,
      package: config?.package || 'unknown'
    };
  }

  return status;
}

/**
 * Cleanup function to terminate any running validation processes
 */
export function cleanup(): void {
  // Any cleanup logic for running processes would go here
  // For now, child processes are managed within their respective promises
}
