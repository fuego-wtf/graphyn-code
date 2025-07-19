import { FigmaAPIClient } from '../../figma-api.js';
import { figmaAuth } from './figmaAuth.js';

interface FigmaUser {
  id: string;
  email: string;
  handle: string;
}

export class FigmaApi {
  private client: FigmaAPIClient | null = null;

  private getClient(): FigmaAPIClient {
    const tokens = figmaAuth.getTokens();
    if (!tokens) {
      throw new Error('Not authenticated with Figma');
    }

    if (!this.client) {
      this.client = new FigmaAPIClient(tokens.access_token);
    }

    return this.client;
  }

  async getUser(): Promise<FigmaUser> {
    const tokens = figmaAuth.getTokens();
    if (!tokens) {
      throw new Error('Not authenticated with Figma');
    }

    try {
      const response = await fetch('https://api.figma.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Figma API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data as FigmaUser;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to fetch user information');
    }
  }

  parseUrl(url: string): { fileKey: string; nodeId?: string } {
    return this.getClient().parseUrl(url);
  }

  async analyzePrototype(url: string, progressCallback?: (message: string) => void) {
    return this.getClient().analyzePrototype(url, progressCallback);
  }

  async extractComponentsFromFrame(fileKey: string, nodeId: string, progressCallback?: (message: string) => void) {
    return this.getClient().extractComponentsFromFrame(fileKey, nodeId, progressCallback);
  }
}

export const figmaApi = new FigmaApi();