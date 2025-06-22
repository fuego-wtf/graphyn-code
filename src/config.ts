export const config = {
  // API URL - defaults to production
  apiBaseUrl: process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz/api/v1',
  authEndpoint: '/auth/validate',
  agentsEndpoint: '/agents',
  timeout: 30000,
  userAgent: 'Graphyn Code CLI v0.1.51',
  oauth: {
    port: 8989,
    redirectUri: 'http://localhost:8989/callback'
  }
};