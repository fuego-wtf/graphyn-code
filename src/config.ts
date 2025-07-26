export const config = {
  // API endpoints
  apiBaseUrl: process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz',
  appUrl: process.env.GRAPHYN_APP_URL || 'https://app.graphyn.xyz',
  codeApiUrl: process.env.GRAPHYN_CODE_API_URL || 'https://code.graphyn.xyz',
  
  // Auth endpoints
  authEndpoint: '/auth/validate',
  agentsEndpoint: '/agents',
  teamsEndpoint: '/api/teams',
  squadAskEndpoint: '/ask',
  
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