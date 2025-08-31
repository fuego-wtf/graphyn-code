/**
 * Mode Manager - Handles switching between standalone and dynamic modes
 * Core of the "Git for AI Agents" architecture
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { GraphynAPIClient } from '../api/client.js';
import chalk from 'chalk';

export type Mode = 'standalone' | 'dynamic';

export interface ModeConfig {
  defaultMode: Mode;
  autoSync: boolean;
  syncInterval: number;
  organization?: string;
  preferences: {
    theme: 'dark' | 'light';
    verbosity: 'quiet' | 'normal' | 'verbose';
    telemetry: boolean;
  };
}

export class ModeManager {
  private currentMode: Mode = 'standalone';
  private config: ModeConfig;
  private configPath: string;
  private apiClient?: GraphynAPIClient;

  constructor() {
    const clydeDir = path.join(os.homedir(), '.clyde');
    this.configPath = path.join(clydeDir, 'config.json');
    // Auth disabled for offline mode
    
    // Default configuration
    this.config = {
      defaultMode: 'standalone',
      autoSync: true,
      syncInterval: 300, // 5 minutes
      preferences: {
        theme: 'dark',
        verbosity: 'normal',
        telemetry: false
      }
    };
    
    this.loadConfig();
  }

  /**
   * Detect and set the appropriate mode
   */
  async detectMode(): Promise<Mode> {
    // Priority order for mode detection:
    // 1. CLI flags (--mode)
    // 2. Environment variables (CLYDE_MODE)
    // 3. Config file
    // 4. Network availability and auth status
    
    const args = process.argv;
    const modeFlag = args.find((arg, i) => arg === '--mode' && args[i + 1]);
    if (modeFlag) {
      const modeIndex = args.indexOf(modeFlag);
      const modeValue = args[modeIndex + 1] as Mode;
      if (modeValue === 'standalone' || modeValue === 'dynamic') {
        await this.setMode(modeValue);
        return modeValue;
      }
    }

    // Check environment variable
    const envMode = process.env.CLYDE_MODE as Mode;
    if (envMode === 'standalone' || envMode === 'dynamic') {
      await this.setMode(envMode);
      return envMode;
    }

    // Use config default, but verify dynamic mode is possible
    if (this.config.defaultMode === 'dynamic') {
      const canUseDynamic = await this.canUseDynamicMode();
      if (canUseDynamic) {
        await this.setMode('dynamic');
        return 'dynamic';
      } else {
        console.log(chalk.yellow('⚠️  Dynamic mode unavailable, using standalone'));
        await this.setMode('standalone');
        return 'standalone';
      }
    }

    await this.setMode('standalone');
    return 'standalone';
  }

  /**
   * Switch between modes
   */
  async switchMode(newMode: Mode): Promise<boolean> {
    if (newMode === this.currentMode) {
      console.log(chalk.blue(`Already in ${newMode} mode`));
      return true;
    }

    if (newMode === 'dynamic') {
      const canSwitch = await this.canUseDynamicMode();
      if (!canSwitch) {
        console.log(chalk.red('❌ Cannot switch to dynamic mode: authentication required'));
        console.log(chalk.gray('Run: clyde auth login'));
        return false;
      }
    }

    console.log(chalk.cyan(`🔄 Switching from ${this.currentMode} to ${newMode} mode...`));

    // If switching to dynamic, offer to push local changes
    if (newMode === 'dynamic' && this.currentMode === 'standalone') {
      await this.offerLocalSync();
    }

    await this.setMode(newMode);
    console.log(chalk.green(`✅ Switched to ${newMode} mode`));
    
    return true;
  }

  /**
   * Check if dynamic mode is available
   */
  private async canUseDynamicMode(): Promise<boolean> {
    try {
      // Check network connectivity
      if (!this.apiClient) {
        this.apiClient = new GraphynAPIClient();
      }
      
      // Check authentication
      const isAuthenticated = await this.apiClient.isAuthenticated();
      
      // Check API availability
      const healthCheck = await this.checkApiHealth();
      
      return isAuthenticated && healthCheck;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check API health
   */
  private async checkApiHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz'}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Offer to sync local changes when switching to dynamic
   */
  private async offerLocalSync(): Promise<void> {
    // This will be implemented with user confirmation
    console.log(chalk.blue('💡 Local agents can be synced to your organization'));
    console.log(chalk.gray('Use: clyde sync push'));
  }

  /**
   * Set current mode
   */
  private async setMode(mode: Mode): Promise<void> {
    this.currentMode = mode;
    this.config.defaultMode = mode;
    await this.saveConfig();
  }

  /**
   * Get current mode
   */
  getCurrentMode(): Mode {
    return this.currentMode;
  }

  /**
   * Get configuration
   */
  getConfig(): ModeConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<ModeConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();
  }

  /**
   * Load configuration from disk
   */
  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf-8');
        const loadedConfig = JSON.parse(configData);
        this.config = { ...this.config, ...loadedConfig };
      }
    } catch (error) {
      // Use default config if loading fails
      console.log(chalk.yellow('⚠️  Using default configuration'));
    }
  }

  /**
   * Save configuration to disk
   */
  private async saveConfig(): Promise<void> {
    try {
      const clydeDir = path.dirname(this.configPath);
      if (!fs.existsSync(clydeDir)) {
        fs.mkdirSync(clydeDir, { recursive: true });
      }
      
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error(chalk.red('❌ Failed to save config:', error));
    }
  }

  /**
   * Get mode status for display
   */
  getModeStatus(): string {
    const mode = this.currentMode;
    const icon = mode === 'dynamic' ? '🌐' : '🏠';
    const color = mode === 'dynamic' ? 'cyan' : 'blue';
    
    return chalk[color](`${icon} ${mode}`);
  }

  /**
   * Check if sync is enabled
   */
  isSyncEnabled(): boolean {
    return this.config.autoSync && this.currentMode === 'dynamic';
  }

  /**
   * Get sync interval
   */
  getSyncInterval(): number {
    return this.config.syncInterval;
  }
}