import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface FigmaTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

export class FigmaAuth {
  private configPath: string;

  constructor() {
    const configDir = path.join(os.homedir(), '.graphyn');
    this.configPath = path.join(configDir, 'config.json');
    
    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  getTokens(): FigmaTokens | null {
    try {
      if (!fs.existsSync(this.configPath)) {
        return null;
      }

      const config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      const figmaOAuth = config['figma.oauth'];
      
      if (!figmaOAuth || !figmaOAuth.access_token) {
        return null;
      }

      return figmaOAuth;
    } catch (error) {
      console.error('Error reading Figma tokens:', error);
      return null;
    }
  }

  saveTokens(tokens: FigmaTokens): void {
    try {
      let config = {};
      
      if (fs.existsSync(this.configPath)) {
        config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      }

      config['figma.oauth'] = tokens;
      
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Error saving Figma tokens:', error);
      throw error;
    }
  }

  clearTokens(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        return;
      }

      const config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      delete config['figma.oauth'];
      delete config['figma'];
      
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Error clearing Figma tokens:', error);
    }
  }

  isAuthenticated(): boolean {
    const tokens = this.getTokens();
    if (!tokens) return false;
    
    // Check if token is expired
    const now = Date.now();
    return tokens.expires_at > now;
  }
}

export const figmaAuth = new FigmaAuth();