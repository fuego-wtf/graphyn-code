/**
 * Optimized Claude Service - Works around CLI streaming limitations
 * 
 * Key insights:
 * 1. Claude CLI doesn't actually stream responses in real-time
 * 2. The entire response comes after the full API call (14+ seconds)
 * 3. "stream-json" format is for structured output, not real-time streaming
 * 4. We need to optimize for the actual Claude CLI behavior
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface OptimizedStreamingOptions {
  workingDirectory?: string;
  timeout?: number;
  useSimplePrompt?: boolean; // Skip complex prompting to reduce latency
}

export interface OptimizedCallbacks {
  onStart?: () => void;
  onProgress?: (stage: string) => void; // Show progress instead of fake chunks
  onComplete: (response: string, metrics: ResponseMetrics) => void;
  onError?: (error: Error) => void;
}

export interface ResponseMetrics {
  startTime: number;
  completionTime: number;
  totalDuration: number;
  apiDuration?: number;
  initDuration?: number;
  success: boolean;
}

export class OptimizedClaudeService extends EventEmitter {
  
  /**
   * Optimized query that works with Claude CLI's actual behavior
   */
  async optimizedQuery(
    userMessage: string,
    callbacks: OptimizedCallbacks,
    options: OptimizedStreamingOptions = {}
  ): Promise<ResponseMetrics> {
    
    const metrics: ResponseMetrics = {
      startTime: Date.now(),
      completionTime: 0,
      totalDuration: 0,
      success: false
    };
    
    try {
      callbacks.onStart?.();
      callbacks.onProgress?.('Initializing Claude CLI...');
      
      // Use simple prompt without complex streaming setup
      const args = ['-p', userMessage];
      
      if (options.timeout) {
        // Add timeout handling if needed
      }
      
      callbacks.onProgress?.('Sending request to Claude...');
      
      const claudeProcess = spawn('claude', args, {
        cwd: options.workingDirectory || process.cwd(),
        stdio: ['inherit', 'pipe', 'pipe']
      });
      
      let responseBuffer = '';
      let errorBuffer = '';
      
      // Collect the full response
      claudeProcess.stdout.on('data', (data: Buffer) => {
        responseBuffer += data.toString();
        // Show progress periodically
        if (responseBuffer.length > 0 && responseBuffer.length % 100 === 0) {
          callbacks.onProgress?.('Receiving response...');
        }
      });
      
      claudeProcess.stderr.on('data', (data: Buffer) => {
        errorBuffer += data.toString();
      });
      
      return new Promise((resolve, reject) => {
        claudeProcess.on('close', (code) => {
          metrics.completionTime = Date.now();
          metrics.totalDuration = metrics.completionTime - metrics.startTime;
          
          if (code === 0) {
            metrics.success = true;
            callbacks.onComplete(responseBuffer.trim(), metrics);
            resolve(metrics);
          } else {
            const error = new Error(`Claude CLI failed with code ${code}: ${errorBuffer}`);
            callbacks.onError?.(error);
            reject(error);
          }
        });
        
        claudeProcess.on('error', (err) => {
          const error = new Error(`Failed to spawn Claude CLI: ${err.message}`);
          callbacks.onError?.(error);
          reject(error);
        });
      });
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks.onError?.(err);
      throw err;
    }
  }
  
  /**
   * Quick greeting with minimal overhead
   */
  async quickGreeting(
    userQuery: string,
    callbacks: OptimizedCallbacks,
    options: OptimizedStreamingOptions = {}
  ): Promise<ResponseMetrics> {
    
    // Use simple, direct prompt to reduce processing time
    const simplePrompt = options.useSimplePrompt 
      ? userQuery 
      : `User: ${userQuery}\n\nRespond naturally and helpfully.`;
    
    return this.optimizedQuery(simplePrompt, callbacks, options);
  }
  
  /**
   * Health check with timing
   */
  async healthCheck(): Promise<{ available: boolean; version?: string; baseLatency: number }> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const child = spawn('claude', ['--version'], { stdio: 'pipe' });
      let output = '';
      
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        if (code === 0) {
          resolve({
            available: true,
            version: output.trim(),
            baseLatency: duration
          });
        } else {
          resolve({
            available: false,
            baseLatency: duration
          });
        }
      });
      
      child.on('error', () => {
        const duration = Date.now() - startTime;
        resolve({
          available: false,
          baseLatency: duration
        });
      });
    });
  }
}

// Export singleton
export const optimizedClaudeService = new OptimizedClaudeService();
