// Dynamic configuration getter that re-reads environment variables at runtime
export function getConfig() {
  // Detect development mode and prefer localhost if available
  const defaultApiUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : 'https://api.graphyn.xyz';
  const apiUrl = process.env.GRAPHYN_API_URL || defaultApiUrl;
  const isDev = apiUrl.includes('localhost') || process.env.NODE_ENV === 'development' || process.env.GRAPHYN_DEV_MODE === 'true';

  return {
    // API endpoints
    apiBaseUrl: apiUrl,
    appUrl: isDev 
      ? (process.env.GRAPHYN_APP_URL || 'http://localhost:3000')
      : (process.env.GRAPHYN_APP_URL || 'https://app.graphyn.xyz'),
    codeApiUrl: isDev 
      ? (process.env.GRAPHYN_CODE_API_URL || apiUrl) // Use main API in development
      : (process.env.GRAPHYN_CODE_API_URL || 'https://code.graphyn.xyz'),
    isDev
  };
}

// Legacy static config for backward compatibility, but prefer getConfig()
export const config = {
  get apiBaseUrl() { return getConfig().apiBaseUrl; },
  get appUrl() { return getConfig().appUrl; },
  get codeApiUrl() { return getConfig().codeApiUrl; },
  get isDev() { return getConfig().isDev; },
  
  // Auth endpoints
  authEndpoint: '/api/auth/validate',
  agentsEndpoint: '/api/agents',
  squadsEndpoint: '/api/teams', // Backend endpoint that returns organizations/squads
  squadAskEndpoint: '/api/code/ask',
  
  // Client configuration
  timeout: 30000,
  userAgent: 'Graphyn Code CLI v0.1.62',
  
  // OAuth configuration
  oauth: {
    port: parseInt(process.env.GRAPHYN_OAUTH_PORT || '8989'),
    redirectUri: process.env.GRAPHYN_OAUTH_REDIRECT_URI || 'https://cli.graphyn.xyz/callback',
    localRedirectUri: 'http://localhost:8989/callback',
    clientId: process.env.GRAPHYN_OAUTH_CLIENT_ID || 'graphyn-cli-official',
    scopes: 'openid profile email agents:read agents:write threads:read threads:write organizations:read'
  }
};