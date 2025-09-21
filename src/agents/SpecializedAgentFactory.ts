import { AgentConfigurationSystem, AgentSpecialization } from '../core/AgentConfigurationSystem.js';
import { ClaudeCodeMCPIntegration, MCPIntegrationOptions } from '../core/ClaudeCodeMCPIntegration.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AgentCreationOptions {
  agentId: string;
  task?: string;
  context?: any;
  workingDirectory: string;
  verbose?: boolean;
  debug?: boolean;
}

export interface AgentCapability {
  name: string;
  description: string;
  tools: string[];
  mcpConfig?: any;
}

/**
 * SpecializedAgentFactory - Factory for creating specialized Claude Code agents
 * 
 * Creates agents based on the AgentConfigurationSystem, loads appropriate
 * prompt templates, configures MCP tools and capabilities dynamically.
 */
export class SpecializedAgentFactory {
  private agentConfig?: AgentConfigurationSystem;
  private isInitialized: boolean = false;

  /**
   * Initialize the factory with agent configuration system
   */
  async initialize(agentConfig: AgentConfigurationSystem): Promise<void> {
    if (!agentConfig.isConfigurationLoaded()) {
      throw new Error('AgentConfigurationSystem must be loaded before initializing factory');
    }

    this.agentConfig = agentConfig;
    this.isInitialized = true;
  }

  /**
   * Create a specialized agent based on type
   */
  async createAgent(agentType: string, options: AgentCreationOptions): Promise<ClaudeCodeMCPIntegration> {
    if (!this.isInitialized || !this.agentConfig) {
      throw new Error('Factory not initialized. Call initialize() first.');
    }

    const agentSpec = this.agentConfig.getAgentSpecialization(agentType);
    if (!agentSpec) {
      throw new Error(`Agent specialization '${agentType}' not found`);
    }

    // Build MCP integration options
    const mcpOptions: MCPIntegrationOptions = {
      agentId: options.agentId,
      agentType,
      promptTemplate: await this.buildAgentPrompt(agentSpec, options),
      task: options.task,
      context: options.context,
      workingDirectory: options.workingDirectory,
      mcpServerConfig: await this.buildMCPConfig(agentSpec),
      verbose: options.verbose,
      debug: options.debug
    };

    // Create and return the integration
    const integration = new ClaudeCodeMCPIntegration(mcpOptions);

    if (options.verbose) {
      console.log(`🏭 Created ${agentType} agent: ${options.agentId}`);
      console.log(`🛠️  Tools: ${agentSpec.tools.join(', ')}`);
      console.log(`🎯 Specializations: ${agentSpec.specializations.join(', ')}`);
    }

    return integration;
  }

  /**
   * Get available agent types
   */
  getAvailableAgentTypes(): string[] {
    if (!this.agentConfig) {
      throw new Error('Factory not initialized');
    }
    return this.agentConfig.getAvailableAgentTypes();
  }

  /**
   * Get agent capabilities for a specific type
   */
  getAgentCapabilities(agentType: string): AgentCapability | null {
    if (!this.agentConfig) {
      throw new Error('Factory not initialized');
    }

    const spec = this.agentConfig.getAgentSpecialization(agentType);
    if (!spec) {
      return null;
    }

    return {
      name: agentType,
      description: spec.description,
      tools: spec.tools,
      mcpConfig: this.getMCPToolsForAgent(spec)
    };
  }

  /**
   * Validate agent creation options
   */
  validateCreationOptions(agentType: string, options: AgentCreationOptions): boolean {
    if (!this.agentConfig) {
      throw new Error('Factory not initialized');
    }

    const spec = this.agentConfig.getAgentSpecialization(agentType);
    if (!spec) {
      throw new Error(`Agent type '${agentType}' not found`);
    }

    // Validate required fields
    if (!options.agentId || !options.workingDirectory) {
      throw new Error('Agent ID and working directory are required');
    }

    // Validate agent ID format
    if (!/^[a-zA-Z0-9\-_]+$/.test(options.agentId)) {
      throw new Error('Agent ID must contain only alphanumeric characters, hyphens, and underscores');
    }

    return true;
  }

  /**
   * Build comprehensive agent prompt from template and context
   */
  private async buildAgentPrompt(agentSpec: AgentSpecialization, options: AgentCreationOptions): Promise<string> {
    if (!agentSpec.promptTemplate) {
      throw new Error(`No prompt template found for agent type: ${agentSpec.type}`);
    }

    let prompt = agentSpec.promptTemplate;

    // Add agent-specific context
    prompt += `\n\n## Agent Specialization Context\n`;
    prompt += `You are a ${agentSpec.type} specialist with the following capabilities:\n`;
    
    agentSpec.specializations.forEach(spec => {
      prompt += `- ${spec}\n`;
    });

    prompt += `\n## Available Tools\n`;
    prompt += `You have access to the following tools:\n`;
    agentSpec.tools.forEach(tool => {
      prompt += `- ${tool}\n`;
    });

    // Add MCP coordination instructions
    prompt += `\n## Multi-Agent Coordination\n`;
    prompt += `You are part of a coordinated multi-agent system. Use MCP tools to:\n`;
    prompt += `- **enqueue_task**: Create new tasks for other agents\n`;
    prompt += `- **get_next_task**: Get your next assigned task\n`;
    prompt += `- **complete_task**: Mark tasks as completed with results\n`;
    prompt += `- **get_task_status**: Check status of dependencies\n`;
    prompt += `- **get_transparency_log**: View system activity for context\n`;

    // Add working directory context
    prompt += `\n## Working Environment\n`;
    prompt += `- Working Directory: ${options.workingDirectory}\n`;
    prompt += `- Agent ID: ${options.agentId}\n`;

    // Add task-specific instructions if provided
    if (options.task) {
      prompt += `\n## Current Assignment\n`;
      prompt += `${options.task}\n`;
      
      // Add task-specific tool suggestions
      prompt += `\n### Recommended Approach\n`;
      prompt += this.getTaskSpecificGuidance(agentSpec.type, options.task);
    }

    // Add collaboration guidelines
    prompt += `\n## Collaboration Guidelines\n`;
    prompt += `- Always check for task dependencies before starting work\n`;
    prompt += `- Use descriptive task names when creating dependencies\n`;
    prompt += `- Provide detailed completion summaries for other agents\n`;
    prompt += `- Log significant progress using transparency tools\n`;
    prompt += `- Ask for clarification if task requirements are unclear\n`;

    return prompt;
  }

  /**
   * Build MCP configuration for specific agent
   */
  private async buildMCPConfig(agentSpec: AgentSpecialization): Promise<string> {
    const mcpConfig = {
      version: "1.0",
      transport: {
        type: "stdio"
      },
      servers: {
        "graphyn-coordinator": {
          command: "node",
          args: [path.join(__dirname, "../../src/mcp-server/server.js")],
          env: {
            NODE_ENV: "production"
          }
        }
      },
      tools: this.getMCPToolsForAgent(agentSpec)
    };

    // Write config to temporary file and return path
    const configPath = path.join(__dirname, `../../config/claude-mcp-client-${agentSpec.type}.json`);
    
    // In a real implementation, we would write this to a file
    // For now, we'll return the path where it should be
    return configPath;
  }

  /**
   * Get MCP tools configuration for specific agent
   */
  private getMCPToolsForAgent(agentSpec: AgentSpecialization): any {
    const baseMCPTools = [
      "enqueue_task",
      "get_next_task", 
      "complete_task",
      "get_task_status",
      "get_transparency_log"
    ];

    // Add agent-specific MCP tool configurations
    const agentSpecificTools: { [key: string]: string[] } = {
      backend: ["query_database", "call_endpoint"],
      frontend: ["get_code", "get_screenshot", "get_metadata"],
      figma: ["get_code", "get_screenshot", "get_code_connect_map", "get_variable_defs"],
      security: ["get_src_files", "query_database"],
      test: ["call_endpoint", "get_src_files"],
      devops: ["get_services", "get_metrics", "get_storage_buckets"]
    };

    const allTools = [...baseMCPTools, ...(agentSpecificTools[agentSpec.type] || [])];

    return {
      enabled: allTools,
      config: {
        timeout: 30000,
        retries: 3,
        batch_size: 10
      }
    };
  }

  /**
   * Get task-specific guidance for agent type
   */
  private getTaskSpecificGuidance(agentType: string, task: string): string {
    const guidance: { [key: string]: (task: string) => string } = {
      backend: (task: string) => {
        if (task.toLowerCase().includes('auth')) {
          return `- Start by creating authentication middleware\n- Set up user models and database schemas\n- Implement JWT token handling\n- Add password hashing and validation\n- Create login/logout endpoints`;
        }
        if (task.toLowerCase().includes('api')) {
          return `- Design RESTful endpoint structure\n- Create route handlers and middleware\n- Set up request validation\n- Implement error handling\n- Add API documentation`;
        }
        return `- Analyze requirements and break into components\n- Create necessary models and schemas\n- Implement core business logic\n- Add proper error handling\n- Write unit tests for functionality`;
      },
      
      frontend: (task: string) => {
        if (task.toLowerCase().includes('component')) {
          return `- Start with component structure and props\n- Implement responsive design patterns\n- Add proper TypeScript types\n- Include accessibility features\n- Create component documentation`;
        }
        return `- Plan component hierarchy\n- Implement state management\n- Add proper styling and responsiveness\n- Include user interaction handling\n- Test across different screen sizes`;
      },
      
      security: (task: string) => {
        return `- Scan for common vulnerabilities (OWASP Top 10)\n- Review authentication and authorization\n- Check for input validation issues\n- Analyze data handling and storage\n- Generate security report with recommendations`;
      },
      
      test: (task: string) => {
        return `- Analyze code coverage requirements\n- Create unit tests for core functions\n- Add integration tests for workflows\n- Implement end-to-end test scenarios\n- Set up continuous testing pipeline`;
      },
      
      figma: (task: string) => {
        return `- Extract design tokens and variables\n- Generate component code with proper typing\n- Map design elements to code structure\n- Create i18n keys for text content\n- Generate component documentation`;
      },
      
      devops: (task: string) => {
        return `- Analyze deployment requirements\n- Create Docker configurations\n- Set up CI/CD pipeline\n- Configure monitoring and logging\n- Plan scaling and infrastructure`;
      }
    };

    const getGuidance = guidance[agentType];
    return getGuidance ? getGuidance(task) : '- Break task into smaller components\n- Plan implementation approach\n- Execute systematically\n- Document progress and decisions';
  }
}