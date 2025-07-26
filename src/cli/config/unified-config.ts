import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import type { GlobalOptions } from '../parser.js';
import { GraphynCLIError } from '../errors/index.js';

interface ConfigSource {
  name: string;
  get(key: string): any;
}

class DefaultSource implements ConfigSource {
  name = 'defaults';
  private defaults = new Map<string, any>([
    ['api.endpoint', 'https://api.graphyn.xyz'],
    ['api.timeout', 30000],
    ['ui.theme', 'auto'],
    ['ui.animations', true],
    ['features.telemetry', true],
    ['features.autoUpdate', true],
    ['features.experimental', false],
    ['team', null],
    ['defaultFormation', '4-3-3']
  ]);
  
  get(key: string): any {
    return this.defaults.get(key);
  }
}

class EnvironmentSource implements ConfigSource {
  name = 'environment';
  private envMap = new Map<string, string>([
    ['api.endpoint', 'GRAPHYN_API_URL'],
    ['api.timeout', 'GRAPHYN_API_TIMEOUT'],
    ['team', 'GRAPHYN_TEAM'],
    ['features.experimental', 'GRAPHYN_EXPERIMENTAL']
  ]);
  
  get(key: string): any {
    const envKey = this.envMap.get(key);
    if (!envKey) return undefined;
    
    const value = process.env[envKey];
    if (!value) return undefined;
    
    // Parse booleans and numbers
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(Number(value))) return Number(value);
    
    return value;
  }
}

class FileSource implements ConfigSource {
  name: string;
  private config: any = {};
  
  constructor(private filePath: string) {
    this.name = `file:${filePath}`;
    this.load();
  }
  
  private load(): void {
    try {
      if (existsSync(this.filePath)) {
        const content = readFileSync(this.filePath, 'utf8');
        this.config = JSON.parse(content);
      }
    } catch (error) {
      throw GraphynCLIError.configError(
        `Failed to parse config file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.filePath
      );
    }
  }
  
  get(key: string): any {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }
    
    return value;
  }
}

class CommandLineSource implements ConfigSource {
  name = 'command-line';
  private options: GlobalOptions;
  
  constructor(options: GlobalOptions) {
    this.options = options;
  }
  
  get(key: string): any {
    switch (key) {
      case 'dev': return this.options.dev;
      case 'verbose': return this.options.verbose;
      case 'color': return this.options.color;
      case 'config': return this.options.config;
      case 'api.endpoint': 
        return this.options.dev ? 'http://localhost:3000' : undefined;
      default: return undefined;
    }
  }
}

export class UnifiedConfig {
  private static instance: UnifiedConfig;
  private sources: ConfigSource[] = [];
  private cache = new Map<string, any>();
  
  static async initialize(options: GlobalOptions): Promise<UnifiedConfig> {
    const instance = new UnifiedConfig();
    
    // Load in precedence order (lowest to highest)
    instance.sources.push(new DefaultSource());
    
    // User config file
    const userConfigPath = join(homedir(), '.graphyn', 'config.json');
    if (existsSync(userConfigPath)) {
      instance.sources.push(new FileSource(userConfigPath));
    }
    
    // Project config file
    const projectConfigPath = '.graphynrc';
    if (existsSync(projectConfigPath)) {
      instance.sources.push(new FileSource(projectConfigPath));
    }
    
    // Custom config file from command line
    if (options.config && existsSync(options.config)) {
      instance.sources.push(new FileSource(options.config));
    }
    
    // Environment variables
    instance.sources.push(new EnvironmentSource());
    
    // Command line options (highest precedence)
    instance.sources.push(new CommandLineSource(options));
    
    UnifiedConfig.instance = instance;
    return instance;
  }
  
  static get<T>(key: string, defaultValue?: T): T {
    if (!UnifiedConfig.instance) {
      throw new Error('Configuration not initialized');
    }
    return UnifiedConfig.instance.getValue(key, defaultValue);
  }
  
  private getValue<T>(key: string, defaultValue?: T): T {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }
    
    // Search through sources in reverse order (highest precedence first)
    for (let i = this.sources.length - 1; i >= 0; i--) {
      const value = this.sources[i].get(key);
      if (value !== undefined) {
        this.cache.set(key, value);
        return value as T;
      }
    }
    
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    
    throw GraphynCLIError.configError(`Configuration key not found: ${key}`);
  }
  
  static getAll(): Record<string, any> {
    if (!UnifiedConfig.instance) {
      throw new Error('Configuration not initialized');
    }
    
    const config: Record<string, any> = {};
    const keys = new Set<string>();
    
    // Collect all keys from all sources
    const defaultKeys = [
      'api.endpoint', 'api.timeout', 'ui.theme', 'ui.animations',
      'features.telemetry', 'features.autoUpdate', 'features.experimental',
      'team', 'defaultFormation'
    ];
    
    defaultKeys.forEach(key => keys.add(key));
    
    // Build config object
    keys.forEach(key => {
      try {
        const value = UnifiedConfig.get(key);
        if (value !== undefined) {
          const parts = key.split('.');
          let obj = config;
          
          for (let i = 0; i < parts.length - 1; i++) {
            if (!(parts[i] in obj)) {
              obj[parts[i]] = {};
            }
            obj = obj[parts[i]];
          }
          
          obj[parts[parts.length - 1]] = value;
        }
      } catch (error) {
        // Ignore missing keys when getting all
      }
    });
    
    return config;
  }
  
  static getSources(): string[] {
    if (!UnifiedConfig.instance) {
      throw new Error('Configuration not initialized');
    }
    return UnifiedConfig.instance.sources.map(s => s.name);
  }
}