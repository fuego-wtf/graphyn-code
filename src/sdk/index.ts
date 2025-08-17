/**
 * Graphyn SDK Client
 * 
 * This is a wrapper around the generated OpenAPI client that includes
 * OAuth authentication and other enhancements for the CLI.
 */

import { Configuration, DefaultApi } from './generated';
import { OAuthManager } from '../auth/oauth.js';

export interface GraphynSDKOptions {
  apiBaseUrl?: string;
  accessToken?: string;
  oauthManager?: OAuthManager;
}

/**
 * Main SDK client class with OAuth authentication
 */
export class GraphynSDK {
  private api: DefaultApi;
  private oauthManager?: OAuthManager;

  constructor(options: GraphynSDKOptions = {}) {
    const apiBaseUrl = options.apiBaseUrl || process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz';
    
    // Configure the generated client
    const configuration = new Configuration({
      basePath: apiBaseUrl,
      accessToken: options.accessToken,
    });

    this.api = new DefaultApi(configuration);
    this.oauthManager = options.oauthManager;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  private async getAccessToken(): Promise<string | undefined> {
    if (this.oauthManager) {
      return await this.oauthManager.getValidToken();
    }
    return undefined;
  }

  /**
   * Update the API configuration with a new access token
   */
  private async updateConfiguration() {
    const token = await this.getAccessToken();
    if (token) {
      this.api.configuration.accessToken = token;
    }
  }

  // Threads API
  async createThread(data: any) {
    await this.updateConfiguration();
    return this.api.apiThreadsPost(data);
  }

  async getThread(id: string) {
    await this.updateConfiguration();
    return this.api.apiThreadsIdGet(id);
  }

  async listThreads() {
    await this.updateConfiguration();
    return this.api.apiThreadsGet();
  }

  async sendMessage(threadId: string, content: string) {
    await this.updateConfiguration();
    return this.api.apiThreadsIdMessagesPost(threadId, { content });
  }

  async getMessages(threadId: string, limit?: number, offset?: number) {
    await this.updateConfiguration();
    return this.api.apiThreadsIdMessagesGet(threadId, limit, offset);
  }

  // Auth API
  async validateApiKey(apiKey: string) {
    return this.api.apiAuthValidatePost({ api_key: apiKey });
  }

  async refreshToken(refreshToken: string) {
    return this.api.apiAuthRefreshPost({ refresh_token: refreshToken });
  }

  // Chat Completions (OpenAI-compatible)
  async createChatCompletion(data: any) {
    await this.updateConfiguration();
    return this.api.apiChatCompletionsPost(data);
  }

  async listModels() {
    await this.updateConfiguration();
    return this.api.apiModelsGet();
  }

  // Direct access to the underlying API client
  get client() {
    return this.api;
  }
}

// Re-export generated types
export * from './generated';
