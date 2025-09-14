/**
 * Real-Time Task Executor - Claude Code Integration
 * 
 * Integrates with actual Claude Code SDK for real AI-powered responses.
 * No mock data - everything uses real Claude intelligence.
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { ConsoleOutput } from '../console/ConsoleOutput.js';
import { QueryProcessor } from './QueryProcessor.js';
import { 
  AgentType, 
  TaskExecution, 
  ExecutionResults,
  TaskResult,
  TaskStatus 
} from './types.js';
import { ClaudeCodeClient } from '../sdk/claude-code-client.js';
import { AgentOrchestrator } from './AgentOrchestrator.js';
import { specializationEngine } from '../engines/SpecializationEngine.js';
import fs from 'fs/promises';
import path from 'path';

export interface ExecutionContext {
  workingDirectory: string;
  repositoryContext?: {
    packageJson?: any;
    readme?: string;
    structure?: string[];
  };
  projectContext?: any; // From specialization engine
  specializedAgents?: any[]; // Dynamic agents from specialization
}

/**
 * Real-time executor with Claude Code SDK integration
 */
export class RealTimeExecutor extends EventEmitter {
  private consoleOutput: ConsoleOutput;
  private queryProcessor: QueryProcessor;
  private activeProcesses = new Map<string, ChildProcess>();
  private taskResults = new Map<string, TaskResult>();
  private agentOrchestrator: AgentOrchestrator;
  
  // NEW: Performance optimization caches
  private repositoryContextCache = new Map<string, { context: any; timestamp: number; ttl: number }>();
  private directoryStructureCache = new Map<string, { structure: { files: string[]; count: number }; timestamp: number; ttl: number }>();
  private readonly CONTEXT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly STRUCTURE_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
  
  // NEW: Performance metrics
  private performanceMetrics = {
    contextBuildTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastOptimization: 0
  };

  constructor(agentsPath?: string) {
    super();
    this.consoleOutput = new ConsoleOutput();
    this.queryProcessor = new QueryProcessor();
    
    // Use singleton pattern to prevent double initialization
    this.agentOrchestrator = AgentOrchestrator.getInstance(agentsPath);
    
    // Set up orchestrator event handlers (only if not already set)
    if (this.agentOrchestrator.listenerCount('agent-error') === 0) {
      this.agentOrchestrator.on('agent-error', (error) => {
        this.consoleOutput.streamError('orchestrator', error, 'Agent orchestration');
      });
    }
    
    if (this.agentOrchestrator.listenerCount('agent-retry') === 0) {
      this.agentOrchestrator.on('agent-retry', ({ attempt, error }) => {
        this.consoleOutput.streamAgentActivity(
          'orchestrator', 
          `Agent retry (attempt ${attempt + 1}): ${error.message}`, 
          'progress'
        );
      });
    }

    // Handle streaming content events
    if (this.agentOrchestrator.listenerCount('streaming_content') === 0) {
      this.agentOrchestrator.on('streaming_content', (text) => {
        this.emit('streaming_content', text);
      });
    }

    if (this.agentOrchestrator.listenerCount('thinking_start') === 0) {
      this.agentOrchestrator.on('thinking_start', () => {
        this.emit('thinking_start');
      });
    }

    if (this.agentOrchestrator.listenerCount('thinking_end') === 0) {
      this.agentOrchestrator.on('thinking_end', () => {
        this.emit('thinking_end');
      });
    }
  }

  /**
   * Initialize the executor and load agent configurations
   */
  async initialize(): Promise<void> {
    await this.agentOrchestrator.initialize();
  }

  /**
   * Execute query with real-time streaming
   */
  async *executeQueryStream(
    query: string,
    context: ExecutionContext,
    options?: {
      maxAgents?: number;
      requireApproval?: boolean;
    }
  ): AsyncGenerator<{ type: string; data: any }> {
    const startTime = Date.now();
    
    try {
      // Start streaming
      yield { type: 'start', data: { query, timestamp: startTime } };

      // PHASE 1: Project Analysis with SpecializationEngine
      yield { type: 'context', data: { message: '🔍 Deep project analysis with dynamic agents...' } };
      
      let projectAnalysis = null;
      let specializedAgents: any[] = [];
      
      // Use specialization engine if provided in context, otherwise use existing context
      if (context.projectContext && context.specializedAgents) {
        // Already analyzed by UnifiedGraphynCLI
        projectAnalysis = context.projectContext;
        specializedAgents = context.specializedAgents;
        
        yield {
          type: 'analysis',
          data: {
            message: `🤖 Using ${specializedAgents.length} specialized agents`,
            stage: 'agent-selection'
          }
        };
      } else {
        // Fallback to repository context building
        const repositoryContextPromise = this.buildRepositoryContext(context.workingDirectory);
        const repositoryContext = await repositoryContextPromise;
        
        // Try to use specialization engine for dynamic analysis
        try {
          yield { type: 'context', data: { message: '🧬 Creating specialized agents for your project...' } };
          
          projectAnalysis = await specializationEngine.analyzeProject(context.workingDirectory);
          specializedAgents = await specializationEngine.createSpecializedAgents(projectAnalysis, query);
          
          if (specializedAgents.length > 0) {
            yield {
              type: 'analysis',
              data: {
                message: `🚀 Created ${specializedAgents.length} specialized agents`,
                stage: 'specialization-complete'
              }
            };
          } else {
            // Fallback to regular orchestration
            yield { type: 'context', data: { message: '🔄 Using standard agent orchestration...' } };
          }
        } catch (error) {
          // Fallback to existing repository context
          console.warn('Specialization engine failed, using standard orchestration:', error);
          yield { type: 'context', data: { message: '🔄 Using standard orchestration (specialization unavailable)...' } };
        }
      }
      
      // Show project info
      const projectName = projectAnalysis?.repository?.name || context.repositoryContext?.packageJson?.name || 'Unknown';
      const techStack = projectAnalysis?.technologies?.map((t: any) => t.name).join(', ') || (context.repositoryContext?.hasTypeScript ? 'TypeScript' : 'JavaScript');
      
      yield { 
        type: 'context', 
        data: { 
          message: `📋 Project: ${projectName} (${techStack}) - executing with specialized agents...` 
        } 
      };
      
      // Stream through orchestrator with appropriate context
      const orchestrationContext = projectAnalysis || await this.buildRepositoryContext(context.workingDirectory);
      
      for await (const event of this.agentOrchestrator.executeQueryStream(query, orchestrationContext, options)) {
        yield event;
      }
      
    } catch (error) {
      yield { 
        type: 'error', 
        data: { 
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        }
      };
    }
  }

  /**
   * Execute query with real Claude Code integration using multi-agent orchestration (blocking version)
   */
  async executeQuery(
    query: string, 
    context: ExecutionContext,
    options?: {
      maxAgents?: number;
      requireApproval?: boolean;
    }
  ): Promise<ExecutionResults> {
    const startTime = Date.now();
    
    try {
      // Stream initial analysis
      this.consoleOutput.streamAgentActivity(
        'orchestrator', 
        `Processing: "${query}"`, 
        'starting'
      );

      // Build repository context
      const repositoryContext = await this.buildRepositoryContext(context.workingDirectory);
      
      // Execute with multi-agent orchestration
      const orchestrationResult = await this.agentOrchestrator.executeQuery(
        query,
        repositoryContext,
        options
      );

      const totalDuration = Date.now() - startTime;
      
      if (orchestrationResult.success) {
        return {
          success: true,
          executionId: `exec-${Date.now()}`,
          completedTasks: [{
            taskId: 'orchestrated-response',
            agentType: 'assistant', // Map to compatible type
            result: this.formatOrchestrationResponse(orchestrationResult),
            duration: totalDuration,
            timestamp: new Date()
          }],
          failedTasks: [],
          totalDuration,
          statistics: {
            totalTasks: orchestrationResult.agentsUsed.length,
            completedTasks: orchestrationResult.agentsUsed.length,
            failedTasks: 0,
            activeSessions: 0,
            startTime: new Date(startTime),
            duration: totalDuration,
            totalCost: 0,
            averageTaskTime: totalDuration / orchestrationResult.agentsUsed.length
          }
        };
      } else {
        return {
          success: false,
          executionId: `exec-${Date.now()}`,
          completedTasks: [],
          failedTasks: [{
            taskId: 'orchestrated-response',
            agentType: 'assistant',
            error: orchestrationResult.error || 'Unknown orchestration error',
            duration: totalDuration,
            timestamp: new Date()
          }],
          totalDuration,
          statistics: {
            totalTasks: 1,
            completedTasks: 0,
            failedTasks: 1,
            activeSessions: 0,
            startTime: new Date(startTime),
            duration: totalDuration,
            totalCost: 0,
            averageTaskTime: totalDuration
          }
        };
      }

    } catch (error) {
      this.consoleOutput.streamError(
        'orchestrator',
        error instanceof Error ? error : new Error(String(error)),
        'Multi-agent orchestration execution'
      );
      
      throw error;
    }
  }

  /**
   * Format orchestration response for display
   */
  private formatOrchestrationResponse(result: any): string {
    let response = `**Agent Analysis (${result.agentsUsed.join(', ')})**\n\n`;
    response += result.primaryResponse;

    if (result.supportingResponses) {
      for (const [agentName, agentResponse] of Object.entries(result.supportingResponses)) {
        response += `\n\n**${agentName} Analysis:**\n${agentResponse}`;
      }
    }

    response += `\n\n*Response generated using ${result.agentsUsed.length} specialized agent(s) in ${result.totalDuration}ms*`;
    
    return response;
  }

  /**
   * Build repository context for Claude (OPTIMIZED: Minimal context for speed)
   */
  private async buildRepositoryContext(workingDirectory: string): Promise<{
    packageJson?: any;
    readme?: string;
    structure: string[];
    fileCount: number;
    hasTypeScript: boolean;
    hasTests: boolean;
  }> {
    const contextStartTime = Date.now();
    const cacheKey = workingDirectory;
    
    // NEW: Check cache first
    const cachedContext = this.repositoryContextCache.get(cacheKey);
    if (cachedContext && (Date.now() - cachedContext.timestamp < cachedContext.ttl)) {
      this.performanceMetrics.cacheHits++;
      this.performanceMetrics.contextBuildTime = Date.now() - contextStartTime;
      return cachedContext.context;
    }

    this.performanceMetrics.cacheMisses++;

    // OPTIMIZATION: Start with minimal context that won't slow down queries
    const context: any = {
      structure: [],
      fileCount: 0,
      hasTypeScript: false,
      hasTests: false
    };

    try {
      // OPTIMIZATION: Only get essential info - packageJson and basic structure
      // Skip README for speed (it's often large and not essential for most queries)
      const [packageJsonResult, structureResult] = await Promise.allSettled([
        this.readPackageJson(workingDirectory),
        this.buildDirectoryStructure(workingDirectory, 1) // Reduced depth from 2 to 1
      ]);

      // Process packageJson result
      if (packageJsonResult.status === 'fulfilled' && packageJsonResult.value) {
        // OPTIMIZATION: Only keep essential package.json fields
        const pkg = packageJsonResult.value;
        context.packageJson = {
          name: pkg.name,
          description: pkg.description,
          version: pkg.version,
          main: pkg.main,
          type: pkg.type,
          // Only keep first 5 scripts and dependencies for brevity
          scripts: pkg.scripts ? Object.fromEntries(
            Object.entries(pkg.scripts).slice(0, 5)
          ) : undefined,
          dependencies: pkg.dependencies ? Object.fromEntries(
            Object.entries(pkg.dependencies).slice(0, 10)
          ) : undefined
        };
      }

      // Process structure result - keep it very minimal
      if (structureResult.status === 'fulfilled') {
        const structure = structureResult.value;
        // OPTIMIZATION: Only show top-level structure + key files
        context.structure = structure.files.slice(0, 15); // Reduced from 50 to 15
        context.fileCount = structure.count;
        context.hasTypeScript = structure.files.some(f => f.endsWith('.ts') || f.endsWith('.tsx'));
        context.hasTests = structure.files.some(f => f.includes('test') || f.includes('spec'));
      } else {
        // Fallback to basic info
        context.structure = ['Unable to scan directory structure'];
      }

    } catch (error) {
      // Fallback context - keep it minimal
      context.structure = ['Error reading repository context'];
    }

    // NEW: Cache the result
    this.repositoryContextCache.set(cacheKey, {
      context: { ...context },
      timestamp: Date.now(),
      ttl: this.CONTEXT_CACHE_TTL
    });

    // NEW: Clean expired cache entries periodically
    this.cleanExpiredCacheEntries();

    this.performanceMetrics.contextBuildTime = Date.now() - contextStartTime;
    return context;
  }

  /**
   * NEW: Optimized package.json reading
   */
  private async readPackageJson(workingDirectory: string): Promise<any | null> {
    try {
      const packageJsonPath = path.join(workingDirectory, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      return JSON.parse(packageJsonContent);
    } catch (error) {
      return null;
    }
  }

  /**
   * NEW: Optimized README reading  
   */
  private async readReadme(workingDirectory: string): Promise<string | null> {
    try {
      const readmePath = path.join(workingDirectory, 'README.md');
      return await fs.readFile(readmePath, 'utf-8');
    } catch (error) {
      return null;
    }
  }

  /**
   * Build directory structure for Claude context (NEW: with caching and optimization)
   */
  private async buildDirectoryStructure(dirPath: string, maxDepth: number): Promise<{
    files: string[];
    count: number;
  }> {
    const cacheKey = `${dirPath}:${maxDepth}`;
    
    // NEW: Check cache first
    const cachedStructure = this.directoryStructureCache.get(cacheKey);
    if (cachedStructure && (Date.now() - cachedStructure.timestamp < cachedStructure.ttl)) {
      return cachedStructure.structure;
    }

    const files: string[] = [];
    let count = 0;
    
    // NEW: Optimized skip patterns for better performance
    const skipPatterns = new Set([
      'node_modules', '.git', 'dist', 'build', 'coverage', '.next', 
      '.nuxt', '.svelte-kit', 'target', 'out', 'tmp', 'temp', '.cache',
      'logs', '.DS_Store', 'Thumbs.db'
    ]);

    // NEW: Use iterative approach with queue instead of recursion for better memory usage
    const queue: Array<{ path: string; depth: number; relativePath: string }> = [
      { path: dirPath, depth: 0, relativePath: '' }
    ];

    while (queue.length > 0 && files.length < 100) { // Increased limit but with hard stop
      const { path: currentPath, depth: currentDepth, relativePath } = queue.shift()!;
      
      if (currentDepth > maxDepth) continue;

      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        // NEW: Process directories and files separately for better performance
        const directories: Array<{ name: string; fullPath: string; relativeFilePath: string }> = [];
        const regularFiles: Array<{ name: string; relativeFilePath: string }> = [];

        for (const entry of entries) {
          // NEW: Early skip for better performance
          if (entry.name.startsWith('.') || skipPatterns.has(entry.name)) {
            continue;
          }

          const fullPath = path.join(currentPath, entry.name);
          const relativeFilePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            directories.push({ name: entry.name, fullPath, relativeFilePath });
          } else {
            regularFiles.push({ name: entry.name, relativeFilePath });
          }
        }

        // Add regular files first
        for (const file of regularFiles) {
          files.push(file.relativeFilePath);
          count++;
        }

        // Add directories and queue them for scanning
        for (const dir of directories) {
          files.push(`${dir.relativeFilePath}/`);
          if (currentDepth < maxDepth) {
            queue.push({
              path: dir.fullPath,
              depth: currentDepth + 1,
              relativePath: dir.relativeFilePath
            });
          }
        }

      } catch (error) {
        // Skip directories we can't read
      }
    }

    const result = { files: files.slice(0, 50), count }; // Keep reasonable limit
    
    // NEW: Cache the result
    this.directoryStructureCache.set(cacheKey, {
      structure: result,
      timestamp: Date.now(),
      ttl: this.STRUCTURE_CACHE_TTL
    });

    return result;
  }

  /**
   * NEW: Clean expired cache entries for memory management
   */
  private cleanExpiredCacheEntries(): void {
    const now = Date.now();
    
    // Clean repository context cache
    for (const [key, cached] of this.repositoryContextCache.entries()) {
      if (now - cached.timestamp >= cached.ttl) {
        this.repositoryContextCache.delete(key);
      }
    }

    // Clean directory structure cache  
    for (const [key, cached] of this.directoryStructureCache.entries()) {
      if (now - cached.timestamp >= cached.ttl) {
        this.directoryStructureCache.delete(key);
      }
    }

    this.performanceMetrics.lastOptimization = now;
  }

  /**
   * NEW: Get performance metrics for monitoring
   */
  getPerformanceMetrics(): {
    contextBuildTime: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRatio: number;
    repositoryCacheSize: number;
    structureCacheSize: number;
    lastOptimization: number;
  } {
    const totalRequests = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
    return {
      ...this.performanceMetrics,
      cacheHitRatio: totalRequests > 0 ? this.performanceMetrics.cacheHits / totalRequests : 0,
      repositoryCacheSize: this.repositoryContextCache.size,
      structureCacheSize: this.directoryStructureCache.size
    };
  }

  /**
   * NEW: Clear all caches manually if needed
   */
  clearPerformanceCache(): void {
    this.repositoryContextCache.clear();
    this.directoryStructureCache.clear();
    this.performanceMetrics = {
      contextBuildTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastOptimization: Date.now()
    };
  }

  /**
   * Build Claude prompt with repository context
   */
  private buildClaudePrompt(query: string, repositoryContext: any): string {
    let prompt = `# Repository Analysis Request

User Query: "${query}"

## Repository Context

`;

    if (repositoryContext.packageJson) {
      prompt += `### Package Information
- Name: ${repositoryContext.packageJson.name || 'Unknown'}
- Description: ${repositoryContext.packageJson.description || 'No description'}
- Version: ${repositoryContext.packageJson.version || 'Unknown'}

`;

      if (repositoryContext.packageJson.scripts) {
        const scripts = Object.keys(repositoryContext.packageJson.scripts);
        prompt += `### Available Scripts
${scripts.map(s => `- ${s}: ${repositoryContext.packageJson.scripts[s]}`).join('\n')}

`;
      }

      if (repositoryContext.packageJson.dependencies) {
        const deps = Object.keys(repositoryContext.packageJson.dependencies);
        prompt += `### Dependencies (${deps.length})
${deps.slice(0, 10).join(', ')}${deps.length > 10 ? '...' : ''}

`;
      }
    }

    if (repositoryContext.structure && repositoryContext.structure.length > 0) {
      prompt += `### Directory Structure (${repositoryContext.fileCount} total files)
\`\`\`
${repositoryContext.structure.slice(0, 30).join('\n')}
${repositoryContext.structure.length > 30 ? '...' : ''}
\`\`\`

`;
    }

    if (repositoryContext.readme) {
      prompt += `### README Content (first 1000 characters)
\`\`\`
${repositoryContext.readme.slice(0, 1000)}${repositoryContext.readme.length > 1000 ? '...' : ''}
\`\`\`

`;
    }

    prompt += `### Project Characteristics
- Has TypeScript: ${repositoryContext.hasTypeScript ? 'Yes' : 'No'}
- Has Tests: ${repositoryContext.hasTests ? 'Yes' : 'No'}
- File Count: ${repositoryContext.fileCount}

## Instructions

Please analyze this repository and respond to the user's query: "${query}"

Be specific and helpful. If the query asks you to find bugs, actually analyze the code structure and dependencies for potential issues. If they ask what they can do, provide actionable suggestions based on the actual repository content.

Do not provide generic advice - tailor your response to this specific repository.`;

    return prompt;
  }


  /**
   * Get available agents from orchestrator
   */
  getAvailableAgents(): string[] {
    return this.agentOrchestrator.getAvailableAgents();
  }

  /**
   * Get agent configuration
   */
  getAgentConfig(agentName: string) {
    return this.agentOrchestrator.getAgentConfig(agentName);
  }

  /**
   * Stop execution (alias for cleanup)
   */
  async stop(): Promise<void> {
    await this.cleanup();
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Terminate any active processes
    for (const [taskId, process] of this.activeProcesses) {
      try {
        process.kill('SIGTERM');
      } catch (error) {
        // Process might already be dead
      }
    }
    
    // Cleanup agent orchestrator
    await this.agentOrchestrator.cleanup();
    
    // NEW: Clear performance caches
    this.clearPerformanceCache();
    
    this.activeProcesses.clear();
    this.taskResults.clear();
  }
}