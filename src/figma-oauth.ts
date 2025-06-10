import axios from 'axios';
import { ConfigManager } from './config-manager';
import { colors } from './ui';
import * as crypto from 'crypto';
import * as http from 'http';
import { exec } from 'child_process';

export interface FigmaOAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  expires_at: number; // timestamp when token expires
}

export class FigmaOAuthManager {
  private config: ConfigManager;
  private readonly clientId = 'YbqfPAJUb1ro4HEUVuiwhj';
  private readonly clientSecret = '4ZXEVoSX0VcINAIMgRKnvi1d38eS39';
  private readonly redirectUri = 'http://localhost:3456/callback';
  private readonly scopes = 'file_content:read,file_metadata:read';

  constructor() {
    this.config = new ConfigManager();
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidAccessToken(): Promise<string | null> {
    const tokens = await this.config.get('figma.oauth') as FigmaOAuthTokens | null;
    
    if (!tokens) {
      return null;
    }

    // Check if token is expired (with 5 minute buffer)
    const now = Date.now();
    const expiresAt = tokens.expires_at || 0;
    
    if (now >= (expiresAt - 5 * 60 * 1000)) {
      console.log(colors.info('🔄 Refreshing Figma access token...'));
      const refreshedTokens = await this.refreshAccessToken(tokens.refresh_token);
      
      if (refreshedTokens) {
        await this.saveTokens(refreshedTokens);
        return refreshedTokens.access_token;
      } else {
        // Refresh failed, need to re-authenticate
        console.log(colors.warning('⚠️  Token refresh failed, need to re-authenticate'));
        return null;
      }
    }

    return tokens.access_token;
  }

  /**
   * Start OAuth flow
   */
  async authenticate(): Promise<boolean> {
    console.log(colors.info('🎨 Starting Figma OAuth authentication...'));
    
    // Generate PKCE parameters
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const state = crypto.randomBytes(16).toString('hex');

    // Build authorization URL
    const authUrl = new URL('https://www.figma.com/oauth');
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('scope', this.scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    console.log(colors.success('🌐 Opening browser for Figma authentication...'));
    console.log(colors.dim(`If browser doesn't open, visit: ${authUrl.toString()}`));

    // Open browser
    this.openBrowser(authUrl.toString());

    // Start local server to receive callback
    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        if (!req.url?.startsWith('/callback')) {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('<h1>404 Not Found</h1>');
          return;
        }

        const url = new URL(req.url, `http://${req.headers.host}`);
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h1>Authentication Failed</h1><p>Error: ${error}</p>`);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (!code || returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication Failed</h1><p>Invalid response from Figma</p>');
          server.close();
          reject(new Error('Invalid OAuth response'));
          return;
        }

        try {
          // Exchange code for tokens
          const tokens = await this.exchangeCodeForTokens(code, codeVerifier);
          await this.saveTokens(tokens);

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head><title>Graphyn - Authentication Success</title></head>
              <body style="font-family: system-ui; text-align: center; padding: 60px;">
                <h1 style="color: #22c55e;">✅ Authentication Successful!</h1>
                <p>You can now close this window and return to your terminal.</p>
                <p style="color: #6b7280;">Graphyn Design now has access to your Figma files.</p>
              </body>
            </html>
          `);
          
          server.close();
          resolve(true);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication Failed</h1><p>Error exchanging code for tokens</p>');
          server.close();
          reject(err);
        }
      });

      server.listen(3456, 'localhost', () => {
        console.log(colors.dim('🔗 Waiting for authentication callback...'));
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('Authentication timeout'));
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Exchange authorization code for access tokens
   */
  private async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<FigmaOAuthTokens> {
    try {
      // Create Basic Auth header as per Figma docs
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      // Create form data as per Figma docs
      const params = new URLSearchParams();
      params.append('redirect_uri', this.redirectUri);
      params.append('code', code);
      params.append('grant_type', 'authorization_code');
      params.append('code_verifier', codeVerifier);

      const response = await axios.post('https://api.figma.com/v1/oauth/token', params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        }
      });

      const tokens = response.data;
      tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
      
      return tokens;
    } catch (error: any) {
      console.error('Token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange code for tokens');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(refreshToken: string): Promise<FigmaOAuthTokens | null> {
    try {
      // Create Basic Auth header as per Figma docs
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      // Create form data as per Figma docs
      const params = new URLSearchParams();
      params.append('refresh_token', refreshToken);
      params.append('grant_type', 'refresh_token');

      const response = await axios.post('https://api.figma.com/v1/oauth/token', params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        }
      });

      const tokens = response.data;
      tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
      
      return tokens;
    } catch (error: any) {
      console.error('Token refresh error:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Save tokens to config
   */
  private async saveTokens(tokens: FigmaOAuthTokens): Promise<void> {
    await this.config.set('figma.oauth', tokens);
  }

  /**
   * Clear stored tokens
   */
  async logout(): Promise<void> {
    await this.config.delete('figma.oauth');
    console.log(colors.success('✅ Logged out from Figma'));
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getValidAccessToken();
    return token !== null;
  }

  /**
   * Generate PKCE code verifier
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate PKCE code challenge
   */
  private generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  /**
   * Open browser (cross-platform)
   */
  private openBrowser(url: string): void {
    const platform = process.platform;
    let command: string;

    switch (platform) {
      case 'darwin':
        command = `open "${url}"`;
        break;
      case 'win32':
        command = `start "${url}"`;
        break;
      default:
        command = `xdg-open "${url}"`;
    }

    exec(command, (error) => {
      if (error) {
        console.log(colors.warning('⚠️  Could not open browser automatically'));
        console.log(colors.info(`Please visit: ${url}`));
      }
    });
  }
}