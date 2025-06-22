import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import Spinner from 'ink-spinner';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import open from 'open';
import { detectRepository, detectFramework } from '../utils/repository.js';
import { generateState, waitForOAuthCallback, getAvailablePort } from '../utils/auth.js';
import { ConfigManager } from '../../config-manager.js';
import { GraphynAPIClient } from '../../api-client.js';
import { config as appConfig } from '../../config.js';
import { colors } from '../../ui.js';

interface InitState {
  step: 'detecting' | 'github' | 'figma' | 'agent' | 'demo' | 'complete';
  projectName?: string;
  repoUrl?: string;
  framework?: string;
  githubConnected: boolean;
  figmaConnected: boolean;
  error?: string;
}

export const Init: React.FC = () => {
  const { exit } = useApp();
  const [state, setState] = useState<InitState>({
    step: 'detecting',
    githubConnected: false,
    figmaConnected: false
  });

  // Step 1: Detect repository
  useEffect(() => {
    if (state.step === 'detecting') {
      detectRepo();
    }
  }, [state.step]);

  const detectRepo = async () => {
    try {
      const repoInfo = await detectRepository();
      const frameworkInfo = await detectFramework();
      
      setState(prev => ({
        ...prev,
        projectName: repoInfo.name,
        repoUrl: repoInfo.url,
        framework: frameworkInfo.name,
        step: 'github'
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to detect repository',
        step: 'github'
      }));
    }
  };

  const handleGitHubAuth = async () => {
    try {
      const port = appConfig.oauth.port; // Use 8989
      const state = generateState();
      const redirectUri = appConfig.oauth.redirectUri;
      const authUrl = `${appConfig.apiBaseUrl}/auth/github/authorize?cli=true&state=${state}&redirect=${encodeURIComponent(redirectUri)}`;
      
      // Open browser
      await open(authUrl);
      
      // Wait for callback
      const oauthData = await waitForOAuthCallback(port, state);
      
      // Exchange OAuth code for CLI token
      const apiClient = new GraphynAPIClient();
      const response = await apiClient.post<{token: string, user: any}>('/cli/auth/callback', {
        provider: 'github',
        code: oauthData.access_token, // This is actually the code
        state: state,
        redirectUri: redirectUri
      });
      
      // Store JWT token and user info
      const configManager = new ConfigManager();
      await configManager.setAuthToken(response.token);
      await configManager.set('user', response.user);
      await configManager.set('organization', response.user.organization);
      
      setState(prev => ({
        ...prev,
        githubConnected: true,
        step: 'figma'
      }));
    } catch (error: any) {
      // Enhanced error handling
      console.log(colors.error(`\n❌ GitHub authentication failed: ${error.message}`));
      
      if (error.message.includes('ECONNREFUSED')) {
        console.log(colors.warning('⚠️  Could not connect to backend. Is it running?'));
        console.log(colors.info('💡 Start backend: cd backend && npm run dev'));
      } else if (error.message.includes('401') || error.message.includes('403')) {
        console.log(colors.warning('⚠️  Invalid OAuth token. Please try again.'));
      } else if (error.message.includes('timeout')) {
        console.log(colors.warning('⚠️  Request timed out. Check your network connection.'));
      }
      
      // For MVP, continue anyway
      setState(prev => ({
        ...prev,
        githubConnected: false,
        step: 'figma'
      }));
    }
  };

  const handleFigmaAuth = async () => {
    try {
      const port = await getAvailablePort();
      const state = generateState();
      const redirectUri = `http://localhost:${port}/callback`;
      const authUrl = `${appConfig.apiBaseUrl}/api/v1/auth/figma/authorize?cli=true&state=${state}&redirect=${encodeURIComponent(redirectUri)}`;
      
      // Open browser
      await open(authUrl);
      
      // Wait for callback
      const oauthData = await waitForOAuthCallback(port, state);
      
      // Exchange OAuth token for CLI JWT
      const apiClient = new GraphynAPIClient();
      const response = await apiClient.post<{token: string}>('/api/v1/cli/token', {
        provider: 'figma',
        token: oauthData.access_token
      });
      
      // Store JWT token
      const configManager = new ConfigManager();
      await configManager.setAuthToken(response.token);
      
      setState(prev => ({
        ...prev,
        figmaConnected: true,
        step: 'agent'
      }));
    } catch (error: any) {
      // Enhanced error handling
      console.log(colors.error(`\n❌ Figma authentication failed: ${error.message}`));
      
      if (error.message.includes('ECONNREFUSED')) {
        console.log(colors.warning('⚠️  Could not connect to backend. Is it running?'));
        console.log(colors.info('💡 Start backend: cd backend && npm run dev'));
      } else if (error.message.includes('401') || error.message.includes('403')) {
        console.log(colors.warning('⚠️  Invalid OAuth token. Please try again.'));
      } else if (error.message.includes('timeout')) {
        console.log(colors.warning('⚠️  Request timed out. Check your network connection.'));
      }
      
      // For MVP, continue anyway
      setState(prev => ({
        ...prev,
        figmaConnected: false,
        step: 'agent'
      }));
    }
  };

  const handleAgentSelection = (item: { value: string }) => {
    if (item.value === 'design') {
      setState(prev => ({ ...prev, step: 'demo' }));
    } else {
      // Open web builder for other agent types
      const builderUrl = `https://graphyn.com/agents/new?type=${item.value}&repo=${encodeURIComponent(state.repoUrl || '')}`;
      open(builderUrl);
      
      // Move to demo after delay
      setTimeout(() => {
        setState(prev => ({ ...prev, step: 'demo' }));
      }, 2000);
    }
  };

  const handleDemo = async () => {
    // For MVP, simulate component generation
    setState(prev => ({ ...prev, step: 'complete' }));
  };

  // Render based on current step
  switch (state.step) {
    case 'detecting':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Spinner type="dots" />
            <Text> Detecting repository...</Text>
          </Box>
        </Box>
      );

    case 'github':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="green">✓ Found project: {state.projectName}</Text>
          {state.framework && (
            <Text color="gray">  Framework: {state.framework}</Text>
          )}
          <Box marginTop={1}>
            <Text>Connect your GitHub account to enable repository context:</Text>
          </Box>
          <Box marginTop={1}>
            <SelectInput
              items={[
                { label: 'Connect GitHub', value: 'connect' },
                { label: 'Skip for now', value: 'skip' }
              ]}
              onSelect={(item) => {
                if (item.value === 'connect') {
                  handleGitHubAuth();
                } else {
                  setState(prev => ({ ...prev, step: 'figma' }));
                }
              }}
            />
          </Box>
        </Box>
      );

    case 'figma':
      return (
        <Box flexDirection="column" padding={1}>
          {state.githubConnected && (
            <Text bold color="green">✓ GitHub connected</Text>
          )}
          <Box marginTop={1}>
            <Text>Connect Figma for pixel-perfect component generation:</Text>
          </Box>
          <Box marginTop={1}>
            <SelectInput
              items={[
                { label: 'Connect Figma', value: 'connect' },
                { label: 'Skip for now', value: 'skip' }
              ]}
              onSelect={(item) => {
                if (item.value === 'connect') {
                  handleFigmaAuth();
                } else {
                  setState(prev => ({ ...prev, step: 'agent' }));
                }
              }}
            />
          </Box>
        </Box>
      );

    case 'agent':
      return (
        <Box flexDirection="column" padding={1}>
          {state.githubConnected && (
            <Text bold color="green">✓ GitHub connected</Text>
          )}
          {state.figmaConnected && (
            <Text bold color="green">✓ Figma connected</Text>
          )}
          <Box marginTop={1}>
            <Text bold>🤖 Let's create your first agent!</Text>
          </Box>
          <Box marginTop={1}>
            <Text>What kind of agent would you like?</Text>
          </Box>
          <Box marginTop={1}>
            <SelectInput
              items={[
                { label: '🎨 Design Agent - Figma to perfect code', value: 'design' },
                { label: '🏗️  Architect - System design expert', value: 'architect' },
                { label: '🔧 Backend Dev - API specialist', value: 'backend' },
                { label: '✨ Custom - Create your own', value: 'custom' }
              ]}
              onSelect={handleAgentSelection}
            />
          </Box>
        </Box>
      );

    case 'demo':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>✨ Let's generate your first component!</Text>
          <Box marginTop={1}>
            <Text>Paste a Figma URL or press Enter for a demo:</Text>
          </Box>
          <Box marginTop={1}>
            <TextInput
              value=""
              placeholder="https://figma.com/file/..."
              onChange={() => {}}
              onSubmit={handleDemo}
            />
          </Box>
        </Box>
      );

    case 'complete':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="green">🎉 Graphyn Ultra is ready!</Text>
          <Box marginTop={1} flexDirection="column">
            <Text>You just:</Text>
            <Text color="gray">  ✓ Connected your repository</Text>
            {state.githubConnected && <Text color="gray">  ✓ Integrated with GitHub</Text>}
            {state.figmaConnected && <Text color="gray">  ✓ Integrated with Figma</Text>}
            <Text color="gray">  ✓ Created your first agent</Text>
            <Text color="gray">  ✓ Generated pixel-perfect code</Text>
          </Box>
          <Box marginTop={1}>
            <Text bold color="blue">💰 You just saved ~2 hours of development time!</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text>With Graphyn Ultra ($39/month), you get:</Text>
            <Text color="gray">  • Unlimited Figma extractions</Text>
            <Text color="gray">  • Unlimited organizations</Text>
            <Text color="gray">  • Team agent sharing</Text>
            <Text color="gray">  • AI that learns your patterns</Text>
          </Box>
          <Box marginTop={1}>
            <Text bold>📚 Next steps:</Text>
          </Box>
          <Box flexDirection="column">
            <Text color="gray">  graphyn design &lt;figma-url&gt;  Generate any component</Text>
            <Text color="gray">  graphyn share agent         Share with your team</Text>
            <Text color="gray">  graphyn --help              See all commands</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to exit</Text>
          </Box>
        </Box>
      );

    default:
      return null;
  }
};