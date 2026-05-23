import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { AIProvider, AIMessage, ProviderResponse, StreamChunk, ProviderConfig, ProviderInfo } from './ai-provider.js';

const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';

export class GeminiProvider extends AIProvider {
  readonly info: ProviderInfo = {
    type: 'gemini',
    name: 'Gemini API',
    description: 'Google Gemini via API key',
    requiresApiKey: true,
    requiresLocalServer: false,
  };

  private client: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;

  constructor(config: ProviderConfig = {}) {
    super(config);
    if (config.apiKey) {
      this.client = new GoogleGenerativeAI(config.apiKey);
      this.model = this.client.getGenerativeModel({
        model: config.model || GEMINI_MODEL,
      });
    }
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    if (!this.config.apiKey) {
      return { valid: false, error: 'GEMINI_API_KEY is required' };
    }
    if (!this.config.apiKey.startsWith('AIza')) {
      return { valid: false, error: 'Invalid Gemini API key format' };
    }
    return { valid: true };
  }

  async chat(messages: AIMessage[]): Promise<ProviderResponse> {
    if (!this.model) throw new Error('Gemini provider not initialized');
    const startTime = Date.now();

    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const chat = this.model.startChat({
      history: conversationMessages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    });

    const lastMessage = conversationMessages[conversationMessages.length - 1];
    const result = await chat.sendMessage(
      systemMessage ? `${systemMessage.content}\n\n${lastMessage.content}` : lastMessage.content
    );

    const text = result.response.text();
    const usage = result.response.usageMetadata;

    return {
      result: text,
      model: this.config.model || GEMINI_MODEL,
      usage: usage ? {
        inputTokens: usage.promptTokenCount,
        outputTokens: usage.candidatesTokenCount,
      } : undefined,
      duration: Date.now() - startTime,
    };
  }

  async *chatStream(messages: AIMessage[]): AsyncGenerator<StreamChunk> {
    if (!this.model) throw new Error('Gemini provider not initialized');

    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const chat = this.model.startChat({
      history: conversationMessages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    });

    const lastMessage = conversationMessages[conversationMessages.length - 1];
    const streamResult = await chat.sendMessageStream(
      systemMessage ? `${systemMessage.content}\n\n${lastMessage.content}` : lastMessage.content
    );

    for await (const chunk of streamResult.stream) {
      const text = chunk.text();
      if (text) {
        yield { type: 'text', content: text };
      }
    }

    yield { type: 'done' };
  }

  async healthCheck(): Promise<{ healthy: boolean; model?: string; error?: string }> {
    try {
      const validation = await this.validateConfig();
      if (!validation.valid) return { healthy: false, error: validation.error };

      const result = await this.chat([{ role: 'user', content: 'Say "ok" in one word.' }]);
      return { healthy: true, model: result.model };
    } catch (error) {
      return { healthy: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
