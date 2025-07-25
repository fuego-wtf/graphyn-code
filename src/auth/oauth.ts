import open from 'open';
import { generateState, waitForOAuthCallback, getAvailablePort } from '../ink/utils/auth';
import { config } from '../config';
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

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

export class OAuthManager {
  private authFilePath: string;
  private clientId = 'graphyn-cli-official';

  constructor() {
    const graphynDir = path.join(os.homedir(), '.graphyn');
    this.authFilePath = path.join(graphynDir, 'auth.json');
    
    // Ensure directory exists
    if (!fs.existsSync(graphynDir)) {
      fs.mkdirSync(graphynDir, { recursive: true });
    }
  }

  async authenticate(): Promise<void> {
    try {
      console.log(colors.info('🔐 Starting OAuth authentication...'));
      
      // Get an available port for the callback server
      const port = await getAvailablePort();
      const redirectUri = `http://localhost:${port}/callback`;
      const state = generateState();
      
      // Build the authorization URL
      const authUrl = new URL(`${config.appUrl}/auth`);
      authUrl.searchParams.set('client_id', this.clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'api:read api:write teams:read');
      authUrl.searchParams.set('cli', 'true');
      
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
      const tokens = await this.exchangeCodeForToken(callbackData.code, redirectUri);
      
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
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens = await response.json();
    return tokens;
  }

  private async storeTokens(tokens: OAuthToken): Promise<void> {
    const authData = {
      apiKey: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenType: tokens.token_type,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scope: tokens.scope,
      authenticatedAt: new Date().toISOString(),
      valid: true,
      authType: 'oauth'
    };

    fs.writeFileSync(this.authFilePath, JSON.stringify(authData, null, 2), { mode: 0o600 });
  }

  async refreshToken(): Promise<string | null> {
    try {
      const authData = this.loadAuthData();
      if (!authData || !authData.refreshToken) {
        return null;
      }

      // Check if token is expired
      if (new Date(authData.expiresAt) > new Date()) {
        return authData.apiKey; // Token is still valid
      }

      console.log(colors.info('Refreshing access token...'));

      const response = await fetch(`${config.apiBaseUrl}/v1/auth/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: authData.refreshToken,
          client_id: this.clientId,
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const tokens: OAuthToken = await response.json();
      await this.storeTokens(tokens);
      
      return tokens.access_token;
    } catch (error) {
      console.error(colors.error('Failed to refresh token:'), error);
      return null;
    }
  }

  async getValidToken(): Promise<string | null> {
    const authData = this.loadAuthData();
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

  private loadAuthData(): any {
    try {
      if (!fs.existsSync(this.authFilePath)) {
        return null;
      }
      return JSON.parse(fs.readFileSync(this.authFilePath, 'utf8'));
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    const authData = this.loadAuthData();
    return authData && authData.valid && authData.apiKey;
  }

  async logout(): Promise<void> {
    try {
      if (fs.existsSync(this.authFilePath)) {
        fs.unlinkSync(this.authFilePath);
        console.log(colors.success('✓ Logged out successfully'));
      } else {
        console.log(colors.info('Already logged out'));
      }
    } catch (error) {
      console.error(colors.error('Failed to logout'));
    }
  }
}