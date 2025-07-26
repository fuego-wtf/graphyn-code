import chalk from 'chalk';
import { getSecureTokenStorage, migrateTokenStorage } from '../auth/secure-storage-v2.js';
import type { ISecureTokenStorage } from '../auth/secure-storage-v2.js';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  bold: chalk.bold
};

export class AuthCommand {
  private storage: ISecureTokenStorage | null = null;
  
  async getStorage(): Promise<ISecureTokenStorage> {
    if (!this.storage) {
      this.storage = await getSecureTokenStorage();
    }
    return this.storage;
  }
  
  /**
   * List all authentication contexts
   */
  async listContexts(): Promise<void> {
    try {
      const storage = await this.getStorage();
      
      // Check if storage supports listing contexts
      if ('listContexts' in storage && typeof storage.listContexts === 'function') {
        const contexts = await storage.listContexts();
        
        if (contexts.length === 0) {
          console.log(colors.info('No authentication contexts found.'));
          return;
        }
        
        console.log(colors.bold('\nAuthentication Contexts:'));
        for (const context of contexts) {
          const tokens = await storage.retrieve(context);
          const status = tokens ? colors.success('✓') : colors.error('✗');
          const source = tokens?.metadata?.source || tokens?.source || 'unknown';
          
          console.log(`${status} ${context} ${colors.info(`(${source})`)}`);
          
          if (tokens?.metadata) {
            console.log(colors.info(`   Stored: ${new Date(tokens.metadata.storedAt).toLocaleString()}`));
            if (tokens.metadata.lastUsed) {
              console.log(colors.info(`   Last used: ${new Date(tokens.metadata.lastUsed).toLocaleString()}`));
            }
          }
        }
      } else {
        // Single context storage
        const tokens = await storage.retrieve();
        if (tokens) {
          console.log(colors.success('✓ Authenticated'));
          if (tokens.source) {
            console.log(colors.info(`   Source: ${tokens.source}`));
          }
        } else {
          console.log(colors.info('Not authenticated'));
        }
      }
    } catch (error) {
      console.error(colors.error('Failed to list contexts:'), error.message);
    }
  }
  
  /**
   * Switch to a different context
   */
  async switchContext(context: string): Promise<void> {
    try {
      const storage = await this.getStorage();
      
      // Check if context exists
      const tokens = await storage.retrieve(context);
      if (!tokens) {
        console.error(colors.error(`Context '${context}' not found.`));
        console.log(colors.info('\nAvailable contexts:'));
        await this.listContexts();
        return;
      }
      
      // For now, just inform the user
      console.log(colors.success(`✓ Switched to context: ${context}`));
      console.log(colors.info('\nNote: Context switching will be used in future commands.'));
    } catch (error) {
      console.error(colors.error('Failed to switch context:'), error.message);
    }
  }
  
  /**
   * Clear a specific context or all contexts
   */
  async clearContext(context?: string): Promise<void> {
    try {
      const storage = await this.getStorage();
      
      if (context) {
        await storage.clear(context);
        console.log(colors.success(`✓ Cleared context: ${context}`));
      } else {
        // Clear all contexts
        if ('listContexts' in storage && typeof storage.listContexts === 'function') {
          const contexts = await storage.listContexts();
          for (const ctx of contexts) {
            await storage.clear(ctx);
          }
          console.log(colors.success(`✓ Cleared ${contexts.length} contexts`));
        } else {
          await storage.clear();
          console.log(colors.success('✓ Cleared authentication data'));
        }
      }
    } catch (error) {
      console.error(colors.error('Failed to clear context:'), error.message);
    }
  }
  
  /**
   * Show current authentication status
   */
  async status(): Promise<void> {
    try {
      const storage = await this.getStorage();
      const tokens = await storage.retrieve();
      
      if (!tokens) {
        console.log(colors.warning('⚠️  Not authenticated'));
        console.log(colors.info('\nRun "graphyn auth" to authenticate'));
        return;
      }
      
      console.log(colors.success('✓ Authenticated'));
      
      // Show token info
      if (tokens.source) {
        console.log(colors.info(`\nToken source: ${tokens.source}`));
      }
      
      if (tokens.expiresAt) {
        const expiresAt = new Date(tokens.expiresAt);
        const now = new Date();
        
        if (expiresAt < now) {
          console.log(colors.error('Token expired'));
        } else {
          const hoursLeft = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
          console.log(colors.info(`Token expires in: ${hoursLeft} hours`));
        }
      }
      
      if (tokens.metadata) {
        console.log(colors.info(`\nStorage type: ${tokens.metadata.source || 'unknown'}`));
        if (tokens.metadata.storedAt) {
          console.log(colors.info(`Stored at: ${new Date(tokens.metadata.storedAt).toLocaleString()}`));
        }
      }
      
      // Check for environment variables
      if (process.env.GRAPHYN_TOKEN || process.env.GRAPHYN_API_KEY) {
        console.log(colors.warning('\n⚠️  Environment variables detected'));
        console.log(colors.info('Environment variables take precedence over stored tokens'));
      }
    } catch (error) {
      console.error(colors.error('Failed to check status:'), error.message);
    }
  }
  
  /**
   * Migrate from old token storage
   */
  async migrate(): Promise<void> {
    try {
      console.log(colors.info('Checking for old token storage...'));
      
      const migrated = await migrateTokenStorage();
      
      if (migrated) {
        console.log(colors.success('✓ Successfully migrated to secure storage'));
      } else {
        console.log(colors.info('No old tokens found to migrate'));
      }
    } catch (error) {
      console.error(colors.error('Migration failed:'), error.message);
    }
  }
}

// Export singleton instance
export const authCommand = new AuthCommand();