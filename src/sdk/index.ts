/**
 * Graphyn SDK Client
 * 
 * This is a wrapper around the generated OpenAPI client that includes
 * OAuth authentication and other enhancements for the CLI.
 */

// TODO: Generate SDK files
// import { Configuration, DefaultApi } from './generated';

export interface GraphynSDKOptions {
  apiBaseUrl?: string;
  accessToken?: string;
}

/**
 * Main SDK client class with OAuth authentication
 */
export class GraphynSDK {
  // private api: DefaultApi;

  constructor(options: GraphynSDKOptions = {}) {
    // const apiBaseUrl = options.apiBaseUrl || process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz';
    
    // TODO: Configure the generated client when SDK files are generated
    // const configuration = new Configuration({
    //   basePath: apiBaseUrl,
    //   accessToken: options.accessToken,
    // });

    // this.api = new DefaultApi(configuration);
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
    // TODO: Update configuration when SDK files are generated
    // if (token) {
    //   this.api.configuration.accessToken = token;
    // }
  }

  // TODO: Implement API methods when SDK files are generated
  async createThread(data: any) {
    throw new Error('SDK generation not completed - please run SDK generation first');
  }

  async getThread(id: string) {
    throw new Error('SDK generation not completed - please run SDK generation first');
  }

  async listThreads() {
    throw new Error('SDK generation not completed - please run SDK generation first');
  }

  async sendMessage(threadId: string, content: string) {
    throw new Error('SDK generation not completed - please run SDK generation first');
  }

  async getMessages(threadId: string, limit?: number, offset?: number) {
    throw new Error('SDK generation not completed - please run SDK generation first');
  }

  async validateApiKey(apiKey: string) {
    throw new Error('SDK generation not completed - please run SDK generation first');
  }

  async refreshToken(refreshToken: string) {
    throw new Error('SDK generation not completed - please run SDK generation first');
  }

  async createChatCompletion(data: any) {
    throw new Error('SDK generation not completed - please run SDK generation first');
  }

  async listModels() {
    throw new Error('SDK generation not completed - please run SDK generation first');
  }

  get client() {
    throw new Error('SDK generation not completed - please run SDK generation first');
  }
}

// TODO: Re-export generated types when SDK files are generated
// export * from './generated';
