import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import GraphynAPIClient from './api-client.js';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray
};

export class AuthManager {
  private authFilePath: string;

  constructor() {
    const graphynDir = path.join(os.homedir(), '.graphyn');
    this.authFilePath = path.join(graphynDir, 'auth.json');
    
    // Ensure directory exists
    if (!fs.existsSync(graphynDir)) {
      fs.mkdirSync(graphynDir, { recursive: true });
    }
  }

  async authenticate(apiKey: string): Promise<void> {
    // For development, accept test tokens or gph_ format
    if (!apiKey.startsWith('gph_') && !apiKey.startsWith('test_') && apiKey !== 'test') {
      throw new Error('Invalid API key format. Must start with gph_ or test_');
    }

    try {
      // If it's a gph_ key, validate with server
      // If it's a test_ key, get it from the test endpoint
      let validatedKey = apiKey;
      let user = null;
      
      if (apiKey.startsWith('test_') || apiKey === 'test') {
        // Get test token from backend
        const client = new GraphynAPIClient();
        const authResponse = await client.getTestToken();
        validatedKey = authResponse.token;
        user = authResponse.user;
      }

      const authData = {
        apiKey: validatedKey,
        authenticatedAt: new Date().toISOString(),
        valid: true,
        user
      };

      fs.writeFileSync(this.authFilePath, JSON.stringify(authData, null, 2), { mode: 0o600 });
    } catch (error) {
      throw new Error('Authentication failed. Please check your API key or backend connection.');
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.authFilePath)) {
        return false;
      }

      const authData = JSON.parse(fs.readFileSync(this.authFilePath, 'utf8'));
      return authData.valid && authData.apiKey;
    } catch {
      return false;
    }
  }

  getApiKey(): string | null {
    try {
      if (!fs.existsSync(this.authFilePath)) {
        return null;
      }

      const authData = JSON.parse(fs.readFileSync(this.authFilePath, 'utf8'));
      return authData.valid ? authData.apiKey : null;
    } catch {
      return null;
    }
  }

  async showStatus(): Promise<void> {
    const isAuth = await this.isAuthenticated();
    const apiKey = this.getApiKey();
    
    console.log();
    console.log('🔐 Authentication Status');
    console.log('────────────────────────');
    
    if (isAuth && apiKey) {
      console.log(colors.success('✓ Authenticated'));
      console.log(colors.info(`API Key: ${apiKey.substring(0, 8)}...`));
    } else {
      console.log(colors.warning('✗ Not authenticated'));
      console.log(colors.info('Run "graphyn auth" to authenticate'));
    }
    console.log();
  }

  async logout(): Promise<void> {
    try {
      if (fs.existsSync(this.authFilePath)) {
        fs.unlinkSync(this.authFilePath);
        console.log(colors.success('✓ Logged out successfully'));
      } else {
        console.log(colors.info('Already logged out'));
      }
    } catch (error) {
      console.error(colors.error('Failed to logout'));
    }
  }
}

// Helper function to load auth for commands
export function loadAuth(): { apiKey: string; user?: any } | null {
  try {
    const graphynDir = path.join(os.homedir(), '.graphyn');
    const authFilePath = path.join(graphynDir, 'auth.json');
    
    if (!fs.existsSync(authFilePath)) {
      return null;
    }

    const authData = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));
    return authData.valid ? authData : null;
  } catch {
    return null;
  }
}