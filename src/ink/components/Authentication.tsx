import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import open from 'open';
import { useStore } from '../store.js';
import { useAuth, useAPI } from '../hooks/useAPI.js';
import { config as appConfig } from '../../config.js';
import { generateState, waitForOAuthCallback, getAvailablePort } from '../utils/auth.js';
import { getAccentColor, getDimColor } from '../theme/colors.js';

type AuthMode = 'menu' | 'api-key' | 'oauth-select' | 'oauth-flow' | 'status' | 'connect-service';

interface AuthState {
  mode: AuthMode;
  loading: boolean;
  error?: string;
  apiKeyInput: string;
  oauthProvider?: 'github' | 'figma';
}

export const Authentication: React.FC = () => {
  const { exit } = useApp();
  const { reset } = useStore();
  const { isAuthenticated, user, authenticate, getTestToken, logout } = useAuth();
  const api = useAPI();
  
  const [state, setState] = useState<AuthState>({
    mode: 'menu',
    loading: false,
    apiKeyInput: ''
  });

  const handleAPIKeySubmit = async (apiKey: string) => {
    if (!apiKey.trim()) return;
    
    setState(prev => ({ ...prev, loading: true, error: undefined }));
    
    try {
      await authenticate(apiKey);
      
      setState(prev => ({
        ...prev,
        loading: false,
        mode: 'status'
      }));
      
      // Show success for 2 seconds then return to menu
      setTimeout(() => {
        setState(prev => ({ ...prev, mode: 'menu' }));
      }, 2000);
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      }));
    }
  };

  const handleTestToken = async () => {
    setState(prev => ({ ...prev, loading: true, error: undefined }));
    
    try {
      await getTestToken();
      
      setState(prev => ({
        ...prev,
        loading: false,
        mode: 'status'
      }));
      
      // Show success for 2 seconds then return to menu
      setTimeout(() => {
        setState(prev => ({ ...prev, mode: 'menu' }));
      }, 2000);
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to get test token'
      }));
    }
  };

  const handleOAuthFlow = async (provider: 'github' | 'figma') => {
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: undefined,
      oauthProvider: provider,
      mode: 'oauth-flow'
    }));
    
    try {
      const port = await getAvailablePort();
      const state = generateState();
      const redirectUri = `http://localhost:${port}/callback`;
      const authUrl = `${appConfig.apiBaseUrl}/api/connect/${provider}/authorize?cli=true&state=${state}&redirect=${encodeURIComponent(redirectUri)}`;
      
      // Open browser
      await open(authUrl);
      
      // Wait for callback
      const oauthData = await waitForOAuthCallback(port, state);
      
      // Exchange OAuth token for CLI JWT
      const response = await api.post<{token: string}>('/api/cli/token', {
        provider,
        token: oauthData.access_token
      });
      
      // Authenticate with the new token
      await authenticate(response.token);
      
      setState(prev => ({
        ...prev,
        loading: false,
        mode: 'status'
      }));
      
      // Show success for 2 seconds then return to menu
      setTimeout(() => {
        setState(prev => ({ ...prev, mode: 'menu' }));
      }, 2000);
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        mode: 'menu',
        error: error instanceof Error ? error.message : 'OAuth authentication failed'
      }));
    }
  };

  const handleLogout = async () => {
    setState(prev => ({ ...prev, loading: true }));
    
    try {
      await logout();
      
      setState(prev => ({
        ...prev,
        loading: false,
        mode: 'menu'
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to logout'
      }));
    }
  };

  const handleMenuSelect = (item: { value: string }) => {
    switch (item.value) {
      case 'api-key':
        setState(prev => ({ ...prev, mode: 'api-key', apiKeyInput: '', error: undefined }));
        break;
      case 'oauth':
        setState(prev => ({ ...prev, mode: 'oauth-select', error: undefined }));
        break;
      case 'oauth-graphyn':
        // Direct Graphyn OAuth (primary login method)
        handleOAuthFlow('github'); // Using GitHub OAuth for Graphyn login
        break;
      case 'connect-github':
        // Connect GitHub account (after already authenticated)
        setState(prev => ({ ...prev, mode: 'connect-service', error: undefined }));
        // TODO: Implement GitHub connection flow
        break;
      case 'connect-figma':
        // Connect Figma account (after already authenticated)
        setState(prev => ({ ...prev, mode: 'connect-service', error: undefined }));
        // TODO: Implement Figma connection flow
        break;
      case 'test-token':
        handleTestToken();
        break;
      case 'status':
        setState(prev => ({ ...prev, mode: 'status' }));
        break;
      case 'logout':
        handleLogout();
        break;
      case 'back':
        reset();
        break;
    }
  };

  const handleOAuthSelect = (item: { value: string }) => {
    if (item.value === 'back') {
      setState(prev => ({ ...prev, mode: 'menu' }));
    } else {
      handleOAuthFlow(item.value as 'github' | 'figma');
    }
  };

  // Loading state
  if (state.loading && state.mode !== 'oauth-flow') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="magenta">Authentication</Text>
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Authenticating...</Text>
        </Box>
      </Box>
    );
  }

  // OAuth flow in progress
  if (state.mode === 'oauth-flow') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">▶ Graphyn Authentication</Text>
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Opening browser for Graphyn login...</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={getDimColor()}>Please complete the authentication in your browser</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={getDimColor()}>You'll be redirected to graphyn.com to sign in</Text>
        </Box>
        {state.error && (
          <Box marginTop={1}>
            <Text color="red">❌ {state.error}</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Render based on mode
  switch (state.mode) {
    case 'menu':
      const menuItems = isAuthenticated
        ? [
            { label: '● View Status', value: 'status' },
            { label: '→ Connect GitHub', value: 'connect-github' },
            { label: '■ Connect Figma', value: 'connect-figma' },
            { label: '× Logout', value: 'logout' },
            { label: '← Back to Main Menu', value: 'back' }
          ]
        : [
            { label: '▹ Enter API Key', value: 'api-key' },
            { label: '▶ Login with Graphyn', value: 'oauth-graphyn' },
            { label: '○ Get Test Token', value: 'test-token' },
            { label: '← Back to Main Menu', value: 'back' }
          ];

      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="magenta">Authentication</Text>
          <Box marginTop={1}>
            <Text color={isAuthenticated ? 'cyan' : 'blue'}>
              {isAuthenticated ? '✓ Authenticated' : '⚠  Not authenticated'}
            </Text>
          </Box>
          
          {state.error && (
            <Box marginTop={1}>
              <Text color="red">✗ {state.error}</Text>
            </Box>
          )}
          
          <Box marginTop={1}>
            <SelectInput items={menuItems} onSelect={handleMenuSelect} />
          </Box>
          
          <Box marginTop={2}>
            <Text color={getDimColor()}>Use ↑↓ to navigate, ↵ to select, ESC to go back</Text>
          </Box>
        </Box>
      );

    case 'api-key':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="magenta">Enter API Key</Text>
          <Box marginTop={1}>
            <Text>Enter your Graphyn API key (starts with gph_ or test_):</Text>
          </Box>
          
          <Box marginTop={1}>
            <TextInput
              value={state.apiKeyInput}
              onChange={(value) => setState(prev => ({ ...prev, apiKeyInput: value }))}
              onSubmit={handleAPIKeySubmit}
              placeholder="gph_xxxxxxxxxxxx"
              mask="*"
            />
          </Box>
          
          {state.error && (
            <Box marginTop={1}>
              <Text color="red">✗ {state.error}</Text>
            </Box>
          )}
          
          <Box marginTop={1}>
            <Text color={getDimColor()}>Press Enter to submit, ESC to cancel</Text>
          </Box>
        </Box>
      );

    case 'oauth-select':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="magenta">OAuth Login</Text>
          <Box marginTop={1}>
            <Text>Select a provider to authenticate with:</Text>
          </Box>
          
          <Box marginTop={1}>
            <SelectInput
              items={[
                { label: '● GitHub', value: 'github' },
                { label: '■ Figma', value: 'figma' },
                { label: '← Back', value: 'back' }
              ]}
              onSelect={handleOAuthSelect}
            />
          </Box>
          
          {state.error && (
            <Box marginTop={1}>
              <Text color="red">✗ {state.error}</Text>
            </Box>
          )}
        </Box>
      );

    case 'status':
      // Get token from API client
      const token = api.client?.currentToken || '';
      
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="magenta">Authentication Status</Text>
          
          <Box marginTop={1} flexDirection="column">
            <Box>
              <Text>Status: </Text>
              <Text color={isAuthenticated ? 'cyan' : 'red'}>
                {isAuthenticated ? '✓ Authenticated' : '✗ Not authenticated'}
              </Text>
            </Box>
            
            {token && (
              <Box marginTop={1}>
                <Text>Token: </Text>
                <Text color="gray">{token.substring(0, 12)}...</Text>
              </Box>
            )}
            
            {user && (
              <>
                <Box marginTop={1}>
                  <Text>User: </Text>
                  <Text color="blue">{user.name || user.email}</Text>
                </Box>
                {user.orgID && (
                  <Box>
                    <Text>Organization: </Text>
                    <Text color="gray">{user.orgID}</Text>
                  </Box>
                )}
              </>
            )}
          </Box>
          
          <Box marginTop={2}>
            <Text color={getDimColor()}>Press any key to return to menu</Text>
          </Box>
        </Box>
      );

    case 'connect-service':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="magenta">→ Connect External Services</Text>
          <Box marginTop={1}>
            <Text color="blue">⚠  Coming Soon</Text>
          </Box>
          <Box marginTop={1}>
            <Text>This feature will allow you to connect:</Text>
            <Box marginLeft={2} flexDirection="column">
              <Text>• GitHub - For repository context</Text>
              <Text>• Figma - For design extraction</Text>
            </Box>
          </Box>
          <Box marginTop={2}>
            <Text color={getDimColor()}>Press ESC to go back</Text>
          </Box>
        </Box>
      );

    default:
      return null;
  }
};