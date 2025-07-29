// Detect development mode based on API URL
const apiUrl = process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz';
const isDev = apiUrl.includes('localhost') || process.env.NODE_ENV === 'development';

export const config = {
  // API endpoints
  apiBaseUrl: apiUrl,
  appUrl: isDev 
    ? (process.env.GRAPHYN_APP_URL || 'http://localhost:3000')
    : (process.env.GRAPHYN_APP_URL || 'https://app.graphyn.xyz'),
  codeApiUrl: isDev 
    ? (process.env.GRAPHYN_CODE_API_URL || apiUrl) // Use main API in development
    : (process.env.GRAPHYN_CODE_API_URL || 'https://code.graphyn.xyz'),
  
  // Auth endpoints
  authEndpoint: '/api/auth/validate',
  agentsEndpoint: '/api/agents',
  squadsEndpoint: '/api/teams', // Backend endpoint that returns organizations/squads
  squadAskEndpoint: '/api/code/ask',
  
  // Client configuration
  timeout: 30000,
  userAgent: 'Graphyn Code CLI v0.1.60',
  
  // OAuth configuration
  oauth: {
    port: parseInt(process.env.GRAPHYN_OAUTH_PORT || '8989'),
    redirectUri: process.env.GRAPHYN_OAUTH_REDIRECT_URI || 'https://cli.graphyn.xyz/callback',
    localRedirectUri: 'http://localhost:8989/callback',
    clientId: process.env.GRAPHYN_OAUTH_CLIENT_ID || 'graphyn-cli-official',
    scopes: 'openid profile email agents:read agents:write threads:read threads:write organizations:read teams:read'
  }
};