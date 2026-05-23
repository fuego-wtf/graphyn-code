import fs from 'fs';
import path from 'path';
import os from 'os';
import { AIProvider, ProviderType, ProviderConfig } from './ai-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { LMStudioProvider } from './lmstudio-provider.js';
import { ClaudeCLIProvider } from './claude-cli-provider.js';

export interface ProviderManagerConfig {
  selectedProvider?: ProviderType;
  geminiApiKey?: string;
  lmStudioUrl?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.graphyn');
const CONFIG_FILE = path.join(CONFIG_DIR, 'provider-config.json');

export class ProviderManager {
  private provider: AIProvider | null = null;
  private config: ProviderManagerConfig;

  constructor(config: ProviderManagerConfig = {}) {
    this.config = {
      ...this.loadPersistedConfig(),
      ...config,
    };
  }

  private loadPersistedConfig(): Partial<ProviderManagerConfig> {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      }
    } catch {
      // Ignore read errors
    }
    return {};
  }

  saveConfig(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), { mode: 0o600 });
  }

  getAvailableProviders(): Array<{ type: ProviderType; name: string; description: string }> {
    return [
      { type: 'gemini', name: 'Gemini API', description: 'Google Gemini via API key' },
      { type: 'lmstudio', name: 'LM Studio', description: 'Local LLM via LM Studio' },
      { type: 'claude-cli', name: 'Claude CLI', description: 'Claude Code CLI' },
    ];
  }

  async selectProvider(type: ProviderType): Promise<AIProvider> {
    this.config.selectedProvider = type;
    this.provider = this.createProvider(type);
    this.saveConfig();
    return this.provider;
  }

  getProvider(): AIProvider | null {
    if (this.provider) return this.provider;
    if (this.config.selectedProvider) {
      this.provider = this.createProvider(this.config.selectedProvider);
      return this.provider;
    }
    return null;
  }

  private createProvider(type: ProviderType): AIProvider {
    const envApiKey = process.env.GEMINI_API_KEY;
    const envLmUrl = process.env.LM_STUDIO_URL;

    switch (type) {
      case 'gemini': {
        const apiKey = this.config.geminiApiKey || envApiKey;
        if (!apiKey) throw new Error('GEMINI_API_KEY not set. Run: graphyn provider set gemini --key <key>');
        return new GeminiProvider({ apiKey });
      }
      case 'lmstudio': {
        return new LMStudioProvider({ baseUrl: this.config.lmStudioUrl || envLmUrl });
      }
      case 'claude-cli': {
        return new ClaudeCLIProvider();
      }
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }

  async healthCheck(type?: ProviderType): Promise<{ type: ProviderType; healthy: boolean; model?: string; error?: string }> {
    const targetType = type || this.config.selectedProvider;
    if (!targetType) return { type: 'gemini', healthy: false, error: 'No provider selected' };

    const provider = this.createProvider(targetType);
    const result = await provider.healthCheck();
    return { type: targetType, ...result };
  }

  getSelectedProvider(): ProviderType | undefined {
    return this.config.selectedProvider;
  }

  getConfig(): ProviderManagerConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<ProviderManagerConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }
}
