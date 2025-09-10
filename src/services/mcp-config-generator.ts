/**
 * MCP Configuration Generator for Claude Desktop
 * Generates .claude/settings.json files for Multi-Claude orchestration
 */

import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';
import { simpleGit } from 'simple-git';
import type { FrameworkInfo } from '../context/detector.js';

const execAsync = promisify(exec);

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold
};

/**
 * MCP Server configuration
 */
export interface MCPServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Project context for MCP configuration
 */
export interface ProjectContext {
  name: string;
  type: string;
  mainBranch: string;
  workingDirectory: string;
  frameworks?: string[];
  databases?: string[];
  hasDocker?: boolean;
  hasKubernetes?: boolean;
  hasTerraform?: boolean;
}

/**
 * MCP Settings structure for Claude Desktop
 */
export interface MCPSettings {
  mcpServers: Record<string, MCPServer>;
  projectContext?: ProjectContext;
}

/**
 * Framework detection result
 */
interface FrameworkDetection {
  frameworks: string[];
  projectType: string;
  suggestions: string[];
}

/**
 * MCP Configuration Generator Service
 */
export class MCPConfigGenerator {
  private workingDir: string;
  private claudeDir: string;
  
  constructor(workingDir?: string) {
    this.workingDir = workingDir || process.cwd();
    this.claudeDir = path.join(this.workingDir, '.claude');
  }
  
  /**
   * Generate MCP configuration for the current project
   */
  async generate(): Promise<MCPSettings> {
    const spinner = ora('Analyzing project for MCP configuration...').start();
    
    try {
      // Detect project characteristics
      const detection = await this.detectFrameworks();
      const projectContext = await this.buildProjectContext(detection);
      
      spinner.text = 'Configuring MCP servers...';
      
      // Build MCP server configuration
      const mcpServers = await this.buildMCPServers(detection, projectContext);
      
      // Create settings object
      const settings: MCPSettings = {
        mcpServers,
        projectContext
      };
      
      spinner.succeed('MCP configuration generated successfully');
      
      return settings;
    } catch (error) {
      spinner.fail('Failed to generate MCP configuration');
      throw error;
    }
  }
  
  /**
   * Save MCP settings to .claude/settings.json
   */
  async save(settings: MCPSettings): Promise<void> {
    const spinner = ora('Saving MCP configuration...').start();
    
    try {
      // Ensure .claude directory exists
      await fs.mkdir(this.claudeDir, { recursive: true });
      
      const settingsPath = path.join(this.claudeDir, 'settings.json');
      
      // Check if settings already exist
      let existingSettings: MCPSettings | null = null;
      if (existsSync(settingsPath)) {
        const existing = await fs.readFile(settingsPath, 'utf-8');
        existingSettings = JSON.parse(existing);
        spinner.text = 'Updating existing MCP configuration...';
      }
      
      // Merge with existing if present
      if (existingSettings) {
        settings = this.mergeSettings(existingSettings, settings);
      }
      
      // Write settings
      await fs.writeFile(
        settingsPath,
        JSON.stringify(settings, null, 2)
      );
      
      spinner.succeed('MCP configuration saved to .claude/settings.json');
      
      // Show what was configured
      this.showConfigurationSummary(settings);
      
    } catch (error) {
      spinner.fail('Failed to save MCP configuration');
      throw error;
    }
  }
  
  /**
   * Detect frameworks and project type
   */
  private async detectFrameworks(): Promise<FrameworkDetection> {
    const frameworks: string[] = [];
    const suggestions: string[] = [];
    let projectType = 'general';
    
    // Check for package.json (Node.js projects)
    const packageJsonPath = path.join(this.workingDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        
        // Check dependencies for frameworks
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        };
        
        // Frontend frameworks
        if (deps['next']) {
          frameworks.push('nextjs');
          projectType = 'frontend';
        }
        if (deps['react']) {
          frameworks.push('react');
          if (projectType === 'general') projectType = 'frontend';
        }
        if (deps['vue']) {
          frameworks.push('vue');
          projectType = 'frontend';
        }
        if (deps['@angular/core']) {
          frameworks.push('angular');
          projectType = 'frontend';
        }
        if (deps['svelte']) {
          frameworks.push('svelte');
          projectType = 'frontend';
        }
        
        // Backend frameworks
        if (deps['express']) {
          frameworks.push('express');
          projectType = projectType === 'frontend' ? 'fullstack' : 'backend';
        }
        if (deps['fastify']) {
          frameworks.push('fastify');
          projectType = projectType === 'frontend' ? 'fullstack' : 'backend';
        }
        if (deps['@nestjs/core']) {
          frameworks.push('nestjs');
          projectType = projectType === 'frontend' ? 'fullstack' : 'backend';
        }
        
        // Database/ORM
        if (deps['prisma'] || deps['@prisma/client']) {
          frameworks.push('prisma');
          suggestions.push('postgres-mcp');
        }
        if (deps['typeorm']) {
          frameworks.push('typeorm');
          suggestions.push('postgres-mcp');
        }
        if (deps['mongoose']) {
          frameworks.push('mongoose');
          suggestions.push('mongodb-mcp');
        }
        
        // Testing
        if (deps['jest'] || deps['vitest']) {
          frameworks.push('testing');
        }
        
        // Build tools
        if (deps['vite']) {
          frameworks.push('vite');
        }
        if (deps['webpack']) {
          frameworks.push('webpack');
        }
        
        // Styling
        if (deps['tailwindcss']) {
          frameworks.push('tailwind');
        }
      } catch (error) {
        // Ignore parse errors
      }
    }
    
    // Check for Encore.app (Encore backend)
    if (existsSync(path.join(this.workingDir, 'encore.app'))) {
      frameworks.push('encore');
      projectType = projectType === 'frontend' ? 'fullstack' : 'backend';
      suggestions.push('postgres-mcp');
    }
    
    // Check for Python projects
    if (existsSync(path.join(this.workingDir, 'requirements.txt')) ||
        existsSync(path.join(this.workingDir, 'pyproject.toml')) ||
        existsSync(path.join(this.workingDir, 'Pipfile'))) {
      frameworks.push('python');
      
      // Check for specific Python frameworks
      try {
        const requirementsPath = path.join(this.workingDir, 'requirements.txt');
        if (existsSync(requirementsPath)) {
          const requirements = await fs.readFile(requirementsPath, 'utf-8');
          if (requirements.includes('django')) {
            frameworks.push('django');
            projectType = 'backend';
          }
          if (requirements.includes('flask')) {
            frameworks.push('flask');
            projectType = 'backend';
          }
          if (requirements.includes('fastapi')) {
            frameworks.push('fastapi');
            projectType = 'backend';
          }
          if (requirements.includes('streamlit')) {
            frameworks.push('streamlit');
            projectType = 'frontend';
          }
        }
      } catch {
        // Ignore errors
      }
    }
    
    // Check for Go projects
    if (existsSync(path.join(this.workingDir, 'go.mod'))) {
      frameworks.push('go');
      projectType = projectType === 'frontend' ? 'fullstack' : 'backend';
    }
    
    // Check for Rust projects
    if (existsSync(path.join(this.workingDir, 'Cargo.toml'))) {
      frameworks.push('rust');
      projectType = projectType === 'frontend' ? 'fullstack' : 'backend';
    }
    
    // Check for Docker
    if (existsSync(path.join(this.workingDir, 'Dockerfile')) ||
        existsSync(path.join(this.workingDir, 'docker-compose.yml')) ||
        existsSync(path.join(this.workingDir, 'docker-compose.yaml'))) {
      frameworks.push('docker');
      suggestions.push('docker-mcp');
    }
    
    // Check for Kubernetes
    if (existsSync(path.join(this.workingDir, 'k8s')) ||
        existsSync(path.join(this.workingDir, '.kube'))) {
      frameworks.push('kubernetes');
      suggestions.push('kubernetes-mcp');
    }
    
    // Check for Terraform
    if (existsSync(path.join(this.workingDir, 'main.tf')) ||
        existsSync(path.join(this.workingDir, 'terraform'))) {
      frameworks.push('terraform');
      suggestions.push('terraform-mcp');
    }
    
    // Check for Figma files
    if (existsSync(path.join(this.workingDir, '.figma')) ||
        existsSync(path.join(this.workingDir, 'figma.config.json'))) {
      frameworks.push('figma');
      suggestions.push('figma-mcp');
    }
    
    return {
      frameworks,
      projectType,
      suggestions: [...new Set(suggestions)] // Remove duplicates
    };
  }
  
  /**
   * Build project context
   */
  private async buildProjectContext(detection: FrameworkDetection): Promise<ProjectContext> {
    const projectName = path.basename(this.workingDir);
    let mainBranch = 'main';
    
    // Try to detect main branch from git
    try {
      const git = simpleGit(this.workingDir);
      const branches = await git.branch();
      
      // Common main branch names
      const mainBranchNames = ['main', 'master', 'develop', 'development'];
      for (const name of mainBranchNames) {
        if (branches.all.includes(name)) {
          mainBranch = name;
          break;
        }
      }
    } catch {
      // Git not available or not a git repo
    }
    
    return {
      name: projectName,
      type: detection.projectType,
      mainBranch,
      workingDirectory: this.workingDir,
      frameworks: detection.frameworks,
      hasDocker: detection.frameworks.includes('docker'),
      hasKubernetes: detection.frameworks.includes('kubernetes'),
      hasTerraform: detection.frameworks.includes('terraform')
    };
  }
  
  /**
   * Build MCP server configurations
   */
  private async buildMCPServers(
    detection: FrameworkDetection,
    context: ProjectContext
  ): Promise<Record<string, MCPServer>> {
    const servers: Record<string, MCPServer> = {};
    
    // Always include core MCP servers
    
    // 1. Filesystem MCP (always needed)
    servers['filesystem'] = {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', this.workingDir]
    };
    
    // 2. GitHub MCP (if in a git repo)
    try {
      const git = simpleGit(this.workingDir);
      const isRepo = await git.checkIsRepo();
      if (isRepo) {
        servers['github'] = {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: {
            GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_PERSONAL_ACCESS_TOKEN}'
          }
        };
      }
    } catch {
      // Not a git repo
    }
    
    // 3. Graphyn MCP (always include for orchestration)
    servers['graphyn-mcp'] = {
      command: 'graphyn',
      args: ['mcp']
    };
    
    // Add conditional MCP servers based on detection
    
    // PostgreSQL MCP
    if (detection.frameworks.includes('prisma') ||
        detection.frameworks.includes('typeorm') ||
        detection.frameworks.includes('encore') ||
        context.type === 'backend') {
      servers['postgres-mcp'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        env: {
          POSTGRES_CONNECTION_STRING: '${POSTGRES_CONNECTION_STRING}'
        }
      };
    }
    
    // Docker MCP
    if (detection.frameworks.includes('docker')) {
      servers['docker-mcp'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-docker']
      };
    }
    
    // Figma MCP
    if (detection.frameworks.includes('figma') || 
        context.type === 'frontend') {
      servers['figma-mcp'] = {
        command: 'npx',
        args: ['-y', '@figma/mcp'],
        env: {
          FIGMA_PERSONAL_ACCESS_TOKEN: '${FIGMA_PERSONAL_ACCESS_TOKEN}'
        }
      };
    }
    
    // Memory MCP (for AI/ML projects)
    if (detection.frameworks.includes('python') ||
        detection.frameworks.includes('streamlit')) {
      servers['memory'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory']
      };
    }
    
    // Puppeteer MCP (for testing/scraping)
    if (detection.frameworks.includes('testing') ||
        context.type === 'frontend') {
      servers['puppeteer'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-puppeteer']
      };
    }
    
    // Brave Search MCP (for research-heavy projects)
    if (context.type === 'general' || detection.frameworks.length === 0) {
      servers['brave-search'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        env: {
          BRAVE_API_KEY: '${BRAVE_API_KEY}'
        }
      };
    }
    
    return servers;
  }
  
  /**
   * Merge existing settings with new ones
   */
  private mergeSettings(existing: MCPSettings, newSettings: MCPSettings): MCPSettings {
    return {
      mcpServers: {
        ...existing.mcpServers,
        ...newSettings.mcpServers
      },
      projectContext: {
        name: existing.projectContext?.name || newSettings.projectContext?.name || '',
        type: existing.projectContext?.type || newSettings.projectContext?.type || '',
        mainBranch: existing.projectContext?.mainBranch || newSettings.projectContext?.mainBranch || 'main',
        workingDirectory: existing.projectContext?.workingDirectory || newSettings.projectContext?.workingDirectory || process.cwd(),
        frameworks: [...(existing.projectContext?.frameworks || []), ...(newSettings.projectContext?.frameworks || [])],
        databases: [...(existing.projectContext?.databases || []), ...(newSettings.projectContext?.databases || [])],
        hasDocker: newSettings.projectContext?.hasDocker ?? existing.projectContext?.hasDocker ?? false,
        hasKubernetes: newSettings.projectContext?.hasKubernetes ?? existing.projectContext?.hasKubernetes ?? false,
        hasTerraform: newSettings.projectContext?.hasTerraform ?? existing.projectContext?.hasTerraform ?? false
      }
    };
  }
  
  /**
   * Show configuration summary
   */
  private showConfigurationSummary(settings: MCPSettings): void {
    console.log(colors.bold('\n📋 MCP Configuration Summary:\n'));
    
    // Project context
    if (settings.projectContext) {
      console.log(colors.highlight('Project Context:'));
      console.log(colors.info(`  • Name: ${settings.projectContext.name}`));
      console.log(colors.info(`  • Type: ${settings.projectContext.type}`));
      console.log(colors.info(`  • Branch: ${settings.projectContext.mainBranch}`));
      
      if (settings.projectContext.frameworks?.length) {
        console.log(colors.info(`  • Frameworks: ${settings.projectContext.frameworks.join(', ')}`));
      }
    }
    
    // MCP Servers
    console.log(colors.highlight('\nConfigured MCP Servers:'));
    for (const [name, server] of Object.entries(settings.mcpServers)) {
      console.log(colors.success(`  ✓ ${name}`));
      if (server.env) {
        const envVars = Object.keys(server.env);
        if (envVars.length > 0) {
          console.log(colors.warning(`    ⚠️  Requires: ${envVars.join(', ')}`));
        }
      }
    }
    
    // Next steps
    console.log(colors.bold('\n📌 Next Steps:\n'));
    
    // Check for required environment variables
    const requiredEnvVars = new Set<string>();
    for (const server of Object.values(settings.mcpServers)) {
      if (server.env) {
        Object.keys(server.env).forEach(key => requiredEnvVars.add(key));
      }
    }
    
    if (requiredEnvVars.size > 0) {
      console.log(colors.warning('1. Set required environment variables:'));
      for (const envVar of requiredEnvVars) {
        console.log(colors.info(`   export ${envVar}="your-value-here"`));
      }
      console.log();
    }
    
    console.log(colors.highlight('2. Copy settings to Claude Desktop:'));
    console.log(colors.info('   The .claude/settings.json file has been created.'));
    console.log(colors.info('   Claude Desktop will automatically detect it when you open this project.\n'));
    
    console.log(colors.highlight('3. Restart Claude Desktop to apply changes.\n'));
    
    console.log(colors.success('✨ MCP configuration complete!'));
  }
  
  /**
   * Validate MCP server availability
   */
  async validateServers(settings: MCPSettings): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const spinner = ora('Validating MCP servers...').start();
    
    for (const [name, server] of Object.entries(settings.mcpServers)) {
      spinner.text = `Checking ${name}...`;
      
      try {
        // Special case for graphyn mcp
        if (name === 'graphyn-mcp') {
          // Check if graphyn CLI is installed
          try {
            await execAsync('which graphyn');
            results.set(name, true);
          } catch {
            results.set(name, false);
          }
        } else {
          // For npx-based servers, we assume they're available
          // (npx will download them on first run)
          results.set(name, true);
        }
      } catch {
        results.set(name, false);
      }
    }
    
    spinner.succeed('MCP server validation complete');
    
    // Show validation results
    console.log(colors.bold('\n🔍 Server Availability:\n'));
    for (const [name, available] of results) {
      if (available) {
        console.log(colors.success(`  ✓ ${name}: Available`));
      } else {
        console.log(colors.warning(`  ⚠️  ${name}: Not installed (will be downloaded on first use)`));
      }
    }
    
    return results;
  }
  
  /**
   * Update existing settings.json file
   */
  async update(): Promise<MCPSettings> {
    const settingsPath = path.join(this.claudeDir, 'settings.json');
    
    if (!existsSync(settingsPath)) {
      console.log(colors.warning('No existing .claude/settings.json found. Generating new configuration...'));
      const settings = await this.generate();
      await this.save(settings);
      return settings;
    }
    
    const spinner = ora('Updating MCP configuration...').start();
    
    try {
      // Read existing settings
      const existing = await fs.readFile(settingsPath, 'utf-8');
      const existingSettings = JSON.parse(existing) as MCPSettings;
      
      // Generate new settings based on current project state
      spinner.text = 'Analyzing project changes...';
      const newSettings = await this.generate();
      
      // Merge settings (preserving user customizations)
      const merged = this.mergeSettings(existingSettings, newSettings);
      
      // Save updated settings
      await fs.writeFile(settingsPath, JSON.stringify(merged, null, 2));
      
      spinner.succeed('MCP configuration updated successfully');
      
      // Show what changed
      this.showUpdateSummary(existingSettings, merged);
      
      return merged;
    } catch (error) {
      spinner.fail('Failed to update MCP configuration');
      throw error;
    }
  }
  
  /**
   * Show what changed in the update
   */
  private showUpdateSummary(oldSettings: MCPSettings, newSettings: MCPSettings): void {
    console.log(colors.bold('\n📝 Configuration Updates:\n'));
    
    // Check for new servers
    const oldServers = new Set(Object.keys(oldSettings.mcpServers));
    const newServers = new Set(Object.keys(newSettings.mcpServers));
    
    const added = [...newServers].filter(s => !oldServers.has(s));
    const removed = [...oldServers].filter(s => !newServers.has(s));
    
    if (added.length > 0) {
      console.log(colors.success('Added servers:'));
      added.forEach(s => console.log(colors.success(`  + ${s}`)));
    }
    
    if (removed.length > 0) {
      console.log(colors.warning('\nRemoved servers:'));
      removed.forEach(s => console.log(colors.warning(`  - ${s}`)));
    }
    
    if (added.length === 0 && removed.length === 0) {
      console.log(colors.info('No server changes detected.'));
    }
    
    // Check for context updates
    if (JSON.stringify(oldSettings.projectContext) !== JSON.stringify(newSettings.projectContext)) {
      console.log(colors.highlight('\nProject context updated.'));
    }
  }
}

/**
 * CLI command handler for MCP config generation
 */
export async function generateMCPConfig(options: {
  update?: boolean;
  validate?: boolean;
} = {}): Promise<void> {
  const generator = new MCPConfigGenerator();
  
  try {
    let settings: MCPSettings;
    
    if (options.update) {
      settings = await generator.update();
    } else {
      settings = await generator.generate();
      await generator.save(settings);
    }
    
    if (options.validate) {
      await generator.validateServers(settings);
    }
    
  } catch (error) {
    console.error(colors.error('Failed to generate MCP configuration:'), error);
    process.exit(1);
  }
}