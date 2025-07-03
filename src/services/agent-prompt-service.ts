import fs from 'fs';
import path from 'path';
import { GraphynAPIClient } from '../ink/services/graphynApi.js';
import { ConfigManager } from '../config-manager.js';

export interface AgentPrompt {
  id: string;
  name: string;
  content: string;
  type: 'backend' | 'frontend' | 'architect' | 'cli' | 'design' | 'custom';
  version?: string;
  lastUpdated?: string;
}

export class AgentPromptService {
  private apiClient: GraphynAPIClient | null = null;
  private promptsDir: string;
  private config: ConfigManager;
  private cacheDir: string;
  
  constructor() {
    this.config = new ConfigManager();
    this.promptsDir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'prompts');
    this.cacheDir = path.join(this.config.getConfigDir(), 'prompt-cache');
    
    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }
  
  /**
   * Initialize API client if authenticated
   */
  private async initApiClient(): Promise<boolean> {
    if (this.apiClient) return true;
    
    const tokens = await this.config.get('tokens') as any;
    if (!tokens?.access_token) return false;
    
    this.apiClient = new GraphynAPIClient({
      apiKey: tokens.access_token,
      baseURL: process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz'
    });
    
    return true;
  }
  
  /**
   * Get agent prompt - tries API first, falls back to local
   */
  async getAgentPrompt(type: string): Promise<string> {
    // Try to get dynamic prompt from API
    const dynamicPrompt = await this.getDynamicPrompt(type);
    if (dynamicPrompt) {
      return dynamicPrompt;
    }
    
    // Fall back to local prompt
    return this.getLocalPrompt(type);
  }
  
  /**
   * Get dynamic prompt from API
   */
  private async getDynamicPrompt(type: string): Promise<string | null> {
    try {
      // Check if we can use API
      if (!await this.initApiClient()) {
        return null;
      }
      
      // Check cache first (valid for 1 hour)
      const cachedPrompt = this.getCachedPrompt(type);
      if (cachedPrompt) {
        return cachedPrompt;
      }
      
      // Fetch from API
      const response = await this.apiClient!.get(`/v1/agents/${type}/prompt`);
      
      if (response.data?.content) {
        // Cache the prompt
        this.cachePrompt(type, response.data.content);
        return response.data.content;
      }
      
      return null;
    } catch (error) {
      // Silently fall back to local prompts
      return null;
    }
  }
  
  /**
   * Get cached prompt if still valid
   */
  private getCachedPrompt(type: string): string | null {
    try {
      const cacheFile = path.join(this.cacheDir, `${type}.json`);
      if (!fs.existsSync(cacheFile)) return null;
      
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      const cacheAge = Date.now() - cached.timestamp;
      const ONE_HOUR = 60 * 60 * 1000;
      
      if (cacheAge < ONE_HOUR) {
        return cached.content;
      }
      
      // Cache expired
      fs.unlinkSync(cacheFile);
      return null;
    } catch {
      return null;
    }
  }
  
  /**
   * Cache a prompt
   */
  private cachePrompt(type: string, content: string): void {
    try {
      const cacheFile = path.join(this.cacheDir, `${type}.json`);
      fs.writeFileSync(cacheFile, JSON.stringify({
        content,
        timestamp: Date.now(),
        type
      }));
    } catch {
      // Caching is optional, ignore errors
    }
  }
  
  /**
   * Get local prompt from file system
   */
  private getLocalPrompt(type: string): string {
    const promptFile = path.join(this.promptsDir, `${type}.md`);
    
    if (!fs.existsSync(promptFile)) {
      throw new Error(`Agent prompt not found: ${type}`);
    }
    
    return fs.readFileSync(promptFile, 'utf8');
  }
  
  /**
   * List available agent types
   */
  async listAgentTypes(): Promise<string[]> {
    const localTypes = this.getLocalAgentTypes();
    
    // Try to get dynamic types from API
    if (await this.initApiClient()) {
      try {
        const response = await this.apiClient!.get('/v1/agents');
        if (response.data?.agents) {
          const dynamicTypes = response.data.agents.map((a: any) => a.type);
          // Merge with local types (unique)
          return [...new Set([...localTypes, ...dynamicTypes])];
        }
      } catch {
        // Fall back to local types
      }
    }
    
    return localTypes;
  }
  
  /**
   * Get local agent types from file system
   */
  private getLocalAgentTypes(): string[] {
    try {
      const files = fs.readdirSync(this.promptsDir);
      return files
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace('.md', ''));
    } catch {
      return ['backend', 'frontend', 'architect', 'cli', 'design'];
    }
  }
  
  /**
   * Update local prompt cache from API
   */
  async updatePromptCache(): Promise<void> {
    if (!await this.initApiClient()) {
      throw new Error('Not authenticated');
    }
    
    try {
      const response = await this.apiClient!.get('/v1/agents');
      if (!response.data?.agents) return;
      
      for (const agent of response.data.agents) {
        try {
          const promptResponse = await this.apiClient!.get(`/v1/agents/${agent.type}/prompt`);
          if (promptResponse.data?.content) {
            this.cachePrompt(agent.type, promptResponse.data.content);
          }
        } catch {
          // Skip individual failures
        }
      }
    } catch (error) {
      throw new Error('Failed to update prompt cache');
    }
  }
  
  /**
   * Clear prompt cache
   */
  clearCache(): void {
    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.cacheDir, file));
      }
    } catch {
      // Ignore errors
    }
  }
}