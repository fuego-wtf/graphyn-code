/**
 * Claude API Wrapper for Graphyn Orchestrator
 * Migrated from src/core/ClaudeAPIWrapper.ts
 *
 * Provides headless Claude Code integration with streaming support
 */
import { EventEmitter } from 'events';
interface ClaudeMessage {
    role: 'user' | 'assistant';
    content: string;
}
interface ClaudeTool {
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}
export interface AgentStreamUpdate {
    type: 'status' | 'progress' | 'output' | 'tool_use' | 'feedback_request' | 'completion';
    status?: 'analyzing' | 'executing' | 'waiting' | 'completed' | 'failed';
    progress?: number;
    output?: string;
    toolName?: string;
    toolInput?: any;
    feedbackRequest?: string;
    result?: any;
}
export declare class ClaudeAPIWrapper extends EventEmitter {
    private apiKey;
    private model;
    private contextWindow;
    constructor(config: {
        apiKey: string;
        model?: string;
        contextWindow?: number;
    });
    streamExecution(messages: ClaudeMessage[], tools: ClaudeTool[], systemPrompt?: string): AsyncGenerator<AgentStreamUpdate>;
    private buildPrompt;
    private spawnClaudeProcess;
    private parseClaudeStreamChunk;
    private generateRealisticToolInput;
    private delay;
    validateApiKey(): Promise<boolean>;
    estimateTokens(content: string): Promise<number>;
    summarizeContext(context: string, maxTokens: number): Promise<string>;
}
export {};
//# sourceMappingURL=claude-api-wrapper.d.ts.map