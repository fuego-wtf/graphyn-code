/**
 * Agent Configuration System - Step 10 Implementation
 * 
 * Loads agent-specializations.json and provides runtime configuration
 * for the dynamic agent specialization engine.
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export interface AgentSpecialization {
  name: string;
  description: string;
  capabilities: string[];
  defaultTools: string[];
  tags: string[];
  prompt: string;
  timeout: number;
  maxRetries: number;
  priority: number;
  dependencies: string[];
  outputs: string[];
}

export interface WorkflowStep {
  agent: string;
  parallel: boolean;
  condition?: string;
  waitFor?: string[];
}

export interface Workflow {
  description: string;
  steps: WorkflowStep[];
}

export interface AgentConfiguration {
  version: string;
  lastUpdated: string;
  agentTypes: Record<string, AgentSpecialization>;
  workflows: Record<string, Workflow>;
  mcpIntegration: {
    enabled: boolean;
    coordinationTools: string[];
    transparencyTools: string[];
  };
  figmaIntegration: {
    enabled: boolean;
    oauthRequired: boolean;
    extractionTools: string[];
  };
}

/**
 * Agent Configuration System - Manages agent specializations and workflows
 */
export class AgentConfigurationSystem {
  private config: AgentConfiguration | null = null;
  private configPath: string;
  private promptTemplates: Map<string, string> = new Map();

  constructor(configPath?: string) {
    this.configPath = configPath || join(process.cwd(), 'config', 'agent-specializations.json');
  }

  /**
   * Load agent configuration from file
   */
  async loadConfiguration(): Promise<AgentConfiguration> {
    if (!existsSync(this.configPath)) {
      throw new Error(`Agent configuration file not found: ${this.configPath}`);
    }

    try {
      const configData = readFileSync(this.configPath, 'utf-8');
      this.config = JSON.parse(configData) as AgentConfiguration;
      
      // Validate configuration structure
      this.validateConfiguration(this.config);
      
      // Load prompt templates
      await this.loadPromptTemplates();
      
      console.log(`✅ Loaded agent configuration v${this.config.version}`);
      console.log(`📋 Available agents: ${Object.keys(this.config.agentTypes).join(', ')}`);
      console.log(`🔄 Available workflows: ${Object.keys(this.config.workflows).join(', ')}`);
      
      return this.config;
    } catch (error) {
      throw new Error(`Failed to load agent configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get agent specialization by type
   */
  getAgentSpecialization(agentType: string): AgentSpecialization | null {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfiguration() first.');
    }
    
    return this.config.agentTypes[agentType] || null;
  }

  /**
   * Get all available agent types
   */
  getAvailableAgentTypes(): string[] {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfiguration() first.');
    }
    
    return Object.keys(this.config.agentTypes);
  }

  /**
   * Get workflow by name
   */
  getWorkflow(workflowName: string): Workflow | null {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfiguration() first.');
    }
    
    return this.config.workflows[workflowName] || null;
  }

  /**
   * Get available workflows
   */
  getAvailableWorkflows(): string[] {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfiguration() first.');
    }
    
    return Object.keys(this.config.workflows);
  }

  /**
   * Get agent prompt template
   */
  getAgentPrompt(agentType: string): string | null {
    const agent = this.getAgentSpecialization(agentType);
    if (!agent) return null;
    
    return this.promptTemplates.get(agentType) || null;
  }

  /**
   * Check if MCP integration is enabled
   */
  isMCPEnabled(): boolean {
    return this.config?.mcpIntegration?.enabled || false;
  }

  /**
   * Check if Figma integration is enabled
   */
  isFigmaEnabled(): boolean {
    return this.config?.figmaIntegration?.enabled || false;
  }

  /**
   * Get MCP coordination tools
   */
  getMCPCoordinationTools(): string[] {
    return this.config?.mcpIntegration?.coordinationTools || [];
  }

  /**
   * Get Figma extraction tools
   */
  getFigmaExtractionTools(): string[] {
    return this.config?.figmaIntegration?.extractionTools || [];
  }

  /**
   * Validate configuration structure
   */
  private validateConfiguration(config: AgentConfiguration): void {
    if (!config.version) {
      throw new Error('Configuration missing version');
    }
    
    if (!config.agentTypes || Object.keys(config.agentTypes).length === 0) {
      throw new Error('Configuration missing agent types');
    }
    
    // Validate each agent type
    for (const [agentType, spec] of Object.entries(config.agentTypes)) {
      this.validateAgentSpecialization(agentType, spec);
    }
    
    // Validate workflows
    if (config.workflows) {
      for (const [workflowName, workflow] of Object.entries(config.workflows)) {
        this.validateWorkflow(workflowName, workflow, config.agentTypes);
      }
    }
  }

  /**
   * Validate individual agent specialization
   */
  private validateAgentSpecialization(agentType: string, spec: AgentSpecialization): void {
    const required = ['name', 'description', 'capabilities', 'defaultTools', 'prompt'];
    for (const field of required) {
      if (!(field in spec)) {
        throw new Error(`Agent ${agentType} missing required field: ${field}`);
      }
    }
    
    if (!Array.isArray(spec.capabilities) || spec.capabilities.length === 0) {
      throw new Error(`Agent ${agentType} must have at least one capability`);
    }
    
    if (!Array.isArray(spec.defaultTools) || spec.defaultTools.length === 0) {
      throw new Error(`Agent ${agentType} must have at least one default tool`);
    }
    
    if (typeof spec.timeout !== 'number' || spec.timeout <= 0) {
      throw new Error(`Agent ${agentType} timeout must be a positive number`);
    }
    
    if (typeof spec.priority !== 'number' || spec.priority < 1 || spec.priority > 10) {
      throw new Error(`Agent ${agentType} priority must be between 1 and 10`);
    }
  }

  /**
   * Validate workflow configuration
   */
  private validateWorkflow(workflowName: string, workflow: Workflow, agentTypes: Record<string, AgentSpecialization>): void {
    if (!workflow.description) {
      throw new Error(`Workflow ${workflowName} missing description`);
    }
    
    if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
      throw new Error(`Workflow ${workflowName} must have at least one step`);
    }
    
    // Validate each step
    for (const [index, step] of workflow.steps.entries()) {
      if (!step.agent || !agentTypes[step.agent]) {
        throw new Error(`Workflow ${workflowName} step ${index} references unknown agent: ${step.agent}`);
      }
      
      if (step.waitFor) {
        for (const dependency of step.waitFor) {
          const dependentStepExists = workflow.steps.some(s => s.agent === dependency);
          if (!dependentStepExists) {
            throw new Error(`Workflow ${workflowName} step ${index} waitFor references unknown agent: ${dependency}`);
          }
        }
      }
    }
  }

  /**
   * Load prompt templates from filesystem
   */
  private async loadPromptTemplates(): Promise<void> {
    if (!this.config) return;
    
    const templateBasePath = resolve(process.cwd());
    
    for (const [agentType, spec] of Object.entries(this.config.agentTypes)) {
      const templatePath = join(templateBasePath, spec.prompt);
      
      try {
        if (existsSync(templatePath)) {
          const templateContent = readFileSync(templatePath, 'utf-8');
          this.promptTemplates.set(agentType, templateContent);
          console.log(`📄 Loaded prompt template for ${agentType}: ${spec.prompt}`);
        } else {
          console.warn(`⚠️ Prompt template not found for ${agentType}: ${templatePath}`);
          // Create default template
          this.promptTemplates.set(agentType, this.createDefaultPrompt(spec));
        }
      } catch (error) {
        console.warn(`⚠️ Failed to load prompt template for ${agentType}: ${error instanceof Error ? error.message : String(error)}`);
        this.promptTemplates.set(agentType, this.createDefaultPrompt(spec));
      }
    }
  }

  /**
   * Create a default prompt template for an agent
   */
  private createDefaultPrompt(spec: AgentSpecialization): string {
    return `# ${spec.name}

${spec.description}

## Capabilities
${spec.capabilities.map(cap => `- ${cap}`).join('\n')}

## Available Tools
${spec.defaultTools.map(tool => `- ${tool}`).join('\n')}

## Tags
${spec.tags.map(tag => `#${tag}`).join(' ')}

## Expected Outputs
${spec.outputs.map(output => `- ${output}`).join('\n')}

You are specialized in: ${spec.capabilities.join(', ')}
Focus on delivering: ${spec.outputs.join(', ')}
`;
  }

  /**
   * Get runtime statistics
   */
  getStats(): {
    agentsCount: number;
    workflowsCount: number;
    mcpEnabled: boolean;
    figmaEnabled: boolean;
    promptsLoaded: number;
  } {
    if (!this.config) {
      return {
        agentsCount: 0,
        workflowsCount: 0,
        mcpEnabled: false,
        figmaEnabled: false,
        promptsLoaded: 0
      };
    }

    return {
      agentsCount: Object.keys(this.config.agentTypes).length,
      workflowsCount: Object.keys(this.config.workflows).length,
      mcpEnabled: this.isMCPEnabled(),
      figmaEnabled: this.isFigmaEnabled(),
      promptsLoaded: this.promptTemplates.size
    };
  }
}

export default AgentConfigurationSystem;