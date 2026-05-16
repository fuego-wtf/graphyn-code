import { EventEmitter } from 'events';

export type ProviderType = 'gemini' | 'lmstudio' | 'claude-cli';

export interface ProviderInfo {
  type: ProviderType;
  name: string;
  description: string;
  requiresApiKey: boolean;
  requiresLocalServer: boolean;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  maxTurns?: number;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface ProviderResponse {
  result: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  duration: number;
}

export interface StreamChunk {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'done' | 'error';
  content?: string;
  error?: string;
}

export abstract class AIProvider extends EventEmitter {
  abstract readonly info: ProviderInfo;
  protected config: ProviderConfig;

  constructor(config: ProviderConfig = {}) {
    super();
    this.config = {
      maxTurns: 10,
      temperature: 0.7,
      ...config,
    };
  }

  abstract chat(messages: AIMessage[]): Promise<ProviderResponse>;

  abstract chatStream(messages: AIMessage[]): AsyncGenerator<StreamChunk>;

  abstract healthCheck(): Promise<{ healthy: boolean; model?: string; error?: string }>;

  abstract validateConfig(): Promise<{ valid: boolean; error?: string }>;
}
