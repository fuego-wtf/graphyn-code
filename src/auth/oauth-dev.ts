import { OAuthManager } from './oauth.js';
import { config } from '../config.js';

/**
 * Development OAuth Manager with localhost support
 * Frontend: https://app.graphyn.xyz
 * Backend: https://api.graphyn.xyz
 */
export class DevOAuthManager extends OAuthManager {
  constructor() {
    super();
    // Override production URLs with development URLs
    this.setupDevelopmentConfig();
  }

  private setupDevelopmentConfig() {
    // Ensure we're using development URLs
    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
      process.env.GRAPHYN_API_URL = 'https://api.graphyn.xyz';
      process.env.GRAPHYN_APP_URL = 'https://app.graphyn.xyz';
      process.env.GRAPHYN_OAUTH_REDIRECT_URI = 'http://localhost:8989/callback';
    }
  }

  async authenticate(): Promise<void> {
    
    return super.authenticate();
  }
}

// Example usage for development
export async function runDevAuth() {
  const authManager = new DevOAuthManager();
  
  if (await authManager.isAuthenticated()) {
    const token = await authManager.getValidToken();
  } else {
    await authManager.authenticate();
  }
}