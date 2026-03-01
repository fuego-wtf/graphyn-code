/**
 * Type declarations for @anthropic-ai/claude-code SDK
 * This is a stub for the proprietary Claude Code SDK
 */

declare module "@anthropic-ai/claude-code" {
  export type PermissionMode = 'default' | 'accept-all' | 'reject-all' | 'custom';

  export interface SDKMessage {
    type: string;
    content?: string;
    tool?: {
      name: string;
      input?: any;
    };
    message?: {
      content?: string;
      role?: string;
      stop_reason?: string;
    };
    result?: any;
    subtype?: string;
    session_id?: string;
    cost_usd?: number;
    total_cost_usd?: number;
    duration_ms?: number;
    token_usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_read_tokens: number;
    };
  }

  export interface QueryOptions {
    prompt: string;
    abortController?: AbortController;
    options?: {
      maxTurns?: number;
      appendSystemPrompt?: string;
      allowedTools?: string[];
      model?: string;
      permissionMode?: PermissionMode;
      mcpServers?: Record<string, any>;
      resume?: string;
      abortController?: AbortController;
    };
  }

  export function query(options: QueryOptions): AsyncIterable<SDKMessage>;
}
