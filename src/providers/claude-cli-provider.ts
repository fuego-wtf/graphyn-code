import { spawn } from 'child_process';
import { AIProvider, AIMessage, ProviderResponse, StreamChunk, ProviderConfig, ProviderInfo } from './ai-provider.js';

export class ClaudeCLIProvider extends AIProvider {
  readonly info: ProviderInfo = {
    type: 'claude-cli',
    name: 'Claude CLI',
    description: 'Claude Code CLI (requires claude command in PATH)',
    requiresApiKey: false,
    requiresLocalServer: false,
  };

  constructor(config: ProviderConfig = {}) {
    super(config);
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    return new Promise((resolve) => {
      const child = spawn('which', ['claude'], { stdio: 'pipe' });
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ valid: true });
        } else {
          resolve({ valid: false, error: 'Claude CLI not found in PATH. Install with: npm install -g @anthropic-ai/claude-code' });
        }
      });
      child.on('error', () => {
        resolve({ valid: false, error: 'Failed to check for Claude CLI' });
      });
    });
  }

  async chat(messages: AIMessage[]): Promise<ProviderResponse> {
    const startTime = Date.now();
    const prompt = this.buildPrompt(messages);

    return new Promise((resolve, reject) => {
      const child = spawn('claude', ['-p', prompt, '--output', 'text', '--max-turns', String(this.config.maxTurns || 10)], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            result: output.trim(),
            model: 'claude-code-cli',
            duration: Date.now() - startTime,
          });
        } else {
          reject(new Error(`Claude CLI exited with code ${code}: ${errorOutput}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  async *chatStream(messages: AIMessage[]): AsyncGenerator<StreamChunk> {
    const prompt = this.buildPrompt(messages);

    const child = spawn('claude', ['-p', prompt, '--max-turns', String(this.config.maxTurns || 10)], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const streamPromise = new Promise<void>((resolve, reject) => {
      child.stdout?.on('data', (data) => {
        const text = data.toString();
        this.emit('chunk', { type: 'text' as const, content: text });
      });

      child.stderr?.on('data', (data) => {
        this.emit('chunk', { type: 'text' as const, content: data.toString() });
      });

      child.on('close', () => {
        this.emit('chunk', { type: 'done' as const });
        resolve();
      });

      child.on('error', (err) => {
        this.emit('chunk', { type: 'error' as const, error: err.message });
        reject(err);
      });
    });

    // Yield chunks via event emitter
    const chunkQueue: StreamChunk[] = [];
    const onChunk = (chunk: StreamChunk) => { chunkQueue.push(chunk); };
    this.on('chunk', onChunk);

    try {
      while (true) {
        while (chunkQueue.length > 0) {
          yield chunkQueue.shift()!;
        }
        const lastChunk = chunkQueue[chunkQueue.length - 1];
        if (lastChunk?.type === 'done' || lastChunk?.type === 'error') break;
        await new Promise(r => setTimeout(r, 50));
      }
    } finally {
      this.off('chunk', onChunk);
    }

    await streamPromise;
  }

  async healthCheck(): Promise<{ healthy: boolean; model?: string; error?: string }> {
    const validation = await this.validateConfig();
    if (!validation.valid) return { healthy: false, error: validation.error };

    return new Promise((resolve) => {
      const child = spawn('claude', ['--version'], { stdio: 'pipe' });
      let output = '';
      child.stdout?.on('data', (data) => { output += data.toString(); });
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ healthy: true, model: output.trim() });
        } else {
          resolve({ healthy: false, error: 'Claude CLI version check failed' });
        }
      });
      child.on('error', () => {
        resolve({ healthy: false, error: 'Claude CLI not found' });
      });
    });
  }

  private buildPrompt(messages: AIMessage[]): string {
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    let prompt = '';
    if (systemMessage) {
      prompt += `${systemMessage.content}\n\n`;
    }
    prompt += userMessages.map(m => m.content).join('\n\n');
    return prompt;
  }
}
