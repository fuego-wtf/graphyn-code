import open from 'open';
import { generateState, waitForOAuthCallback } from '../ink/utils/auth.js';
import { config, getConfig } from '../config.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { withRetry } from '../utils/retry.js';
import { randomBytes, createHash } from 'crypto';
import { SecureTokenStorage } from './secure-storage.js';
import { getSecureTokenStorage, type ISecureTokenStorage } from './secure-storage-v2.js';
import { ConfigManager } from '../config-manager.js';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray
};

interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface PKCEValues {
  verifier: string;
  challenge: string;
  method: string;
  createdAt: number;
}

export class OAuthManager {
  private authFilePath: string; // Legacy path for migration
  private clientId: string;
  private pkceValues?: PKCEValues;
  private secureStorage?: SecureTokenStorage;
  private secureStorageV2?: ISecureTokenStorage;
  private refreshPromise?: Promise<string | null>;
  private useV2Storage = true; // Feature flag for new storage

  constructor() {
    const graphynDir = path.join(os.homedir(), '.graphyn');
    this.authFilePath = path.join(graphynDir, 'auth.json');
    
    // Always use the same client ID
    this.clientId = 'graphyn-cli-official';
    
    // Ensure directory exists
    if (!fs.existsSync(graphynDir)) {
      fs.mkdirSync(graphynDir, { recursive: true });
    }
  }

  private generatePKCE(): PKCEValues {
    // RFC 7636 recommends 43-128 characters for verifier
    // Generate 96 random bytes = 128 base64url characters
    const verifier = randomBytes(96).toString('base64url');
    const challenge = createHash('sha256')
      .update(verifier)
      .digest('base64url');
    
    const pkce: PKCEValues = {
      verifier,
      challenge,
      method: 'S256',
      createdAt: Date.now()
    };
    
    // Persist for crash recovery (expires after 10 minutes)
    this.storePKCETemporary(pkce);
    
    return pkce;
  }
  
  private storePKCETemporary(pkce: PKCEValues): void {
    try {
      const tempDir = path.join(os.tmpdir(), 'graphyn-cli');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { mode: 0o700 });
      }
      const tempPath = path.join(tempDir, 'pkce.json');
      fs.writeFileSync(tempPath, JSON.stringify(pkce), { mode: 0o600 });
    } catch (error) {
      // Non-critical, continue without persistence
      console.debug('Failed to persist PKCE values:', error);
    }
  }

  async authenticate(): Promise<void> {
    try {
      // Get dynamic config that reads environment variables at runtime
      const dynamicConfig = getConfig();
      
      // Debug output for OAuth configuration
      if (process.env.DEBUG_GRAPHYN) {
        console.log('[OAuth Debug] Environment variables:');
        console.log('- NODE_ENV:', process.env.NODE_ENV);
        console.log('- GRAPHYN_DEV_MODE:', process.env.GRAPHYN_DEV_MODE);
        console.log('- GRAPHYN_API_URL:', process.env.GRAPHYN_API_URL);
        console.log('- GRAPHYN_APP_URL:', process.env.GRAPHYN_APP_URL);
        console.log('[OAuth Debug] Dynamic Config:');
        console.log('- apiBaseUrl:', dynamicConfig.apiBaseUrl);
        console.log('- appUrl:', dynamicConfig.appUrl);
        console.log('- isDev:', dynamicConfig.isDev);
      }
      
      // Generate PKCE values
      this.pkceValues = this.generatePKCE();
      
      // Use fixed port 8989 for the callback server
      const port = 8989;
      const actualRedirectUri = `http://127.0.0.1:${port}/callback`;
      const state = generateState();
      
      // Use dynamic config for URLs
      const apiUrl = dynamicConfig.apiBaseUrl;
      const appUrl = dynamicConfig.appUrl;
      
      const authUrl = new URL(`${appUrl}/auth`);
      authUrl.searchParams.set('client_id', this.clientId);
      authUrl.searchParams.set('redirect_uri', actualRedirectUri);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid profile email agents:read agents:write threads:read threads:write organizations:read');
      authUrl.searchParams.set('code_challenge', this.pkceValues.challenge);
      authUrl.searchParams.set('code_challenge_method', this.pkceValues.method);
      authUrl.searchParams.set('cli', 'true');
      authUrl.searchParams.set('actual_port', port.toString());
      authUrl.searchParams.set('prompt', 'consent');
      
      // Always set dev_mode when in development
      if (dynamicConfig.isDev) {
        authUrl.searchParams.set('dev_mode', 'true');
      }
      
      
      // Open the browser
      await open(authUrl.toString());
      
      // Wait for the callback
      const callbackData = await waitForOAuthCallback(port, state);
      
      if (!callbackData.code) {
        throw new Error('No authorization code received');
      }
      
      
      // Exchange the code for tokens
      const tokens = await this.exchangeCodeForToken(callbackData.code, actualRedirectUri);
      
      // Store the tokens
      await this.storeTokens(tokens);
      
      // Fetch user profile to get organization info
      try {
        const userResponse = await fetch(`${dynamicConfig.apiBaseUrl}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json() as {
            user: { id: string; email: string; name?: string };
            organizations: Array<{ id: string; name: string; slug: string; role: string }>;
            current_organization?: { id: string; name: string; slug: string };
          };
          
          // Store user data in config
          const configManager = new ConfigManager();
          
          // Use the first organization if no current organization is set
          const orgToUse = userData.current_organization || userData.organizations[0];
          
          if (orgToUse) {
            await configManager.set('auth.user', {
              email: userData.user.email,
              name: userData.user.name || userData.user.email,
              orgID: orgToUse.id,
              userID: userData.user.id
            });
            
            console.log(colors.info(`✓ Authenticated as ${userData.user.email}`));
            console.log(colors.info(`✓ Organization: ${orgToUse.name}`));
          }
        }
      } catch (error) {
        console.warn(colors.warning('Could not fetch user profile, but authentication succeeded'));
      }
      
      // After successful authentication
      console.log(colors.success('✓ Authentication successful!'));
      
    } catch (error) {
      console.error(colors.error('Authentication failed:'), error);
      throw error;
    }
  }

  private async exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthToken> {
    
    if (!this.pkceValues) {
      throw new Error('PKCE values not generated');
    }
    
    return withRetry(async () => {
      const dynamicConfig = getConfig();
      const apiUrl = dynamicConfig.apiBaseUrl;
      const response = await fetch(`${apiUrl}/api/auth/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: this.clientId,
          code_verifier: this.pkceValues!.verifier,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error: any = new Error(`Token exchange failed: ${errorText}`);
        error.status = response.status;
        throw error;
      }

      const tokens = await response.json() as OAuthToken;
      return tokens;
    }, {
      maxAttempts: 3,
      onRetry: (error, attempt) => {
      }
    });
  }

  private async storeTokens(tokens: OAuthToken, context: string = 'default'): Promise<void> {
    const authData = {
      apiKey: tokens.access_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenType: tokens.token_type,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scope: tokens.scope,
      authenticatedAt: new Date().toISOString(),
      valid: true,
      authType: 'oauth'
    };

    try {
      if (this.useV2Storage) {
        // Use new secure storage v2
        if (!this.secureStorageV2) {
          this.secureStorageV2 = await getSecureTokenStorage();
        }
        await this.secureStorageV2.store(authData, context);
      } else {
        // Use old secure storage
        if (!this.secureStorage) {
          this.secureStorage = await SecureTokenStorage.getPlatformStorage();
        }
        await this.secureStorage.store(authData);
      }
      
      // Remove legacy file if it exists
      if (fs.existsSync(this.authFilePath)) {
        fs.unlinkSync(this.authFilePath);
      }
    } catch (error) {
      // Fallback to file storage
      fs.writeFileSync(this.authFilePath, JSON.stringify(authData, null, 2), { mode: 0o600 });
    }
  }

  async refreshToken(): Promise<string | null> {
    try {
      const authData = await this.loadAuthData();
      if (!authData || !authData.refreshToken) {
        return null;
      }

      // Always try to refresh when this method is called
      // (getValidToken already checks if refresh is needed)

      // Check if already refreshing (prevent concurrent refreshes)
      if (this.refreshPromise) {
        return this.refreshPromise;
      }

      // Initiate refresh
      this.refreshPromise = this.performTokenRefresh(authData)
        .finally(() => {
          this.refreshPromise = undefined;
        });
      
      return this.refreshPromise;
    } catch (error) {
      return null;
    }
  }
  
  private async performTokenRefresh(authData: any): Promise<string | null> {
    try {
      return await withRetry(async () => {
      const dynamicConfig = getConfig();
      const apiUrl = dynamicConfig.apiBaseUrl;
      const response = await fetch(`${apiUrl}/api/auth/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `Graphyn-CLI/${process.env.npm_package_version || '0.0.0'}`
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: authData.refreshToken,
          client_id: this.clientId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: 'unknown_error', error_description: errorText };
        }
        
        // Handle specific errors
        if (errorData.error === 'invalid_grant' || errorData.error === 'unauthorized_client') {
          // Refresh token expired or invalid, need re-authentication
          await this.logout();
          throw new Error('Session expired. Please authenticate again.');
        }
        
        if (errorData.error === 'temporarily_unavailable') {
          // Server is temporarily unavailable, might be rate limiting
          throw new Error('Authentication server is temporarily unavailable. Please try again in a few moments.');
        }
        
        // Log the full error for debugging
        console.debug('Token refresh error:', errorData);
        
        throw new Error(`Token refresh failed: ${errorData.error_description || errorData.error || 'Unknown error'}`);
      }

      const tokens = await response.json() as OAuthToken;
      await this.storeTokens(tokens);
      
      return tokens.access_token;
      }, {
        maxAttempts: 3,
        delay: 1000,
        backoff: 2,
        onRetry: (error, attempt) => {
          console.debug(`Token refresh attempt ${attempt}/3 failed:`, error instanceof Error ? error.message : error);
        }
      });
    } catch (error) {
      // If all retries fail, clear the stored token and return null
      console.error(colors.error('All token refresh attempts failed'));
      await this.logout();
      throw error;
    }
  }
  
  private async openAuthUrl(url: string, options: { port: number; state: string }): Promise<void> {
    const platform = os.platform();
    
    try {
      
      // Try to open with default browser
      await open(url, {
        wait: false,
      });
      
      
    } catch (error) {
      // Fallback strategies
      
      // Method 1: Copy URL
      
      // For SSH/headless environments
      if (!process.env.DISPLAY && platform === 'linux') {
      }
    }
  }

  async getValidToken(): Promise<string | null> {
    const authData = await this.loadAuthData();
    if (!authData || !authData.valid) {
      return null;
    }

    // For OAuth tokens, check expiry and refresh if needed
    if (authData.authType === 'oauth') {
      try {
        // Check if token is still valid
        const expiryTime = new Date(authData.expiresAt).getTime();
        const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
        const isExpired = Date.now() + bufferTime >= expiryTime;
        
        if (!isExpired) {
          // Token is still valid, return it with proper prefix for backend
          const rawToken = authData.accessToken || authData.apiKey;
          return this.ensureTokenPrefix(rawToken);
        }
        
        // Token is expired or about to expire, try to refresh
        if (authData.refreshToken) {
          const newToken = await this.refreshToken();
          if (newToken) {
            return this.ensureTokenPrefix(newToken);
          }
        }
        
        // If refresh fails or no refresh token, return null
        return null;
      } catch (error) {
        console.error(colors.error('Token validation failed:'), error instanceof Error ? error.message : error);
        return null;
      }
    }

    // For API keys, just return them with proper prefix
    return this.ensureTokenPrefix(authData.apiKey);
  }

  private ensureTokenPrefix(token: string): string {
    if (!token) return token;
    
    // Check if token already has a proper prefix
    if (token.startsWith('graphyn_oauth_') || 
        token.startsWith('ba_') || 
        token.startsWith('graph_sk_') || 
        token.startsWith('graph_pk_')) {
      return token;
    }
    
    // Add the graphyn_oauth_ prefix for OAuth tokens
    return `graphyn_oauth_${token}`;
  }

  private async loadAuthData(context: string = 'default'): Promise<any> {
    try {
      if (this.useV2Storage) {
        // Try new secure storage v2 first
        if (!this.secureStorageV2) {
          this.secureStorageV2 = await getSecureTokenStorage();
        }
        const v2Data = await this.secureStorageV2.retrieve(context);
        if (v2Data) {
          return v2Data;
        }
      }
      
      // Try old secure storage
      if (!this.secureStorage) {
        this.secureStorage = await SecureTokenStorage.getPlatformStorage();
      }
      const secureData = await this.secureStorage.retrieve();
      if (secureData) {
        // Migrate to v2 if enabled
        if (this.useV2Storage && this.secureStorageV2) {
          try {
            await this.secureStorageV2.store(secureData, context);
            await this.secureStorage.clear();
          } catch (error) {
            console.debug('Failed to migrate to v2 storage:', error);
          }
        }
        return secureData;
      }
      
      // Fall back to legacy file storage for migration
      if (fs.existsSync(this.authFilePath)) {
        const fileData = JSON.parse(fs.readFileSync(this.authFilePath, 'utf8'));
        
        // Migrate to secure storage
        try {
          if (this.useV2Storage && this.secureStorageV2) {
            await this.secureStorageV2.store(fileData, context);
          } else {
            await this.secureStorage.store(fileData);
          }
          fs.unlinkSync(this.authFilePath);
        } catch (error) {
          console.error(colors.warning('Failed to migrate to secure storage'));
        }
        
        return fileData;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const authData = await this.loadAuthData();
      if (!authData || !authData.valid || !authData.apiKey) {
        return false;
      }
      
      // For OAuth tokens, check if they're expired
      if (authData.authType === 'oauth' && authData.expiresAt) {
        const expiryTime = new Date(authData.expiresAt).getTime();
        const isExpired = Date.now() >= expiryTime;
        
        // If expired but we have a refresh token, we're still "authenticated"
        // (getValidToken will handle the refresh)
        if (isExpired && !authData.refreshToken) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async logout(context: string = 'default'): Promise<void> {
    try {
      if (this.useV2Storage) {
        // Clear v2 storage
        if (!this.secureStorageV2) {
          this.secureStorageV2 = await getSecureTokenStorage();
        }
        await this.secureStorageV2.clear(context);
      } else {
        // Clear old secure storage
        if (!this.secureStorage) {
          this.secureStorage = await SecureTokenStorage.getPlatformStorage();
        }
        await this.secureStorage.clear();
      }
      
      // Also clear legacy file if it exists
      if (fs.existsSync(this.authFilePath)) {
        fs.unlinkSync(this.authFilePath);
      }
      
    } catch (error) {
    }
  }
}