/**
 * Figma Authentication Manager
 * 
 * Handles Figma OAuth authentication, token storage, and refresh
 * Integrates with existing auth.ts patterns
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import http from 'http';
import { URL } from 'url';

export interface FigmaAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

export interface FigmaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  scope: string;
}

export interface FigmaAuthData {
  tokens: FigmaTokens;
  authenticatedAt: string;
  userId?: string;
  teamId?: string;
  valid: boolean;
}

/**
 * Figma OAuth Authentication Manager
 * Follows existing auth.ts patterns for token storage
 */
export class FigmaAuthManager {
  private authFilePath: string;
  private config: FigmaAuthConfig;
  
  constructor(config?: Partial<FigmaAuthConfig>) {
    const graphynDir = path.join(os.homedir(), '.graphyn');
    this.authFilePath = path.join(graphynDir, 'figma-auth.json');
    
    // Ensure directory exists
    if (!fs.existsSync(graphynDir)) {
      fs.mkdirSync(graphynDir, { recursive: true });
    }
    
    // Default configuration
    this.config = {
      clientId: config?.clientId || process.env.FIGMA_CLIENT_ID || '',
      clientSecret: config?.clientSecret || process.env.FIGMA_CLIENT_SECRET || '',
      redirectUri: config?.redirectUri || 'http://localhost:8080/callback',
      scope: config?.scope || ['file_read']
    };
  }

  /**
   * Start OAuth authentication flow
   */
  async authenticateOAuth(): Promise<FigmaTokens> {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('Figma Client ID and Client Secret are required. Set FIGMA_CLIENT_ID and FIGMA_CLIENT_SECRET environment variables.');
    }

    // Generate OAuth URL
    const authUrl = this.generateAuthUrl();
    
    console.log('🔐 Starting Figma OAuth authentication...');
    console.log(`Opening browser to: ${authUrl}`);
    
    // Open browser
    await this.openBrowser(authUrl);
    
    // Start local server to capture callback
    const authCode = await this.startCallbackServer();
    
    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(authCode);
    
    // Store tokens
    await this.storeTokens(tokens);
    
    console.log('✅ Figma authentication successful!');
    return tokens;
  }

  /**
   * Generate OAuth authorization URL
   */
  private generateAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope.join(' '),
      response_type: 'code',
      state: this.generateState()
    });
    
    return `https://www.figma.com/oauth?${params.toString()}`;
  }

  /**
   * Generate secure state parameter
   */
  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Open browser to authentication URL
   */
  private async openBrowser(url: string): Promise<void> {
    const platform = process.platform;
    
    const commands = {
      darwin: 'open',
      win32: 'start',
      linux: 'xdg-open'
    };
    
    const command = commands[platform as keyof typeof commands];
    
    if (!command) {
      console.log(`Please open this URL in your browser: ${url}`);
      return;
    }
    
    return new Promise((resolve, reject) => {
      const child = spawn(command, [url], { 
        stdio: 'ignore',
        detached: true 
      });
      
      child.on('error', (error) => {
        console.log(`Could not open browser automatically: ${error.message}`);
        console.log(`Please open this URL manually: ${url}`);
        resolve();
      });
      
      child.on('spawn', () => {
        child.unref();
        resolve();
      });
    });
  }

  /**
   * Start local callback server to capture OAuth response
   */
  private async startCallbackServer(): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const url = new URL(req.url || '', `http://localhost:8080`);
        
        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');
          
          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body>
                  <h1>❌ Authentication Failed</h1>
                  <p>Error: ${error}</p>
                  <p>You can close this tab and return to the CLI.</p>
                </body>
              </html>
            `);
            server.close();
            reject(new Error(`OAuth error: ${error}`));
            return;
          }
          
          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body>
                  <h1>✅ Authentication Successful</h1>
                  <p>You can close this tab and return to the CLI.</p>
                  <script>setTimeout(() => window.close(), 3000);</script>
                </body>
              </html>
            `);
            server.close();
            resolve(code);
            return;
          }
        }
        
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>404 Not Found</h1></body></html>');
      });
      
      server.listen(8080, 'localhost', () => {
        console.log('🌐 Listening for OAuth callback on http://localhost:8080/callback');
      });
      
      server.on('error', (error) => {
        reject(new Error(`Failed to start callback server: ${error.message}`));
      });
      
      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('Authentication timeout. Please try again.'));
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Exchange authorization code for access tokens
   */
  private async exchangeCodeForTokens(code: string): Promise<FigmaTokens> {
    try {
      const response = await fetch('https://www.figma.com/api/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri,
          code: code,
          grant_type: 'authorization_code'
        }).toString()
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in * 1000),
        tokenType: data.token_type,
        scope: data.scope
      };
    } catch (error: any) {
      throw new Error(`Failed to exchange code for tokens: ${error.message}`);
    }
  }

  /**
   * Store tokens securely following auth.ts patterns
   */
  async storeTokens(tokens: FigmaTokens, userId?: string, teamId?: string): Promise<void> {
    const authData: FigmaAuthData = {
      tokens,
      authenticatedAt: new Date().toISOString(),
      userId,
      teamId,
      valid: true
    };
    
    try {
      fs.writeFileSync(this.authFilePath, JSON.stringify(authData, null, 2), { mode: 0o600 });
    } catch (error: any) {
      throw new Error(`Failed to store tokens: ${error.message}`);
    }
  }

  /**
   * Load stored tokens
   */
  async loadTokens(): Promise<FigmaTokens | null> {
    try {
      if (!fs.existsSync(this.authFilePath)) {
        return null;
      }
      
      const authData: FigmaAuthData = JSON.parse(fs.readFileSync(this.authFilePath, 'utf8'));
      
      if (!authData.valid) {
        return null;
      }
      
      return authData.tokens;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get valid access token (refresh if needed)
   */
  async getValidAccessToken(): Promise<string | null> {
    const tokens = await this.loadTokens();
    
    if (!tokens) {
      return null;
    }
    
    // Check if token is still valid (with 5 minute buffer)
    const fiveMinutes = 5 * 60 * 1000;
    if (tokens.expiresAt > Date.now() + fiveMinutes) {
      return tokens.accessToken;
    }
    
    // Try to refresh token
    try {
      const refreshedTokens = await this.refreshToken(tokens.refreshToken);
      await this.storeTokens(refreshedTokens);
      return refreshedTokens.accessToken;
    } catch (error) {
      console.warn('Failed to refresh Figma token:', error);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<FigmaTokens> {
    try {
      const response = await fetch('https://www.figma.com/api/oauth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: refreshToken
        }).toString()
      });
      
      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Some APIs don't return new refresh token
        expiresAt: Date.now() + (data.expires_in * 1000),
        tokenType: data.token_type,
        scope: data.scope
      };
    } catch (error: any) {
      throw new Error(`Failed to refresh token: ${error.message}`);
    }
  }

  /**
   * Check if user is authenticated with Figma
   */
  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.loadTokens();
    return tokens !== null && tokens.accessToken.length > 0;
  }

  /**
   * Show authentication status
   */
  async showStatus(): Promise<void> {
    const isAuth = await this.isAuthenticated();
    const tokens = await this.loadTokens();
    
    console.log();
    console.log('🎨 Figma Authentication Status');
    console.log('─────────────────────────────');
    
    if (isAuth && tokens) {
      console.log('✅ Authenticated with Figma');
      
      if (tokens.expiresAt) {
        const expiresAt = new Date(tokens.expiresAt);
        const now = new Date();
        const isExpired = expiresAt < now;
        
        console.log(`🕐 Token expires: ${expiresAt.toLocaleString()}${isExpired ? ' (EXPIRED)' : ''}`);
      }
      
      if (tokens.scope) {
        console.log(`🔐 Scope: ${tokens.scope}`);
      }
    } else {
      console.log('❌ Not authenticated with Figma');
      console.log('Run "graphyn figma auth" to authenticate');
    }
    console.log();
  }

  /**
   * Logout and clear stored tokens
   */
  async logout(): Promise<void> {
    try {
      if (fs.existsSync(this.authFilePath)) {
        fs.unlinkSync(this.authFilePath);
        console.log('✅ Figma logout successful');
      } else {
        console.log('ℹ️  Already logged out of Figma');
      }
    } catch (error) {
      console.error('❌ Failed to logout from Figma');
    }
  }

  /**
   * Get authentication data including user info
   */
  async getAuthData(): Promise<FigmaAuthData | null> {
    try {
      if (!fs.existsSync(this.authFilePath)) {
        return null;
      }
      
      const authData: FigmaAuthData = JSON.parse(fs.readFileSync(this.authFilePath, 'utf8'));
      return authData.valid ? authData : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Authenticate with personal access token (for development)
   */
  async authenticateWithToken(token: string): Promise<void> {
    // Validate token by making a test API call
    const testResponse = await fetch('https://api.figma.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!testResponse.ok) {
      throw new Error('Invalid Figma personal access token');
    }
    
    const userData = await testResponse.json();
    
    // Store token as if it was an OAuth token (simplified)
    const tokens: FigmaTokens = {
      accessToken: token,
      refreshToken: '', // Personal access tokens don't have refresh tokens
      expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year from now
      tokenType: 'Bearer',
      scope: 'file_read' // Assume basic scope
    };
    
    await this.storeTokens(tokens, userData.id, userData.team_id);
    console.log('✅ Figma personal access token stored successfully');
  }
}