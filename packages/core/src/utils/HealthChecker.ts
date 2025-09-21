/**
 * Health Checker - Comprehensive system diagnostics and health monitoring
 * 
 * Provides system validation, dependency checks, and health diagnostics
 * for the complete Graphyn orchestration platform.
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  duration?: number;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  summary: {
    healthy: number;
    warnings: number;
    errors: number;
    total: number;
  };
  systemInfo: {
    platform: string;
    nodeVersion: string;
    memory: {
      total: number;
      free: number;
      used: number;
    };
    cpu: {
      cores: number;
      load: number[];
    };
    uptime: number;
  };
  timestamp: Date;
}

export class HealthChecker {
  private readonly timeout: number;

  constructor(timeout = 5000) {
    this.timeout = timeout;
  }

  /**
   * Run comprehensive health check
   */
  async checkSystemHealth(): Promise<SystemHealth> {
    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];

    // Core system checks
    checks.push(await this.checkNodeVersion());
    checks.push(await this.checkMemoryUsage());
    checks.push(await this.checkDiskSpace());
    checks.push(await this.checkNetworkConnectivity());

    // Graphyn-specific checks
    checks.push(await this.checkGraphynDirectories());
    checks.push(await this.checkDatabaseConnectivity());
    checks.push(await this.checkMCPServer());
    checks.push(await this.checkClaudeCLI());

    // Development dependencies
    checks.push(await this.checkGitRepository());
    checks.push(await this.checkPackageManager());
    checks.push(await this.checkBuildTools());

    // Security checks
    checks.push(await this.checkPermissions());
    checks.push(await this.checkEnvironmentVariables());

    // Calculate summary
    const summary = {
      healthy: checks.filter(c => c.status === 'healthy').length,
      warnings: checks.filter(c => c.status === 'warning').length,
      errors: checks.filter(c => c.status === 'error').length,
      total: checks.length
    };

    // Determine overall health
    let overall: SystemHealth['overall'] = 'healthy';
    if (summary.errors > 0) {
      overall = 'unhealthy';
    } else if (summary.warnings > 0) {
      overall = 'degraded';
    }

    return {
      overall,
      checks,
      summary,
      systemInfo: await this.getSystemInfo(),
      timestamp: new Date()
    };
  }

  /**
   * Check specific component health
   */
  async checkComponent(component: string): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      switch (component) {
        case 'node':
          return await this.checkNodeVersion();
        case 'memory':
          return await this.checkMemoryUsage();
        case 'disk':
          return await this.checkDiskSpace();
        case 'network':
          return await this.checkNetworkConnectivity();
        case 'directories':
          return await this.checkGraphynDirectories();
        case 'database':
          return await this.checkDatabaseConnectivity();
        case 'mcp':
          return await this.checkMCPServer();
        case 'claude':
          return await this.checkClaudeCLI();
        case 'git':
          return await this.checkGitRepository();
        case 'npm':
          return await this.checkPackageManager();
        case 'build':
          return await this.checkBuildTools();
        case 'permissions':
          return await this.checkPermissions();
        case 'env':
          return await this.checkEnvironmentVariables();
        default:
          return {
            component,
            status: 'error',
            message: `Unknown component: ${component}`,
            timestamp: new Date(),
            duration: Date.now() - startTime
          };
      }
    } catch (error) {
      return {
        component,
        status: 'error',
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    }
  }

  // Individual health check methods
  private async checkNodeVersion(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);

    return {
      component: 'node',
      status: majorVersion >= 18 ? 'healthy' : majorVersion >= 16 ? 'warning' : 'error',
      message: majorVersion >= 18 
        ? `Node.js ${nodeVersion} is supported`
        : majorVersion >= 16
          ? `Node.js ${nodeVersion} works but v18+ recommended`
          : `Node.js ${nodeVersion} is outdated, v18+ required`,
      details: { version: nodeVersion, majorVersion },
      timestamp: new Date(),
      duration: Date.now() - startTime
    };
  }

  private async checkMemoryUsage(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedPercent = ((totalMemory - freeMemory) / totalMemory) * 100;

    return {
      component: 'memory',
      status: usedPercent < 80 ? 'healthy' : usedPercent < 90 ? 'warning' : 'error',
      message: `Memory usage: ${usedPercent.toFixed(1)}%`,
      details: {
        total: Math.round(totalMemory / 1024 / 1024),
        free: Math.round(freeMemory / 1024 / 1024),
        used: Math.round((totalMemory - freeMemory) / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024)
      },
      timestamp: new Date(),
      duration: Date.now() - startTime
    };
  }

  private async checkDiskSpace(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Check if statfs is available (Node.js filesystem stats)
      const stats = await fs.statfs('.');
      
      // Use correct StatsFs properties
      const blockSize = stats.bsize || 4096; // Default block size if not available
      const total = stats.blocks * blockSize;
      const free = stats.bavail * blockSize;
      const used = total - free;
      const usedPercent = total > 0 ? (used / total) * 100 : 0;

      return {
        component: 'disk',
        status: usedPercent < 80 ? 'healthy' : usedPercent < 90 ? 'warning' : 'error',
        message: `Disk usage: ${usedPercent.toFixed(1)}%`,
        details: {
          total: Math.round(total / 1024 / 1024 / 1024),
          free: Math.round(free / 1024 / 1024 / 1024),
          used: Math.round(used / 1024 / 1024 / 1024),
          blockSize
        },
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    } catch {
      return {
        component: 'disk',
        status: 'warning',
        message: 'Could not check disk space on this platform',
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    }
  }

  private async checkNetworkConnectivity(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const testUrls = ['https://api.anthropic.com', 'https://github.com', 'https://registry.npmjs.org'];
      const results = await Promise.allSettled(
        testUrls.map(url => 
          Promise.race([
            fetch(url, { method: 'HEAD' }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), this.timeout)
            )
          ])
        )
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const total = results.length;

      return {
        component: 'network',
        status: successful === total ? 'healthy' : successful > 0 ? 'warning' : 'error',
        message: `Network connectivity: ${successful}/${total} endpoints reachable`,
        details: { successful, total, tested: testUrls },
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        component: 'network',
        status: 'error',
        message: `Network check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    }
  }

  private async checkGraphynDirectories(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const homeDir = os.homedir();
    const graphynDir = path.join(homeDir, '.graphyn');

    try {
      const exists = await fs.access(graphynDir).then(() => true).catch(() => false);
      
      if (!exists) {
        return {
          component: 'directories',
          status: 'warning',
          message: 'Graphyn user directory not initialized',
          details: { path: graphynDir },
          timestamp: new Date(),
          duration: Date.now() - startTime
        };
      }

      const stats = await fs.stat(graphynDir);
      return {
        component: 'directories',
        status: 'healthy',
        message: 'Graphyn directories accessible',
        details: { 
          path: graphynDir,
          created: stats.birthtime,
          modified: stats.mtime
        },
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        component: 'directories',
        status: 'error',
        message: `Directory check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    }
  }

  private async checkDatabaseConnectivity(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Check if SQLite database file exists or can be created
      const testDbPath = path.join(os.tmpdir(), 'health-check.db');
      
      // Try to write a small test file to verify database directory is writable
      await fs.writeFile(testDbPath, '');
      await fs.unlink(testDbPath);

      return {
        component: 'database',
        status: 'healthy',
        message: 'Database directory is writable',
        details: { testPath: testDbPath },
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        component: 'database',
        status: 'error',
        message: `Database check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    }
  }

  private async checkMCPServer(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const mcpServerPath = path.join(process.cwd(), 'services/mcp/dist/index.js');
      const exists = await fs.access(mcpServerPath).then(() => true).catch(() => false);

      return {
        component: 'mcp',
        status: exists ? 'healthy' : 'warning',
        message: exists ? 'MCP server binary available' : 'MCP server not built',
        details: { path: mcpServerPath, exists },
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        component: 'mcp',
        status: 'error',
        message: `MCP server check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    }
  }

  private async checkClaudeCLI(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const result = await this.runCommand('claude', ['--version']);
      
      return {
        component: 'claude',
        status: result.success ? 'healthy' : 'warning',
        message: result.success 
          ? `Claude CLI available: ${result.output.trim()}`
          : 'Claude CLI not found (will use simulation mode)',
        details: result,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        component: 'claude',
        status: 'warning',
        message: 'Claude CLI not available (will use simulation mode)',
        details: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    }
  }

  private async checkGitRepository(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const result = await this.runCommand('git', ['status', '--porcelain']);
      const isRepo = result.success;

      return {
        component: 'git',
        status: isRepo ? 'healthy' : 'warning',
        message: isRepo ? 'Git repository detected' : 'Not a git repository',
        details: { isRepository: isRepo, hasChanges: result.output.length > 0 },
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        component: 'git',
        status: 'warning',
        message: 'Git not available',
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    }
  }

  private async checkPackageManager(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const managers = ['npm', 'yarn', 'pnpm'];
    const available = [];

    for (const manager of managers) {
      try {
        const result = await this.runCommand(manager, ['--version']);
        if (result.success) {
          available.push({ name: manager, version: result.output.trim() });
        }
      } catch {
        // Manager not available
      }
    }

    return {
      component: 'npm',
      status: available.length > 0 ? 'healthy' : 'error',
      message: available.length > 0 
        ? `Package managers: ${available.map(a => `${a.name}@${a.version}`).join(', ')}`
        : 'No package manager found',
      details: { available },
      timestamp: new Date(),
      duration: Date.now() - startTime
    };
  }

  private async checkBuildTools(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const packageJsonExists = await fs.access('package.json').then(() => true).catch(() => false);
      const tsconfigExists = await fs.access('tsconfig.json').then(() => true).catch(() => false);
      
      if (!packageJsonExists) {
        return {
          component: 'build',
          status: 'warning',
          message: 'No package.json found',
          timestamp: new Date(),
          duration: Date.now() - startTime
        };
      }

      const pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'));
      const hasBuildScript = !!pkg.scripts?.build;
      const hasTypeScript = !!pkg.devDependencies?.typescript;

      return {
        component: 'build',
        status: hasBuildScript ? 'healthy' : 'warning',
        message: hasBuildScript ? 'Build configuration available' : 'No build script found',
        details: {
          hasBuildScript,
          hasTypeScript,
          tsconfigExists,
          buildScript: pkg.scripts?.build
        },
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        component: 'build',
        status: 'error',
        message: `Build tools check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    }
  }

  private async checkPermissions(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Test write permissions in current directory
      const testFile = path.join(process.cwd(), '.health-check-temp');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);

      return {
        component: 'permissions',
        status: 'healthy',
        message: 'File system permissions OK',
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        component: 'permissions',
        status: 'error',
        message: `Permission check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    }
  }

  private async checkEnvironmentVariables(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const requiredEnvVars = ['NODE_ENV'];
    const recommendedEnvVars = ['ANTHROPIC_API_KEY', 'DATABASE_URL'];
    
    const missing = requiredEnvVars.filter(env => !process.env[env]);
    const missingRecommended = recommendedEnvVars.filter(env => !process.env[env]);

    let status: HealthCheckResult['status'] = 'healthy';
    let message = 'Environment variables configured';

    if (missing.length > 0) {
      status = 'error';
      message = `Missing required environment variables: ${missing.join(', ')}`;
    } else if (missingRecommended.length > 0) {
      status = 'warning';
      message = `Missing recommended environment variables: ${missingRecommended.join(', ')}`;
    }

    return {
      component: 'env',
      status,
      message,
      details: {
        required: requiredEnvVars,
        recommended: recommendedEnvVars,
        missing,
        missingRecommended
      },
      timestamp: new Date(),
      duration: Date.now() - startTime
    };
  }

  private async getSystemInfo() {
    const memInfo = process.memoryUsage();
    
    return {
      platform: `${os.type()} ${os.release()} ${os.arch()}`,
      nodeVersion: process.version,
      memory: {
        total: Math.round(os.totalmem() / 1024 / 1024),
        free: Math.round(os.freemem() / 1024 / 1024),
        used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)
      },
      cpu: {
        cores: os.cpus().length,
        load: os.loadavg()
      },
      uptime: Math.round(os.uptime())
    };
  }

  private async runCommand(command: string, args: string[]): Promise<{
    success: boolean;
    output: string;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const child = spawn(command, args, { stdio: 'pipe' });
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr || undefined
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          output: '',
          error: error.message
        });
      });

      // Timeout handling
      setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          output: stdout,
          error: `Command timed out after ${this.timeout}ms`
        });
      }, this.timeout);
    });
  }
}