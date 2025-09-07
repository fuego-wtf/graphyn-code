/**
 * Global Type Declarations for Graphyn CLI
 * 
 * PROCESS-001: Type System Integration
 * Fixes missing Claude Code SDK declarations and global Task function
 */

// ============================================================================
// CLAUDE CODE SDK INTEGRATION
// ============================================================================

/**
 * Claude Code SDK Task function
 * Used in clyde/interactive-shell.ts and engines/standalone-engine.ts
 */
declare global {
  /**
   * Claude Code Task tool for agent orchestration
   */
  const Task: {
    /**
     * Execute a task with the given parameters
     */
    (params: TaskParams): Promise<TaskResult>;
    
    /**
     * Check if Task is available in the current environment
     */
    available?: boolean;
  };

  /**
   * Task parameters for Claude Code SDK
   */
  interface TaskParams {
    description: string;
    prompt: string;
    subagent_type?: string;
    context?: Record<string, unknown>;
    tools?: string[];
    timeout?: number;
  }

  /**
   * Task execution result
   */
  interface TaskResult {
    success: boolean;
    result?: any;
    error?: string;
    duration: number;
    timestamp: Date;
  }

  // Node.js process extensions for CLI environment
  namespace NodeJS {
    interface ProcessEnv {
      GRAPHYN_API_KEY?: string;
      GRAPHYN_BASE_URL?: string;
      FIGMA_ACCESS_TOKEN?: string;
      CLAUDE_API_KEY?: string;
      NODE_ENV?: 'development' | 'production' | 'test';
      DEBUG?: string;
    }

    interface Process {
      /**
       * Enhanced stdout for real-time streaming
       */
      stdout: NodeJS.WriteStream & {
        clearLine?: (dir?: number) => boolean;
        cursorTo?: (x: number, y?: number) => boolean;
        moveCursor?: (dx: number, dy: number) => boolean;
      };
    }
  }
}

// ============================================================================
// ENHANCED API TYPES FOR AGENTS AND THREADS
// ============================================================================

/**
 * Extended Agent interface with missing properties
 * Fixes PROCESS-010: API Client Type Alignment
 */
export interface EnhancedAgent {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  model?: string;
  
  // Missing properties that dynamic-engine.ts expects
  status: 'active' | 'draft' | 'inactive';
  capabilities: string[];
  created: string;        // ISO timestamp
  lastModified: string;   // ISO timestamp
  
  // Compatibility with existing created_at/updated_at
  created_at?: string;
  updated_at?: string;
}

/**
 * Extended Thread interface with missing properties
 * Fixes lastActivity error in dynamic-engine.ts
 */
export interface EnhancedThread {
  id: string;
  title?: string;
  description?: string;
  participants?: string[];
  messages?: any[];
  
  // Missing properties
  lastActivity: string;   // ISO timestamp
  status?: 'active' | 'archived' | 'closed';
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// ORCHESTRATION ENGINE TYPES
// ============================================================================

/**
 * Real-time event types for PROCESS-008: Event Streaming
 */
export interface StreamEvent {
  type: 'progress' | 'message' | 'error' | 'complete';
  timestamp: Date;
  source: string;
  data: any;
}

/**
 * Console streaming interface for real-time output
 */
export interface ConsoleStreamer {
  write(text: string): void;
  writeLine(text: string): void;
  clearLine(): void;
  updateLine(text: string): void;
  showSpinner(message: string): () => void;
  stream(events: AsyncIterable<StreamEvent>): Promise<void>;
}

// ============================================================================
// FIGMA INTEGRATION TYPES (PRESERVED)
// ============================================================================

/**
 * Figma OAuth and API types for design extraction
 */
export interface FigmaTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}

export interface FigmaApiResponse<T = any> {
  err?: string;
  status?: number;
  meta?: Record<string, any>;
  [key: string]: T;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Helper type for async generators used in orchestration
 */
export type AsyncGenerator<T> = {
  [Symbol.asyncIterator](): AsyncIterator<T>;
};

/**
 * Error with context for better debugging
 */
export interface ContextualError extends Error {
  context?: Record<string, unknown>;
  code?: string;
  process?: string; // Which PROCESS-xxx this error belongs to
}

// Export everything for module compatibility
export {};