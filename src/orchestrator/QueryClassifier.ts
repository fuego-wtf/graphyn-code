/**
 * Query Classifier - Intelligent complexity detection for task decomposition
 * 
 * Fixes the critical issue where simple queries like "hello world" generate
 * 4 complex tasks with 47-minute estimates. This classifier detects query
 * complexity and recommends appropriate decomposition strategies.
 */

import { QueryComplexity } from './types.js';

export interface QueryPattern {
  readonly pattern: RegExp;
  readonly complexity: QueryComplexity;
  readonly taskCount: number;
  readonly estimatedMinutes: number;
  readonly description: string;
}

export interface QueryClassification {
  readonly complexity: QueryComplexity;
  readonly recommendedTaskCount: number;
  readonly estimatedMinutes: number;
  readonly reasoning: string;
  readonly patterns: QueryPattern[];
  readonly shouldSimplify: boolean;
}

/**
 * Intelligent query classification to prevent over-engineering
 */
export class QueryClassifier {
  private readonly patterns: QueryPattern[] = [
    // SIMPLE patterns - single task, 1-5 minutes
    {
      pattern: /hello world/i,
      complexity: QueryComplexity.SIMPLE,
      taskCount: 1,
      estimatedMinutes: 1,
      description: "Basic hello world script"
    },
    {
      pattern: /simple.*script/i,
      complexity: QueryComplexity.SIMPLE,
      taskCount: 1,
      estimatedMinutes: 2,
      description: "Simple script creation"
    },
    {
      pattern: /create.*single.*file/i,
      complexity: QueryComplexity.SIMPLE,
      taskCount: 1,
      estimatedMinutes: 3,
      description: "Single file creation"
    },
    {
      pattern: /basic.*function/i,
      complexity: QueryComplexity.SIMPLE,
      taskCount: 1,
      estimatedMinutes: 2,
      description: "Basic function implementation"
    },
    {
      pattern: /(quick|simple|basic|small).*example/i,
      complexity: QueryComplexity.SIMPLE,
      taskCount: 1,
      estimatedMinutes: 2,
      description: "Simple example code"
    },

    // MEDIUM patterns - 2-4 tasks, 5-20 minutes
    {
      pattern: /create.*component/i,
      complexity: QueryComplexity.MODERATE,
      taskCount: 2,
      estimatedMinutes: 8,
      description: "Component with tests"
    },
    {
      pattern: /build.*api|rest.*api|api.*endpoint/i,
      complexity: QueryComplexity.MODERATE,
      taskCount: 3,
      estimatedMinutes: 15,
      description: "API with documentation"
    },
    {
      pattern: /add.*feature/i,
      complexity: QueryComplexity.MODERATE,
      taskCount: 3,
      estimatedMinutes: 12,
      description: "Feature implementation"
    },
    {
      pattern: /implement.*service/i,
      complexity: QueryComplexity.MODERATE,
      taskCount: 3,
      estimatedMinutes: 18,
      description: "Service implementation"
    },

    // COMPLEX patterns - 4+ tasks, 20+ minutes
    {
      pattern: /full.*stack|complete.*application/i,
      complexity: QueryComplexity.ENTERPRISE,
      taskCount: 8,
      estimatedMinutes: 45,
      description: "Full application development"
    },
    {
      pattern: /microservices|multi.*service/i,
      complexity: QueryComplexity.ENTERPRISE,
      taskCount: 6,
      estimatedMinutes: 35,
      description: "Microservices architecture"
    },
    {
      pattern: /platform|system.*architecture/i,
      complexity: QueryComplexity.ENTERPRISE,
      taskCount: 8,
      estimatedMinutes: 50,
      description: "Platform development"
    }
  ];

  /**
   * Classify query complexity and recommend decomposition
   */
  classifyQuery(query: string): QueryClassification {
    const matchedPatterns = this.findMatchingPatterns(query);
    
    if (matchedPatterns.length === 0) {
      return this.classifyByHeuristics(query);
    }

    // Use the most specific (highest complexity) match
    const primaryPattern = matchedPatterns.reduce((best, current) => 
      current.complexity > best.complexity ? current : best
    );

    const shouldSimplify = this.detectOverEngineering(query, primaryPattern);

    return {
      complexity: primaryPattern.complexity,
      recommendedTaskCount: primaryPattern.taskCount,
      estimatedMinutes: primaryPattern.estimatedMinutes,
      reasoning: `Matched pattern: ${primaryPattern.description}`,
      patterns: matchedPatterns,
      shouldSimplify
    };
  }

  /**
   * Find all patterns that match the query
   */
  private findMatchingPatterns(query: string): QueryPattern[] {
    return this.patterns.filter(pattern => pattern.pattern.test(query));
  }

  /**
   * Classify by heuristics when no patterns match
   */
  private classifyByHeuristics(query: string): QueryClassification {
    const words = query.toLowerCase().split(/\s+/);
    const complexityIndicators = {
      simple: ['create', 'make', 'add', 'write', 'simple', 'basic', 'quick'],
      medium: ['build', 'implement', 'develop', 'feature', 'component'],
      complex: ['system', 'platform', 'architecture', 'full', 'complete', 'enterprise']
    };

    let score = 0;
    for (const word of words) {
      if (complexityIndicators.simple.includes(word)) score += 1;
      if (complexityIndicators.medium.includes(word)) score += 2;
      if (complexityIndicators.complex.includes(word)) score += 4;
    }

    if (score <= 2) {
      return {
        complexity: QueryComplexity.SIMPLE,
        recommendedTaskCount: 1,
        estimatedMinutes: 3,
        reasoning: "Simple task based on word analysis",
        patterns: [],
        shouldSimplify: false
      };
    } else if (score <= 6) {
      return {
        complexity: QueryComplexity.MODERATE,
        recommendedTaskCount: 3,
        estimatedMinutes: 15,
        reasoning: "Medium complexity based on word analysis",
        patterns: [],
        shouldSimplify: false
      };
    } else {
      return {
        complexity: QueryComplexity.ENTERPRISE,
        recommendedTaskCount: 6,
        estimatedMinutes: 35,
        reasoning: "Complex task based on word analysis",
        patterns: [],
        shouldSimplify: false
      };
    }
  }

  /**
   * Detect when decomposition is likely over-engineered
   */
  private detectOverEngineering(query: string, pattern: QueryPattern): boolean {
    const overEngineeringSignals = [
      // Simple words but complex decomposition
      query.includes('simple') && pattern.taskCount > 2,
      query.includes('quick') && pattern.estimatedMinutes > 10,
      query.includes('basic') && pattern.taskCount > 1,
      
      // Contradictory complexity
      query.includes('hello world') && pattern.taskCount > 1,
      query.length < 30 && pattern.taskCount > 3
    ];

    return overEngineeringSignals.some(signal => signal);
  }

  /**
   * Suggest simplified decomposition for over-engineered plans
   */
  suggestSimplification(classification: QueryClassification, query: string): QueryClassification {
    if (!classification.shouldSimplify) {
      return classification;
    }

    // Force simplification for obvious cases
    if (query.includes('hello world')) {
      return {
        complexity: QueryComplexity.SIMPLE,
        recommendedTaskCount: 1,
        estimatedMinutes: 1,
        reasoning: "Simplified: Hello world should be single task",
        patterns: classification.patterns,
        shouldSimplify: false
      };
    }

    // General simplification: reduce by half
    return {
      ...classification,
      recommendedTaskCount: Math.max(1, Math.ceil(classification.recommendedTaskCount / 2)),
      estimatedMinutes: Math.max(2, Math.ceil(classification.estimatedMinutes / 2)),
      reasoning: `Simplified: ${classification.reasoning}`,
      shouldSimplify: false
    };
  }

  /**
   * Check if query should use simple mode (single task, single agent)
   */
  shouldUseSimpleMode(classification: QueryClassification): boolean {
    return classification.complexity === QueryComplexity.SIMPLE && 
           classification.recommendedTaskCount === 1 &&
           classification.estimatedMinutes <= 5;
  }

  /**
   * Get human-readable explanation of classification
   */
  explainClassification(classification: QueryClassification): string {
    const complexity = classification.complexity; // Already a string in QueryComplexity enum
    
    return `Classified as ${complexity} complexity:
• ${classification.recommendedTaskCount} task(s)
• ~${classification.estimatedMinutes} minute(s)
• Reason: ${classification.reasoning}${classification.shouldSimplify ? '\n⚠️ This may be over-engineered' : ''}`;
  }
}
