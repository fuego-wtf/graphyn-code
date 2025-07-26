import open from 'open';
import { generateState, waitForOAuthCallback, getAvailablePort } from '../ink/utils/auth.js';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { withRetry } from '../utils/retry.js';
import { randomBytes, createHash } from 'crypto';
import { SecureTokenStorage } from './secure-storage.js';
import { getSecureTokenStorage, type ISecureTokenStorage } from './secure-storage-v2.js';

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
      console.log(colors.info('🔐 Starting OAuth authentication...'));
      
      // Generate PKCE values
      this.pkceValues = this.generatePKCE();
      
      // Get an available port for the callback server
      const port = await getAvailablePort();
      const actualRedirectUri = `http://localhost:${port}/callback`;
      const state = generateState();
      
      // Build the authorization URL with PKCE
      const appUrl = process.env.GRAPHYN_APP_URL || config.appUrl || 'https://app.graphyn.xyz';
      const apiUrl = process.env.GRAPHYN_API_URL || config.apiBaseUrl || 'https://api.graphyn.xyz';
      
      const authUrl = new URL(`${apiUrl}/v1/auth/oauth/authorize`);
      authUrl.searchParams.set('client_id', this.clientId);
      authUrl.searchParams.set('redirect_uri', actualRedirectUri);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid profile email agents:read agents:write threads:read threads:write organizations:read teams:read');
      authUrl.searchParams.set('code_challenge', this.pkceValues.challenge);
      authUrl.searchParams.set('code_challenge_method', this.pkceValues.method);
      authUrl.searchParams.set('cli', 'true');
      authUrl.searchParams.set('actual_port', port.toString());
      
      const isDev = apiUrl.includes('localhost') || process.env.NODE_ENV === 'development';
      if (isDev) {
        authUrl.searchParams.set('dev_mode', 'true');
      }
      
      console.log(colors.info(`Opening browser for authentication...`));
      console.log(colors.info(`If the browser doesn't open, visit: ${authUrl.toString()}`));
      
      // Open the browser
      await open(authUrl.toString());
      
      // Wait for the callback
      console.log(colors.info('Waiting for authentication...'));
      const callbackData = await waitForOAuthCallback(port, state);
      
      if (!callbackData.code) {
        throw new Error('No authorization code received');
      }
      
      console.log(colors.success('✓ Authorization code received'));
      
      // Exchange the code for tokens
      const tokens = await this.exchangeCodeForToken(callbackData.code, actualRedirectUri);
      
      // Store the tokens
      await this.storeTokens(tokens);
      
      console.log(colors.success('✓ Authentication successful!'));
      console.log(colors.info('You can now use Graphyn Code to create AI development squads.'));
      
    } catch (error) {
      console.error(colors.error('Authentication failed:'), error);
      throw error;
    }
  }

  private async exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthToken> {
    console.log(colors.info('Exchanging authorization code for access token...'));
    console.log(colors.info(`Code: ${code.substring(0, 20)}...`));
    
    if (!this.pkceValues) {
      throw new Error('PKCE values not generated');
    }
    
    return withRetry(async () => {
      const response = await fetch(`${config.apiBaseUrl}/v1/auth/oauth/token`, {
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
        console.log(colors.warning(`Retrying token exchange (attempt ${attempt}/3)...`));
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
      console.error(colors.warning('Failed to use secure storage, falling back to file storage'));
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

      // Proactive refresh (5 minutes before expiry)
      const expiryTime = new Date(authData.expiresAt).getTime();
      const bufferTime = 5 * 60 * 1000; // 5 minutes
      const shouldRefresh = Date.now() + bufferTime >= expiryTime;
      
      if (!shouldRefresh) {
        return authData.apiKey;
      }

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
      console.error(colors.error('Failed to refresh token:'), error);
      return null;
    }
  }
  
  private async performTokenRefresh(authData: any): Promise<string | null> {
    console.log(colors.info('Refreshing access token...'));
    
    return withRetry(async () => {
      const response = await fetch(`${config.apiBaseUrl}/v1/auth/oauth/token`, {
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
        if (errorData.error === 'invalid_grant') {
          // Refresh token expired, need re-authentication
          await this.logout();
          throw new Error('Session expired. Please authenticate again.');
        }
        
        throw new Error(`Token refresh failed: ${errorData.error_description || errorData.error}`);
      }

      const tokens = await response.json() as OAuthToken;
      await this.storeTokens(tokens);
      
      return tokens.access_token;
    }, {
      maxAttempts: 3,
      delay: 1000,
      backoff: 2,
      onRetry: (error, attempt) => {
        console.log(colors.warning(`Token refresh attempt ${attempt} failed: ${error.message}`));
      }
    });
  }
  
  private async openAuthUrl(url: string, options: { port: number; state: string }): Promise<void> {
    const platform = os.platform();
    
    try {
      console.log(colors.info('Opening browser for authentication...'));
      
      // Try to open with default browser
      await open(url, {
        wait: false,
      });
      
      console.log(colors.success('✓ Opened browser'));
      
    } catch (error) {
      // Fallback strategies
      console.log(colors.warning('\n⚠️  Could not open browser automatically'));
      console.log(colors.info('\nPlease authenticate using one of these methods:\n'));
      
      // Method 1: Copy URL
      console.log(colors.info('1. Open this URL in your browser:'));
      console.log(chalk.bold(`   ${url}\n`));
      
      // For SSH/headless environments
      if (!process.env.DISPLAY && platform === 'linux') {
        console.log(colors.info('\nDetected headless environment.'));
        console.log(colors.info('You can:'));
        console.log(colors.info('1. Copy the URL and open it on your local machine'));
        console.log(colors.info(`2. Use SSH port forwarding: ssh -L ${options.port}:localhost:${options.port} user@server\n`));
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
      return await this.refreshToken();
    }

    // For API keys, just return them
    return authData.apiKey;
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
            console.log(colors.info('Migrated tokens to new secure storage'));
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
          console.log(colors.info('Migrated tokens to secure storage'));
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
    const authData = await this.loadAuthData();
    return authData && authData.valid && authData.apiKey;
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
      
      console.log(colors.success('✓ Logged out successfully'));
    } catch (error) {
      console.error(colors.error('Failed to logout'));
    }
  }
}