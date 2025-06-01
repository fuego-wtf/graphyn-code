import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

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
    if (!apiKey.startsWith('gph_')) {
      throw new Error('Invalid API key format. Must start with gph_');
    }

    try {
      // Validate with server (for now, just store locally)
      const authData = {
        apiKey,
        authenticatedAt: new Date().toISOString(),
        valid: true
      };

      fs.writeFileSync(this.authFilePath, JSON.stringify(authData, null, 2), { mode: 0o600 });
    } catch (error) {
      throw new Error('Authentication failed. Please check your API key.');
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