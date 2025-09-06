/**
 * Query Analyzer - Smart detection for orchestration needs
 * 
 * Analyzes user queries to determine:
 * - When to use simple agent execution vs multi-agent orchestration
 * - Which agents should be involved
 * - Execution mode (sequential, parallel, adaptive)
 */
import { debug } from './debug.js';

export interface QueryAnalysis {
  needsOrchestration: boolean;
  complexity: 'simple' | 'medium' | 'complex';
  suggestedAgents: string[];
  executionMode: 'sequential' | 'parallel' | 'adaptive';
  confidence: number;
  reasoning: string;
}

export interface QueryPattern {
  pattern: RegExp;
  indicators: string[];
  complexity: 'simple' | 'medium' | 'complex';
  agents: string[];
  mode: 'sequential' | 'parallel' | 'adaptive';
  weight: number;
}

export class QueryAnalyzer {
  private patterns: QueryPattern[] = [
    // Complex orchestration patterns
    {
      pattern: /build.*system|create.*application|implement.*platform|develop.*solution/i,
      indicators: ['build', 'system', 'application', 'platform', 'solution'],
      complexity: 'complex',
      agents: ['architect', 'backend', 'frontend', 'test-writer'],
      mode: 'adaptive',
      weight: 0.9
    },
    {
      pattern: /full.?stack|end.?to.?end|complete.*feature|entire.*workflow/i,
      indicators: ['full-stack', 'end-to-end', 'complete', 'entire'],
      complexity: 'complex',
      agents: ['architect', 'backend', 'frontend', 'design', 'test-writer'],
      mode: 'adaptive',
      weight: 0.85
    },
    {
      pattern: /authentication.*system|auth.*flow|login.*signup|user.*management/i,
      indicators: ['authentication', 'auth flow', 'login', 'signup', 'user management'],
      complexity: 'medium',
      agents: ['architect', 'backend', 'frontend'],
      mode: 'sequential',
      weight: 0.8
    },
    {
      pattern: /api.*database|rest.*api|graphql|backend.*frontend|data.*layer/i,
      indicators: ['API', 'database', 'REST', 'GraphQL', 'data layer'],
      complexity: 'medium',
      agents: ['architect', 'backend', 'test-writer'],
      mode: 'sequential',
      weight: 0.75
    },
    {
      pattern: /ui.*component|dashboard|interface|frontend|react|vue|angular/i,
      indicators: ['UI', 'dashboard', 'interface', 'frontend', 'component'],
      complexity: 'medium',
      agents: ['design', 'frontend', 'test-writer'],
      mode: 'sequential',
      weight: 0.7
    },
    {
      pattern: /multiple.*features|several.*components|various.*parts|many.*aspects/i,
      indicators: ['multiple', 'several', 'various', 'many'],
      complexity: 'complex',
      agents: ['architect', 'backend', 'frontend', 'test-writer'],
      mode: 'parallel',
      weight: 0.8
    },

    // Medium complexity patterns
    {
      pattern: /add.*feature|implement.*functionality|create.*component|build.*module/i,
      indicators: ['add feature', 'implement', 'create component', 'build module'],
      complexity: 'medium',
      agents: ['backend', 'test-writer'],
      mode: 'sequential',
      weight: 0.6
    },
    {
      pattern: /fix.*bug|debug|troubleshoot|error.*handling|exception/i,
      indicators: ['fix', 'debug', 'troubleshoot', 'error'],
      complexity: 'simple',
      agents: ['backend'],
      mode: 'sequential',
      weight: 0.4
    },
    {
      pattern: /test.*suite|testing|unit.*test|integration.*test|e2e/i,
      indicators: ['test', 'testing', 'unit test', 'integration'],
      complexity: 'simple',
      agents: ['test-writer'],
      mode: 'sequential',
      weight: 0.5
    },
    {
      pattern: /documentation|docs|readme|guide|tutorial/i,
      indicators: ['documentation', 'docs', 'readme', 'guide'],
      complexity: 'simple',
      agents: ['backend'],
      mode: 'sequential',
      weight: 0.3
    },

    // Simple patterns (single agent tasks)
    {
      pattern: /explain|understand|analyze|review|what.*is|how.*does|help.*me/i,
      indicators: ['explain', 'understand', 'analyze', 'review', 'what is', 'help me'],
      complexity: 'simple',
      agents: ['architect'],
      mode: 'sequential',
      weight: 0.2
    },
    {
      pattern: /refactor|optimize|improve|clean.*up|performance/i,
      indicators: ['refactor', 'optimize', 'improve', 'clean up'],
      complexity: 'simple',
      agents: ['backend'],
      mode: 'sequential',
      weight: 0.4
    }
  ];

  private complexityIndicators = {
    orchestration: [
      'and', 'also', 'plus', 'with', 'including', 'both',
      'system', 'platform', 'application', 'solution',
      'full-stack', 'end-to-end', 'complete', 'entire',
      'workflow', 'pipeline', 'process', 'architecture'
    ],
    simple: [
      'just', 'only', 'simple', 'basic', 'quick',
      'fix', 'help', 'explain', 'show', 'what',
      'understand', 'analyze', 'review'
    ]
  };

  analyze(query: string): QueryAnalysis {
    debug('Analyzing query:', query);

    // Clean and normalize query
    const normalizedQuery = query.toLowerCase().trim();
    
    // Calculate pattern matches
    const matches = this.patterns
      .map(pattern => ({
        ...pattern,
        score: this.scorePattern(normalizedQuery, pattern)
      }))
      .filter(match => match.score > 0)
      .sort((a, b) => b.score - a.score);

    debug('Pattern matches:', matches.map(m => ({ pattern: m.pattern.source, score: m.score })));

    // Determine orchestration need
    const orchestrationScore = this.calculateOrchestrationScore(normalizedQuery, matches);
    const needsOrchestration = orchestrationScore > 0.5;

    // Get best match for recommendations
    const bestMatch = matches[0];
    
    // Fallback for no matches
    const fallback = {
      complexity: 'simple' as const,
      agents: this.detectAgentsFromKeywords(normalizedQuery),
      mode: 'sequential' as const
    };

    const result: QueryAnalysis = {
      needsOrchestration,
      complexity: bestMatch?.complexity || fallback.complexity,
      suggestedAgents: bestMatch?.agents || fallback.agents,
      executionMode: bestMatch?.mode || fallback.mode,
      confidence: Math.max(orchestrationScore, bestMatch?.score || 0.3),
      reasoning: this.buildReasoning(normalizedQuery, matches, orchestrationScore, needsOrchestration)
    };

    debug('Query analysis result:', result);
    return result;
  }

  private scorePattern(query: string, pattern: QueryPattern): number {
    let score = 0;

    // Check regex match
    if (pattern.pattern.test(query)) {
      score += pattern.weight;
    }

    // Check individual indicators
    const indicatorMatches = pattern.indicators.filter(indicator => 
      query.includes(indicator.toLowerCase())
    );
    
    score += (indicatorMatches.length / pattern.indicators.length) * pattern.weight * 0.5;

    return Math.min(score, 1); // Cap at 1
  }

  private calculateOrchestrationScore(query: string, matches: any[]): number {
    let score = 0;

    // Base score from pattern matches
    if (matches.length > 0) {
      score = Math.max(...matches.map(m => m.score));
    }

    // Boost for orchestration indicators
    const orchestrationWords = this.complexityIndicators.orchestration.filter(word => 
      query.includes(word)
    );
    score += orchestrationWords.length * 0.1;

    // Reduce for simple indicators
    const simpleWords = this.complexityIndicators.simple.filter(word => 
      query.includes(word)
    );
    score -= simpleWords.length * 0.15;

    // Boost for multiple agent mentions
    const agentMentions = ['backend', 'frontend', 'ui', 'api', 'database', 'test', 'design']
      .filter(agent => query.includes(agent));
    if (agentMentions.length > 1) {
      score += 0.2;
    }

    // Boost for conjunctions indicating complexity
    const conjunctions = ['and', 'also', 'plus', 'with', 'including', 'both']
      .filter(word => query.includes(word));
    score += conjunctions.length * 0.1;

    return Math.max(0, Math.min(1, score));
  }

  private detectAgentsFromKeywords(query: string): string[] {
    const agentKeywords = {
      architect: ['architecture', 'design', 'structure', 'plan', 'organize', 'system'],
      backend: ['api', 'server', 'database', 'endpoint', 'service', 'backend'],
      frontend: ['ui', 'interface', 'component', 'react', 'vue', 'angular', 'frontend'],
      'test-writer': ['test', 'testing', 'spec', 'coverage', 'unit', 'integration'],
      design: ['design', 'figma', 'ui', 'ux', 'mockup', 'wireframe'],
      cli: ['cli', 'command', 'terminal', 'script', 'tool']
    };

    const detectedAgents: string[] = [];

    for (const [agent, keywords] of Object.entries(agentKeywords)) {
      if (keywords.some(keyword => query.includes(keyword))) {
        detectedAgents.push(agent);
      }
    }

    // Default to backend if no specific agents detected
    return detectedAgents.length > 0 ? detectedAgents : ['backend'];
  }

  private buildReasoning(
    query: string, 
    matches: any[], 
    orchestrationScore: number, 
    needsOrchestration: boolean
  ): string {
    if (needsOrchestration) {
      if (matches.length > 0) {
        const topMatch = matches[0];
        return `Query matches "${topMatch.pattern.source}" pattern with ${topMatch.complexity} complexity. Suggests ${topMatch.agents.join(', ')} agents in ${topMatch.mode} mode.`;
      }
      return `High orchestration score (${orchestrationScore.toFixed(2)}) indicates need for multi-agent coordination.`;
    } else {
      if (matches.length > 0) {
        return `Simple query best handled by single agent execution.`;
      }
      return `Low complexity query suitable for direct agent execution.`;
    }
  }

  /**
   * Quick check if query needs orchestration (for CLI routing)
   */
  needsOrchestration(query: string): boolean {
    return this.analyze(query).needsOrchestration;
  }

  /**
   * Get recommended single agent for simple queries
   */
  getSingleAgent(query: string): string {
    const analysis = this.analyze(query);
    return analysis.suggestedAgents[0] || 'backend';
  }
}

// Export singleton instance
export const queryAnalyzer = new QueryAnalyzer();
