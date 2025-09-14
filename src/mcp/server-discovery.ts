/**
 * MCP Server Discovery Engine
 * 
 * Discovers and auto-configures MCP servers based on project technology
 * stack analysis, environment variables, and user preferences.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { 
  getMCPServerConfig, 
  buildMCPServerCommand, 
  hasRequiredEnvironment,
  getMissingEnvironmentVars,
  getCoreMCPServers,
  getMCPServersByCategory,
  type MCPServer, 
  type MCPServerConfig 
} from './server-registry.js';
import { 
  autoInstallMCPServer, 
  validateMCPServerStartup,
  installAndValidateMCPServers 
} from './server-installer.js';
import type { ProjectAnalysis, TechnologyProfile } from '../engines/SpecializationEngine.js';

interface MCPDiscoveryResult {
  recommendedServers: Record<string, MCPServer>;
  installationResults: any[];
  validationResults: any[];
  skippedServers: Array<{
    name: string;
    reason: string;
    missingEnv?: string[];
  }>;
  summary: {
    totalRecommended: number;
    totalInstalled: number;
    totalValidated: number;
    totalSkipped: number;
  };
}

/**
 * Discover and configure MCP servers for a project
 */
export async function discoverMCPServersForProject(
  analysis: ProjectAnalysis,
  options: {
    autoInstall?: boolean;
    skipValidation?: boolean;
    silent?: boolean;
    includeOptional?: boolean;
  } = {}
): Promise<MCPDiscoveryResult> {
  const recommendedServers: Record<string, MCPServer> = {};
  const installationResults: any[] = [];
  const validationResults: any[] = [];
  const skippedServers: Array<{
    name: string;
    reason: string;
    missingEnv?: string[];
  }> = [];

  if (!options.silent) {
    console.log('🔍 Discovering MCP servers for project...');
  }

  // Step 1: Always include core servers
  const coreServers = getCoreMCPServers();
  for (const serverName of coreServers) {
    const config = getMCPServerConfig(serverName);
    if (config) {
      if (hasRequiredEnvironment(serverName)) {
        const server = buildMCPServerCommand(serverName, config);
        recommendedServers[serverName] = server;
        
        if (!options.silent) {
          console.log(`✅ Core server '${serverName}' configured`);
        }
      } else {
        const missingEnv = getMissingEnvironmentVars(serverName);
        skippedServers.push({
          name: serverName,
          reason: 'Missing required environment variables',
          missingEnv
        });
        
        if (!options.silent) {
          console.log(`⚠️ Core server '${serverName}' skipped - missing env: ${missingEnv.join(', ')}`);
        }
      }
    }
  }

  // Step 2: Detect technology-specific servers
  const techMappings = getTechnologyMCPMappings();
  
  for (const tech of analysis.technologies) {
    const serverNames = techMappings[tech.name.toLowerCase()] || [];
    
    for (const serverName of serverNames) {
      // Skip if already added
      if (recommendedServers[serverName]) continue;
      
      const config = getMCPServerConfig(serverName);
      if (config) {
        if (hasRequiredEnvironment(serverName)) {
          const server = buildMCPServerCommand(serverName, config);
          recommendedServers[serverName] = server;
          
          if (!options.silent) {
            console.log(`✅ MCP server '${serverName}' configured for ${tech.name}`);
          }
        } else {
          const missingEnv = getMissingEnvironmentVars(serverName);
          skippedServers.push({
            name: serverName,
            reason: `${tech.name} detected but missing environment variables`,
            missingEnv
          });
          
          if (!options.silent) {
            console.log(`⚠️ Server '${serverName}' for ${tech.name} skipped - missing env: ${missingEnv.join(', ')}`);
          }
        }
      }
    }
  }

  // Step 3: Detect workflow-based servers
  if (analysis.development_workflow) {
    await addWorkflowServers(analysis, recommendedServers, skippedServers, options);
  }

  // Step 4: Detect deployment and architecture servers
  if (analysis.architecture) {
    await addArchitectureServers(analysis, recommendedServers, skippedServers, options);
  }

  // Step 5: Install servers if auto-install is enabled
  if (options.autoInstall) {
    const serverNames = Object.keys(recommendedServers);
    if (serverNames.length > 0) {
      const installResults = await installAndValidateMCPServers(serverNames, {
        parallel: true,
        silent: options.silent,
        skipValidation: options.skipValidation
      });
      
      installationResults.push(...installResults.installations);
      validationResults.push(...installResults.validations);
    }
  }

  const summary = {
    totalRecommended: Object.keys(recommendedServers).length,
    totalInstalled: installationResults.filter(r => r.success).length,
    totalValidated: validationResults.filter(r => r.success).length,
    totalSkipped: skippedServers.length
  };

  if (!options.silent) {
    console.log(`🚀 MCP discovery complete: ${summary.totalRecommended} servers configured`);
  }

  return {
    recommendedServers,
    installationResults,
    validationResults,
    skippedServers,
    summary
  };
}

/**
 * Get technology to MCP server mappings
 */
function getTechnologyMCPMappings(): Record<string, string[]> {
  return {
    // Frontend Technologies
    'react': ['npm', 'webpack'],
    'vue': ['npm', 'webpack'],
    'angular': ['npm'],
    'next.js': ['npm', 'webpack'],
    'nuxt': ['npm'],
    'svelte': ['npm'],
    
    // Backend Technologies
    'express.js': ['npm'],
    'fastify': ['npm'],
    'nestjs': ['npm'],
    'django': ['postgres'],
    'flask': ['postgres'],
    'fastapi': ['postgres'],
    'spring': [],
    
    // Databases
    'postgresql': ['postgres'],
    'postgres': ['postgres'],
    'mongodb': ['mongodb'],
    'redis': ['redis'],
    'sqlite': ['sqlite'],
    'mysql': [],
    
    // DevOps Technologies
    'docker': ['docker'],
    'kubernetes': ['kubernetes'],
    'aws': ['aws'],
    'gcp': [],
    'azure': [],
    
    // Testing Frameworks
    'jest': ['jest'],
    'cypress': ['cypress'],
    'playwright': [],
    'vitest': [],
    
    // Build Tools
    'webpack': ['webpack'],
    'vite': ['npm'],
    'rollup': ['npm'],
    'parcel': ['npm'],
    
    // Version Control
    'git': ['git']
  };
}

/**
 * Add workflow-based servers
 */
async function addWorkflowServers(
  analysis: ProjectAnalysis,
  recommendedServers: Record<string, MCPServer>,
  skippedServers: any[],
  options: any
): Promise<void> {
  // CI/CD tools
  for (const tool of analysis.development_workflow.ci_cd_tools) {
    if (tool.toLowerCase().includes('github')) {
      await tryAddServer('github', recommendedServers, skippedServers, options);
    }
  }

  // Testing frameworks
  for (const framework of analysis.development_workflow.testing_framework) {
    const serverName = framework.toLowerCase();
    if (['jest', 'cypress'].includes(serverName)) {
      await tryAddServer(serverName, recommendedServers, skippedServers, options);
    }
  }

  // Package managers
  for (const manager of analysis.development_workflow.package_managers) {
    if (['npm', 'yarn', 'pnpm'].includes(manager)) {
      await tryAddServer('npm', recommendedServers, skippedServers, options);
      break; // Only need one npm server
    }
  }
}

/**
 * Add architecture-based servers
 */
async function addArchitectureServers(
  analysis: ProjectAnalysis,
  recommendedServers: Record<string, MCPServer>,
  skippedServers: any[],
  options: any
): Promise<void> {
  // Architecture patterns
  for (const pattern of analysis.architecture.patterns) {
    if (pattern.includes('container')) {
      await tryAddServer('docker', recommendedServers, skippedServers, options);
    }
    
    if (pattern.includes('kubernetes') || pattern.includes('k8s')) {
      await tryAddServer('kubernetes', recommendedServers, skippedServers, options);
    }
    
    if (pattern.includes('serverless')) {
      await tryAddServer('aws', recommendedServers, skippedServers, options); // Assume AWS Lambda
    }
  }
}

/**
 * Helper function to try adding a server
 */
async function tryAddServer(
  serverName: string,
  recommendedServers: Record<string, MCPServer>,
  skippedServers: any[],
  options: any
): Promise<void> {
  // Skip if already added
  if (recommendedServers[serverName]) return;

  const config = getMCPServerConfig(serverName);
  if (config) {
    if (hasRequiredEnvironment(serverName)) {
      const server = buildMCPServerCommand(serverName, config);
      recommendedServers[serverName] = server;
      
      if (!options.silent) {
        console.log(`✅ MCP server '${serverName}' configured`);
      }
    } else {
      const missingEnv = getMissingEnvironmentVars(serverName);
      skippedServers.push({
        name: serverName,
        reason: 'Missing required environment variables',
        missingEnv
      });
      
      if (!options.silent) {
        console.log(`⚠️ Server '${serverName}' skipped - missing env: ${missingEnv.join(', ')}`);
      }
    }
  }
}

/**
 * Discover MCP servers based on working directory analysis
 */
export async function discoverMCPServersFromDirectory(
  workingDirectory: string,
  options: {
    autoInstall?: boolean;
    skipValidation?: boolean;
    silent?: boolean;
  } = {}
): Promise<MCPDiscoveryResult> {
  const recommendedServers: Record<string, MCPServer> = {};
  const skippedServers: any[] = [];

  if (!options.silent) {
    console.log('🔍 Scanning directory for MCP server opportunities...');
  }

  try {
    // Always add core servers
    const coreServers = getCoreMCPServers();
    for (const serverName of coreServers) {
      await tryAddServer(serverName, recommendedServers, skippedServers, options);
    }

    // Check for common files that indicate technology usage
    const files = await fs.readdir(workingDirectory);
    
    // Package.json indicates Node.js project
    if (files.includes('package.json')) {
      await tryAddServer('npm', recommendedServers, skippedServers, options);
      
      // Check package.json contents for more specific technologies
      try {
        const packageJsonPath = path.join(workingDirectory, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        // React/Next.js
        if (allDeps.react || allDeps.next) {
          await tryAddServer('webpack', recommendedServers, skippedServers, options);
        }
        
        // Testing frameworks
        if (allDeps.jest) {
          await tryAddServer('jest', recommendedServers, skippedServers, options);
        }
        if (allDeps.cypress) {
          await tryAddServer('cypress', recommendedServers, skippedServers, options);
        }
        
        // Database ORMs
        if (allDeps.prisma || allDeps.pg || allDeps['postgres']) {
          await tryAddServer('postgres', recommendedServers, skippedServers, options);
        }
        if (allDeps.mongodb || allDeps.mongoose) {
          await tryAddServer('mongodb', recommendedServers, skippedServers, options);
        }
        if (allDeps.redis) {
          await tryAddServer('redis', recommendedServers, skippedServers, options);
        }
      } catch (error) {
        // Ignore package.json parsing errors
      }
    }

    // Docker files
    if (files.some(f => f.toLowerCase().includes('docker'))) {
      await tryAddServer('docker', recommendedServers, skippedServers, options);
    }

    // Kubernetes files
    if (files.some(f => f.includes('k8s') || f.includes('kube'))) {
      await tryAddServer('kubernetes', recommendedServers, skippedServers, options);
    }

    // Python files
    if (files.some(f => f.endsWith('.py')) || files.includes('requirements.txt')) {
      // Could add Python-specific MCP servers here
    }

    // Git repository
    if (files.includes('.git')) {
      await tryAddServer('git', recommendedServers, skippedServers, options);
    }

  } catch (error) {
    if (!options.silent) {
      console.warn('Error scanning directory for MCP servers:', error);
    }
  }

  // Install if requested
  let installationResults: any[] = [];
  let validationResults: any[] = [];

  if (options.autoInstall) {
    const serverNames = Object.keys(recommendedServers);
    if (serverNames.length > 0) {
      const installResults = await installAndValidateMCPServers(serverNames, {
        parallel: true,
        silent: options.silent,
        skipValidation: options.skipValidation
      });
      
      installationResults = installResults.installations;
      validationResults = installResults.validations;
    }
  }

  const summary = {
    totalRecommended: Object.keys(recommendedServers).length,
    totalInstalled: installationResults.filter(r => r.success).length,
    totalValidated: validationResults.filter(r => r.success).length,
    totalSkipped: skippedServers.length
  };

  return {
    recommendedServers,
    installationResults,
    validationResults,
    skippedServers,
    summary
  };
}

/**
 * Create minimal MCP configuration for testing
 */
export function createMinimalMCPConfiguration(): Record<string, MCPServer> {
  const servers: Record<string, MCPServer> = {};
  
  // Only include filesystem and git - most likely to work without env vars
  const minimalServers = ['filesystem', 'git'];
  
  for (const serverName of minimalServers) {
    const config = getMCPServerConfig(serverName);
    if (config && hasRequiredEnvironment(serverName)) {
      servers[serverName] = buildMCPServerCommand(serverName, config);
    }
  }
  
  return servers;
}

/**
 * Get user-friendly MCP server status
 */
export function getMCPServerStatus(servers: Record<string, MCPServer>): Array<{
  name: string;
  description: string;
  tools: string[];
  status: 'configured' | 'needs_env' | 'error';
  missingEnv?: string[];
}> {
  const status: Array<{
    name: string;
    description: string;
    tools: string[];
    status: 'configured' | 'needs_env' | 'error';
    missingEnv?: string[];
  }> = [];

  for (const [serverName, serverConfig] of Object.entries(servers)) {
    const config = getMCPServerConfig(serverName);
    
    if (config) {
      const missingEnv = getMissingEnvironmentVars(serverName);
      
      status.push({
        name: serverName,
        description: config.description,
        tools: config.tools,
        status: missingEnv.length > 0 ? 'needs_env' : 'configured',
        missingEnv: missingEnv.length > 0 ? missingEnv : undefined
      });
    } else {
      status.push({
        name: serverName,
        description: 'Unknown server',
        tools: [],
        status: 'error'
      });
    }
  }

  return status;
}
