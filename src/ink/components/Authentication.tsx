import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import open from 'open';
import { useStore } from '../store.js';
import { ConfigManager } from '../../config-manager.js';
import { GraphynAPIClient, AuthResponse } from '../../api-client.js';
import { config as appConfig } from '../../config.js';
import { generateState, waitForOAuthCallback, getAvailablePort } from '../utils/auth.js';

type AuthMode = 'menu' | 'api-key' | 'oauth-select' | 'oauth-flow' | 'status';

interface AuthState {
  mode: AuthMode;
  isAuthenticated: boolean;
  token?: string;
  user?: AuthResponse['user'];
  loading: boolean;
  error?: string;
  apiKeyInput: string;
  oauthProvider?: 'github' | 'figma';
}

export const Authentication: React.FC = () => {
  const { exit } = useApp();
  const { reset } = useStore();
  const [state, setState] = useState<AuthState>({
    mode: 'menu',
    isAuthenticated: false,
    loading: true,
    apiKeyInput: ''
  });

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setState(prev => ({ ...prev, loading: true }));
    
    try {
      const configManager = new ConfigManager();
      const token = await configManager.getAuthToken();
      
      if (token) {
        // Validate token with API
        const apiClient = new GraphynAPIClient();
        apiClient.setToken(token);
        
        try {
          await apiClient.ping();
          
          // Get user info if available
          const config = await configManager.getAll();
          
          setState(prev => ({
            ...prev,
            isAuthenticated: true,
            token,
            user: config.auth?.user,
            loading: false,
            mode: 'menu'
          }));
        } catch (error) {
          // Token is invalid
          await configManager.delete('auth.token');
          setState(prev => ({
            ...prev,
            isAuthenticated: false,
            loading: false
          }));
        }
      } else {
        setState(prev => ({
          ...prev,
          isAuthenticated: false,
          loading: false
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to check authentication status'
      }));
    }
  };

  const handleAPIKeySubmit = async (apiKey: string) => {
    if (!apiKey.trim()) return;
    
    setState(prev => ({ ...prev, loading: true, error: undefined }));
    
    try {
      // Validate API key format
      if (!apiKey.startsWith('gph_') && !apiKey.startsWith('test_')) {
        throw new Error('Invalid API key format. Must start with gph_ or test_');
      }
      
      const apiClient = new GraphynAPIClient();
      apiClient.setToken(apiKey);
      
      // Test the API key
      await apiClient.ping();
      
      // Save the token
      const configManager = new ConfigManager();
      await configManager.setAuthToken(apiKey);
      
      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        token: apiKey,
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
      const apiClient = new GraphynAPIClient();
      const response = await apiClient.getTestToken();
      
      // Save the token
      const configManager = new ConfigManager();
      await configManager.setAuthToken(response.token);
      await configManager.set('auth.user', response.user);
      
      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        token: response.token,
        user: response.user,
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
      const authUrl = `${appConfig.apiBaseUrl}/api/v1/auth/${provider}/authorize?cli=true&state=${state}&redirect=${encodeURIComponent(redirectUri)}`;
      
      // Open browser
      await open(authUrl);
      
      // Wait for callback
      const oauthData = await waitForOAuthCallback(port, state);
      
      // Exchange OAuth token for CLI JWT
      const apiClient = new GraphynAPIClient();
      const response = await apiClient.post<{token: string, user: AuthResponse['user']}>('/api/v1/cli/token', {
        provider,
        token: oauthData.access_token
      });
      
      // Store JWT token and user info
      const configManager = new ConfigManager();
      await configManager.setAuthToken(response.token);
      await configManager.set('auth.user', response.user);
      await configManager.set(`${provider}.connected`, true);
      
      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        token: response.token,
        user: response.user,
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
      const configManager = new ConfigManager();
      await configManager.delete('auth');
      
      setState(prev => ({
        ...prev,
        isAuthenticated: false,
        token: undefined,
        user: undefined,
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
        <Text bold>Authentication</Text>
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> {state.mode === 'menu' ? 'Checking authentication status...' : 'Authenticating...'}</Text>
        </Box>
      </Box>
    );
  }

  // OAuth flow in progress
  if (state.mode === 'oauth-flow') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>OAuth Authentication - {state.oauthProvider?.charAt(0).toUpperCase() + state.oauthProvider?.slice(1)}</Text>
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Opening browser for authentication...</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Please complete the authentication in your browser</Text>
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
      const menuItems = state.isAuthenticated
        ? [
            { label: '📊 View Status', value: 'status' },
            { label: '🚪 Logout', value: 'logout' },
            { label: '← Back to Main Menu', value: 'back' }
          ]
        : [
            { label: '🔑 Enter API Key', value: 'api-key' },
            { label: '🔗 OAuth Login (GitHub/Figma)', value: 'oauth' },
            { label: '🧪 Get Test Token', value: 'test-token' },
            { label: '← Back to Main Menu', value: 'back' }
          ];

      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>Authentication</Text>
          <Box marginTop={1}>
            <Text color={state.isAuthenticated ? 'green' : 'yellow'}>
              {state.isAuthenticated ? '✅ Authenticated' : '⚠️  Not authenticated'}
            </Text>
          </Box>
          
          {state.error && (
            <Box marginTop={1}>
              <Text color="red">❌ {state.error}</Text>
            </Box>
          )}
          
          <Box marginTop={1}>
            <SelectInput items={menuItems} onSelect={handleMenuSelect} />
          </Box>
          
          <Box marginTop={2}>
            <Text dimColor>Use ↑↓ to navigate, ↵ to select, ESC to go back</Text>
          </Box>
        </Box>
      );

    case 'api-key':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>Enter API Key</Text>
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
              <Text color="red">❌ {state.error}</Text>
            </Box>
          )}
          
          <Box marginTop={1}>
            <Text dimColor>Press Enter to submit, ESC to cancel</Text>
          </Box>
        </Box>
      );

    case 'oauth-select':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>OAuth Login</Text>
          <Box marginTop={1}>
            <Text>Select a provider to authenticate with:</Text>
          </Box>
          
          <Box marginTop={1}>
            <SelectInput
              items={[
                { label: '🐙 GitHub', value: 'github' },
                { label: '🎨 Figma', value: 'figma' },
                { label: '← Back', value: 'back' }
              ]}
              onSelect={handleOAuthSelect}
            />
          </Box>
          
          {state.error && (
            <Box marginTop={1}>
              <Text color="red">❌ {state.error}</Text>
            </Box>
          )}
        </Box>
      );

    case 'status':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>Authentication Status</Text>
          
          <Box marginTop={1} flexDirection="column">
            <Box>
              <Text>Status: </Text>
              <Text color={state.isAuthenticated ? 'green' : 'red'}>
                {state.isAuthenticated ? '✅ Authenticated' : '❌ Not authenticated'}
              </Text>
            </Box>
            
            {state.token && (
              <Box marginTop={1}>
                <Text>Token: </Text>
                <Text color="gray">{state.token.substring(0, 12)}...</Text>
              </Box>
            )}
            
            {state.user && (
              <>
                <Box marginTop={1}>
                  <Text>User: </Text>
                  <Text color="cyan">{state.user.name || state.user.email}</Text>
                </Box>
                {state.user.orgID && (
                  <Box>
                    <Text>Organization: </Text>
                    <Text color="gray">{state.user.orgID}</Text>
                  </Box>
                )}
              </>
            )}
          </Box>
          
          <Box marginTop={2}>
            <Text dimColor>Press any key to return to menu</Text>
          </Box>
        </Box>
      );

    default:
      return null;
  }
};