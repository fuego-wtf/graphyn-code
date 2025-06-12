export const config = {
  // Production API URL - backend deployment pending
  apiBaseUrl: process.env.GRAPHYN_API_URL || 'https://backend-kkoa.up.railway.app',
  authEndpoint: '/auth/validate',
  agentsEndpoint: '/agents',
  timeout: 30000,
  userAgent: 'Graphyn Code CLI v1.0.0'
};