/**
 * Dynamic Agent Registry - Technology-Aware Agent Configuration
 * 
 * Manages agent profiles that can be dynamically loaded and specialized
 * based on detected project technologies and requirements.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { type ProjectContext } from '../context/context7-integration.js';
import { type AgentType } from '../orchestrator/types.js';

export interface AgentCapability {
  name: string;
  description: string;
  proficiency: 'basic' | 'intermediate' | 'expert';
  prerequisites?: string[];
}

export interface AgentSpecialization {
  technology: string;
  version?: string;
  capabilities: AgentCapability[];
  prompts: {
    system: string;
    context: string;
    examples?: string[];
  };
  tools?: string[];
  patterns?: {
    name: string;
    description: string;
    template: string;
  }[];
}

export interface AgentProfile {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  basePrompt: string;
  
  // Technology specializations
  specializations: AgentSpecialization[];
  
  // Default capabilities
  defaultCapabilities: AgentCapability[];
  
  // Configuration
  config: {
    maxConcurrency: number;
    timeout: number;
    retryAttempts: number;
    priority: number;
  };
  
  // Metadata
  metadata: {
    version: string;
    author: string;
    tags: string[];
    lastUpdated: Date;
  };
}

export interface AgentMatch {
  agent: AgentProfile;
  specialization?: AgentSpecialization;
  confidence: number;
  reasoning: string;
}

export class DynamicAgentRegistry {
  private profiles = new Map<string, AgentProfile>();
  private specializationCache = new Map<string, AgentSpecialization[]>();
  private agentDir: string;
  
  constructor(agentDir?: string) {
    this.agentDir = agentDir || path.join(process.cwd(), '.claude', 'agents');
  }
  
  /**
   * Initialize the registry and load agent profiles
   */
  async initialize(): Promise<void> {
    console.log('🤖 Initializing dynamic agent registry...');
    
    await this.ensureAgentDirectory();
    await this.cleanupOldAgentFiles(); // Clean up before loading
    await this.loadAgentProfiles();
    await this.loadSpecializations();
    
    console.log(`✅ Loaded ${this.profiles.size} agent profiles`);
  }
  
  /**
   * Get agents specialized for a project context
   */
  async getSpecializedAgents(context: ProjectContext): Promise<AgentMatch[]> {
    const matches: AgentMatch[] = [];
    
    for (const [id, profile] of this.profiles) {
      const match = this.matchAgentToContext(profile, context);
      if (match.confidence > 0.5) {
        matches.push(match);
      }
    }
    
    // Sort by confidence and return top matches
    return matches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 8); // Max 8 agents for orchestration
  }
  
  /**
   * Get a specific agent by type with context-aware specialization
   */
  async getAgent(type: AgentType, context: ProjectContext): Promise<AgentMatch | null> {
    const candidates = Array.from(this.profiles.values())
      .filter(profile => profile.type === type);
    
    if (candidates.length === 0) {
      return null;
    }
    
    // Find best match based on context
    let bestMatch: AgentMatch | null = null;
    let highestConfidence = 0;
    
    for (const candidate of candidates) {
      const match = this.matchAgentToContext(candidate, context);
      if (match.confidence > highestConfidence) {
        highestConfidence = match.confidence;
        bestMatch = match;
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Create a new agent profile dynamically (IN-MEMORY ONLY)
   */
  async createAgent(config: {
    name: string;
    type: AgentType;
    description: string;
    specialization?: string;
    technologies?: string[];
  }): Promise<AgentProfile> {
    const profile: AgentProfile = {
      id: `${config.type}-ephemeral-${Date.now()}`,
      name: config.name,
      type: config.type,
      description: config.description,
      basePrompt: this.generateBasePrompt(config.type, config.description),
      specializations: config.specialization 
        ? [await this.createSpecialization(config.specialization, config.technologies || [])]
        : [],
      defaultCapabilities: this.getDefaultCapabilities(config.type),
      config: {
        maxConcurrency: 1,
        timeout: 300000,
        retryAttempts: 3,
        priority: 1
      },
      metadata: {
        version: '1.0.0',
        author: 'dynamic-ephemeral',
        tags: [config.type, ...(config.technologies || [])],
        lastUpdated: new Date()
      }
    };
    
    // Store in memory only - no file persistence for dynamic agents
    this.profiles.set(profile.id, profile);
    
    return profile;
  }
  
  /**
   * Clean up old timestamped agent files
   */
  private async cleanupOldAgentFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.agentDir);
      const timestampedFiles = files.filter(f => 
        f.endsWith('.json') && 
        /\w+-\w+-\d{13}/.test(f) // Matches pattern like "agent-type-timestamp"
      );
      
      if (timestampedFiles.length > 0) {
        console.log(`🧹 Cleaning up ${timestampedFiles.length} old agent files...`);
        
        for (const file of timestampedFiles) {
          try {
            await fs.unlink(path.join(this.agentDir, file));
          } catch (error) {
            console.warn(`Failed to delete old agent file ${file}:`, error);
          }
        }
        
        console.log(`✅ Cleaned up ${timestampedFiles.length} old agent files`);
      }
    } catch (error) {
      console.warn('Failed to cleanup old agent files:', error);
    }
  }
  
  /**
   * Load all agent profiles from disk
   */
  private async loadAgentProfiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.agentDir);
      const profileFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('specialization-'));
      
      for (const file of profileFiles) {
        try {
          const content = await fs.readFile(path.join(this.agentDir, file), 'utf-8');
          const profile: AgentProfile = JSON.parse(content);
          
          // Parse dates
          profile.metadata.lastUpdated = new Date(profile.metadata.lastUpdated);
          
          this.profiles.set(profile.id, profile);
        } catch (error) {
          console.warn(`Failed to load agent profile ${file}:`, error);
        }
      }
    } catch (error) {
      console.warn('Failed to load agent profiles:', error);
    }
  }
  
  /**
   * Load technology specializations
   */
  private async loadSpecializations(): Promise<void> {
    try {
      const files = await fs.readdir(this.agentDir);
      const specFiles = files.filter(f => f.startsWith('specialization-') && f.endsWith('.json'));
      
      for (const file of specFiles) {
        try {
          const content = await fs.readFile(path.join(this.agentDir, file), 'utf-8');
          const specializations: AgentSpecialization[] = JSON.parse(content);
          
          const technology = file.replace('specialization-', '').replace('.json', '');
          this.specializationCache.set(technology, specializations);
        } catch (error) {
          console.warn(`Failed to load specialization ${file}:`, error);
        }
      }
    } catch (error) {
      console.warn('Failed to load specializations:', error);
    }
  }
  
  /**
   * Match an agent to project context
   */
  private matchAgentToContext(profile: AgentProfile, context: ProjectContext): AgentMatch {
    let confidence = 0.3; // Base confidence
    let reasoning = `Base agent: ${profile.name}`;
    let bestSpecialization: AgentSpecialization | undefined;
    
    // Check if agent type is recommended for this project
    const isRecommended = context.recommendedAgents.some(rec => 
      rec.type === profile.type
    );
    
    if (isRecommended) {
      confidence += 0.4;
      reasoning += ', recommended for project';
    }
    
    // Check for technology specializations
    for (const specialization of profile.specializations) {
      const techMatch = this.matchTechnologySpecialization(specialization, context);
      if (techMatch.confidence > 0) {
        confidence += techMatch.confidence * 0.3;
        bestSpecialization = specialization;
        reasoning += `, specializes in ${specialization.technology}`;
        break;
      }
    }
    
    // Check framework compatibility
    for (const framework of context.techStack.frameworks) {
      if (profile.metadata.tags.includes(framework.name.toLowerCase())) {
        confidence += 0.2;
        reasoning += `, ${framework.name} experience`;
        break;
      }
    }
    
    // Architecture bonus
    if (profile.type === 'architect' && context.architecture.type === 'microservices') {
      confidence += 0.1;
      reasoning += ', microservices architecture';
    }
    
    return {
      agent: profile,
      specialization: bestSpecialization,
      confidence: Math.min(confidence, 1.0),
      reasoning
    };
  }
  
  /**
   * Match technology specialization to context
   */
  private matchTechnologySpecialization(
    specialization: AgentSpecialization, 
    context: ProjectContext
  ): { confidence: number } {
    const techName = specialization.technology.toLowerCase();
    
    // Direct framework match
    for (const framework of context.techStack.frameworks) {
      if (framework.name.toLowerCase() === techName) {
        return { confidence: framework.confidence / 100 };
      }
    }
    
    // Pattern matching
    const patterns = [
      { pattern: /react/i, frameworks: ['react', 'next', 'gatsby'] },
      { pattern: /vue/i, frameworks: ['vue', 'nuxt'] },
      { pattern: /angular/i, frameworks: ['angular'] },
      { pattern: /node/i, frameworks: ['express', 'fastify', 'nestjs'] },
      { pattern: /python/i, frameworks: ['django', 'flask', 'fastapi'] },
      { pattern: /docker/i, deployments: ['container'] }
    ];
    
    for (const { pattern, frameworks, deployments } of patterns) {
      if (pattern.test(techName)) {
        if (frameworks) {
          const match = context.techStack.frameworks.find(f => 
            frameworks.includes(f.name.toLowerCase())
          );
          if (match) {
            return { confidence: match.confidence / 100 * 0.8 };
          }
        }
        
        if (deployments) {
          if (deployments.includes(context.workflow.deploymentPattern)) {
            return { confidence: 0.7 };
          }
        }
      }
    }
    
    return { confidence: 0 };
  }
  
  /**
   * Generate base prompt for agent type
   */
  private generateBasePrompt(type: AgentType, description: string): string {
    const basePrompts: Record<AgentType, string> = {
      'architect': `You are a software architect focused on system design, scalability, and technical decision-making. Your role is to analyze requirements, design system architecture, and provide technical guidance to other agents. You excel at breaking down complex problems and creating maintainable, scalable solutions.`,
      
      'backend': `You are a backend developer specializing in server-side development, APIs, databases, and system integration. You focus on building robust, performant backend systems and services. You understand security, scalability, and best practices for server-side development.`,
      
      'frontend': `You are a frontend developer specializing in user interfaces, user experience, and client-side development. You excel at creating responsive, accessible, and performant web interfaces. You understand modern frontend frameworks, state management, and browser optimization.`,
      
      'test-writer': `You are a quality assurance engineer specializing in testing strategies, test automation, and quality assurance. You focus on ensuring software reliability through comprehensive testing including unit tests, integration tests, and end-to-end testing.`,
      
      'design': `You are a UI/UX designer focused on user experience, visual design, and interface design. You excel at creating intuitive, accessible, and aesthetically pleasing user interfaces. You understand design systems, user research, and accessibility principles.`,
      
      'cli': `You are a CLI and developer tooling specialist focused on command-line interfaces, developer experience, and automation tools. You excel at creating efficient, user-friendly command-line tools and scripts that improve developer productivity.`,
      
      'pr-merger': `You are a code review and integration specialist focused on pull request analysis, code quality, and merge conflict resolution. You ensure code quality standards and help maintain clean, consistent codebases.`,
      
      'task-dispatcher': `You are a task management and coordination specialist focused on breaking down complex requests into manageable tasks and coordinating work across multiple agents. You excel at project planning and resource allocation.`,
      
      'production-architect': `You are a production systems architect specializing in deployment, infrastructure, monitoring, and scalability. You focus on production readiness, reliability, and operational excellence.`,
      
      'code-cli-developer': `You are a developer tools and CLI specialist focused on creating developer-friendly command-line interfaces and automation tools. You excel at improving developer workflow and productivity through well-designed tooling.`,
      
      'security': `You are a security specialist focused on application security, authentication, authorization, and security best practices. You excel at identifying security vulnerabilities, implementing secure authentication systems, setting up proper access controls, and ensuring compliance with security standards.`,
      
      'researcher': `You are a research specialist focused on discovering best practices, analyzing technical patterns, and providing evidence-based recommendations. You excel at researching emerging technologies, comparing solutions, documenting findings, and helping teams make informed technical decisions.`,
      
      'figma-extractor': `You are a Figma design extraction specialist focused on converting design files into implementation-ready assets and code. You excel at analyzing design systems, extracting components, and generating clean, maintainable code from design specifications.`,
      
      'devops': `You are a DevOps engineer specializing in continuous integration, deployment automation, and infrastructure management. You focus on building reliable CI/CD pipelines, managing containerized applications, and ensuring smooth deployment processes.`,
      
      'performance': `You are a performance optimization specialist focused on analyzing, measuring, and improving application performance. You excel at identifying bottlenecks, implementing optimizations, and ensuring applications run efficiently under load.`
    };
    
    return basePrompts[type] || `You are a ${type} agent. ${description}`;
  }
  
  /**
   * Get default capabilities for agent type
   */
  private getDefaultCapabilities(type: AgentType): AgentCapability[] {
    const capabilities: Record<AgentType, AgentCapability[]> = {
      'architect': [
        {
          name: 'System Design',
          description: 'Design scalable system architectures',
          proficiency: 'expert'
        },
        {
          name: 'Technical Planning',
          description: 'Create technical implementation plans',
          proficiency: 'expert'
        },
        {
          name: 'Code Review',
          description: 'Review code for architecture compliance',
          proficiency: 'intermediate'
        }
      ],
      
      'backend': [
        {
          name: 'API Development',
          description: 'Create REST and GraphQL APIs',
          proficiency: 'expert'
        },
        {
          name: 'Database Design',
          description: 'Design and optimize databases',
          proficiency: 'intermediate'
        },
        {
          name: 'Security Implementation',
          description: 'Implement authentication and authorization',
          proficiency: 'intermediate'
        }
      ],
      
      'frontend': [
        {
          name: 'Component Development',
          description: 'Create reusable UI components',
          proficiency: 'expert'
        },
        {
          name: 'State Management',
          description: 'Implement application state management',
          proficiency: 'intermediate'
        },
        {
          name: 'Performance Optimization',
          description: 'Optimize frontend performance',
          proficiency: 'intermediate'
        }
      ],
      
      'test-writer': [
        {
          name: 'Unit Testing',
          description: 'Write comprehensive unit tests',
          proficiency: 'expert'
        },
        {
          name: 'Integration Testing',
          description: 'Create integration test suites',
          proficiency: 'intermediate'
        },
        {
          name: 'Test Automation',
          description: 'Set up automated testing pipelines',
          proficiency: 'intermediate'
        }
      ],
      
      'design': [
        {
          name: 'UI/UX Design',
          description: 'Create user-centered design solutions',
          proficiency: 'expert'
        },
        {
          name: 'Design Systems',
          description: 'Build and maintain design systems',
          proficiency: 'intermediate'
        },
        {
          name: 'Prototyping',
          description: 'Create interactive prototypes',
          proficiency: 'intermediate'
        }
      ],
      
      'cli': [
        {
          name: 'CLI Development',
          description: 'Build command-line interfaces and tools',
          proficiency: 'expert'
        },
        {
          name: 'Script Automation',
          description: 'Create automation scripts and workflows',
          proficiency: 'intermediate'
        },
        {
          name: 'Developer Experience',
          description: 'Improve developer tooling and workflows',
          proficiency: 'intermediate'
        }
      ],
      
      'security': [
        {
          name: 'Authentication Systems',
          description: 'Implement secure authentication and authorization',
          proficiency: 'expert'
        },
        {
          name: 'Security Auditing',
          description: 'Identify and fix security vulnerabilities',
          proficiency: 'expert'
        },
        {
          name: 'RBAC Implementation',
          description: 'Design and implement role-based access control',
          proficiency: 'expert'
        },
        {
          name: 'Compliance',
          description: 'Ensure security compliance and standards',
          proficiency: 'intermediate'
        }
      ],
      
      'researcher': [
        {
          name: 'Technical Research',
          description: 'Research and analyze technical solutions',
          proficiency: 'expert'
        },
        {
          name: 'Best Practices Documentation',
          description: 'Document and recommend best practices',
          proficiency: 'expert'
        },
        {
          name: 'Technology Evaluation',
          description: 'Evaluate and compare technologies',
          proficiency: 'expert'
        },
        {
          name: 'Pattern Analysis',
          description: 'Identify and analyze architectural patterns',
          proficiency: 'intermediate'
        }
      ],
      
      'task-dispatcher': [
        {
          name: 'Task Planning',
          description: 'Break down complex tasks into manageable units',
          proficiency: 'expert'
        },
        {
          name: 'Resource Allocation',
          description: 'Allocate tasks to appropriate agents',
          proficiency: 'expert'
        },
        {
          name: 'Coordination',
          description: 'Coordinate work across multiple agents',
          proficiency: 'intermediate'
        }
      ],
      
      'production-architect': [
        {
          name: 'Infrastructure Design',
          description: 'Design production infrastructure',
          proficiency: 'expert'
        },
        {
          name: 'Deployment Strategies',
          description: 'Design deployment and rollback strategies',
          proficiency: 'expert'
        },
        {
          name: 'Monitoring & Observability',
          description: 'Set up monitoring and observability systems',
          proficiency: 'intermediate'
        }
      ],
      
      'performance': [
        {
          name: 'Performance Analysis',
          description: 'Analyze and optimize system performance',
          proficiency: 'expert'
        },
        {
          name: 'Load Testing',
          description: 'Design and execute load testing strategies',
          proficiency: 'expert'
        },
        {
          name: 'Optimization',
          description: 'Implement performance optimizations',
          proficiency: 'intermediate'
        }
      ],
      
      'figma-extractor': [
        {
          name: 'Design Extraction',
          description: 'Extract designs and assets from Figma',
          proficiency: 'expert'
        },
        {
          name: 'Code Generation',
          description: 'Generate code from design specifications',
          proficiency: 'intermediate'
        },
        {
          name: 'Design System Integration',
          description: 'Integrate designs with existing systems',
          proficiency: 'intermediate'
        }
      ],
      
      'pr-merger': [
        {
          name: 'Code Review',
          description: 'Review pull requests for quality and standards',
          proficiency: 'expert'
        },
        {
          name: 'Merge Strategy',
          description: 'Determine optimal merge strategies',
          proficiency: 'expert'
        },
        {
          name: 'Conflict Resolution',
          description: 'Resolve merge conflicts',
          proficiency: 'intermediate'
        }
      ],
      
      'devops': [
        {
          name: 'CI/CD Pipeline',
          description: 'Design and maintain CI/CD pipelines',
          proficiency: 'expert'
        },
        {
          name: 'Infrastructure as Code',
          description: 'Manage infrastructure using code',
          proficiency: 'expert'
        },
        {
          name: 'Container Orchestration',
          description: 'Manage containerized applications',
          proficiency: 'intermediate'
        }
      ],
      
      'code-cli-developer': [
        {
          name: 'CLI Tool Development',
          description: 'Build command-line developer tools',
          proficiency: 'expert'
        },
        {
          name: 'Developer Experience',
          description: 'Improve developer workflow and productivity',
          proficiency: 'expert'
        },
        {
          name: 'Automation Scripts',
          description: 'Create automation scripts and tools',
          proficiency: 'intermediate'
        }
      ]
    };
    
    return capabilities[type] || [];
  }
  
  /**
   * Create specialization dynamically
   */
  private async createSpecialization(
    technology: string, 
    additionalTechs: string[]
  ): Promise<AgentSpecialization> {
    return {
      technology,
      capabilities: [
        {
          name: `${technology} Development`,
          description: `Develop applications using ${technology}`,
          proficiency: 'expert'
        }
      ],
      prompts: {
        system: `You specialize in ${technology} development. Focus on ${technology} best practices and patterns.`,
        context: `Use ${technology} conventions and follow established patterns for ${technology} development.`,
        examples: []
      },
      tools: [],
      patterns: []
    };
  }
  
  /**
   * Ensure agent directory exists
   */
  private async ensureAgentDirectory(): Promise<void> {
    try {
      await fs.access(this.agentDir);
    } catch {
      await fs.mkdir(this.agentDir, { recursive: true });
      await this.createDefaultAgents();
    }
  }
  
  /**
   * Create default agent profiles if none exist
   * 🔥 ENHANCED: Complete agent set with all types, matching .md agents
   */
  private async createDefaultAgents(): Promise<void> {
    console.log('🤖 Creating default agent profiles...');
    
    const defaultAgents: Partial<AgentProfile>[] = [
      {
        name: 'System Architect',
        type: 'architect',
        description: 'Designs scalable system architecture, microservices, and technical solutions'
      },
      {
        name: 'Backend Developer',
        type: 'backend',
        description: 'Implements server-side logic, APIs, databases, and backend systems'
      },
      {
        name: 'Frontend Developer',
        type: 'frontend',
        description: 'Creates responsive user interfaces, React/Vue components, and client-side functionality'
      },
      {
        name: 'Test Engineer',
        type: 'test-writer',
        description: 'Writes comprehensive test suites, TDD/BDD, and quality assurance'
      },
      {
        name: 'UI/UX Designer',
        type: 'design',
        description: 'Designs user interfaces, user experiences, and design systems'
      },
      {
        name: 'Security Expert',
        type: 'security',
        description: 'Implements security best practices, authentication, authorization, and RBAC systems'
      },
      {
        name: 'Research Specialist',
        type: 'researcher',
        description: 'Researches best practices, analyzes patterns, and provides technical recommendations'
      },
      {
        name: 'Task Coordinator',
        type: 'task-dispatcher',
        description: 'Coordinates multi-agent workflows, breaks down complex tasks, and manages project execution'
      },
      {
        name: 'CLI Developer',
        type: 'cli',
        description: 'Creates command-line interfaces, developer tools, and automation scripts'
      },
      {
        name: 'DevOps Engineer',
        type: 'devops',
        description: 'Manages CI/CD pipelines, containerization, and deployment automation'
      },
      {
        name: 'Performance Expert',
        type: 'performance',
        description: 'Optimizes application performance, identifies bottlenecks, and implements optimizations'
      },
      {
        name: 'Figma Specialist',
        type: 'figma-extractor',
        description: 'Extracts designs from Figma, converts to code, and manages design tokens'
      },
      {
        name: 'Production Architect',
        type: 'production-architect',
        description: 'Designs production infrastructure, monitoring, and scalability solutions'
      },
      {
        name: 'Code CLI Developer',
        type: 'code-cli-developer',
        description: 'Specializes in CLI tools, developer experience, and command-line interfaces'
      },
      {
        name: 'PR Manager',
        type: 'pr-merger',
        description: 'Reviews code, manages pull requests, and ensures code quality standards'
      }
    ];
    
    // Don't create default agents automatically - use static .md files instead
    console.log('✅ Default agent profiles will be loaded from .md files in .claude/agents/');
  }
  
  /**
   * Save agent profile to disk (only for persistent agents)
   */
  private async saveAgentProfile(profile: AgentProfile): Promise<void> {
    // Only save non-ephemeral agents
    if (profile.metadata.author === 'dynamic-ephemeral') {
      return; // Skip saving ephemeral agents
    }
    
    const filename = `${profile.type}-${profile.id}.json`;
    const filepath = path.join(this.agentDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(profile, null, 2));
  }
  
  /**
   * Get all registered agents
   */
  getAgents(): AgentProfile[] {
    return Array.from(this.profiles.values());
  }
  
  /**
   * Get agent by ID
   */
  getAgentById(id: string): AgentProfile | undefined {
    return this.profiles.get(id);
  }
  
  /**
   * Update agent profile
   */
  async updateAgent(id: string, updates: Partial<AgentProfile>): Promise<void> {
    const existing = this.profiles.get(id);
    if (!existing) {
      throw new Error(`Agent ${id} not found`);
    }
    
    const updated = {
      ...existing,
      ...updates,
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
        lastUpdated: new Date()
      }
    };
    
    this.profiles.set(id, updated);
    await this.saveAgentProfile(updated);
  }
  
  /**
   * Delete agent profile
   */
  async deleteAgent(id: string): Promise<void> {
    const agent = this.profiles.get(id);
    if (!agent) {
      throw new Error(`Agent ${id} not found`);
    }
    
    this.profiles.delete(id);
    
    // Remove file
    const filename = `${agent.type}-${id}.json`;
    const filepath = path.join(this.agentDir, filename);
    
    try {
      await fs.unlink(filepath);
    } catch (error) {
      console.warn(`Failed to delete agent file ${filename}:`, error);
    }
  }
}

// Export singleton instance
export const dynamicAgentRegistry = new DynamicAgentRegistry();
