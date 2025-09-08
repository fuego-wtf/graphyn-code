/**
 * Claude Code SDK Client Wrapper
 * 
 * Provides a clean interface to the Claude Code SDK with OAuth authentication,
 * streaming support, and session management for multi-turn conversations.
 */

import { query, type SDKMessage, type PermissionMode } from "@anthropic-ai/claude-code";
import { z } from "zod";
import { EventEmitter } from 'events';

export interface ClaudeCodeOptions {
  maxTurns?: number;
  appendSystemPrompt?: string;
  allowedTools?: string[];
  abortController?: AbortController;
  model?: string;
  permissionMode?: PermissionMode;
  mcpServers?: Record<string, any>;
  resume?: string; // Session ID for resuming conversations
}

export interface ExecutionMetrics {
  duration_ms: number;
  total_cost_usd: number;
  token_usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
  };
  tool_calls: number;
  turns: number;
}

export interface ClaudeResult {
  result: string;
  metrics: ExecutionMetrics;
  sessionId: string;
}

export type ClaudeStreamCallback = (message: SDKMessage) => void;

/**
 * Main Claude Code SDK wrapper class
 */
export class ClaudeCodeClient extends EventEmitter {
  private sessionId?: string;
  private abortController?: AbortController;
  private retryCount = 0;
  private maxRetries = 3;
  private metrics: ExecutionMetrics[] = [];

  constructor() {
    super();
  }

  /**
   * Execute a query with streaming support
   */
  async *executeQueryStream(
    prompt: string, 
    options: ClaudeCodeOptions = {}
  ): AsyncGenerator<SDKMessage> {
    const startTime = Date.now();
    this.abortController = options.abortController || new AbortController();
    
    let toolCalls = 0;
    let sessionId = options.resume || this.sessionId;
    
    try {
      this.emit('debug', `Starting Claude query with prompt length: ${prompt.length}`);
      
      for await (const message of query({
        prompt,
        options: {
          maxTurns: options.maxTurns || 10,
          appendSystemPrompt: options.appendSystemPrompt,
          allowedTools: options.allowedTools || [
            'Bash', 'Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep',
            'WebFetch', 'WebSearch', 'NotebookEdit', 'Task'
          ],
          abortController: this.abortController,
          model: options.model || 'claude-3-5-sonnet-20241022',
          permissionMode: options.permissionMode,
          mcpServers: options.mcpServers
        }
      })) {
        this.emit('debug', `Received message: ${message.type}`);
        
        // Log any errors or important messages
        if ('error' in message && message.error) {
          this.emit('debug', `Claude error: ${JSON.stringify(message)}`);
        }
        // Track session ID
        if (message.type === "system" && 'subtype' in message && message.subtype === "init") {
          sessionId = (message as any).session_id;
          this.sessionId = sessionId;
        }
        
        // Count tool calls
        if (message.type === "assistant" && 
            message.message.stop_reason === "tool_use") {
          toolCalls++;
        }
        
        // Track final metrics
        if (message.type === "result") {
          const finalMetrics: ExecutionMetrics = {
            duration_ms: (message as any).duration_ms,
            total_cost_usd: (message as any).total_cost_usd,
            token_usage: {
              input_tokens: (message as any).usage.input_tokens,
              output_tokens: (message as any).usage.output_tokens,
              cache_read_tokens: (message as any).usage.cache_read_input_tokens || 0,
            },
            tool_calls: toolCalls,
            turns: (message as any).num_turns || 0
          };
          
          this.metrics.push(finalMetrics);
        }
        
        yield message;
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Execute a query and return the final result
   */
  async executeQuery(
    prompt: string, 
    options: ClaudeCodeOptions = {}
  ): Promise<ClaudeResult> {
    let finalResult = "";
    let finalMetrics: ExecutionMetrics;
    let sessionId = "";
    
    for await (const message of this.executeQueryStream(prompt, options)) {
      if (message.type === "system" && 'subtype' in message && message.subtype === "init") {
        sessionId = (message as any).session_id;
      }
      
      if (message.type === "result") {
        if ('subtype' in message && message.subtype === "success") {
          finalResult = (message as any).result || "";
        }
        
        finalMetrics = {
          duration_ms: (message as any).duration_ms,
          total_cost_usd: (message as any).total_cost_usd,
          token_usage: {
            input_tokens: (message as any).usage.input_tokens,
            output_tokens: (message as any).usage.output_tokens,
            cache_read_tokens: (message as any).usage.cache_read_input_tokens || 0,
          },
          tool_calls: 0, // Will be updated during streaming
          turns: (message as any).num_turns || 0
        };
        
        if ('subtype' in message && message.subtype === "success") {
          return {
            result: finalResult,
            metrics: finalMetrics,
            sessionId
          };
        } else {
          throw new Error(`Query failed: ${(message as any).subtype}`);
        }
      }
    }
    
    throw new Error("Query completed without result");
  }

  /**
   * Execute query with retry logic
   */
  async executeWithRetry(
    prompt: string, 
    options: ClaudeCodeOptions = {}
  ): Promise<ClaudeResult> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.executeQuery(prompt, options);
      } catch (error) {
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        this.emit('retry', { attempt, error });
      }
    }
    
    throw new Error("Max retries exceeded");
  }

  /**
   * Continue a conversation with an existing session
   */
  async continueConversation(
    prompt: string, 
    options: ClaudeCodeOptions = {}
  ): Promise<ClaudeResult> {
    if (!this.sessionId) {
      throw new Error("No active session to continue");
    }
    
    return this.executeQuery(prompt, { 
      ...options,
      resume: this.sessionId 
    });
  }

  /**
   * Abort the current query
   */
  abort() {
    this.abortController?.abort();
    this.emit('aborted');
  }

  /**
   * Get average metrics across all queries
   */
  getAverageMetrics(): ExecutionMetrics | null {
    if (this.metrics.length === 0) {
      return null;
    }
    
    return {
      duration_ms: this.metrics.reduce((sum, m) => sum + m.duration_ms, 0) / this.metrics.length,
      total_cost_usd: this.metrics.reduce((sum, m) => sum + m.total_cost_usd, 0) / this.metrics.length,
      token_usage: {
        input_tokens: this.metrics.reduce((sum, m) => sum + m.token_usage.input_tokens, 0) / this.metrics.length,
        output_tokens: this.metrics.reduce((sum, m) => sum + m.token_usage.output_tokens, 0) / this.metrics.length,
        cache_read_tokens: this.metrics.reduce((sum, m) => sum + m.token_usage.cache_read_tokens, 0) / this.metrics.length,
      },
      tool_calls: this.metrics.reduce((sum, m) => sum + m.tool_calls, 0) / this.metrics.length,
      turns: this.metrics.reduce((sum, m) => sum + m.turns, 0) / this.metrics.length
    };
  }

  /**
   * Clear session and metrics
   */
  reset() {
    this.sessionId = undefined;
    this.abortController = undefined;
    this.metrics = [];
    this.retryCount = 0;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Check if client has an active session
   */
  hasActiveSession(): boolean {
    return !!this.sessionId;
  }
}

/**
 * Utility function to create a pre-configured client
 */
export function createClaudeClient(options?: Partial<ClaudeCodeOptions>): ClaudeCodeClient {
  const client = new ClaudeCodeClient();
  
  // Set up default event handlers
  client.on('error', (error) => {
    console.error('Claude Code SDK Error:', error);
  });
  
  client.on('retry', ({ attempt, error }) => {
    console.warn(`Retrying Claude request (attempt ${attempt + 1}):`, error.message);
  });
  
  return client;
}

/**
 * Simple utility for one-off queries
 */
export async function queryClaudeCode(
  prompt: string,
  options?: ClaudeCodeOptions
): Promise<string> {
  const client = createClaudeClient();
  const result = await client.executeQuery(prompt, options);
  return result.result;
}