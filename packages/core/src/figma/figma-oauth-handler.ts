/**
 * Figma OAuth PKCE Handler for Secure Authentication
 *
 * Implements OAuth 2.0 Authorization Code flow with PKCE for secure
 * Figma API access without client secrets. Handles token management,
 * refresh, and secure storage in ~/.graphyn user directory.
 */

import { createHash, randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const isNodeError = (error: unknown): error is NodeJS.ErrnoException => {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string';
};

const toError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === 'string' ? error : JSON.stringify(error));
};

const execAsync = promisify(exec);

export interface FigmaOAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  baseUrl?: string;
}

export interface FigmaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  scope: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

interface UserInfoResponse {
  id: string;
  email: string;
  handle: string;
  img_url: string;
}

export interface FigmaUserInfo {
  id: string;
  email: string;
  handle: string;
  img_url: string;
}

/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth security
 */
class PKCEGenerator {
  /**
   * Generate cryptographically secure code verifier
   */
  static generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Generate code challenge from verifier using SHA256
   */
  static generateCodeChallenge(verifier: string): string {
    return createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }
}

/**
 * Secure token storage with encryption
 */
class SecureTokenStorage {
  private credentialsPath: string;

  constructor(userDataPath: string) {
    this.credentialsPath = path.join(userDataPath, 'figma', 'credentials.json');
  }

  /**
   * Store encrypted tokens to user data directory
   */
  async storeTokens(tokens: FigmaTokens): Promise<void> {
    const credentialsDir = path.dirname(this.credentialsPath);
    await fs.mkdir(credentialsDir, { recursive: true });

    // Simple XOR encryption for now - production would use proper encryption
    const encryptedTokens = this.encryptTokens(tokens);

    await fs.writeFile(this.credentialsPath, JSON.stringify({
      encrypted: true,
      data: encryptedTokens,
      storedAt: new Date().toISOString()
    }, null, 2));
  }

  /**
   * Load and decrypt tokens from storage
   */
  async loadTokens(): Promise<FigmaTokens | null> {
    try {
      const data = await fs.readFile(this.credentialsPath, 'utf-8');
      const parsed = JSON.parse(data);

      if (parsed.encrypted) {
        return this.decryptTokens(parsed.data);
      }

      return parsed; // Legacy unencrypted format
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return null;
      }
      throw toError(error);
    }
  }

  /**
   * Remove stored tokens
   */
  async clearTokens(): Promise<void> {
    try {
      await fs.unlink(this.credentialsPath);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return;
      }
      if (error) {
        throw toError(error);
      }
    }
  }

  /**
   * Simple XOR encryption for token storage
   * Production implementation should use proper encryption libraries
   */
  private encryptTokens(tokens: FigmaTokens): string {
    const key = 'graphyn-figma-key'; // In production, derive from user credentials
    const jsonStr = JSON.stringify(tokens);
    let encrypted = '';

    for (let i = 0; i < jsonStr.length; i++) {
      encrypted += String.fromCharCode(
        jsonStr.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }

    return Buffer.from(encrypted).toString('base64');
  }

  /**
   * Decrypt tokens using XOR
   */
  private decryptTokens(encrypted: string): FigmaTokens {
    const key = 'graphyn-figma-key';
    const decoded = Buffer.from(encrypted, 'base64').toString();
    let decrypted = '';

    for (let i = 0; i < decoded.length; i++) {
      decrypted += String.fromCharCode(
        decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }

    return JSON.parse(decrypted);
  }
}

/**
 * Main Figma OAuth Handler implementing PKCE flow
 */
export class FigmaOAuthHandler {
  private config: FigmaOAuthConfig;
  private tokenStorage: SecureTokenStorage;
  private pendingAuth: Map<string, {
    codeVerifier: string;
    state: string;
    resolve: (tokens: FigmaTokens) => void;
    reject: (error: Error) => void;
  }> = new Map();

  constructor(config: FigmaOAuthConfig, userDataPath: string) {
    this.config = {
      baseUrl: 'https://www.figma.com',
      ...config
    };
    this.tokenStorage = new SecureTokenStorage(userDataPath);
  }

  /**
   * Check if user has valid authentication
   */
  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.tokenStorage.loadTokens();
    if (!tokens) return false;

    // Check if token is expired
    if (Date.now() >= tokens.expiresAt) {
      // Try to refresh
      try {
        await this.refreshTokens();
        return true;
      } catch {
        return false;
      }
    }

    return true;
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    const tokens = await this.tokenStorage.loadTokens();
    if (!tokens) {
      throw new Error('No Figma authentication found. Please run `graphyn figma auth` first.');
    }

    // Check if token needs refresh
    if (Date.now() >= tokens.expiresAt - 60000) { // Refresh 1 minute before expiry
      await this.refreshTokens();
      const refreshedTokens = await this.tokenStorage.loadTokens();
      return refreshedTokens!.accessToken;
    }

    return tokens.accessToken;
  }

  /**
   * Start OAuth authentication flow
   */
  async startAuthFlow(): Promise<FigmaTokens> {
    const state = randomBytes(16).toString('hex');
    const codeVerifier = PKCEGenerator.generateCodeVerifier();
    const codeChallenge = PKCEGenerator.generateCodeChallenge(codeVerifier);

    const authUrl = this.buildAuthUrl(state, codeChallenge);

    return new Promise((resolve, reject) => {
      this.pendingAuth.set(state, { codeVerifier, state, resolve, reject });

      // Auto-cleanup after 10 minutes
      setTimeout(() => {
        if (this.pendingAuth.has(state)) {
          this.pendingAuth.delete(state);
          reject(new Error('OAuth authentication timed out'));
        }
      }, 10 * 60 * 1000);

      this.openBrowser(authUrl);
    });
  }

  /**
   * Handle OAuth callback with authorization code
   */
  async handleCallback(code: string, state: string): Promise<FigmaTokens> {
    const authData = this.pendingAuth.get(state);
    if (!authData) {
      throw new Error('Invalid or expired OAuth state');
    }

    this.pendingAuth.delete(state);

    try {
      const tokens = await this.exchangeCodeForTokens(code, authData.codeVerifier);
      await this.tokenStorage.storeTokens(tokens);
      authData.resolve(tokens);
      return tokens;
    } catch (error) {
      const normalized = toError(error);
      authData.reject(normalized);
      throw normalized;
    }
  }

  /**
   * Refresh expired access token
   */
  async refreshTokens(): Promise<FigmaTokens> {
    const tokens = await this.tokenStorage.loadTokens();
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.config.baseUrl}/api/oauth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const data = await response.json() as TokenResponse;
    const newTokens: FigmaTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokens.refreshToken,
      expiresAt: Date.now() + (data.expires_in * 1000),
      tokenType: data.token_type || 'Bearer',
      scope: data.scope || tokens.scope,
    };

    await this.tokenStorage.storeTokens(newTokens);
    return newTokens;
  }

  /**
   * Get authenticated user information
   */
  async getUserInfo(): Promise<FigmaUserInfo> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.config.baseUrl}/api/v1/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as UserInfoResponse;
    return data;
  }

  /**
   * Revoke tokens and clear storage
   */
  async logout(): Promise<void> {
    try {
      const tokens = await this.tokenStorage.loadTokens();
      if (tokens?.accessToken) {
        // Revoke token on server
        await fetch(`${this.config.baseUrl}/api/oauth/revoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: this.config.clientId,
            token: tokens.accessToken,
          }),
        });
      }
    } catch {
      // Ignore revocation errors, still clear local tokens
    }

    await this.tokenStorage.clearTokens();
  }

  /**
   * Build authorization URL with PKCE parameters
   */
  private buildAuthUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state,
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${this.config.baseUrl}/oauth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<FigmaTokens> {
    const response = await fetch(`${this.config.baseUrl}/api/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        redirect_uri: this.config.redirectUri,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const data = await response.json() as TokenResponse;

    if (!data.access_token) {
      throw new Error('Token exchange response missing access_token');
    }

    if (!data.refresh_token) {
      throw new Error('Token exchange response missing refresh_token');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      tokenType: data.token_type || 'Bearer',
      scope: data.scope ?? this.config.scopes.join(' '),
    };
  }

  /**
   * Open browser for OAuth authorization
   */
  private async openBrowser(url: string): Promise<void> {
    const platform = process.platform;
    let command: string;

    switch (platform) {
      case 'darwin':
        command = `open "${url}"`;
        break;
      case 'win32':
        command = `start "" "${url}"`;
        break;
      default:
        command = `xdg-open "${url}"`;
    }

    try {
      await execAsync(command);
    } catch (error) {
      console.error('Failed to open browser automatically.');
      console.log(`Please open this URL manually: ${url}`);
    }
  }
}

/**
 * Factory function to create configured OAuth handler
 */
export function createFigmaOAuthHandler(userDataPath: string): FigmaOAuthHandler {
  const config: FigmaOAuthConfig = {
    clientId: process.env.FIGMA_CLIENT_ID || 'graphyn-figma-client',
    redirectUri: process.env.FIGMA_REDIRECT_URI || 'http://localhost:8080/oauth/figma/callback',
    scopes: ['file_read', 'file_write'], // Standard Figma API permissions
  };

  return new FigmaOAuthHandler(config, userDataPath);
}
