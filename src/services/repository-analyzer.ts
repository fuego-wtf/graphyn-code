import { GraphynAPIClient } from '../api-client.js';
import { AnalyzerAgent } from '../agents/analyzer-agent.js';
import { ContextBuilderService, RepositoryContext, AnalysisData } from './context-builder.js';
import { RepositoryDetector } from '../utils/repository-detector.js';
import { execSync } from 'child_process';
import chalk from 'chalk';

export interface AnalysisResult {
  repository: {
    url?: string;
    branch?: string;
    type: 'monorepo' | 'single' | 'unknown';
  };
  context: RepositoryContext;
  rawAnalysis: AnalysisData;
  timestamp: string;
}

export class RepositoryAnalyzerService {
  private contextBuilder: ContextBuilderService;
  private analyzerAgent: AnalyzerAgent;

  constructor(private apiClient: GraphynAPIClient) {
    this.contextBuilder = new ContextBuilderService();
    this.analyzerAgent = new AnalyzerAgent(apiClient);
  }

  /**
   * Analyze repository with specified context mode
   */
  async analyze(
    rootPath: string = process.cwd(),
    contextMode: string = 'detailed'
  ): Promise<AnalysisResult> {
    console.log(chalk.gray('🔍 Analyzing repository...'));

    // Get basic repository info
    const repoInfo = await RepositoryDetector.detectRepository(rootPath);
    
    // Get current branch
    const branch = this.getCurrentBranch(rootPath);

    console.log(chalk.gray('🤖 Asking AI agent to analyze the codebase...'));
    
    // Use agent to analyze repository
    const rawAnalysis = await this.analyzerAgent.analyzeRepository(rootPath);

    // Enhance analysis with repo detector info
    if (!rawAnalysis.repository.mainFramework && repoInfo.projects?.[0]?.framework) {
      rawAnalysis.repository.mainFramework = repoInfo.projects[0].framework;
    }
    if (!rawAnalysis.repository.primaryLanguage && repoInfo.projects?.[0]?.language) {
      rawAnalysis.repository.primaryLanguage = repoInfo.projects[0].language;
    }
    rawAnalysis.repository.type = repoInfo.type;

    console.log(chalk.gray('📋 Building context...'));
    
    // Build context using specified mode
    const context = this.contextBuilder.buildContext(contextMode, rawAnalysis);

    const result: AnalysisResult = {
      repository: {
        url: repoInfo.gitUrl,
        branch,
        type: repoInfo.type,
      },
      context,
      rawAnalysis,
      timestamp: new Date().toISOString(),
    };

    console.log(chalk.green('✅ Analysis complete!'));
    
    return result;
  }

  /**
   * Register a custom context builder
   */
  registerContextBuilder(mode: string, builder: (analysis: AnalysisData) => RepositoryContext): void {
    this.contextBuilder.registerBuilder(mode, builder);
  }

  /**
   * Get available context modes
   */
  getAvailableContextModes(): string[] {
    return this.contextBuilder.getAvailableModes();
  }

  /**
   * Get current git branch
   */
  private getCurrentBranch(rootPath: string): string {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: rootPath,
        encoding: 'utf-8',
      }).trim();
    } catch {
      return 'main';
    }
  }

  /**
   * Format analysis result for display
   */
  formatAnalysisForDisplay(result: AnalysisResult): string {
    const lines: string[] = [];
    
    lines.push(chalk.bold('\n📊 Repository Analysis Report'));
    lines.push(chalk.gray('─'.repeat(50)));
    
    // Repository info
    lines.push(chalk.bold('\n📁 Repository:'));
    if (result.repository.url) {
      lines.push(`  URL: ${chalk.cyan(result.repository.url)}`);
    }
    lines.push(`  Branch: ${chalk.yellow(result.repository.branch)}`);
    lines.push(`  Type: ${chalk.blue(result.repository.type)}`);
    
    // Tech stack
    lines.push(chalk.bold('\n🛠️  Tech Stack:'));
    if (result.context.detected_stack && result.context.detected_stack.length > 0) {
      const stack = result.context.detected_stack;
      // Group by category
      const frontend = stack.filter(s => ['react', 'vue', 'angular', 'nextjs', 'svelte'].some(f => s.includes(f)));
      const backend = stack.filter(s => ['express', 'fastify', 'nestjs', 'django', 'flask'].some(f => s.includes(f)));
      const databases = stack.filter(s => ['postgresql', 'mysql', 'mongodb', 'redis'].some(f => s.includes(f)));
      const languages = stack.filter(s => ['typescript', 'javascript', 'python', 'go', 'rust'].some(f => s.includes(f)));
      
      if (frontend.length > 0) {
        lines.push(`  Frontend: ${frontend.map(s => chalk.green(s)).join(', ')}`);
      }
      if (backend.length > 0) {
        lines.push(`  Backend: ${backend.map(s => chalk.blue(s)).join(', ')}`);
      }
      if (databases.length > 0) {
        lines.push(`  Databases: ${databases.map(s => chalk.magenta(s)).join(', ')}`);
      }
      if (languages.length > 0) {
        lines.push(`  Languages: ${languages.map(s => chalk.yellow(s)).join(', ')}`);
      }
      
      // Show remaining items
      const shown = new Set([...frontend, ...backend, ...databases, ...languages]);
      const others = stack.filter(s => !shown.has(s));
      if (others.length > 0) {
        lines.push(`  Other: ${others.map(s => chalk.gray(s)).join(', ')}`);
      }
    }
    
    // Patterns
    if (result.context.patterns && result.context.patterns.length > 0) {
      lines.push(chalk.bold('\n📐 Patterns:'));
      result.context.patterns.forEach(pattern => {
        lines.push(`  • ${chalk.cyan(pattern)}`);
      });
    }
    
    // Framework and language
    lines.push(chalk.bold('\n🎯 Primary Stack:'));
    if (result.context.framework) {
      lines.push(`  Framework: ${chalk.green(result.context.framework)}`);
    }
    if (result.context.language) {
      lines.push(`  Language: ${chalk.yellow(result.context.language)}`);
    }
    
    lines.push(chalk.gray('\n─'.repeat(50)));
    lines.push(chalk.gray(`Generated at: ${new Date(result.timestamp).toLocaleString()}`));
    
    return lines.join('\n');
  }
}