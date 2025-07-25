import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import crypto from 'crypto';

export interface OAuthCallbackData {
  code?: string;
  access_token?: string;
  token?: string;
  state: string;
}

export const generateState = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

export const waitForOAuthCallback = (port: number, expectedState: string): Promise<OAuthCallbackData> => {
  return new Promise((resolve, reject) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '', `http://localhost:${port}`);
      
      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const access_token = url.searchParams.get('access_token');
        const token = url.searchParams.get('token');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        
        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; text-align: center; padding: 50px;">
                <h1 style="color: #ef4444;">Authentication Failed</h1>
                <p>${error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error(error));
          return;
        }
        
        if (state !== expectedState) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; text-align: center; padding: 50px;">
                <h1 style="color: #ef4444;">Security Error</h1>
                <p>Invalid state parameter.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error('Invalid state parameter'));
          return;
        }
        
        if (code || access_token || token) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head>
                <title>Graphyn - Authentication Success</title>
                <style>
                  body {
                    font-family: system-ui, -apple-system, sans-serif;
                    text-align: center;
                    padding: 50px;
                    background: #f8fafc;
                  }
                  h1 { color: #10b981; }
                  .logo { font-size: 48px; margin-bottom: 20px; }
                </style>
              </head>
              <body>
                <div class="logo">🚀</div>
                <h1>Authentication Successful!</h1>
                <p>You can close this window and return to your terminal.</p>
                <p style="color: #6b7280; margin-top: 30px;">Graphyn is ready to help you build amazing AI agents!</p>
                <script>setTimeout(() => window.close(), 3000);</script>
              </body>
            </html>
          `);
          server.close();
          
          // Return the authorization code, access token, or token
          resolve({
            code: code || undefined,
            access_token: access_token || undefined,
            token: token || undefined,
            state: state!
          });
        }
      }
    });
    
    server.listen(port);
    
    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timeout'));
    }, 300000);
  });
};

export const getAvailablePort = (): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address !== 'string') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error('Failed to get available port'));
      }
    });
  });
};