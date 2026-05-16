import { AIProvider, AIMessage, ProviderResponse, StreamChunk, ProviderConfig, ProviderInfo } from './ai-provider.js';

const DEFAULT_BASE_URL = 'http://localhost:1234/v1';

export class LMStudioProvider extends AIProvider {
  readonly info: ProviderInfo = {
    type: 'lmstudio',
    name: 'LM Studio',
    description: 'Local LLM via LM Studio (OpenAI-compatible API)',
    requiresApiKey: false,
    requiresLocalServer: true,
  };

  private detectedModel: string | null = null;

  constructor(config: ProviderConfig = {}) {
    super({
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
      ...config,
    });
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
    try {
      new URL(baseUrl);
    } catch {
      return { valid: false, error: `Invalid LM Studio URL: ${baseUrl}` };
    }
    return { valid: true };
  }

  private async detectModel(): Promise<string> {
    if (this.detectedModel) return this.detectedModel;

    const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
    const response = await fetch(`${baseUrl}/models`);
    if (!response.ok) throw new Error(`Failed to list models: ${response.statusText}`);

    const data = await response.json() as { data: Array<{ id: string }> };
    if (data.data && data.data.length > 0) {
      this.detectedModel = data.data[0].id;
      return this.detectedModel;
    }
    throw new Error('No models loaded in LM Studio');
  }

  private buildBody(messages: AIMessage[], stream: boolean): Record<string, unknown> {
    const systemMessage = messages.find(m => m.role === 'system');
    const formattedMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));

    if (systemMessage) {
      formattedMessages.unshift({ role: 'system', content: systemMessage.content });
    }

    return {
      model: this.config.model || this.detectedModel || undefined,
      messages: formattedMessages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxOutputTokens,
      stream,
    };
  }

  async chat(messages: AIMessage[]): Promise<ProviderResponse> {
    const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
    const startTime = Date.now();

    await this.detectModel();

    const body = this.buildBody(messages, false);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LM Studio API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      result: data.choices[0].message.content,
      model: data.model,
      usage: data.usage ? {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      } : undefined,
      duration: Date.now() - startTime,
    };
  }

  async *chatStream(messages: AIMessage[]): AsyncGenerator<StreamChunk> {
    const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
    await this.detectModel();

    const body = this.buildBody(messages, true);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      yield { type: 'error', error: `LM Studio API error: ${response.status} ${errorText}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response body for streaming' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const parsed = JSON.parse(trimmed.slice(6));
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            yield { type: 'text', content: delta.content };
          }
        } catch {
          // Skip malformed SSE chunks
        }
      }
    }

    yield { type: 'done' };
  }

  async healthCheck(): Promise<{ healthy: boolean; model?: string; error?: string }> {
    try {
      const validation = await this.validateConfig();
      if (!validation.valid) return { healthy: false, error: validation.error };

      const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
      const response = await fetch(`${baseUrl}/models`);
      if (!response.ok) return { healthy: false, error: `LM Studio not responding (${response.status})` };

      const data = await response.json() as { data: Array<{ id: string }> };
      if (!data.data || data.data.length === 0) {
        return { healthy: false, error: 'No models loaded in LM Studio' };
      }

      return { healthy: true, model: data.data[0].id };
    } catch (error) {
      return {
        healthy: false,
        error: `LM Studio not available at ${this.config.baseUrl || DEFAULT_BASE_URL}. Make sure LM Studio is running with an API server enabled.`,
      };
    }
  }
}
