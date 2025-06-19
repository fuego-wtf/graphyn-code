import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import crypto from 'crypto';

interface OAuthToken {
  access_token: string;
  token_type: string;
  scope: string;
}

export const generateState = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

export const waitForOAuthCallback = (port: number, expectedState: string): Promise<OAuthToken> => {
  return new Promise((resolve, reject) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '', `http://localhost:${port}`);
      
      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
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
        
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; text-align: center; padding: 50px;">
                <h1 style="color: #10b981;">Success!</h1>
                <p>Authentication successful. You can close this window.</p>
                <script>window.close();</script>
              </body>
            </html>
          `);
          server.close();
          
          // TODO: Exchange code for token with backend
          // For MVP, return mock token
          resolve({
            access_token: `mock_token_${code}`,
            token_type: 'Bearer',
            scope: 'repo user'
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