/**
 * MCP Server Registry - NPM Package Mappings for Auto-Installation
 * 
 * Maintains a registry of available MCP servers with their NPM packages,
 * tool capabilities, and environment requirements for automatic installation.
 */

export interface MCPServerConfig {
  package: string;
  description: string;
  tools: string[];
  required_env: string[];
  auto_install: boolean;
  startup_args?: string[];
  working_directory?: string;
  version?: string;
}

export interface MCPServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
  working_directory?: string;
}

/**
 * Official MCP Server Registry
 * Maps server names to their NPM packages and configurations
 */
export const MCP_SERVER_REGISTRY: Record<string, MCPServerConfig> = {
  // CORE SERVERS (Always Available)
  'filesystem': {
    package: '@modelcontextprotocol/server-filesystem',
    description: 'File system operations (Read, Write, Edit, Glob)',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Search'],
    required_env: [],
    auto_install: true,
    startup_args: ['/tmp', process.cwd()]
  },

  'github': {
    package: '@modelcontextprotocol/server-github',
    description: 'GitHub API operations (PR, Issues, Repos)',
    tools: ['CreatePR', 'CreateIssue', 'ListIssues', 'GetRepo', 'CreateBranch'],
    required_env: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    auto_install: true
  },

  // DATABASE SERVERS
  'postgres': {
    package: '@modelcontextprotocol/server-postgres',
    description: 'PostgreSQL database operations',
    tools: ['Query', 'Schema', 'Migration', 'Explain', 'Backup'],
    required_env: ['DATABASE_URL'],
    auto_install: false // Only if PostgreSQL detected
  },

  'mongodb': {
    package: '@modelcontextprotocol/server-mongodb',
    description: 'MongoDB operations',
    tools: ['Find', 'Insert', 'Update', 'Delete', 'Aggregate'],
    required_env: ['MONGODB_URI'],
    auto_install: false
  },

  'redis': {
    package: '@modelcontextprotocol/server-redis',
    description: 'Redis cache operations',
    tools: ['Get', 'Set', 'Delete', 'Expire', 'Pub', 'Sub'],
    required_env: ['REDIS_URL'],
    auto_install: false
  },

  'sqlite': {
    package: '@modelcontextprotocol/server-sqlite',
    description: 'SQLite database operations',
    tools: ['Query', 'Schema', 'Migration'],
    required_env: [],
    auto_install: false // Only if SQLite files detected
  },

  // DEVOPS SERVERS
  'docker': {
    package: '@modelcontextprotocol/server-docker',
    description: 'Docker container management',
    tools: ['Container', 'Image', 'Network', 'Volume', 'Compose'],
    required_env: [],
    auto_install: false // Only if Docker detected
  },

  'kubernetes': {
    package: '@modelcontextprotocol/server-kubernetes',
    description: 'Kubernetes cluster management',
    tools: ['Deploy', 'Scale', 'Rollback', 'Logs', 'Exec'],
    required_env: ['KUBECONFIG'],
    auto_install: false
  },

  'aws': {
    package: '@modelcontextprotocol/server-aws',
    description: 'AWS cloud services',
    tools: ['S3', 'Lambda', 'CloudFormation', 'EC2', 'RDS'],
    required_env: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
    auto_install: false
  },

  // INTEGRATION SERVERS
  'slack': {
    package: '@modelcontextprotocol/server-slack',
    description: 'Slack messaging',
    tools: ['SendMessage', 'ListChannels', 'GetUser', 'PostFile'],
    required_env: ['SLACK_TOKEN'],
    auto_install: false
  },

  'jira': {
    package: '@modelcontextprotocol/server-jira',
    description: 'Jira issue tracking',
    tools: ['CreateIssue', 'UpdateIssue', 'GetIssue', 'Search'],
    required_env: ['JIRA_TOKEN', 'JIRA_URL'],
    auto_install: false
  },

  'figma': {
    package: '@figma/mcp',
    description: 'Figma design operations',
    tools: ['GetDesign', 'ExportAssets', 'GetComponents', 'GetStyles'],
    required_env: ['FIGMA_PERSONAL_ACCESS_TOKEN'],
    auto_install: false
  },

  'notion': {
    package: '@modelcontextprotocol/server-notion',
    description: 'Notion workspace operations',
    tools: ['CreatePage', 'UpdatePage', 'GetDatabase', 'Query'],
    required_env: ['NOTION_API_KEY'],
    auto_install: false
  },

  // DEVELOPMENT SERVERS
  'git': {
    package: '@modelcontextprotocol/server-git',
    description: 'Git version control operations',
    tools: ['Status', 'Commit', 'Branch', 'Merge', 'Log'],
    required_env: [],
    auto_install: true // Always useful for development
  },

  'npm': {
    package: '@modelcontextprotocol/server-npm',
    description: 'NPM package management',
    tools: ['Install', 'Update', 'Search', 'Info', 'Scripts'],
    required_env: [],
    auto_install: false // Only if package.json detected
  },

  'webpack': {
    package: '@modelcontextprotocol/server-webpack',
    description: 'Webpack build operations',
    tools: ['Build', 'Dev', 'Analyze', 'Config'],
    required_env: [],
    auto_install: false // Only if webpack detected
  },

  // TESTING SERVERS
  'jest': {
    package: '@modelcontextprotocol/server-jest',
    description: 'Jest testing framework',
    tools: ['RunTests', 'Coverage', 'Watch', 'Config'],
    required_env: [],
    auto_install: false // Only if Jest detected
  },

  'cypress': {
    package: '@modelcontextprotocol/server-cypress',
    description: 'Cypress E2E testing',
    tools: ['RunTests', 'Open', 'Record', 'Config'],
    required_env: [],
    auto_install: false // Only if Cypress detected
  },

  // API TESTING SERVERS
  'postman': {
    package: '@modelcontextprotocol/server-postman',
    description: 'Postman API testing',
    tools: ['RunCollection', 'CreateTest', 'Export'],
    required_env: ['POSTMAN_API_KEY'],
    auto_install: false
  },

  // MONITORING SERVERS
  'datadog': {
    package: '@modelcontextprotocol/server-datadog',
    description: 'Datadog monitoring',
    tools: ['Metrics', 'Logs', 'Traces', 'Dashboards'],
    required_env: ['DATADOG_API_KEY'],
    auto_install: false
  },

  'newrelic': {
    package: '@modelcontextprotocol/server-newrelic',
    description: 'New Relic monitoring',
    tools: ['Metrics', 'Alerts', 'Insights'],
    required_env: ['NEW_RELIC_API_KEY'],
    auto_install: false
  }
};

/**
 * Get MCP server configuration by name
 */
export function getMCPServerConfig(serverName: string): MCPServerConfig | undefined {
  return MCP_SERVER_REGISTRY[serverName];
}

/**
 * Get all available MCP server names
 */
export function getAvailableMCPServers(): string[] {
  return Object.keys(MCP_SERVER_REGISTRY);
}

/**
 * Get core MCP servers that should always be available
 */
export function getCoreMCPServers(): string[] {
  return Object.keys(MCP_SERVER_REGISTRY).filter(
    name => MCP_SERVER_REGISTRY[name].auto_install
  );
}

/**
 * Get MCP servers by category
 */
export function getMCPServersByCategory(category: string): string[] {
  const categoryMap: Record<string, string[]> = {
    'database': ['postgres', 'mongodb', 'redis', 'sqlite'],
    'devops': ['docker', 'kubernetes', 'aws'],
    'integration': ['slack', 'jira', 'figma', 'notion'],
    'development': ['git', 'npm', 'webpack'],
    'testing': ['jest', 'cypress', 'postman'],
    'monitoring': ['datadog', 'newrelic'],
    'core': getCoreMCPServers()
  };

  return categoryMap[category] || [];
}

/**
 * Build NPX command for MCP server
 */
export function buildMCPServerCommand(
  serverName: string, 
  config: MCPServerConfig,
  env: Record<string, string> = {}
): MCPServer {
  const serverEnv: Record<string, string> = {};
  
  // Build environment variables
  for (const envVar of config.required_env) {
    // Use actual env var or placeholder for Claude to fill
    serverEnv[envVar] = env[envVar] || process.env[envVar] || `\${${envVar}}`;
  }

  return {
    command: 'npx',
    args: ['-y', config.package, ...(config.startup_args || [])],
    env: serverEnv,
    working_directory: config.working_directory
  };
}

/**
 * Check if server has all required environment variables
 */
export function hasRequiredEnvironment(serverName: string, env: Record<string, string> = {}): boolean {
  const config = getMCPServerConfig(serverName);
  if (!config) return false;

  return config.required_env.every(envVar => 
    env[envVar] || process.env[envVar] || envVar.includes('${')
  );
}

/**
 * Get missing environment variables for a server
 */
export function getMissingEnvironmentVars(serverName: string, env: Record<string, string> = {}): string[] {
  const config = getMCPServerConfig(serverName);
  if (!config) return [];

  return config.required_env.filter(envVar => 
    !env[envVar] && !process.env[envVar] && !envVar.includes('${')
  );
}
