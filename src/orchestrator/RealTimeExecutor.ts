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
import fs from 'fs/promises';
import path from 'path';

export interface ExecutionContext {
  workingDirectory: string;
  repositoryContext?: {
    packageJson?: any;
    readme?: string;
    structure?: string[];
  };
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

      // Build repository context
      yield { type: 'context', data: { message: 'Building repository context...' } };
      const repositoryContext = await this.buildRepositoryContext(context.workingDirectory);
      
      // Stream through orchestrator
      for await (const event of this.agentOrchestrator.executeQueryStream(query, repositoryContext, options)) {
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
   * Build repository context for Claude
   */
  private async buildRepositoryContext(workingDirectory: string): Promise<{
    packageJson?: any;
    readme?: string;
    structure: string[];
    fileCount: number;
    hasTypeScript: boolean;
    hasTests: boolean;
  }> {
    const context: any = {
      structure: [],
      fileCount: 0,
      hasTypeScript: false,
      hasTests: false
    };

    try {
      // Read package.json if it exists
      try {
        const packageJsonPath = path.join(workingDirectory, 'package.json');
        const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
        context.packageJson = JSON.parse(packageJsonContent);
      } catch (error) {
        // No package.json or invalid JSON
      }

      // Read README if it exists
      try {
        const readmePath = path.join(workingDirectory, 'README.md');
        context.readme = await fs.readFile(readmePath, 'utf-8');
      } catch (error) {
        // No README
      }

      // Build directory structure (limited depth to avoid overwhelming Claude)
      try {
        const structure = await this.buildDirectoryStructure(workingDirectory, 2);
        context.structure = structure.files;
        context.fileCount = structure.count;
        context.hasTypeScript = structure.files.some(f => f.endsWith('.ts') || f.endsWith('.tsx'));
        context.hasTests = structure.files.some(f => f.includes('test') || f.includes('spec'));
      } catch (error) {
        // Fallback to basic info
        context.structure = ['Unable to scan directory structure'];
      }

    } catch (error) {
      // Fallback context
      context.structure = ['Error reading repository context'];
    }

    return context;
  }

  /**
   * Build directory structure for Claude context
   */
  private async buildDirectoryStructure(dirPath: string, maxDepth: number): Promise<{
    files: string[];
    count: number;
  }> {
    const files: string[] = [];
    let count = 0;

    async function scanDir(currentPath: string, currentDepth: number, relativePath = ''): Promise<void> {
      if (currentDepth > maxDepth) return;

      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          // Skip common directories that aren't useful for Claude
          if (entry.name.startsWith('.') || 
              entry.name === 'node_modules' || 
              entry.name === 'dist' || 
              entry.name === 'build') {
            continue;
          }

          const fullPath = path.join(currentPath, entry.name);
          const relativeFilePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            files.push(`${relativeFilePath}/`);
            await scanDir(fullPath, currentDepth + 1, relativeFilePath);
          } else {
            files.push(relativeFilePath);
            count++;
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    await scanDir(dirPath, 0);
    return { files: files.slice(0, 50), count }; // Limit to 50 entries
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
    
    this.activeProcesses.clear();
    this.taskResults.clear();
  }
}