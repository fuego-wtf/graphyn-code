import { ConfigManager } from '../config-manager.js';

interface TokenInfo {
  token: string;
  expiresAt?: string;
  refreshToken?: string;
}

export class TokenManager {
  private configManager: ConfigManager;
  private refreshInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    this.configManager = new ConfigManager();
  }
  
  /**
   * Save token with expiry information
   */
  async saveToken(token: string, expiresIn?: number, refreshToken?: string): Promise<void> {
    const tokenInfo: TokenInfo = {
      token,
      refreshToken
    };
    
    if (expiresIn) {
      // Calculate expiry time (expiresIn is in seconds)
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      tokenInfo.expiresAt = expiresAt;
    }
    
    await this.configManager.set('auth.tokenInfo', tokenInfo);
    await this.configManager.set('auth.token', token); // Keep backward compatibility
    
    // Start refresh timer if we have expiry info
    if (tokenInfo.expiresAt) {
      this.startRefreshTimer(tokenInfo.expiresAt);
    }
  }
  
  /**
   * Get current token, checking if it's expired
   */
  async getToken(): Promise<string | null> {
    const tokenInfo = await this.configManager.get('auth.tokenInfo') as TokenInfo | undefined;
    
    if (!tokenInfo?.token) {
      // Check legacy token storage
      const legacyToken = await this.configManager.get('auth.token') as string | undefined;
      return legacyToken || null;
    }
    
    // Check if token is expired
    if (tokenInfo.expiresAt) {
      const expiryTime = new Date(tokenInfo.expiresAt).getTime();
      const now = Date.now();
      const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
      
      if (now >= expiryTime - bufferTime) {
        // Token is expired or about to expire
        if (tokenInfo.refreshToken) {
          // Attempt to refresh
          const newToken = await this.refreshToken(tokenInfo.refreshToken);
          if (newToken) {
            return newToken;
          }
        }
        
        // Token is expired and can't be refreshed
        await this.clearToken();
        return null;
      }
    }
    
    return tokenInfo.token;
  }
  
  /**
   * Refresh the access token using refresh token
   */
  private async refreshToken(refreshToken: string): Promise<string | null> {
    try {
      const apiUrl = process.env.GRAPHYN_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/v1/auth/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: 'graphyn-cli-official'
        })
      });
      
      if (!response.ok) {
        console.error('Failed to refresh token');
        return null;
      }
      
      const data: any = await response.json();
      
      // Save new token
      await this.saveToken(
        data.access_token,
        data.expires_in,
        data.refresh_token || refreshToken
      );
      
      return data.access_token;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }
  
  /**
   * Clear stored token
   */
  async clearToken(): Promise<void> {
    this.stopRefreshTimer();
    await this.configManager.delete('auth.tokenInfo');
    await this.configManager.delete('auth.token');
  }
  
  /**
   * Start automatic refresh timer
   */
  private startRefreshTimer(expiresAt: string): void {
    this.stopRefreshTimer();
    
    const expiryTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // Refresh 5 minutes before expiry
    const refreshIn = expiryTime - now - bufferTime;
    
    if (refreshIn > 0) {
      this.refreshInterval = setTimeout(async () => {
        const tokenInfo = await this.configManager.get('auth.tokenInfo') as TokenInfo | undefined;
        if (tokenInfo?.refreshToken) {
          await this.refreshToken(tokenInfo.refreshToken);
        }
      }, refreshIn);
    }
  }
  
  /**
   * Stop refresh timer
   */
  private stopRefreshTimer(): void {
    if (this.refreshInterval) {
      clearTimeout(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

// Export singleton instance
export const tokenManager = new TokenManager();