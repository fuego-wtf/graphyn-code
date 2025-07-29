import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';

interface GraphynConfig {
  auth?: {
    token?: string;
    user?: {
      email: string;
      name: string;
      orgID: string;
      userID: string;
    };
    squad?: {
      id: string;
      name: string;
      slug?: string;
    };
  };
  figma?: {
    accessToken?: string;
    connected?: boolean;
  };
  github?: {
    connected?: boolean;
  };
  api?: {
    baseUrl?: string;
    timeout?: number;
  };
  preferences?: {
    defaultFramework?: string;
    autoLaunch?: boolean;
  };
}

export class ConfigManager {
  private configPath: string;
  private config: GraphynConfig = {};

  constructor() {
    const graphynDir = path.join(os.homedir(), '.graphyn');
    this.configPath = path.join(graphynDir, 'config.json');
  }

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(data);
    } catch (error) {
      // Config doesn't exist yet, that's ok
      this.config = {};
    }
  }

  async save(): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  async get(key: string): Promise<any> {
    await this.load();
    
    // Support nested keys like 'figma.accessToken'
    const keys = key.split('.');
    let value: any = this.config;
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) break;
    }
    
    return value;
  }

  async set(key: string, value: any): Promise<void> {
    await this.load();
    
    // Support nested keys
    const keys = key.split('.');
    let current: any = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k]) {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[keys[keys.length - 1]] = value;
    
    await this.save();
  }

  async delete(key: string): Promise<void> {
    await this.load();
    
    const keys = key.split('.');
    let current: any = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current?.[keys[i]];
      if (!current) return;
    }
    
    delete current[keys[keys.length - 1]];
    
    await this.save();
  }

  async getAll(): Promise<GraphynConfig> {
    await this.load();
    return { ...this.config };
  }

  async setAuthToken(token: string): Promise<void> {
    await this.set('auth.token', token);
  }

  async getAuthToken(): Promise<string | undefined> {
    return await this.get('auth.token');
  }

  getAuthTokenSync(): string | undefined {
    // Synchronous version for components that need immediate access
    try {
      const data = fsSync.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(data);
      return config?.auth?.token;
    } catch {
      return undefined;
    }
  }

  async setSquad(squad: { id: string; name: string; slug?: string }): Promise<void> {
    await this.set('auth.squad', squad);
  }

  async getSquad(): Promise<{ id: string; name: string; slug?: string } | undefined> {
    return await this.get('auth.squad');
  }

  async clearSquad(): Promise<void> {
    await this.delete('auth.squad');
  }

  getConfigDir(): string {
    return path.join(os.homedir(), '.graphyn');
  }
}