/**
 * Claude Code SDK Diagnostics and Health Checks
 * 
 * Comprehensive diagnostics for Claude Code SDK configuration,
 * API connectivity, and environment requirements.
 */

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

export interface SDKDiagnosticResult {
  category: string;
  test: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: string;
  fix?: string;
}

export interface SDKHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  canProceed: boolean;
  results: SDKDiagnosticResult[];
  recommendations: string[];
}

/**
 * Run comprehensive Claude Code SDK diagnostics
 */
export async function runSDKDiagnostics(): Promise<SDKHealthReport> {
  const results: SDKDiagnosticResult[] = [];
  
  console.log(chalk.cyan('\n🔍 Running Claude Code SDK diagnostics...\n'));
  
  // Test 1: Check Node.js version
  await checkNodeVersion(results);
  
  // Test 2: Check Claude Code SDK installation
  await checkSDKInstallation(results);
  
  // Test 3: Check API key configuration
  await checkAPIConfiguration(results);
  
  // Test 4: Test basic SDK functionality
  await testBasicSDKFunction(results);
  
  // Test 5: Check network connectivity
  await checkNetworkConnectivity(results);
  
  // Test 6: Check Claude CLI binary (optional)
  await checkClaudeCLI(results);
  
  // Test 7: Check environment variables
  await checkEnvironmentVariables(results);
  
  // Analyze results and generate report
  return analyzeResults(results);
}

/**
 * Check Node.js version compatibility
 */
async function checkNodeVersion(results: SDKDiagnosticResult[]): Promise<void> {
  try {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);
    
    if (major >= 18) {
      results.push({
        category: 'Environment',
        test: 'Node.js Version',
        status: 'pass',
        message: `Node.js ${version} is compatible`,
        details: 'Claude Code SDK requires Node.js 18 or higher'
      });
    } else {
      results.push({
        category: 'Environment',
        test: 'Node.js Version',
        status: 'fail',
        message: `Node.js ${version} is too old`,
        details: 'Claude Code SDK requires Node.js 18 or higher',
        fix: 'Upgrade Node.js to version 18 or higher'
      });
    }
  } catch (error) {
    results.push({
      category: 'Environment',
      test: 'Node.js Version',
      status: 'fail',
      message: 'Failed to check Node.js version',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Check Claude Code SDK installation
 */
async function checkSDKInstallation(results: SDKDiagnosticResult[]): Promise<void> {
  try {
    // Check if package is installed
    const { stdout } = await execAsync('npm list @anthropic-ai/claude-code', { cwd: process.cwd() });
    
    if (stdout.includes('@anthropic-ai/claude-code')) {
      const versionMatch = stdout.match(/@anthropic-ai\/claude-code@([^\s]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';
      
      results.push({
        category: 'SDK',
        test: 'Package Installation',
        status: 'pass',
        message: `@anthropic-ai/claude-code@${version} is installed`,
        details: 'SDK package found in node_modules'
      });
    } else {
      results.push({
        category: 'SDK',
        test: 'Package Installation',
        status: 'fail',
        message: '@anthropic-ai/claude-code is not installed',
        fix: 'Run: npm install @anthropic-ai/claude-code'
      });
    }
  } catch (error) {
    results.push({
      category: 'SDK',
      test: 'Package Installation',
      status: 'fail',
      message: 'Failed to check SDK installation',
      details: error instanceof Error ? error.message : String(error),
      fix: 'Run: npm install @anthropic-ai/claude-code'
    });
  }
}

/**
 * Check API configuration and credentials
 */
async function checkAPIConfiguration(results: SDKDiagnosticResult[]): Promise<void> {
  try {
    // Check for Claude CLI session authentication (preferred method)
    // API key is NOT required when Claude CLI is authenticated
    try {
      const { stdout: claudeAuth } = await execAsync('claude whoami', { timeout: 5000 });
      if (claudeAuth.trim() && !claudeAuth.includes('error') && !claudeAuth.includes('not authenticated')) {
        results.push({
          category: 'API',
          test: 'Claude Authentication',
          status: 'pass',
          message: 'Claude CLI authenticated (session-based auth - no API key required)',
          details: `Authenticated user: ${claudeAuth.trim()}`
        });
      } else {
        throw new Error('Claude CLI not authenticated');
      }
    } catch (error) {
      // Fallback: Check if API key is provided (optional)
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (anthropicKey && anthropicKey.startsWith('sk-ant-')) {
        results.push({
          category: 'API',
          test: 'API Key Fallback',
          status: 'pass',
          message: 'API key configured as fallback authentication',
          details: `Key format: sk-ant-***${anthropicKey.slice(-8)}`
        });
      } else {
        results.push({
          category: 'API',
          test: 'Authentication',
          status: 'warn',
          message: 'Claude CLI not authenticated and no API key found',
          details: 'Claude Code SDK works best with Claude CLI authentication',
          fix: 'Run "claude login" to authenticate (preferred) or set ANTHROPIC_API_KEY'
        });
      }
    }
    
    // Check Claude Desktop configuration directory
    const configPath = process.platform === 'darwin' 
      ? `${process.env.HOME}/.config/claude/claude_desktop_config.json`
      : process.platform === 'win32'
        ? `${process.env.APPDATA}/claude/claude_desktop_config.json`
        : `${process.env.HOME}/.config/claude/claude_desktop_config.json`;
    
    try {
      await fs.access(configPath);
      results.push({
        category: 'API',
        test: 'Claude Desktop Config',
        status: 'pass',
        message: 'Claude Desktop configuration file found',
        details: `Config at: ${configPath}`
      });
    } catch {
      results.push({
        category: 'API',
        test: 'Claude Desktop Config',
        status: 'warn',
        message: 'Claude Desktop configuration not found',
        details: 'This may affect Claude CLI integration',
        fix: 'Install Claude Desktop app and configure API access'
      });
    }
    
  } catch (error) {
    results.push({
      category: 'API',
      test: 'API Configuration',
      status: 'fail',
      message: 'Failed to check API configuration',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Test basic SDK functionality
 */
async function testBasicSDKFunction(results: SDKDiagnosticResult[]): Promise<void> {
  try {
    // Try to import the SDK
    const { ClaudeCodeClient } = await import('../sdk/claude-code-client.js');
    
    results.push({
      category: 'SDK',
      test: 'Module Import',
      status: 'pass',
      message: 'ClaudeCodeClient can be imported successfully',
      details: 'SDK module is accessible'
    });
    
    // Try to create a client instance
    try {
      const client = new ClaudeCodeClient();
      
      results.push({
        category: 'SDK',
        test: 'Client Creation',
        status: 'pass',
        message: 'ClaudeCodeClient can be instantiated',
        details: 'SDK client object created successfully'
      });
      
      // Test with a minimal query (with short timeout)
      try {
        const abortController = new AbortController();
        setTimeout(() => abortController.abort(), 5000); // 5 second timeout
        
        let hasResponse = false;
        const testPromise = (async () => {
          for await (const message of client.executeQueryStream('Say "Hello test"', {
            abortController,
            maxTurns: 1,
            allowedTools: []
          })) {
            hasResponse = true;
            if (message.type === 'result') {
              break;
            }
          }
        })();
        
        await Promise.race([
          testPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Test timeout')), 5000))
        ]);
        
        if (hasResponse) {
          results.push({
            category: 'SDK',
            test: 'Basic Query Test',
            status: 'pass',
            message: 'SDK can execute basic queries',
            details: 'Successfully executed test query'
          });
        } else {
          results.push({
            category: 'SDK',
            test: 'Basic Query Test',
            status: 'warn',
            message: 'SDK query completed but no response received',
            details: 'May indicate API or configuration issues'
          });
        }
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        if (errorMsg.includes('timeout') || errorMsg.includes('aborted')) {
          results.push({
            category: 'SDK',
            test: 'Basic Query Test',
            status: 'fail',
            message: 'SDK query timed out',
            details: 'Unable to complete test query within 5 seconds',
            fix: 'Check API key and network connectivity'
          });
        } else {
          results.push({
            category: 'SDK',
            test: 'Basic Query Test',
            status: 'fail',
            message: 'SDK query failed',
            details: errorMsg,
            fix: 'Verify API configuration and network access'
          });
        }
      }
      
    } catch (error) {
      results.push({
        category: 'SDK',
        test: 'Client Creation',
        status: 'fail',
        message: 'Failed to create ClaudeCodeClient',
        details: error instanceof Error ? error.message : String(error),
        fix: 'Check SDK installation and dependencies'
      });
    }
    
  } catch (error) {
    results.push({
      category: 'SDK',
      test: 'Module Import',
      status: 'fail',
      message: 'Failed to import ClaudeCodeClient',
      details: error instanceof Error ? error.message : String(error),
      fix: 'Reinstall the Claude Code SDK package'
    });
  }
}

/**
 * Check network connectivity to Anthropic API
 */
async function checkNetworkConnectivity(results: SDKDiagnosticResult[]): Promise<void> {
  try {
    const response = await fetch('https://api.anthropic.com', {
      method: 'GET',
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    results.push({
      category: 'Network',
      test: 'API Connectivity',
      status: 'pass',
      message: 'Can reach Anthropic API endpoints',
      details: `Status: ${response.status} ${response.statusText}`
    });
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    results.push({
      category: 'Network',
      test: 'API Connectivity',
      status: 'fail',
      message: 'Cannot reach Anthropic API',
      details: errorMsg,
      fix: 'Check internet connection and firewall settings'
    });
  }
}

/**
 * Check Claude CLI binary availability (optional)
 */
async function checkClaudeCLI(results: SDKDiagnosticResult[]): Promise<void> {
  try {
    const { stdout } = await execAsync('which claude', { timeout: 5000 });
    
    if (stdout.trim()) {
      try {
        const { stdout: versionOutput } = await execAsync('claude --version', { timeout: 5000 });
        
        results.push({
          category: 'CLI',
          test: 'Claude CLI Binary',
          status: 'pass',
          message: `Claude CLI is available at ${stdout.trim()}`,
          details: `Version: ${versionOutput.trim()}`
        });
      } catch {
        results.push({
          category: 'CLI',
          test: 'Claude CLI Binary',
          status: 'warn',
          message: 'Claude CLI found but version check failed',
          details: `Binary at: ${stdout.trim()}`,
          fix: 'Verify Claude CLI installation'
        });
      }
    }
    
  } catch (error) {
    results.push({
      category: 'CLI',
      test: 'Claude CLI Binary',
      status: 'warn',
      message: 'Claude CLI binary not found in PATH',
      details: 'This is optional - SDK can work without CLI binary',
      fix: 'Install Claude CLI if terminal integration is needed'
    });
  }
}

/**
 * Check relevant environment variables
 */
async function checkEnvironmentVariables(results: SDKDiagnosticResult[]): Promise<void> {
  const envVars = [
    'NODE_ENV',
    'DEBUG',
    'CLAUDE_API_KEY', // Alternative API key name
    'ANTHROPIC_API_KEY',
    'HOME',
    'PATH'
  ];
  
  const foundVars: string[] = [];
  const missingVars: string[] = [];
  
  for (const varName of envVars) {
    if (process.env[varName]) {
      foundVars.push(`${varName}=${varName.includes('KEY') ? '[REDACTED]' : process.env[varName]}`);
    } else if (varName === 'ANTHROPIC_API_KEY') {
      // ANTHROPIC_API_KEY is optional - Claude CLI session auth is preferred
      // Don't treat this as a missing requirement
    }
  }
  
  if (foundVars.length > 0) {
    results.push({
      category: 'Environment',
      test: 'Environment Variables',
      status: 'pass',
      message: `Found ${foundVars.length} relevant environment variables`,
      details: foundVars.join(', ')
    });
  }
  
  if (missingVars.length > 0) {
    results.push({
      category: 'Environment',
      test: 'Required Variables',
      status: 'fail',
      message: `Missing required environment variables: ${missingVars.join(', ')}`,
      fix: 'Set the missing environment variables'
    });
  }
}

/**
 * Analyze diagnostic results and generate health report
 */
function analyzeResults(results: SDKDiagnosticResult[]): SDKHealthReport {
  const passCount = results.filter(r => r.status === 'pass').length;
  const warnCount = results.filter(r => r.status === 'warn').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  
  let overall: 'healthy' | 'degraded' | 'unhealthy';
  let canProceed = true;
  
  // Determine overall health
  if (failCount === 0) {
    overall = warnCount === 0 ? 'healthy' : 'degraded';
  } else {
    overall = 'unhealthy';
    
    // Check if critical failures prevent operation
    const criticalFailures = results.filter(r => 
      r.status === 'fail' && (
        r.test.includes('API Key') ||
        r.test.includes('Package Installation') ||
        r.test.includes('Node.js Version')
      )
    );
    
    canProceed = criticalFailures.length === 0;
  }
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (failCount > 0) {
    recommendations.push(`Fix ${failCount} critical issue${failCount > 1 ? 's' : ''} before proceeding`);
  }
  
  if (warnCount > 0) {
    recommendations.push(`Address ${warnCount} warning${warnCount > 1 ? 's' : ''} for optimal performance`);
  }
  
  if (overall === 'healthy') {
    recommendations.push('Claude Code SDK is ready for use');
  } else if (!canProceed) {
    recommendations.push('Resolve critical failures before using Claude Code SDK');
  } else {
    recommendations.push('Claude Code SDK may work with limitations');
  }
  
  return {
    overall,
    canProceed,
    results,
    recommendations
  };
}

/**
 * Print diagnostic results in a formatted way
 */
export function printDiagnosticResults(report: SDKHealthReport): void {
  console.log('\n' + chalk.cyan('═'.repeat(60)));
  console.log(chalk.cyan('                  DIAGNOSTIC RESULTS'));
  console.log(chalk.cyan('═'.repeat(60)) + '\n');
  
  // Overall status
  const statusColor = report.overall === 'healthy' ? chalk.green :
                     report.overall === 'degraded' ? chalk.yellow : chalk.red;
  
  console.log(`Overall Status: ${statusColor(report.overall.toUpperCase())}`);
  console.log(`Can Proceed: ${report.canProceed ? chalk.green('YES') : chalk.red('NO')}\n`);
  
  // Group results by category
  const categories = [...new Set(report.results.map(r => r.category))];
  
  for (const category of categories) {
    console.log(chalk.bold(`${category}:`));
    
    const categoryResults = report.results.filter(r => r.category === category);
    
    for (const result of categoryResults) {
      const icon = result.status === 'pass' ? '✓' : result.status === 'warn' ? '⚠' : '✗';
      const color = result.status === 'pass' ? chalk.green : result.status === 'warn' ? chalk.yellow : chalk.red;
      
      console.log(`  ${color(icon)} ${result.test}: ${result.message}`);
      
      if (result.details) {
        console.log(`    ${chalk.gray(result.details)}`);
      }
      
      if (result.fix) {
        console.log(`    ${chalk.blue(`Fix: ${result.fix}`)}`);
      }
    }
    
    console.log('');
  }
  
  // Recommendations
  if (report.recommendations.length > 0) {
    console.log(chalk.bold('Recommendations:'));
    for (const rec of report.recommendations) {
      console.log(`  • ${rec}`);
    }
    console.log('');
  }
  
  console.log(chalk.cyan('═'.repeat(60)) + '\n');
}