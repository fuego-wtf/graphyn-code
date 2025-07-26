import { OAuthManager } from './oauth.js';
import { config } from '../config.js';

/**
 * Development OAuth Manager with localhost support
 * Frontend: http://localhost:3000 (app.graphyn.xyz)
 * Backend: http://localhost:4000 (api.graphyn.xyz)
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
      process.env.GRAPHYN_API_URL = 'http://localhost:4000';
      process.env.GRAPHYN_APP_URL = 'http://localhost:3000';
      process.env.GRAPHYN_OAUTH_REDIRECT_URI = 'http://localhost:8989/callback';
    }
  }

  async authenticate(): Promise<void> {
    console.log('🔧 Running in development mode');
    console.log('📍 Frontend: http://localhost:3000');
    console.log('📍 Backend: http://localhost:4000');
    console.log('📍 Callback: http://localhost:8989/callback');
    
    return super.authenticate();
  }
}

// Example usage for development
export async function runDevAuth() {
  const authManager = new DevOAuthManager();
  
  if (await authManager.isAuthenticated()) {
    console.log('✓ Already authenticated');
    const token = await authManager.getValidToken();
    console.log('Token valid:', !!token);
  } else {
    console.log('Starting OAuth flow...');
    await authManager.authenticate();
  }
}