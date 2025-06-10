import fs from 'fs/promises';
import path from 'path';
import os from 'os';

interface GraphynConfig {
  figma?: {
    accessToken?: string;
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
}