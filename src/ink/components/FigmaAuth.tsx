import React, { useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import Spinner from 'ink-spinner';
import * as crypto from 'crypto';
import * as http from 'http';
import { exec } from 'child_process';
import axios from 'axios';
import { ConfigManager } from '../../config-manager.js';

type AuthStep = 'checking' | 'authenticating' | 'waiting' | 'success' | 'error';

interface FigmaOAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  expires_at: number;
}

export const FigmaAuth: React.FC = () => {
  const { exit } = useApp();
  const [step, setStep] = useState<AuthStep>('checking');
  const [statusMessage, setStatusMessage] = useState('Checking authentication status...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const clientId = 'YbqfPAJUb1ro4HEUVuiwhj';
  const clientSecret = '4ZXEVoSX0VcINAIMgRKnvi1d38eS39';
  const redirectUri = 'http://localhost:3456/callback';
  const scopes = 'file_content:read,file_metadata:read';

  useEffect(() => {
    checkAndAuthenticate();
  }, []);

  const checkAndAuthenticate = async () => {
    try {
      // Check if already authenticated
      const config = new ConfigManager();
      const tokens = await config.get('figma.oauth') as FigmaOAuthTokens | null;
      
      if (tokens && tokens.expires_at > Date.now()) {
        setStep('success');
        setStatusMessage('Already authenticated with Figma!');
        setTimeout(() => exit(), 2000);
        return;
      }
      
      // Start OAuth flow
      setStep('authenticating');
      setStatusMessage('Starting Figma OAuth authentication...');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate PKCE parameters
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
      const state = crypto.randomBytes(16).toString('hex');
      
      // Build authorization URL
      const authUrl = new URL('https://www.figma.com/oauth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      
      setStep('waiting');
      setStatusMessage('Opening browser for authentication...');
      
      // Open browser
      openBrowser(authUrl.toString());
      
      // Start local server to receive callback
      const server = http.createServer(async (req, res) => {
        if (!req.url?.startsWith('/callback')) {
          res.writeHead(404);
          res.end('Not Found');
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
          setStep('error');
          setErrorMessage(`OAuth error: ${error}`);
          setTimeout(() => exit(), 3000);
          return;
        }
        
        if (!code || returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication Failed</h1><p>Invalid response from Figma</p>');
          server.close();
          setStep('error');
          setErrorMessage('Invalid OAuth response');
          setTimeout(() => exit(), 3000);
          return;
        }
        
        try {
          // Exchange code for tokens
          const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
          const params = new URLSearchParams();
          params.append('redirect_uri', redirectUri);
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
          
          // Save tokens
          await config.set('figma.oauth', tokens);
          
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
          setStep('success');
          setStatusMessage('Successfully authenticated with Figma!');
          setTimeout(() => exit(), 2000);
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication Failed</h1><p>Error exchanging code for tokens</p>');
          server.close();
          setStep('error');
          setErrorMessage('Failed to exchange code for tokens');
          setTimeout(() => exit(), 3000);
        }
      });
      
      server.listen(3456, 'localhost', () => {
        console.log('\n🔗 Waiting for authentication callback on http://localhost:3456...\n');
      });
      
      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        setStep('error');
        setErrorMessage('Authentication timeout');
        setTimeout(() => exit(), 3000);
      }, 5 * 60 * 1000);
      
    } catch (error: any) {
      setStep('error');
      setErrorMessage(error.message);
      setTimeout(() => exit(), 3000);
    }
  };

  const openBrowser = (url: string) => {
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
        console.log('⚠️  Could not open browser automatically');
        console.log(`Please visit: ${url}`);
      }
    });
  };

  const getStepIcon = () => {
    switch (step) {
      case 'checking':
      case 'authenticating':
      case 'waiting':
        return <Spinner type="dots" />;
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      default:
        return null;
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        🎨 Figma OAuth Authentication
      </Text>
      
      <Box marginTop={2}>
        <Text>
          {getStepIcon()} {statusMessage}
        </Text>
      </Box>
      
      {step === 'waiting' && (
        <Box marginTop={2} flexDirection="column">
          <Text dimColor>📋 Complete authentication in your browser:</Text>
          <Text dimColor>1. Log in to your Figma account</Text>
          <Text dimColor>2. Authorize Graphyn Code access</Text>
          <Text dimColor>3. You'll be redirected back here</Text>
        </Box>
      )}
      
      {step === 'error' && errorMessage && (
        <Box marginTop={2}>
          <Text color="red">Error: {errorMessage}</Text>
        </Box>
      )}
    </Box>
  );
};