/**
 * Agent Orchestrator - Multi-Agent Coordination System
 * 
 * Intelligently routes queries to appropriate agents based on content analysis
 * and coordinates multi-agent workflows using the Claude Code SDK.
 */

import { EventEmitter } from 'events';
import { ClaudeCodeClient } from '../sdk/claude-code-client.js';
import { ConsoleOutput } from '../console/ConsoleOutput.js';
import fs from 'fs/promises';
import path from 'path';

export interface AgentConfig {
  name: string;
  role: string;
  responsibilities: string[];
  specializedKnowledge: string[];
  keywords: string[];
  priority: number; // Higher number = higher priority for routing
}

export interface TaskAnalysis {
  primaryAgent: string;
  supportingAgents: string[];
  confidence: number;
  reasoning: string;
}

export interface OrchestrationResult {
  success: boolean;
  primaryResponse: string;
  supportingResponses?: Record<string, string>;
  agentsUsed: string[];
  totalDuration: number;
  error?: string;
}

/**
 * Multi-agent orchestration system with intelligent routing
 */
export class AgentOrchestrator extends EventEmitter {
  private static instance: AgentOrchestrator | null = null;
  private claudeClient: ClaudeCodeClient;
  private consoleOutput: ConsoleOutput;
  private agentConfigs: Map<string, AgentConfig> = new Map();
  private agentsPath: string;
  private initialized: boolean = false;

  constructor(agentsPath: string = path.join(process.cwd(), '.claude/agents')) {
    super();
    
    // Prevent duplicate initialization with warning
    if (AgentOrchestrator.instance && !process.env.GRAPHYN_ALLOW_DUPLICATE_ORCHESTRATORS) {
      console.warn('⚠️ AgentOrchestrator: Multiple instances detected, this may cause double initialization');
    }
    
    this.claudeClient = new ClaudeCodeClient();
    this.consoleOutput = new ConsoleOutput();
    this.agentsPath = agentsPath;
    
    // Set up Claude client event handlers
    this.setupEventHandlers();
    
    AgentOrchestrator.instance = this;
  }

  /**
   * Get or create singleton instance
   */
  static getInstance(agentsPath?: string): AgentOrchestrator {
    if (!AgentOrchestrator.instance) {
      AgentOrchestrator.instance = new AgentOrchestrator(agentsPath);
    }
    return AgentOrchestrator.instance;
  }

  /**
   * Initialize the orchestrator by loading agent configurations
   */
  async initialize(): Promise<void> {
    // Skip if already initialized
    if (this.initialized) {
      return;
    }
    
    this.consoleOutput.streamAgentActivity('orchestrator', 'Initializing agent configurations...', 'starting');
    
    try {
      await this.loadAgentConfigurations();
      this.initialized = true;
      this.consoleOutput.streamAgentActivity(
        'orchestrator', 
        `Loaded ${this.agentConfigs.size} agent configurations`, 
        'completed'
      );
    } catch (error) {
      this.consoleOutput.streamError(
        'orchestrator',
        error instanceof Error ? error : new Error(String(error)),
        'Agent configuration loading'
      );
      throw error;
    }
  }

  /**
   * Analyze query and determine which agents should handle it
   */
  async analyzeTask(query: string, repositoryContext?: any): Promise<TaskAnalysis> {
    this.consoleOutput.streamAgentActivity('orchestrator', 'Analyzing task requirements...', 'progress');
    
    // Use keyword matching for initial routing
    const keywordAnalysis = this.performKeywordAnalysis(query);
    
    // Use Claude to validate and improve the routing decision
    const claudeAnalysis = await this.getClaudeRoutingRecommendation(query, repositoryContext, keywordAnalysis);
    
    return claudeAnalysis;
  }

  /**
   * Execute query with real-time streaming support
   */
  async *executeQueryStream(
    query: string,
    repositoryContext?: any,
    options?: {
      maxAgents?: number;
      requireApproval?: boolean;
    }
  ): AsyncGenerator<{ type: 'analysis' | 'agent_start' | 'message' | 'result'; data: any }> {
    const startTime = Date.now();
    
    try {
      // Analyze which agents are needed
      yield { type: 'analysis', data: { message: 'Analyzing task requirements...', stage: 'routing' }};
      const analysis = await this.analyzeTask(query, repositoryContext);
      
      yield { 
        type: 'analysis', 
        data: { 
          message: `Routing to: ${analysis.primaryAgent} (${analysis.confidence}% confidence)`,
          agent: analysis.primaryAgent,
          confidence: analysis.confidence,
          reasoning: analysis.reasoning
        }
      };

      // Execute with primary agent using streaming
      yield { 
        type: 'agent_start', 
        data: { 
          agent: analysis.primaryAgent, 
          query,
          message: `${analysis.primaryAgent} agent starting analysis...`
        }
      };

      let finalResult = '';
      for await (const message of this.executeWithAgentStream(analysis.primaryAgent, query, repositoryContext)) {
        yield { type: 'message', data: { agent: analysis.primaryAgent, message }};
        
        // Collect final result if it's a result message
        if (message.type === 'result' && 'subtype' in message && message.subtype === 'success') {
          finalResult = (message as any).result || '';
        }
      }

      // Return final orchestration result
      yield { 
        type: 'result', 
        data: {
          success: true,
          primaryResponse: finalResult,
          agentsUsed: [analysis.primaryAgent],
          totalDuration: Date.now() - startTime
        }
      };

    } catch (error) {
      yield { 
        type: 'result', 
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          agentsUsed: [],
          totalDuration: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Execute query using orchestrated multi-agent approach (blocking version)
   */
  async executeQuery(
    query: string,
    repositoryContext?: any,
    options?: {
      maxAgents?: number;
      requireApproval?: boolean;
    }
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    
    try {
      // Analyze which agents are needed
      const analysis = await this.analyzeTask(query, repositoryContext);
      
      this.consoleOutput.streamAgentActivity(
        'orchestrator',
        `Routing to: ${analysis.primaryAgent} (${analysis.confidence}% confidence)`,
        'progress'
      );

      // Execute with primary agent
      const primaryResponse = await this.executeWithAgent(
        analysis.primaryAgent,
        query,
        repositoryContext
      );

      const result: OrchestrationResult = {
        success: true,
        primaryResponse: primaryResponse.result,
        agentsUsed: [analysis.primaryAgent],
        totalDuration: Date.now() - startTime
      };

      // Execute with supporting agents if specified and needed
      if (analysis.supportingAgents.length > 0 && (options?.maxAgents || 1) > 1) {
        result.supportingResponses = {};
        
        for (const agentName of analysis.supportingAgents.slice(0, (options?.maxAgents || 2) - 1)) {
          this.consoleOutput.streamAgentActivity(
            'orchestrator',
            `Getting supporting analysis from ${agentName}...`,
            'progress'
          );
          
          try {
            const supportResponse = await this.executeWithAgent(
              agentName,
              `Provide supporting analysis for: ${query}\\n\\nPrimary response: ${primaryResponse.result.slice(0, 500)}...`,
              repositoryContext
            );
            
            result.supportingResponses[agentName] = supportResponse.result;
            result.agentsUsed.push(agentName);
          } catch (error) {
            // Don't fail entire orchestration if supporting agent fails
            this.consoleOutput.streamAgentActivity(
              'orchestrator',
              `Supporting agent ${agentName} failed, continuing...`,
              'progress'
            );
          }
        }
      }

      this.consoleOutput.streamAgentActivity(
        'orchestrator',
        `Orchestration completed using ${result.agentsUsed.length} agents`,
        'completed'
      );

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.consoleOutput.streamError(
        'orchestrator',
        error instanceof Error ? error : new Error(String(error)),
        'Multi-agent orchestration'
      );

      return {
        success: false,
        primaryResponse: '',
        agentsUsed: [],
        totalDuration: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  /**
   * Execute query with a specific agent using streaming
   */
  private async *executeWithAgentStream(
    agentName: string,
    query: string,
    repositoryContext?: any
  ): AsyncGenerator<any> {
    let agentConfig = this.agentConfigs.get(agentName);
    
    // Fallback mechanism for unknown agents
    if (!agentConfig) {
      // Try to find any available agent as fallback
      const availableAgents = Array.from(this.agentConfigs.keys());
      
      if (availableAgents.length === 0) {
        throw new Error(`No agents available. Make sure .claude/agents/ directory has agent configuration files`);
      }
      
      // Use first available agent as fallback
      const fallbackAgentName = availableAgents[0];
      agentConfig = this.agentConfigs.get(fallbackAgentName)!;
      
      yield {
        type: 'agent_fallback',
        message: `⚠️ Agent '${agentName}' not found, using '${fallbackAgentName}' as fallback`
      };
      
      agentName = fallbackAgentName; // Update for logging
    }

    // Build specialized prompt for the agent
    const agentPrompt = await this.buildAgentPrompt(agentConfig, query, repositoryContext);

    // Use REAL Claude Code SDK streaming - NO MOCKING
    for await (const message of this.claudeClient.executeQueryStream(agentPrompt, {
      maxTurns: 10,
      allowedTools: [
        'Bash', 'Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep',
        'WebFetch', 'WebSearch', 'NotebookEdit', 'Task'
      ],
      model: 'claude-3-5-sonnet-20241022'
    })) {
      // Yield each message as it arrives from Claude
      yield message;
    }
  }

  /**
   * Execute query with a specific agent (blocking version)
   */
  private async executeWithAgent(
    agentName: string,
    query: string,
    repositoryContext?: any
  ): Promise<{ result: string; metrics?: any }> {
    let agentConfig = this.agentConfigs.get(agentName);
    
    // Fallback mechanism for unknown agents
    if (!agentConfig) {
      // Try to find any available agent as fallback
      const availableAgents = Array.from(this.agentConfigs.keys());
      
      if (availableAgents.length === 0) {
        throw new Error(`No agents available. Make sure .claude/agents/ directory has agent configuration files`);
      }
      
      // Use first available agent as fallback
      const fallbackAgentName = availableAgents[0];
      agentConfig = this.agentConfigs.get(fallbackAgentName)!;
      
      this.consoleOutput.streamAgentActivity(
        'orchestrator',
        `⚠️ Agent '${agentName}' not found, using '${fallbackAgentName}' as fallback`,
        'progress'
      );
      
      agentName = fallbackAgentName; // Update for logging
    }

    this.consoleOutput.streamAgentActivity(
      'orchestrator',
      `${agentName} agent analyzing: "${query}"`,
      'progress'
    );

    // Build specialized prompt for the agent
    const agentPrompt = await this.buildAgentPrompt(agentConfig, query, repositoryContext);

    // Use REAL Claude Code SDK - NO MOCKING
    return await this.claudeClient.executeQuery(agentPrompt, {
      maxTurns: 10,
      allowedTools: [
        'Bash', 'Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep',
        'WebFetch', 'WebSearch', 'NotebookEdit', 'Task'
      ],
      model: 'claude-3-5-sonnet-20241022'
    });
  }


  /**
   * Load agent configurations from markdown files
   */
  private async loadAgentConfigurations(): Promise<void> {
    try {
      // Check if agents directory exists
      try {
        await fs.access(this.agentsPath);
      } catch (error) {
        throw new Error(`Agents directory not found at: ${this.agentsPath}\nMake sure .claude/agents/ directory exists with agent configuration files`);
      }

      const agentFiles = await fs.readdir(this.agentsPath);
      const markdownFiles = agentFiles.filter(file => file.endsWith('.md'));

      if (markdownFiles.length === 0) {
        throw new Error(`No agent configuration files found in: ${this.agentsPath}\nExpected .md files with agent definitions`);
      }

      for (const file of markdownFiles) {
        const agentName = path.basename(file, '.md');
        const filePath = path.join(this.agentsPath, file);
        
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const config = this.parseAgentConfig(agentName, content);
          this.agentConfigs.set(agentName, config);
        } catch (error) {
          console.warn(`⚠️ Failed to load agent ${agentName}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (this.agentConfigs.size === 0) {
        throw new Error('No valid agent configurations loaded. Check your .claude/agents/*.md files');
      }

    } catch (error) {
      throw new Error(`Failed to load agent configurations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse agent configuration from markdown content
   */
  private parseAgentConfig(name: string, content: string): AgentConfig {
    const config: AgentConfig = {
      name,
      role: '',
      responsibilities: [],
      specializedKnowledge: [],
      keywords: [],
      priority: 1
    };

    // Extract role from markdown
    const roleMatch = content.match(/##\s*Role\s*\n\*\*(.*?)\*\*/);
    if (roleMatch) {
      config.role = roleMatch[1];
    }

    // Extract responsibilities
    const responsibilitiesSection = content.match(/##\s*Core Responsibilities(.*?)##/s);
    if (responsibilitiesSection) {
      const responsibilities = responsibilitiesSection[1].match(/^[-*]\s+(.+)$/gm);
      if (responsibilities) {
        config.responsibilities = responsibilities.map(r => r.replace(/^[-*]\s+/, '').trim());
      }
    }

    // Extract specialized knowledge
    const knowledgeSection = content.match(/##\s*Specialized Knowledge Areas(.*?)##/s);
    if (knowledgeSection) {
      const knowledge = knowledgeSection[1].match(/^[-*]\s+(.+)$/gm);
      if (knowledge) {
        config.specializedKnowledge = knowledge.map(k => k.replace(/^[-*]\s+/, '').trim());
      }
    }

    // Generate keywords from role and responsibilities
    config.keywords = this.generateKeywords(config.role, config.responsibilities);

    // Set priority based on agent type
    const priorityMap: Record<string, number> = {
      'assistant': 1,        // Lowest priority - catch-all
      'architect': 5,        // High priority for architecture decisions
      'security-expert': 4,  // High priority for security concerns
      'backend-developer': 3,
      'frontend-developer': 3,
      'data-engineer': 3,
      'devops': 2,
      'tester': 2
    };
    config.priority = priorityMap[name] || 1;

    return config;
  }

  /**
   * Generate keywords for agent matching
   */
  private generateKeywords(role: string, responsibilities: string[]): string[] {
    const keywords = new Set<string>();
    
    // Add words from role
    role.toLowerCase().split(/\s+/).forEach(word => keywords.add(word));
    
    // Add key terms from responsibilities
    responsibilities.forEach(resp => {
      const words = resp.toLowerCase().match(/\b\w{4,}\b/g) || [];
      words.forEach(word => {
        if (!this.isStopWord(word)) {
          keywords.add(word);
        }
      });
    });

    return Array.from(keywords);
  }

  /**
   * Perform enhanced keyword-based analysis for initial routing
   */
  private performKeywordAnalysis(query: string): TaskAnalysis {
    const queryLower = query.toLowerCase();
    const scores = new Map<string, number>();

    // Enhanced keyword patterns for better matching
    const queryPatterns = {
      'understand': ['architect', 'assistant'], 
      'analyze': ['architect', 'assistant'],
      'explain': ['architect', 'assistant'],
      'help': ['assistant', 'architect'],
      'repository': ['architect', 'assistant'],
      'repo': ['architect', 'assistant'],
      'backend': ['backend-developer'],
      'frontend': ['frontend-developer'],
      'api': ['backend-developer', 'architect'],
      'database': ['backend-developer'],
      'ui': ['frontend-developer'],
      'design': ['frontend-developer'],
      'security': ['security-expert'],
      'auth': ['security-expert', 'backend-developer'],
      'test': ['tester'],
      'deploy': ['devops']
    };

    // Score each agent based on keyword matches
    for (const [agentName, config] of this.agentConfigs) {
      let score = 0;
      
      // Check enhanced patterns
      for (const [pattern, agents] of Object.entries(queryPatterns)) {
        if (queryLower.includes(pattern) && agents.includes(agentName)) {
          score += config.priority * 3; // Higher weight for pattern matches
        }
      }
      
      // Check original keywords
      config.keywords.forEach(keyword => {
        if (queryLower.includes(keyword)) {
          score += config.priority;
        }
      });

      // Boost score for exact role matches
      if (queryLower.includes(config.role.toLowerCase())) {
        score += config.priority * 2;
      }

      scores.set(agentName, score);
    }

    // Find best matches
    const sortedScores = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
    const primaryAgent = sortedScores[0]?.[0] || 'assistant';
    const supportingAgents = sortedScores
      .slice(1, 3)
      .filter(([_, score]) => score > 0)
      .map(([agent, _]) => agent);

    const maxScore = sortedScores[0]?.[1] || 0;
    // Improved confidence calculation with minimum 60% for pattern matches
    const confidence = maxScore > 0 ? Math.min(95, Math.max(60, maxScore * 8)) : 30;

    return {
      primaryAgent,
      supportingAgents,
      confidence,
      reasoning: `Enhanced keyword analysis suggests ${primaryAgent} (score: ${maxScore})`
    };
  }

  /**
   * Use Claude to validate and improve routing decisions
   */
  private async getClaudeRoutingRecommendation(
    query: string,
    repositoryContext: any,
    initialAnalysis: TaskAnalysis
  ): Promise<TaskAnalysis> {
    try {
      this.consoleOutput.streamAgentActivity(
        'orchestrator',
        'Getting Claude routing recommendation...',
        'progress'
      );

      const agentList = Array.from(this.agentConfigs.entries())
        .map(([name, config]) => `- ${name}: ${config.role}`)
        .join('\n');

      // Build optimized routing prompt (reduced size)
      const contextSummary = repositoryContext ? 
        `Project: ${repositoryContext.packageJson?.name || 'Unknown'}, Type: ${repositoryContext.hasTypeScript ? 'TypeScript' : 'JavaScript'}, Files: ${repositoryContext.fileCount || 0}` :
        'No context';

      const routingPrompt = `Analyze task and recommend best agent.

Agents:
${agentList}

Task: "${query}"
Context: ${contextSummary}
Keyword suggestion: ${initialAnalysis.primaryAgent} (${initialAnalysis.confidence}%)

Respond with JSON only:
{
  "primaryAgent": "agent-name",
  "supportingAgents": ["agent-name"],
  "confidence": 85,
  "reasoning": "Brief explanation"
}`;

      // Use REAL Claude Code SDK for routing with increased turn limit
      const result = await this.claudeClient.executeQuery(routingPrompt, {
        maxTurns: 3, // Increased from 1 to handle complex routing decisions
        model: 'claude-3-5-sonnet-20241022'
      });

      // Parse JSON response from Claude
      const jsonMatch = result.result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const recommendation = JSON.parse(jsonMatch[0]);
        
        // Validate the recommendation
        if (this.agentConfigs.has(recommendation.primaryAgent)) {
          this.consoleOutput.streamAgentActivity(
            'orchestrator',
            `Claude recommends: ${recommendation.primaryAgent} (${recommendation.confidence}% confidence)`,
            'progress'
          );

          return {
            primaryAgent: recommendation.primaryAgent,
            supportingAgents: recommendation.supportingAgents?.filter((agent: string) => 
              this.agentConfigs.has(agent)
            ) || [],
            confidence: Math.max(initialAnalysis.confidence, recommendation.confidence || 0),
            reasoning: recommendation.reasoning || initialAnalysis.reasoning
          };
        }
      }
    } catch (error) {
      // Fall back to keyword analysis if Claude routing fails
      this.consoleOutput.streamAgentActivity(
        'orchestrator',
        `Claude routing failed (${error instanceof Error ? error.message : 'Unknown error'}), using keyword analysis`,
        'progress'
      );
    }

    return initialAnalysis;
  }

  /**
   * Build specialized prompt for an agent
   */
  private async buildAgentPrompt(
    agentConfig: AgentConfig,
    query: string,
    repositoryContext?: any
  ): Promise<string> {
    let prompt = `# ${agentConfig.role}

You are a ${agentConfig.role.toLowerCase()}. ${agentConfig.responsibilities.slice(0, 3).join('. ')}.

## Task Request
${query}

## Repository Context
${repositoryContext ? JSON.stringify(repositoryContext, null, 2) : 'Repository context not available'}

## Your Expertise
You specialize in: ${agentConfig.specializedKnowledge.slice(0, 5).join(', ')}

## Instructions
1. Analyze the task from your specialized perspective
2. Provide practical, actionable recommendations
3. Include code examples when relevant
4. Consider integration with other system components
5. Follow security and performance best practices

Please provide a detailed response addressing the task requirements.`;

    return prompt;
  }

  /**
   * Check if word is a common stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'and', 'the', 'for', 'with', 'that', 'this', 'are', 'can', 'will',
      'have', 'has', 'been', 'from', 'they', 'them', 'their', 'into',
      'implementation', 'system', 'development', 'application'
    ]);
    return stopWords.has(word);
  }

  /**
   * Set up event handlers for the Claude client
   */
  private setupEventHandlers(): void {
    this.claudeClient.on('error', (error) => {
      this.emit('agent-error', error);
    });

    this.claudeClient.on('retry', ({ attempt, error }) => {
      this.emit('agent-retry', { attempt, error });
    });

    this.claudeClient.on('debug', (message) => {
      this.consoleOutput.streamAgentActivity('claude-sdk', message, 'progress');
    });
  }

  /**
   * Get available agents
   */
  getAvailableAgents(): string[] {
    return Array.from(this.agentConfigs.keys());
  }

  /**
   * Get agent configuration
   */
  getAgentConfig(agentName: string): AgentConfig | undefined {
    return this.agentConfigs.get(agentName);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.claudeClient.reset();
    this.removeAllListeners();
  }
}