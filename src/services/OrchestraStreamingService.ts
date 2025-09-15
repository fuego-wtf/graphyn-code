/**
 * Orchestra Streaming Service
 * Multiple parallel Claude streams working in harmony
 * 
 * This service launches multiple specialized Claude CLI instances in parallel,
 * each optimized for different aspects of the user's query, creating a
 * responsive experience through orchestrated parallel processing.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

export interface OrchestraRequest {
  primaryQuery: string;
  workingDirectory: string;
  decomposition: {
    soloist: StreamTask;      // Main response
    analyst: StreamTask;      // Context analysis  
    advisor: StreamTask;      // Suggestions
    critic: StreamTask;       // Validation
  };
}

export interface StreamTask {
  prompt: string;
  priority: number;
  tools: string[];
  timeout: number;
  role: string;
}

export interface OrchestraResult {
  primary: string;
  context?: string;
  suggestions?: string[];
  validation?: string;
  metrics: OrchestraMetrics;
}

export interface OrchestraMetrics {
  startTime: number;
  firstResponse: number;
  completionTime: number;
  activeStreams: number;
  completedStreams: number;
  totalDuration: number;
}

export interface ProgressUpdate {
  stage: string;
  progress: number;
  activeStreams: number;
  completedStreams: number;
  latestResult?: string;
}

export class OrchestraStreamingService extends EventEmitter {
  private activeStreams = new Map<string, ChildProcess>();
  private sessionCache = new Map<string, string>();
  private resultBuffer = new Map<string, any>();
  
  /**
   * Main orchestra conductor - launches parallel streams
   */
  async conductQuery(
    query: string,
    onProgress: (update: ProgressUpdate) => void,
    onComplete: (result: OrchestraResult) => void,
    options: { workingDirectory?: string; timeout?: number } = {}
  ): Promise<void> {
    
    const metrics: OrchestraMetrics = {
      startTime: Date.now(),
      firstResponse: 0,
      completionTime: 0,
      activeStreams: 0,
      completedStreams: 0,
      totalDuration: 0
    };
    
    try {
      // Phase 1: Decompose request
      onProgress({
        stage: 'Analyzing request...',
        progress: 10,
        activeStreams: 0,
        completedStreams: 0
      });
      
      const orchestraRequest = await this.decomposeRequest(query, options);
      
      // Phase 2: Launch orchestra
      onProgress({
        stage: 'Launching orchestra...',
        progress: 20,
        activeStreams: 0,
        completedStreams: 0
      });
      
      const performances = await this.launchEnsemble(orchestraRequest, onProgress);
      metrics.activeStreams = performances.length;
      
      // Phase 3: Harmonize results
      const result = await this.harmonyStream(performances, onProgress, metrics);
      
      metrics.completionTime = Date.now();
      metrics.totalDuration = metrics.completionTime - metrics.startTime;
      result.metrics = metrics;
      
      onComplete(result);
      
    } catch (error) {
      console.error('Orchestra performance failed:', error);
      throw error;
    }
  }
  
  /**
   * Decompose user query into parallel tasks
   */
  private async decomposeRequest(
    query: string,
    options: { workingDirectory?: string } = {}
  ): Promise<OrchestraRequest> {
    
    const workingDir = options.workingDirectory || process.cwd();
    
    return {
      primaryQuery: query,
      workingDirectory: workingDir,
      decomposition: {
        soloist: {
          prompt: `Primary response: ${query}`,
          priority: 1,
          tools: ['Read', 'Grep', 'Bash'],
          timeout: 20000,
          role: 'soloist'
        },
        analyst: {
          prompt: `Analyze codebase context relevant to: ${query}`,
          priority: 2,
          tools: ['Read', 'Glob', 'Grep'],
          timeout: 15000,
          role: 'analyst'
        },
        advisor: {
          prompt: `Suggest next steps and improvements for: ${query}`,
          priority: 3,
          tools: ['Read'],
          timeout: 12000,
          role: 'advisor'
        },
        critic: {
          prompt: `Validate and critique the approach for: ${query}`,
          priority: 4,
          tools: [],
          timeout: 10000,
          role: 'critic'
        }
      }
    };
  }
  
  /**
   * Launch ensemble of specialized Claude instances
   */
  private async launchEnsemble(
    request: OrchestraRequest,
    onProgress: (update: ProgressUpdate) => void
  ): Promise<Array<{ role: string; process: ChildProcess; task: StreamTask }>> {
    
    const members = Object.entries(request.decomposition);
    const performances: Array<{ role: string; process: ChildProcess; task: StreamTask }> = [];
    
    for (const [role, task] of members) {
      try {
        const process = await this.spawnMember(role, task, request.workingDirectory);
        performances.push({ role, process, task });
        
        onProgress({
          stage: `Launched ${role}...`,
          progress: 30 + (performances.length * 10),
          activeStreams: performances.length,
          completedStreams: 0
        });
        
      } catch (error) {
        console.warn(`Failed to launch ${role}:`, error);
      }
    }
    
    return performances;
  }
  
  /**
   * Spawn individual orchestra member
   */
  private async spawnMember(
    role: string,
    task: StreamTask,
    workingDirectory: string
  ): Promise<ChildProcess> {
    
    // Build optimized args for this role
    const args = ['-p', task.prompt];
    
    // Add tools if specified
    if (task.tools.length > 0) {
      args.push('--allowedTools', task.tools.join(','));
    } else {
      // Disable all tools for faster response
      args.push('--allowedTools', '');
    }
    
    // Add output format for structured parsing
    args.push('--output-format', 'json');
    
    // Spawn the Claude process
    const claudeProcess = spawn('claude', args, {
      cwd: workingDirectory,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CLAUDE_ROLE: role,
        CLAUDE_PRIORITY: task.priority.toString()
      }
    });
    
    // Store active stream
    this.activeStreams.set(role, claudeProcess);
    
    return claudeProcess;
  }
  
  /**
   * Harmonize results from multiple streams
   */
  private async harmonyStream(
    performances: Array<{ role: string; process: ChildProcess; task: StreamTask }>,
    onProgress: (update: ProgressUpdate) => void,
    metrics: OrchestraMetrics
  ): Promise<OrchestraResult> {
    
    const result: OrchestraResult = {
      primary: '',
      context: undefined,
      suggestions: [],
      validation: undefined,
      metrics
    };
    
    const completionPromises = performances.map(({ role, process, task }) =>
      this.capturePerformance(role, process, task, onProgress, result, metrics)
    );
    
    // Wait for at least the primary response + any one supporting response
    await Promise.race([
      // Wait for soloist (primary) + any other
      Promise.all([
        completionPromises[0], // Soloist must complete
        Promise.race(completionPromises.slice(1)) // Any supporting member
      ]),
      // Or timeout after reasonable time
      this.timeout(25000)
    ]);
    
    // Give remaining streams a bit more time, but don't wait forever
    await Promise.race([
      Promise.allSettled(completionPromises),
      this.timeout(5000)
    ]);
    
    return result;
  }
  
  /**
   * Capture individual performance output
   */
  private async capturePerformance(
    role: string,
    process: ChildProcess,
    task: StreamTask,
    onProgress: (update: ProgressUpdate) => void,
    result: OrchestraResult,
    metrics: OrchestraMetrics
  ): Promise<void> {
    
    return new Promise((resolve, reject) => {
      let outputBuffer = '';
      let errorBuffer = '';
      
      // Set timeout for this specific performance
      const timeoutId = setTimeout(() => {
        console.warn(`${role} performance timed out after ${task.timeout}ms`);
        process.kill();
        resolve(); // Don't reject - allow other streams to continue
      }, task.timeout);
      
      // Capture stdout
      process.stdout?.on('data', (data) => {
        outputBuffer += data.toString();
      });
      
      // Capture stderr
      process.stderr?.on('data', (data) => {
        errorBuffer += data.toString();
      });
      
      // Handle completion
      process.on('close', (code) => {
        clearTimeout(timeoutId);
        this.activeStreams.delete(role);
        metrics.completedStreams++;
        
        if (code === 0 && outputBuffer.trim()) {
          // Parse and integrate result
          this.integratePerformance(role, outputBuffer, result, metrics);
          
          onProgress({
            stage: `${role} completed`,
            progress: 70 + (metrics.completedStreams * 5),
            activeStreams: this.activeStreams.size,
            completedStreams: metrics.completedStreams,
            latestResult: this.getLatestResult(role, result)
          });
          
        } else if (errorBuffer) {
          console.warn(`${role} failed:`, errorBuffer);
        }
        
        resolve();
      });
      
      // Handle process errors
      process.on('error', (error) => {
        clearTimeout(timeoutId);
        console.warn(`${role} process error:`, error);
        resolve(); // Don't reject - allow other streams to continue
      });
    });
  }
  
  /**
   * Integrate performance result into final output
   */
  private integratePerformance(
    role: string,
    output: string,
    result: OrchestraResult,
    metrics: OrchestraMetrics
  ): void {
    
    try {
      // Try to parse JSON output
      const parsed = JSON.parse(output);
      const content = parsed.result || parsed.response || output;
      
      switch (role) {
        case 'soloist':
          result.primary = content;
          if (metrics.firstResponse === 0) {
            metrics.firstResponse = Date.now();
          }
          break;
          
        case 'analyst':
          result.context = content;
          break;
          
        case 'advisor':
          // Parse suggestions from content
          result.suggestions = this.extractSuggestions(content);
          break;
          
        case 'critic':
          result.validation = content;
          break;
      }
      
    } catch (error) {
      // Fallback to raw output if JSON parsing fails
      switch (role) {
        case 'soloist':
          result.primary = output.trim();
          break;
        case 'analyst':
          result.context = output.trim();
          break;
        case 'advisor':
          result.suggestions = [output.trim()];
          break;
        case 'critic':
          result.validation = output.trim();
          break;
      }
    }
  }
  
  /**
   * Extract suggestions from advisor output
   */
  private extractSuggestions(content: string): string[] {
    const lines = content.split('\n');
    const suggestions: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[-•*]\s/) || trimmed.match(/^\d+\.\s/)) {
        suggestions.push(trimmed.replace(/^[-•*]\s/, '').replace(/^\d+\.\s/, ''));
      }
    }
    
    return suggestions.length > 0 ? suggestions : [content];
  }
  
  /**
   * Get latest result for progress updates
   */
  private getLatestResult(role: string, result: OrchestraResult): string {
    switch (role) {
      case 'soloist': return result.primary.slice(0, 100) + '...';
      case 'analyst': return result.context?.slice(0, 100) + '...' || '';
      case 'advisor': return result.suggestions?.[0]?.slice(0, 100) + '...' || '';
      case 'critic': return result.validation?.slice(0, 100) + '...' || '';
      default: return '';
    }
  }
  
  /**
   * Timeout helper
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Orchestra timeout after ${ms}ms`)), ms);
    });
  }
  
  /**
   * Health check for orchestra capabilities
   */
  async healthCheck(): Promise<{
    claudeCLI: boolean;
    parallelCapacity: number;
    estimatedLatency: number;
  }> {
    
    const startTime = Date.now();
    
    // Test Claude CLI availability
    const cliAvailable = await new Promise<boolean>((resolve) => {
      const child = spawn('claude', ['--version'], { stdio: 'pipe' });
      child.on('close', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    });
    
    const checkLatency = Date.now() - startTime;
    
    return {
      claudeCLI: cliAvailable,
      parallelCapacity: 4, // Number of parallel streams we can handle
      estimatedLatency: checkLatency
    };
  }
  
  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    // Kill all active streams
    for (const [role, process] of this.activeStreams) {
      if (!process.killed) {
        process.kill();
      }
    }
    
    this.activeStreams.clear();
    this.sessionCache.clear();
    this.resultBuffer.clear();
    
    this.emit('shutdown');
  }
}

// Export singleton
export const orchestraStreamingService = new OrchestraStreamingService();
