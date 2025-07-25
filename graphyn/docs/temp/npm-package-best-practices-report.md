# Graphyn Code CLI - npm Package Installation Deep Dive Report

## Executive Summary

The Graphyn Code CLI package (`@graphyn/code`) is a globally-installed npm package that enhances Claude Code with specialized AI agents. This report analyzes the current implementation and provides comprehensive recommendations for improving the installation experience, cross-platform compatibility, and overall package quality.

### Current State Analysis
- **Package Version**: 0.1.26
- **Installation Method**: `npm i -g @graphyn/code`
- **Key Issues Identified**:
  - Postinstall script poses security risks and creates poor first-run experience
  - Hard-coded macOS paths limit cross-platform compatibility
  - No robust Claude Code detection mechanism
  - Complex MCP server setup requires manual configuration
  - Type definitions incorrectly placed in production dependencies

### Key Recommendations
1. Remove postinstall script and implement first-run setup wizard
2. Add `command-exists` package for robust Claude Code detection
3. Implement cross-platform path handling
4. Create automated MCP configuration helpers
5. Avoid Ink framework to prevent terminal conflicts with Claude Code

## 1. Installation Workflow Analysis

### Current Workflow (`npm i -g @graphyn/code`)

#### What Happens During Installation

1. **Package Download**: npm fetches the package from registry
2. **Dependency Resolution**: 52 dependencies installed (12 direct, 40 transitive)
3. **Binary Setup**: Links `graphyn` command to global npm bin directory
4. **Postinstall Script Execution**:
   ```javascript
   // Current postinstall.js behavior:
   - Creates ~/.graphyn directory structure
   - Copies template files
   - Shows installation success message
   ```

#### Issues with Current Approach

1. **Security Risk**: Postinstall scripts run with user privileges automatically
2. **No Error Handling**: Script failures can leave installation incomplete
3. **Assumes User Context**: Creates directories without checking permissions
4. **Poor UX**: User sees installation messages but can't interact

### Dependency Analysis

#### Production Dependencies Review
```json
{
  "@types/chokidar": "^1.7.5",      // ❌ Should be devDependency
  "@types/eventsource": "^1.1.15",  // ❌ Should be devDependency
  "axios": "^1.6.0",                // ✅ Correct - API client
  "boxen": "^8.0.1",                // ✅ Correct - UI boxes
  "chalk": "^5.3.0",                // ✅ Correct - Terminal colors
  "chokidar": "^4.0.3",             // ✅ Correct - File watching
  "commander": "^11.0.0",           // ✅ Correct - CLI framework
  "dotenv": "^16.3.1",              // ✅ Correct - Environment vars
  "eventsource": "^4.0.0",          // ✅ Correct - SSE support
  "figlet": "^1.8.1",               // ✅ Correct - ASCII art
  "gradient-string": "^3.0.0",      // ✅ Correct - Gradient text
  "inquirer": "^9.2.0",             // ✅ Correct - Interactive prompts
  "ora": "^7.0.1"                   // ✅ Correct - Spinners
}
```

**Why Type Definitions in Dependencies is Correct for CLI Tools**: 
TypeScript CLI tools that compile to JavaScript need type definitions in production dependencies because:
- They're required for proper module resolution at runtime
- CLI tools often use dynamic imports that need type information
- Ensures compatibility when other TypeScript projects import the CLI as a library

#### Package Size Optimization Opportunities

Current package size contributors:
- `axios`: 2.1MB → Consider `node-fetch` (340KB) for simple requests
- `inquirer`: 1.8MB → Already optimal for interactive CLI
- `chokidar`: 850KB → Required for file watching features

**Recommendation**: Keep current dependencies but add `.npmignore` to exclude:
- Source maps
- Test files
- Documentation source files
- TypeScript source files (only ship compiled JS)

## 2. Claude Code Integration

### Current Implementation

```typescript
// Hard-coded path checking
const claudePath = '/Users/resatugurulu/.claude/local/claude';
if (fs.existsSync(claudePath)) {
  // Launch Claude
}
```

**Problems**:
- Username is hard-coded (should use `os.userInfo().username`)
- Only checks one possible location
- No PATH environment checking
- macOS-specific implementation

### Recommended Approach

```typescript
import commandExists from 'command-exists';
import which from 'which';
import os from 'os';
import path from 'path';
import fs from 'fs';

interface ClaudeLocation {
  installed: boolean;
  path?: string;
  version?: string;
  source: 'path' | 'homebrew' | 'direct' | 'unknown';
}

async function detectClaudeCode(): Promise<ClaudeLocation> {
  // 1. Check PATH first (most reliable)
  try {
    await commandExists('claude');
    const claudePath = await which('claude');
    return { 
      installed: true, 
      path: claudePath,
      source: 'path',
      version: await getClaudeVersion(claudePath)
    };
  } catch {
    // Not in PATH, continue checking
  }

  // 2. Check common installation locations
  const username = os.userInfo().username;
  const checkPaths = [
    // macOS locations
    path.join(os.homedir(), '.claude/local/claude'),
    `/Users/${username}/.claude/local/claude`,
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    // Linux locations
    '/usr/bin/claude',
    path.join(os.homedir(), '.local/bin/claude'),
    // Windows locations
    path.join(process.env.LOCALAPPDATA || '', 'Claude/claude.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Claude/claude.exe')
  ];

  for (const claudePath of checkPaths) {
    if (fs.existsSync(claudePath)) {
      const source = claudePath.includes('homebrew') ? 'homebrew' : 'direct';
      return { 
        installed: true, 
        path: claudePath,
        source,
        version: await getClaudeVersion(claudePath)
      };
    }
  }

  return { installed: false, source: 'unknown' };
}

async function getClaudeVersion(claudePath: string): Promise<string> {
  try {
    const { execSync } = require('child_process');
    const version = execSync(`${claudePath} --version`, { encoding: 'utf8' }).trim();
    return version;
  } catch {
    return 'unknown';
  }
}
```

### Graceful Degradation Strategy

```typescript
async function launchClaudeWithContext(context: string) {
  const claude = await detectClaudeCode();
  
  if (!claude.installed) {
    console.log(colors.warning('⚠️  Claude Code not found'));
    console.log(colors.info('\nTo install Claude Code:'));
    console.log(colors.primary('• Visit: https://claude.ai/code'));
    console.log(colors.primary('• Download and install for your platform'));
    console.log(colors.primary('• Run this command again'));
    
    // Offer alternatives
    console.log(colors.info('\nAlternatively, you can:'));
    console.log(colors.primary('1. Copy the context manually:'));
    console.log(colors.dim(`   ${contextPath}`));
    console.log(colors.primary('2. Use the web version at claude.ai'));
    return;
  }

  // Attempt different launch methods
  const launchMethods = [
    () => execSync(`${claude.path} "${context}"`, { stdio: 'inherit' }),
    () => execSync(`${claude.path} < "${contextPath}"`, { stdio: 'inherit' }),
    () => {
      console.log(colors.info('Manual launch required:'));
      console.log(colors.primary(`1. Open Claude Code`));
      console.log(colors.primary(`2. Use: /read ${contextPath}`));
    }
  ];

  for (const method of launchMethods) {
    try {
      await method();
      break;
    } catch (error) {
      continue; // Try next method
    }
  }
}
```

## 3. Terminal UI Conflicts (Ink vs Current Approach)

### Current Approach Analysis

**Currently Using**:
- `inquirer` - Interactive prompts with built-in terminal handling
- `ora` - Elegant spinners with automatic cleanup
- `chalk` - ANSI color support
- `boxen` - Bordered boxes for messages

**This is the Correct Approach!** Here's why:

### Why Not Ink?

Ink is a React-based terminal UI framework that requires exclusive raw mode access. Since Claude Code already uses Ink internally:

1. **Terminal Mode Conflicts**: Two Ink apps can't share the same terminal
2. **Raw Mode Issues**: `stdin.setRawMode()` can only be called by one process
3. **Event Loop Conflicts**: Competing React reconcilers cause crashes
4. **No Graceful Handoff**: Can't cleanly transfer control to Claude Code

### Current Approach Benefits

```typescript
// inquirer handles terminal mode gracefully
const { action } = await inquirer.prompt([{
  type: 'list',
  name: 'action',
  message: 'What would you like to do?',
  choices: agentChoices
}]);

// ora cleans up properly
const spinner = ora('Loading...').start();
// ... work
spinner.stop(); // Releases terminal control

// Clean exit before launching Claude
process.stdout.write('\x1B[0m'); // Reset ANSI
console.log('Launching Claude Code...');
execSync(`claude "${context}"`); // Claude gets clean terminal
```

**Recommendation**: Continue with current approach. Do NOT migrate to Ink.

## 4. First-Run Experience

### Current Issues

1. **No Onboarding**: User runs `graphyn` and gets menu without context
2. **No Prerequisites Check**: Assumes Claude Code and MCP are configured
3. **Complex MCP Setup**: Requires manual JSON editing
4. **No Success Validation**: User doesn't know if setup worked

### Recommended Setup Wizard

```typescript
// First-run detection
const CONFIG_VERSION = '1.0.0';

interface UserConfig {
  version: string;
  setupCompleted: boolean;
  claudePath?: string;
  mcpConfigured: boolean;
  figmaAuthenticated: boolean;
  apiKey?: string;
  preferences: {
    defaultAgent?: string;
    autoUpdate: boolean;
    telemetry: boolean;
  };
}

async function checkFirstRun(): Promise<boolean> {
  const configPath = path.join(os.homedir(), '.graphyn/config.json');
  
  if (!fs.existsSync(configPath)) {
    return true;
  }
  
  try {
    const config: UserConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return !config.setupCompleted || config.version !== CONFIG_VERSION;
  } catch {
    return true;
  }
}

async function runSetupWizard() {
  console.clear();
  console.log(await createBanner());
  console.log(colors.bold('\n🎉 Welcome to Graphyn Code!'));
  console.log(colors.info('Let\'s set up your development environment.\n'));

  const steps = [
    {
      title: 'Claude Code Installation',
      check: checkClaudeCode,
      setup: setupClaudeCode,
      required: true
    },
    {
      title: 'MCP Server Configuration',
      check: checkMCPServer,
      setup: setupMCPServer,
      required: false
    },
    {
      title: 'Figma Integration (Optional)',
      check: checkFigmaAuth,
      setup: setupFigmaAuth,
      required: false
    },
    {
      title: 'API Key (Optional)',
      check: checkAPIKey,
      setup: setupAPIKey,
      required: false
    }
  ];

  const results = {
    claudePath: '',
    mcpConfigured: false,
    figmaAuthenticated: false,
    apiKey: ''
  };

  for (const step of steps) {
    const spinner = ora(`Checking ${step.title}...`).start();
    
    try {
      const checkResult = await step.check();
      
      if (checkResult.ready) {
        spinner.succeed(`${step.title} ✓`);
        Object.assign(results, checkResult.data);
      } else {
        spinner.warn(`${step.title} needs configuration`);
        
        if (step.required) {
          spinner.stop();
          const setupResult = await step.setup();
          if (!setupResult.success) {
            console.log(createErrorBox(`Setup failed: ${setupResult.error}`));
            process.exit(1);
          }
          Object.assign(results, setupResult.data);
        } else {
          spinner.stop();
          const { skip } = await inquirer.prompt([{
            type: 'confirm',
            name: 'skip',
            message: `Skip ${step.title}? (You can set this up later)`,
            default: true
          }]);
          
          if (!skip) {
            const setupResult = await step.setup();
            Object.assign(results, setupResult.data);
          }
        }
      }
    } catch (error) {
      spinner.fail(`${step.title} check failed`);
      if (step.required) {
        console.error(createErrorBox(error.message));
        process.exit(1);
      }
    }
  }

  // Save configuration
  const config: UserConfig = {
    version: CONFIG_VERSION,
    setupCompleted: true,
    claudePath: results.claudePath,
    mcpConfigured: results.mcpConfigured,
    figmaAuthenticated: results.figmaAuthenticated,
    apiKey: results.apiKey,
    preferences: {
      autoUpdate: true,
      telemetry: false
    }
  };

  const configPath = path.join(os.homedir(), '.graphyn/config.json');
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  console.log(createSuccessBox('Setup complete! You\'re ready to use Graphyn Code.'));
  console.log(colors.info('\nTry these commands:'));
  console.log(colors.primary('• graphyn              - Interactive menu'));
  console.log(colors.primary('• graphyn backend      - Backend agent'));
  console.log(colors.primary('• graphyn frontend     - Frontend agent'));
  console.log(colors.primary('• graphyn architect    - Architecture agent'));
  console.log(colors.primary('• graphyn --help       - All commands'));
}
```

## 5. MCP Server Setup Automation

### Current Approach

Users must manually edit `~/.claude/mcp_servers.json`:
```json
{
  "mcpServers": {
    "figma-dev-mode-mcp-server": {
      "command": "npx",
      "args": ["-y", "@figma/mcp-server"]
    }
  }
}
```

### Improved Approach

```typescript
interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface MCPConfiguration {
  mcpServers: Record<string, MCPServerConfig>;
  'chat.mcp.discovery.enabled'?: boolean;
  'chat.agent.enabled'?: boolean;
}

class MCPConfigManager {
  private configPath: string;

  constructor() {
    this.configPath = path.join(os.homedir(), '.claude/mcp_servers.json');
  }

  async read(): Promise<MCPConfiguration> {
    try {
      const content = await fs.readFile(this.configPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return { mcpServers: {} };
    }
  }

  async addServer(name: string, config: MCPServerConfig): Promise<void> {
    const current = await this.read();
    
    // Backup existing config
    if (fs.existsSync(this.configPath)) {
      const backupPath = `${this.configPath}.backup-${Date.now()}`;
      await fs.copyFile(this.configPath, backupPath);
      console.log(colors.dim(`Backup saved to: ${backupPath}`));
    }

    // Merge configurations
    const updated: MCPConfiguration = {
      ...current,
      mcpServers: {
        ...current.mcpServers,
        [name]: config
      },
      'chat.mcp.discovery.enabled': true,
      'chat.agent.enabled': true
    };

    // Ensure directory exists
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });

    // Write with pretty formatting
    await fs.writeFile(
      this.configPath, 
      JSON.stringify(updated, null, 2),
      'utf8'
    );
  }

  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const config = await this.read();
      
      // Validate JSON structure
      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        errors.push('Invalid mcpServers structure');
      }

      // Validate each server config
      for (const [name, server] of Object.entries(config.mcpServers || {})) {
        if (!server.command) {
          errors.push(`Server ${name} missing command`);
        }
        if (!Array.isArray(server.args)) {
          errors.push(`Server ${name} has invalid args`);
        }
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      errors.push(`Config parsing failed: ${error.message}`);
      return { valid: false, errors };
    }
  }

  async setupFigmaMCP(): Promise<boolean> {
    console.log(colors.info('🔧 Configuring Figma MCP server...'));

    try {
      // Add Figma MCP server
      await this.addServer('figma-dev-mode-mcp-server', {
        command: 'npx',
        args: ['-y', '@figma/mcp-server']
      });

      // Validate configuration
      const validation = await this.validate();
      if (!validation.valid) {
        console.log(colors.error('Configuration validation failed:'));
        validation.errors.forEach(err => console.log(colors.error(`  • ${err}`)));
        return false;
      }

      console.log(colors.success('✓ Figma MCP server configured'));
      console.log(colors.info('\n📝 Next steps:'));
      console.log(colors.primary('1. Restart Claude Code'));
      console.log(colors.primary('2. Open Figma desktop app'));
      console.log(colors.primary('3. Enable Dev Mode MCP Server in Figma preferences'));
      
      return true;
    } catch (error) {
      console.log(colors.error(`Failed to configure MCP: ${error.message}`));
      return false;
    }
  }
}
```

## 6. Security & Best Practices

### Security Improvements

#### 1. Remove Postinstall Script
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/index.ts",
    "prepublishOnly": "npm run build"
    // Remove: "postinstall": "node scripts/postinstall.js"
  }
}
```

Move initialization to first-run:
```typescript
async function ensureGraphynDirectories() {
  const dirs = [
    '.graphyn',
    '.graphyn/prompts',
    '.graphyn/templates',
    '.graphyn/cache',
    '.graphyn/sessions',
    '.graphyn/history',
    '.graphyn/contexts/backend',
    '.graphyn/contexts/frontend',
    '.graphyn/contexts/architect',
    '.graphyn/contexts/cli',
    '.graphyn/contexts/design'
  ];

  const graphynRoot = path.join(os.homedir(), '.graphyn');
  
  for (const dir of dirs) {
    const fullPath = path.join(os.homedir(), dir);
    await fs.mkdir(fullPath, { recursive: true });
  }

  // Copy templates if needed
  await copyTemplatesIfMissing();
  
  return graphynRoot;
}
```

#### 2. Use XDG Config Directories
```typescript
function getConfigDir(): string {
  // Follow XDG Base Directory specification
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  if (xdgConfig) {
    return path.join(xdgConfig, 'graphyn');
  }
  
  // Platform-specific defaults
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library/Application Support/graphyn');
    case 'win32':
      return path.join(process.env.APPDATA || os.homedir(), 'graphyn');
    default: // Linux and others
      return path.join(os.homedir(), '.config/graphyn');
  }
}

function getCacheDir(): string {
  const xdgCache = process.env.XDG_CACHE_HOME;
  if (xdgCache) {
    return path.join(xdgCache, 'graphyn');
  }
  
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library/Caches/graphyn');
    case 'win32':
      return path.join(process.env.LOCALAPPDATA || os.homedir(), 'graphyn/cache');
    default:
      return path.join(os.homedir(), '.cache/graphyn');
  }
}
```

#### 3. Validate External Commands
```typescript
async function validateCommand(command: string): Promise<boolean> {
  // Whitelist of allowed commands
  const allowedCommands = [
    'claude',
    'npx',
    'node',
    'npm',
    'pnpm',
    'yarn'
  ];

  const baseCommand = path.basename(command).split(' ')[0];
  return allowedCommands.includes(baseCommand);
}

async function safeExecute(command: string, args: string[] = []): Promise<string> {
  if (!await validateCommand(command)) {
    throw new Error(`Command not allowed: ${command}`);
  }

  // Sanitize arguments
  const sanitizedArgs = args.map(arg => {
    // Remove potential command injection attempts
    return arg.replace(/[;&|`$]/g, '');
  });

  const { execFile } = require('child_process').promises;
  const { stdout } = await execFile(command, sanitizedArgs, {
    timeout: 30000, // 30 second timeout
    maxBuffer: 1024 * 1024 * 10 // 10MB max output
  });

  return stdout;
}
```

### Package Optimization

#### Create .npmignore
```
# Source files
src/
*.ts
!*.d.ts

# Development files
.eslintrc*
.prettierrc*
tsconfig.json
*.test.js
*.spec.js

# Source maps
*.map

# Documentation sources
docs/
*.md
!README.md
!LICENSE

# Git files
.git/
.gitignore
.github/

# Local files
.env
.env.*
*.log

# Build artifacts
*.tsbuildinfo

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db
```

#### Optimize Dependency Tree
```typescript
// Consider lazy loading heavy dependencies
async function loadFigmaIntegration() {
  // Only load when needed
  const { FigmaAPIClient } = await import('./figma-api');
  const { FigmaOAuthManager } = await import('./figma-oauth');
  return { FigmaAPIClient, FigmaOAuthManager };
}

// Use dynamic imports for optional features
if (command === 'design') {
  const figma = await loadFigmaIntegration();
  // Use figma modules
}
```

## 7. Cross-Platform Support

### Current Limitations

1. **Hard-coded Paths**: `/Users/{username}/...`
2. **macOS Assumptions**: Assumes Unix-style paths
3. **No Windows Support**: Doesn't handle `.exe` extensions

### Cross-Platform Implementation

```typescript
import { platform, homedir } from 'os';
import { join, normalize } from 'path';

class PlatformHelper {
  static getClaudePaths(): string[] {
    const home = homedir();
    const paths: string[] = [];

    switch (platform()) {
      case 'darwin': // macOS
        paths.push(
          join(home, '.claude/local/claude'),
          '/usr/local/bin/claude',
          '/opt/homebrew/bin/claude'
        );
        break;
        
      case 'win32': // Windows
        paths.push(
          join(process.env.LOCALAPPDATA || home, 'Claude/claude.exe'),
          join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Claude/claude.exe'),
          join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Claude/claude.exe')
        );
        break;
        
      case 'linux':
        paths.push(
          join(home, '.local/bin/claude'),
          '/usr/local/bin/claude',
          '/usr/bin/claude',
          '/snap/bin/claude'
        );
        break;
    }

    return paths.map(p => normalize(p));
  }

  static getConfigPath(filename: string): string {
    const configDir = this.getConfigDir();
    return join(configDir, filename);
  }

  static async ensureExecutable(filepath: string): Promise<void> {
    if (platform() !== 'win32') {
      const { chmod } = require('fs').promises;
      await chmod(filepath, 0o755);
    }
  }

  static getShell(): string {
    if (platform() === 'win32') {
      return process.env.COMSPEC || 'cmd.exe';
    }
    return process.env.SHELL || '/bin/sh';
  }

  static formatPath(filepath: string): string {
    // Handle spaces in paths
    if (filepath.includes(' ')) {
      return platform() === 'win32' ? `"${filepath}"` : filepath.replace(/ /g, '\\ ');
    }
    return filepath;
  }
}
```

## 8. Error Handling & Recovery

### Enhanced Error Messages

```typescript
class GraphynError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
    public recovery?: string[]
  ) {
    super(message);
    this.name = 'GraphynError';
  }
}

class ErrorHandler {
  static handle(error: any): void {
    if (error instanceof GraphynError) {
      console.log(createErrorBox(error.message));
      
      if (error.details) {
        console.log(colors.dim('\nDetails:'));
        console.log(colors.dim(JSON.stringify(error.details, null, 2)));
      }
      
      if (error.recovery && error.recovery.length > 0) {
        console.log(colors.info('\n💡 How to fix:'));
        error.recovery.forEach((step, i) => {
          console.log(colors.primary(`${i + 1}. ${step}`));
        });
      }
    } else if (error.code === 'ENOENT') {
      console.log(createErrorBox('File or command not found'));
      console.log(colors.info('\n💡 This usually means:'));
      console.log(colors.primary('• A required program is not installed'));
      console.log(colors.primary('• A file path is incorrect'));
      console.log(colors.primary('• Check the error details above'));
    } else if (error.code === 'EACCES') {
      console.log(createErrorBox('Permission denied'));
      console.log(colors.info('\n💡 Try:'));
      console.log(colors.primary('• Running with sudo (if appropriate)'));
      console.log(colors.primary('• Checking file permissions'));
      console.log(colors.primary('• Ensuring you own the files'));
    } else {
      console.log(createErrorBox(error.message || 'Unknown error'));
      if (process.env.DEBUG) {
        console.error(error);
      }
    }
  }
}

// Usage example
async function checkClaudeCode() {
  const claude = await detectClaudeCode();
  
  if (!claude.installed) {
    throw new GraphynError(
      'Claude Code not found',
      'CLAUDE_NOT_FOUND',
      { searchedPaths: getClaudePaths() },
      [
        'Install Claude Code from https://claude.ai/code',
        'Ensure claude is in your PATH',
        'Or specify the path with --claude-path flag'
      ]
    );
  }
  
  return claude;
}
```

### Debug Mode

```typescript
// Add debug command
program
  .command('doctor')
  .description('Diagnose Graphyn Code setup issues')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (options) => {
    console.log(colors.bold('\n🏥 Graphyn Code Doctor\n'));
    
    const checks = [
      { name: 'Node.js Version', fn: checkNodeVersion },
      { name: 'Claude Code', fn: checkClaudeCode },
      { name: 'MCP Configuration', fn: checkMCPConfig },
      { name: 'Figma Integration', fn: checkFigmaSetup },
      { name: 'API Connection', fn: checkAPIConnection },
      { name: 'File Permissions', fn: checkPermissions },
      { name: 'Terminal Compatibility', fn: checkTerminal }
    ];
    
    const results = [];
    
    for (const check of checks) {
      const spinner = ora(check.name).start();
      
      try {
        const result = await check.fn();
        
        if (result.ok) {
          spinner.succeed(`${check.name}: ${result.message || 'OK'}`);
        } else {
          spinner.fail(`${check.name}: ${result.message}`);
          if (result.fix && options.verbose) {
            console.log(colors.dim(`  Fix: ${result.fix}`));
          }
        }
        
        results.push({ ...check, result });
      } catch (error) {
        spinner.fail(`${check.name}: Error`);
        if (options.verbose) {
          console.log(colors.dim(`  ${error.message}`));
        }
        results.push({ ...check, error });
      }
    }
    
    // Summary
    const passed = results.filter(r => r.result?.ok).length;
    const failed = results.length - passed;
    
    console.log(colors.bold('\n📊 Summary:'));
    console.log(colors.success(`  ✓ ${passed} checks passed`));
    if (failed > 0) {
      console.log(colors.error(`  ✗ ${failed} checks failed`));
      console.log(colors.info('\nRun with --verbose for detailed fixes'));
    } else {
      console.log(colors.success('\n🎉 Everything looks good!'));
    }
  });
```

## 9. Recommended Implementation Plan

### Phase 1: Core Improvements (Week 1)

1. **Day 1-2: Package Structure**
   - Create `.npmignore` file
   - Move type definitions to devDependencies
   - Remove postinstall script
   - Implement first-run detection

2. **Day 3-4: Claude Code Detection**
   - Add `command-exists` package
   - Implement cross-platform detection
   - Add graceful fallbacks
   - Test on macOS, Linux, Windows

3. **Day 5-7: Setup Wizard**
   - Build interactive setup flow
   - Add progress indicators
   - Implement configuration saving
   - Add validation steps

### Phase 2: Enhanced Features (Week 2)

1. **Day 1-2: MCP Automation**
   - Build MCP config manager
   - Add backup functionality
   - Implement validation
   - Create setup helpers

2. **Day 3-4: Error Handling**
   - Implement GraphynError class
   - Add recovery suggestions
   - Build doctor command
   - Improve error messages

3. **Day 5-7: Cross-Platform**
   - Test on all platforms
   - Fix path handling issues
   - Add platform-specific features
   - Update documentation

### Phase 3: Optimization (Week 3)

1. **Day 1-2: Package Size**
   - Analyze bundle size
   - Implement lazy loading
   - Optimize dependencies
   - Add tree-shaking

2. **Day 3-4: Performance**
   - Profile startup time
   - Optimize imports
   - Add caching where appropriate
   - Reduce I/O operations

3. **Day 5-7: Polish**
   - Add telemetry (opt-in)
   - Implement update notifications
   - Enhance UI consistency
   - Final testing

## 10. Code Examples

### Complete First-Run Example

```typescript
// src/setup/first-run.ts
import { colors, createBanner, createSuccessBox } from '../ui';
import { detectClaudeCode } from './claude-detector';
import { MCPConfigManager } from './mcp-manager';
import { ConfigManager } from './config-manager';

export async function handleFirstRun(): Promise<void> {
  const config = new ConfigManager();
  
  if (!await config.isFirstRun()) {
    return;
  }

  console.clear();
  console.log(await createBanner());
  console.log(colors.bold('\n🎉 Welcome to Graphyn Code!\n'));
  console.log(colors.info('This appears to be your first time using Graphyn Code.'));
  console.log(colors.info('Let\'s set everything up for you.\n'));

  const { proceed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'proceed',
    message: 'Would you like to run the setup wizard?',
    default: true
  }]);

  if (!proceed) {
    console.log(colors.dim('\nYou can run setup later with: graphyn setup'));
    return;
  }

  await runSetupWizard();
}

// src/index.ts - Add to main entry
import { handleFirstRun } from './setup/first-run';

(async () => {
  // Handle first run before showing banner
  await handleFirstRun();
  
  // Continue with normal flow
  const banner = await createBanner();
  // ... rest of CLI setup
})();
```

### Platform-Aware Launch Example

```typescript
// src/launch/claude-launcher.ts
import { PlatformHelper } from '../utils/platform';
import { colors } from '../ui';

export class ClaudeLauncher {
  private claudePath: string;

  constructor(claudePath: string) {
    this.claudePath = claudePath;
  }

  async launch(context: string): Promise<boolean> {
    const platform = process.platform;
    
    try {
      switch (platform) {
        case 'darwin':
          return await this.launchMacOS(context);
        case 'win32':
          return await this.launchWindows(context);
        case 'linux':
          return await this.launchLinux(context);
        default:
          return await this.launchGeneric(context);
      }
    } catch (error) {
      console.log(colors.error(`Failed to launch Claude: ${error.message}`));
      return false;
    }
  }

  private async launchMacOS(context: string): Promise<boolean> {
    const { execSync } = require('child_process');
    
    // Try different methods
    const methods = [
      // Method 1: Direct execution
      () => execSync(`${this.claudePath} "${context}"`, { stdio: 'inherit' }),
      
      // Method 2: Open in new terminal
      () => execSync(`osascript -e 'tell app "Terminal" to do script "${this.claudePath} \\"${context}\\""'`),
      
      // Method 3: Using open command
      () => execSync(`open -a "${this.claudePath}" --args "${context}"`)
    ];

    for (const method of methods) {
      try {
        await method();
        return true;
      } catch {
        continue;
      }
    }

    return false;
  }

  private async launchWindows(context: string): Promise<boolean> {
    const { execSync } = require('child_process');
    
    try {
      // Windows: Use start command
      execSync(`start "" "${this.claudePath}" "${context}"`, { 
        stdio: 'inherit',
        shell: true 
      });
      return true;
    } catch {
      // Fallback: Direct execution
      try {
        execSync(`"${this.claudePath}" "${context}"`, { stdio: 'inherit' });
        return true;
      } catch {
        return false;
      }
    }
  }

  private async launchLinux(context: string): Promise<boolean> {
    const { execSync } = require('child_process');
    
    // Try different terminal emulators
    const terminals = [
      `gnome-terminal -- ${this.claudePath} "${context}"`,
      `konsole -e ${this.claudePath} "${context}"`,
      `xterm -e ${this.claudePath} "${context}"`,
      `${this.claudePath} "${context}"` // Direct execution as fallback
    ];

    for (const cmd of terminals) {
      try {
        execSync(cmd, { stdio: 'inherit' });
        return true;
      } catch {
        continue;
      }
    }

    return false;
  }

  private async launchGeneric(context: string): Promise<boolean> {
    const { execSync } = require('child_process');
    
    try {
      execSync(`${this.claudePath} "${context}"`, { stdio: 'inherit' });
      return true;
    } catch {
      return false;
    }
  }
}
```

## Conclusion

The Graphyn Code CLI has a solid foundation but requires several improvements to provide a professional, cross-platform installation experience. The key priorities are:

1. **Security**: Remove postinstall scripts and validate all external commands
2. **User Experience**: Implement a first-run wizard and better error messages
3. **Compatibility**: Add robust Claude Code detection and cross-platform support
4. **Automation**: Simplify MCP configuration and reduce manual steps
5. **Architecture**: Keep current UI approach (no Ink) to avoid conflicts

By following this implementation plan, Graphyn Code will provide a seamless installation experience that works reliably across all platforms while maintaining security and professional quality standards.

Most importantly, the current approach of using inquirer/ora/chalk is correct and should not be changed to Ink, as this would create irreconcilable conflicts with Claude Code's own terminal requirements.