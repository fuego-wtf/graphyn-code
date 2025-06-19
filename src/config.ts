export const config = {
  // API URL - defaults to production
  apiBaseUrl: process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz',
  authEndpoint: '/auth/validate',
  agentsEndpoint: '/agents',
  timeout: 30000,
  userAgent: 'Graphyn Code CLI v1.0.0'
};