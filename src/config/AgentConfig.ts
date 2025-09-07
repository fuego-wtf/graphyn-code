/**
 * Agent Configuration System
 * 
 * Manages agent definitions, prompts, and capabilities
 * Supports loading from .claude/agents and custom configurations
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { AgentType } from '../orchestrator/types';

export interface AgentDefinition {
  id: string;
  name: string;
  role: AgentType;
  description: string;
  expertise: string[];
  capabilities: AgentCapability[];
  prompt: string;
  constraints: string[];
  outputFormat: string;
  maxTokens?: number;
  temperature?: number;
  examples?: AgentExample[];
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentCapability {
  name: string;
  description: string;
  parameters?: Record<string, any>;
  enabled: boolean;
}

export interface AgentExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface AgentConfigSource {
  type: 'file' | 'directory' | 'builtin' | 'remote';
  path: string;
  priority: number;
}

/**
 * Agent Configuration Manager
 */
export class AgentConfig {
  private agents: Map<string, AgentDefinition> = new Map();
  private sources: AgentConfigSource[] = [];
  private initialized: boolean = false;

  constructor() {
    this.setupDefaultSources();
  }

  /**
   * Initialize agent configurations from all sources
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🤖 Loading agent configurations...');

    // Sort sources by priority
    const sortedSources = this.sources.sort((a, b) => a.priority - b.priority);

    for (const source of sortedSources) {
      try {
        await this.loadFromSource(source);
      } catch (error: any) {
        console.warn(`⚠️  Failed to load from ${source.path}: ${error.message}`);
      }
    }

    console.log(`✅ Loaded ${this.agents.size} agent configurations`);
    this.initialized = true;
  }

  /**
   * Load agent definitions from various sources
   */
  async loadAgentDefinitions(): Promise<AgentDefinition[]> {
    await this.initialize();
    return Array.from(this.agents.values());
  }

  /**
   * Get specific agent definition
   */
  async getAgentDefinition(agentId: string): Promise<AgentDefinition | null> {
    await this.initialize();
    return this.agents.get(agentId) || null;
  }

  /**
   * Get agent prompt for specific role
   */
  async getAgentPrompt(role: AgentType, customizations?: Record<string, any>): Promise<string> {
    await this.initialize();

    // Find agent by role
    const agent = Array.from(this.agents.values()).find(a => a.role === role);
    
    if (!agent) {
      return this.generateDefaultPrompt(role, customizations);
    }

    let prompt = agent.prompt;

    // Apply customizations
    if (customizations) {
      prompt = this.applyCustomizations(prompt, customizations);
    }

    return prompt;
  }

  /**
   * Get agents by role
   */
  async getAgentsByRole(role: AgentType): Promise<AgentDefinition[]> {
    await this.initialize();
    return Array.from(this.agents.values()).filter(a => a.role === role);
  }

  /**
   * Add custom agent source
   */
  addSource(source: AgentConfigSource): void {
    this.sources.push(source);
    this.initialized = false; // Force reload
  }

  /**
   * Setup default configuration sources
   */
  private setupDefaultSources(): void {
    const projectAgentsDir = path.join(process.cwd(), '.claude', 'agents');
    const globalAgentsDir = path.join(os.homedir(), '.claude', 'agents');
    const graphynAgentsDir = path.join(os.homedir(), '.graphyn', 'agents');

    // Project-specific agents (highest priority)
    if (fs.existsSync(projectAgentsDir)) {
      this.sources.push({
        type: 'directory',
        path: projectAgentsDir,
        priority: 1
      });
    }

    // Global .claude agents
    if (fs.existsSync(globalAgentsDir)) {
      this.sources.push({
        type: 'directory',
        path: globalAgentsDir,
        priority: 2
      });
    }

    // Graphyn-specific agents
    if (fs.existsSync(graphynAgentsDir)) {
      this.sources.push({
        type: 'directory',
        path: graphynAgentsDir,
        priority: 3
      });
    }

    // Built-in agents (lowest priority)
    this.sources.push({
      type: 'builtin',
      path: 'builtin',
      priority: 10
    });
  }

  /**
   * Load agents from a specific source
   */
  private async loadFromSource(source: AgentConfigSource): Promise<void> {
    switch (source.type) {
      case 'directory':
        await this.loadFromDirectory(source.path);
        break;
      case 'file':
        await this.loadFromFile(source.path);
        break;
      case 'builtin':
        await this.loadBuiltinAgents();
        break;
      case 'remote':
        await this.loadFromRemote(source.path);
        break;
    }
  }

  /**
   * Load agents from directory
   */
  private async loadFromDirectory(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) return;

    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      if (file.endsWith('.md') || file.endsWith('.json') || file.endsWith('.yaml') || file.endsWith('.yml')) {
        const filePath = path.join(dirPath, file);
        try {
          await this.loadFromFile(filePath);
        } catch (error: any) {
          console.warn(`⚠️  Failed to load agent from ${filePath}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Load agent from single file
   */
  private async loadFromFile(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath, ext);

    let agent: AgentDefinition;

    try {
      if (ext === '.json') {
        agent = JSON.parse(content);
      } else if (ext === '.yaml' || ext === '.yml') {
        // Would need yaml parser, for now treat as JSON
        agent = JSON.parse(content);
      } else if (ext === '.md') {
        agent = this.parseMarkdownAgent(content, basename);
      } else {
        throw new Error(`Unsupported file format: ${ext}`);
      }

      // Validate and add agent
      this.validateAgent(agent);
      this.agents.set(agent.id, agent);
      
    } catch (error: any) {
      throw new Error(`Failed to parse agent from ${filePath}: ${error.message}`);
    }
  }

  /**
   * Parse agent definition from markdown format
   */
  private parseMarkdownAgent(content: string, basename: string): AgentDefinition {
    const sections = this.parseMarkdownSections(content);
    
    // Extract metadata from frontmatter or headers
    const metadata = this.extractMetadata(sections);
    
    return {
      id: metadata.id || basename,
      name: metadata.name || basename.replace(/-/g, ' '),
      role: metadata.role || 'cli',
      description: metadata.description || '',
      expertise: metadata.expertise || [],
      capabilities: metadata.capabilities || [],
      prompt: sections.prompt || content,
      constraints: metadata.constraints || [],
      outputFormat: metadata.outputFormat || 'markdown',
      maxTokens: metadata.maxTokens,
      temperature: metadata.temperature,
      examples: metadata.examples || [],
      version: metadata.version || '1.0.0',
      createdAt: metadata.createdAt || new Date().toISOString(),
      updatedAt: metadata.updatedAt || new Date().toISOString()
    };
  }

  /**
   * Parse markdown into sections
   */
  private parseMarkdownSections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = content.split('\n');
    let currentSection = 'prompt';
    let currentContent: string[] = [];

    for (const line of lines) {
      if (line.startsWith('# ') || line.startsWith('## ')) {
        // Save previous section
        if (currentContent.length > 0) {
          sections[currentSection] = currentContent.join('\n').trim();
        }
        
        // Start new section
        currentSection = line.replace(/^#+\s+/, '').toLowerCase().replace(/\s+/g, '_');
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }
    
    // Save last section
    if (currentContent.length > 0) {
      sections[currentSection] = currentContent.join('\n').trim();
    }

    return sections;
  }

  /**
   * Extract metadata from sections
   */
  private extractMetadata(sections: Record<string, string>): Partial<AgentDefinition> {
    const metadata: Partial<AgentDefinition> = {};

    // Look for YAML frontmatter
    if (sections.prompt?.startsWith('---')) {
      const frontmatterEnd = sections.prompt.indexOf('---', 3);
      if (frontmatterEnd !== -1) {
        const frontmatter = sections.prompt.substring(3, frontmatterEnd);
        try {
          const parsed = this.parseYamlLike(frontmatter);
          Object.assign(metadata, parsed);
          sections.prompt = sections.prompt.substring(frontmatterEnd + 3).trim();
        } catch (error) {
          // Ignore frontmatter parsing errors
        }
      }
    }

    // Extract from specific sections
    if (sections.role) {
      const role = sections.role as string;
      // Validate it's a proper AgentType
      const validAgentTypes = ['architect', 'backend', 'frontend', 'test-writer', 'design', 'cli', 'pr-merger', 'task-dispatcher', 'production-architect', 'figma-extractor'];
      if (validAgentTypes.includes(role)) {
        metadata.role = role as AgentType;
      }
    }
    if (sections.description) metadata.description = sections.description;
    if (sections.expertise) {
      metadata.expertise = sections.expertise.split('\n')
        .map(line => line.replace(/^[-*]\s*/, '').trim())
        .filter(line => line);
    }

    return metadata;
  }

  /**
   * Simple YAML-like parser for frontmatter
   */
  private parseYamlLike(content: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();
        
        // Handle arrays
        if (value.startsWith('[') && value.endsWith(']')) {
          result[key.trim()] = JSON.parse(value);
        } 
        // Handle strings
        else if (value.startsWith('"') && value.endsWith('"')) {
          result[key.trim()] = value.slice(1, -1);
        }
        // Handle numbers
        else if (!isNaN(Number(value))) {
          result[key.trim()] = Number(value);
        }
        // Handle booleans
        else if (value === 'true' || value === 'false') {
          result[key.trim()] = value === 'true';
        }
        // Default to string
        else {
          result[key.trim()] = value;
        }
      }
    }

    return result;
  }

  /**
   * Load built-in agent definitions
   */
  private async loadBuiltinAgents(): Promise<void> {
    const builtinAgents: AgentDefinition[] = [
      {
        id: 'code-architect',
        name: 'Code Architect',
        role: 'architect' as AgentType,
        description: 'Designs system architecture and technical specifications',
        expertise: ['system design', 'architecture patterns', 'scalability', 'performance'],
        capabilities: [
          { name: 'system-design', description: 'Design system architecture', enabled: true },
          { name: 'code-review', description: 'Review code architecture', enabled: true }
        ],
        prompt: `You are a Code Architect specializing in system design and technical architecture.

Your expertise includes:
- System design and architecture patterns
- Scalability and performance optimization
- Code structure and organization
- Technical decision making

Focus on creating maintainable, scalable, and well-structured solutions.`,
        constraints: ['follow best practices', 'consider scalability', 'maintain code quality'],
        outputFormat: 'structured technical documentation',
        examples: [],
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'frontend-developer',
        name: 'Frontend Developer',
        role: 'frontend' as AgentType,
        description: 'Builds user interfaces and frontend applications',
        expertise: ['React', 'TypeScript', 'CSS', 'responsive design', 'accessibility'],
        capabilities: [
          { name: 'component-development', description: 'Build UI components', enabled: true },
          { name: 'styling', description: 'Apply CSS and styling', enabled: true },
          { name: 'state-management', description: 'Manage application state', enabled: true }
        ],
        prompt: `You are a Frontend Developer expert in building modern web applications.

Your expertise includes:
- React and TypeScript development
- Component design and reusability
- CSS and responsive design
- User experience optimization
- Accessibility best practices

Focus on creating intuitive, accessible, and performant user interfaces.`,
        constraints: ['ensure accessibility', 'optimize performance', 'maintain consistency'],
        outputFormat: 'working code with comments',
        examples: [],
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'backend-developer',
        name: 'Backend Developer', 
        role: 'backend' as AgentType,
        description: 'Develops server-side logic and APIs',
        expertise: ['Node.js', 'APIs', 'databases', 'authentication', 'security'],
        capabilities: [
          { name: 'api-development', description: 'Build REST and GraphQL APIs', enabled: true },
          { name: 'database-design', description: 'Design database schemas', enabled: true },
          { name: 'authentication', description: 'Implement auth systems', enabled: true }
        ],
        prompt: `You are a Backend Developer specializing in server-side development and APIs.

Your expertise includes:
- Node.js and server-side frameworks
- RESTful API design and GraphQL
- Database design and optimization
- Authentication and security
- System integration

Focus on building secure, performant, and maintainable backend systems.`,
        constraints: ['ensure security', 'optimize performance', 'handle errors gracefully'],
        outputFormat: 'working code with tests',
        examples: [],
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const agent of builtinAgents) {
      this.agents.set(agent.id, agent);
    }
  }

  /**
   * Load agents from remote source
   */
  private async loadFromRemote(url: string): Promise<void> {
    // Implementation would fetch from remote URL
    // For now, just a placeholder
    console.log(`Remote agent loading not yet implemented: ${url}`);
  }

  /**
   * Validate agent definition
   */
  private validateAgent(agent: any): void {
    const required = ['id', 'name', 'role', 'prompt'];
    
    for (const field of required) {
      if (!agent[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate role exists in AgentType enum
    const validAgentTypes = ['architect', 'backend', 'frontend', 'test-writer', 'design', 'cli', 'pr-merger', 'task-dispatcher', 'production-architect', 'figma-extractor'];
    if (!validAgentTypes.includes(agent.role)) {
      console.warn(`Unknown role: ${agent.role}`);
    }
  }

  /**
   * Apply customizations to prompt
   */
  private applyCustomizations(prompt: string, customizations: Record<string, any>): string {
    let customizedPrompt = prompt;

    // Simple template replacement
    for (const [key, value] of Object.entries(customizations)) {
      const placeholder = `{{${key}}}`;
      customizedPrompt = customizedPrompt.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return customizedPrompt;
  }

  /**
   * Generate default prompt for role
   */
  private generateDefaultPrompt(role: AgentType, customizations?: Record<string, any>): string {
    const rolePrompts: Record<string, string> = {
      architect: 'You are a system architect. Focus on high-level design and technical decisions.',
      frontend: 'You are a frontend developer. Focus on user interface and user experience.',
      backend: 'You are a backend developer. Focus on server-side logic and data management.',
      'test-writer': 'You are a quality assurance tester. Focus on testing and quality validation.',
      design: 'You are a UI/UX designer. Focus on user experience and visual design.',
      cli: 'You are a CLI developer. Focus on command-line interfaces and developer tools.',
      'pr-merger': 'You are a code reviewer. Focus on code quality and merge decisions.',
      'task-dispatcher': 'You are a task coordinator. Focus on task analysis and assignment.',
      'production-architect': 'You are a DevOps engineer. Focus on deployment and infrastructure.',
      'figma-extractor': 'You are a design system expert. Focus on extracting and organizing design assets.'
    };

    let prompt = rolePrompts[role] || 'You are a technical specialist. Apply your expertise to solve specific problems.';

    if (customizations) {
      prompt = this.applyCustomizations(prompt, customizations);
    }

    return prompt;
  }

  /**
   * Save agent definition
   */
  async saveAgent(agent: AgentDefinition, filePath?: string): Promise<void> {
    const targetPath = filePath || path.join(
      process.cwd(), 
      '.claude', 
      'agents', 
      `${agent.id}.json`
    );

    // Ensure directory exists
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Update timestamp
    agent.updatedAt = new Date().toISOString();

    // Write file
    fs.writeFileSync(targetPath, JSON.stringify(agent, null, 2));
    
    // Update in memory
    this.agents.set(agent.id, agent);
    
    console.log(`✅ Saved agent definition: ${agent.id}`);
  }

  /**
   * List available agents
   */
  async listAgents(): Promise<{ id: string; name: string; role: AgentType; description: string }[]> {
    await this.initialize();
    
    return Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      description: agent.description
    }));
  }

  /**
   * Create agent from template
   */
  createAgentTemplate(role: AgentType, name: string): AgentDefinition {
    return {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      role,
      description: `${name} agent for ${role} tasks`,
      expertise: [],
      capabilities: [],
      prompt: this.generateDefaultPrompt(role),
      constraints: [],
      outputFormat: 'markdown',
      examples: [],
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}