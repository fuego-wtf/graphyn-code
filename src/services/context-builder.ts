export interface RepositoryContext {
  detected_stack?: string[];
  patterns?: string[];
  framework?: string;
  language?: string;
  [key: string]: any; // Allow custom fields
}

export type ContextMode = 'detailed' | 'summary' | 'custom';

export interface AnalysisData {
  techStack: {
    frontend?: string[];
    backend?: string[];
    databases?: string[];
    infrastructure?: string[];
    testing?: string[];
    languages?: string[];
  };
  patterns: {
    architecture?: string[];
    organization?: string[];
    practices?: string[];
  };
  repository: {
    type: 'monorepo' | 'single' | 'unknown';
    mainFramework?: string;
    primaryLanguage?: string;
  };
}

export type ContextBuilder = (analysis: AnalysisData) => RepositoryContext;

export class ContextBuilderService {
  private builders: Map<string, ContextBuilder> = new Map();

  constructor() {
    // Register default builders
    this.registerBuilder('detailed', this.detailedBuilder);
    this.registerBuilder('summary', this.summaryBuilder);
  }

  /**
   * Register a custom context builder
   */
  registerBuilder(mode: string, builder: ContextBuilder): void {
    this.builders.set(mode, builder);
  }

  /**
   * Build context using specified mode
   */
  buildContext(mode: string, analysis: AnalysisData): RepositoryContext {
    const builder = this.builders.get(mode);
    if (!builder) {
      throw new Error(`Unknown context mode: ${mode}. Available modes: ${Array.from(this.builders.keys()).join(', ')}`);
    }
    return builder(analysis);
  }

  /**
   * Detailed context builder - includes versions and full stack
   */
  private detailedBuilder(analysis: AnalysisData): RepositoryContext {
    const detected_stack: string[] = [];
    
    // Add all tech stack items with details
    if (analysis.techStack.frontend) {
      detected_stack.push(...analysis.techStack.frontend);
    }
    if (analysis.techStack.backend) {
      detected_stack.push(...analysis.techStack.backend);
    }
    if (analysis.techStack.databases) {
      detected_stack.push(...analysis.techStack.databases);
    }
    if (analysis.techStack.infrastructure) {
      detected_stack.push(...analysis.techStack.infrastructure);
    }
    if (analysis.techStack.testing) {
      detected_stack.push(...analysis.techStack.testing);
    }
    if (analysis.techStack.languages) {
      detected_stack.push(...analysis.techStack.languages);
    }

    // Combine all patterns
    const patterns: string[] = [];
    if (analysis.patterns.architecture) {
      patterns.push(...analysis.patterns.architecture);
    }
    if (analysis.patterns.organization) {
      patterns.push(...analysis.patterns.organization);
    }
    if (analysis.patterns.practices) {
      patterns.push(...analysis.patterns.practices);
    }

    return {
      detected_stack: [...new Set(detected_stack)], // Remove duplicates
      patterns: [...new Set(patterns)],
      framework: analysis.repository.mainFramework,
      language: analysis.repository.primaryLanguage,
      repository_type: analysis.repository.type,
      tech_details: analysis.techStack, // Include full details
    };
  }

  /**
   * Summary context builder - high-level overview only
   */
  private summaryBuilder(analysis: AnalysisData): RepositoryContext {
    const mainStack: string[] = [];
    
    // Add only main frameworks and languages
    if (analysis.repository.mainFramework) {
      mainStack.push(analysis.repository.mainFramework);
    }
    if (analysis.repository.primaryLanguage) {
      mainStack.push(analysis.repository.primaryLanguage);
    }
    
    // Add primary database if any
    if (analysis.techStack.databases?.[0]) {
      mainStack.push(analysis.techStack.databases[0]);
    }

    // Add main patterns only
    const mainPatterns: string[] = [];
    if (analysis.patterns.architecture?.[0]) {
      mainPatterns.push(analysis.patterns.architecture[0]);
    }
    if (analysis.patterns.organization?.[0]) {
      mainPatterns.push(analysis.patterns.organization[0]);
    }

    return {
      detected_stack: mainStack,
      patterns: mainPatterns,
      framework: analysis.repository.mainFramework,
      language: analysis.repository.primaryLanguage,
    };
  }

  /**
   * Get available context modes
   */
  getAvailableModes(): string[] {
    return Array.from(this.builders.keys());
  }
}