import { readFile, readdir } from 'fs/promises';
import { join, extname } from 'path';
import { glob } from 'glob';
import { RepositoryAnalyzerService } from './repository-analyzer.js';
import type { RepositoryContext } from './context-builder.js';
import chalk from 'chalk';

export interface ExtractedContext {
  query: string;
  framework: string;
  language: string;
  dependencies: Record<string, string>;
  fileStructure: FileNode[];
  patterns: string[];
  relevantFiles: RelevantFile[];
  suggestions: string[];
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export interface RelevantFile {
  path: string;
  relevance: number;
  reason: string;
  content?: string;
}

export class RepositoryContextExtractor {
  private queryKeywords: Map<string, string[]> = new Map([
    ['authentication', ['auth', 'login', 'session', 'jwt', 'oauth', 'passport', 'user', 'password']],
    ['database', ['db', 'database', 'sql', 'postgres', 'mysql', 'mongo', 'schema', 'migration']],
    ['api', ['api', 'endpoint', 'rest', 'graphql', 'route', 'controller', 'handler']],
    ['frontend', ['component', 'ui', 'view', 'react', 'vue', 'angular', 'style', 'css']],
    ['testing', ['test', 'spec', 'jest', 'mocha', 'cypress', 'unit', 'integration']],
    ['deployment', ['deploy', 'docker', 'kubernetes', 'ci', 'cd', 'build', 'production']],
  ]);

  constructor(private analyzer: RepositoryAnalyzerService) {}

  async extractContext(query: string, repoPath: string = process.cwd()): Promise<ExtractedContext> {
    console.log(chalk.gray('🔍 Extracting repository context based on query...'));
    
    // Analyze the repository first
    const analysis = await this.analyzer.analyze(repoPath, 'detailed');
    
    // Extract keywords from query
    const keywords = this.extractKeywords(query.toLowerCase());
    
    // Create a context object from the analysis
    const context = analysis.context || {
      files: [],
      summary: '',
      metadata: {}
    };
    
    // Create structure for backward compatibility
    const contextCompat = {
      framework: analysis.framework || 'unknown',
      language: analysis.language || 'unknown',
      dependencies: {},
      patterns: []
    };
    
    // Find relevant files based on query
    const relevantFiles = await this.findRelevantFiles(repoPath, keywords, contextCompat as any);
    
    // Build file structure (limited depth)
    const fileStructure = await this.buildFileStructure(repoPath, 2);
    
    // Generate suggestions based on context
    const suggestions = this.generateSuggestions(query, contextCompat as any, relevantFiles);
    
    return {
      query,
      framework: contextCompat.framework,
      language: contextCompat.language,
      dependencies: contextCompat.dependencies,
      fileStructure,
      patterns: contextCompat.patterns,
      relevantFiles: relevantFiles.slice(0, 10), // Limit to top 10 most relevant
      suggestions,
    };
  }

  private extractKeywords(query: string): string[] {
    const keywords: Set<string> = new Set();
    
    // Add words from query
    query.split(/\s+/).forEach(word => {
      if (word.length > 2) {
        keywords.add(word);
      }
    });
    
    // Add related keywords based on categories
    for (const [category, terms] of this.queryKeywords) {
      if (terms.some(term => query.includes(term))) {
        terms.forEach(term => keywords.add(term));
      }
    }
    
    return Array.from(keywords);
  }

  private async findRelevantFiles(
    repoPath: string,
    keywords: string[],
    context: RepositoryContext
  ): Promise<RelevantFile[]> {
    const relevantFiles: RelevantFile[] = [];
    
    // Common patterns to search
    const patterns = [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.py',
      '**/*.go',
      '**/*.java',
      '**/README.md',
      '**/package.json',
      '**/requirements.txt',
      '**/go.mod',
    ];
    
    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: repoPath,
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
        absolute: false,
      });
      
      for (const file of files) {
        const relevance = this.calculateRelevance(file, keywords);
        if (relevance > 0) {
          relevantFiles.push({
            path: file,
            relevance,
            reason: this.getRelevanceReason(file, keywords),
          });
        }
      }
    }
    
    // Sort by relevance
    relevantFiles.sort((a, b) => b.relevance - a.relevance);
    
    // Load content for top files
    const topFiles = relevantFiles.slice(0, 5);
    for (const file of topFiles) {
      try {
        const fullPath = join(repoPath, file.path);
        const content = await readFile(fullPath, 'utf-8');
        file.content = content.slice(0, 1000); // First 1000 chars
      } catch (error) {
        // Ignore read errors
      }
    }
    
    return relevantFiles;
  }

  private calculateRelevance(filePath: string, keywords: string[]): number {
    let relevance = 0;
    const lowerPath = filePath.toLowerCase();
    
    // Check filename
    keywords.forEach(keyword => {
      if (lowerPath.includes(keyword)) {
        relevance += 5;
      }
    });
    
    // Boost for specific file types
    if (lowerPath.includes('config') || lowerPath.includes('setup')) {
      relevance += 2;
    }
    
    if (lowerPath.includes('test') || lowerPath.includes('spec')) {
      relevance += 1;
    }
    
    return relevance;
  }

  private getRelevanceReason(filePath: string, keywords: string[]): string {
    const reasons: string[] = [];
    const lowerPath = filePath.toLowerCase();
    
    keywords.forEach(keyword => {
      if (lowerPath.includes(keyword)) {
        reasons.push(`Contains keyword: ${keyword}`);
      }
    });
    
    if (reasons.length === 0) {
      reasons.push('Related to project structure');
    }
    
    return reasons.join(', ');
  }

  private async buildFileStructure(repoPath: string, maxDepth: number): Promise<FileNode[]> {
    const buildNode = async (path: string, depth: number): Promise<FileNode[]> => {
      if (depth >= maxDepth) return [];
      
      try {
        const entries = await readdir(path, { withFileTypes: true });
        const nodes: FileNode[] = [];
        
        for (const entry of entries) {
          // Skip hidden files and common ignore patterns
          if (entry.name.startsWith('.') || 
              ['node_modules', 'dist', 'build', '__pycache__'].includes(entry.name)) {
            continue;
          }
          
          const fullPath = join(path, entry.name);
          const relativePath = fullPath.replace(repoPath + '/', '');
          
          if (entry.isDirectory()) {
            const children = await buildNode(fullPath, depth + 1);
            nodes.push({
              name: entry.name,
              path: relativePath,
              type: 'directory',
              children: children.length > 0 ? children : undefined,
            });
          } else {
            nodes.push({
              name: entry.name,
              path: relativePath,
              type: 'file',
            });
          }
        }
        
        return nodes;
      } catch (error) {
        return [];
      }
    };
    
    return buildNode(repoPath, 0);
  }

  private generateSuggestions(
    query: string,
    context: RepositoryContext,
    relevantFiles: RelevantFile[]
  ): string[] {
    const suggestions: string[] = [];
    
    // Framework-specific suggestions
    if (context.framework?.toLowerCase().includes('next')) {
      if (query.includes('auth')) {
        suggestions.push('Consider using NextAuth.js for authentication');
      }
      if (query.includes('api')) {
        suggestions.push('Use Next.js API routes in pages/api or app/api');
      }
    }
    
    if (context.framework?.toLowerCase().includes('express')) {
      if (query.includes('auth')) {
        suggestions.push('Consider using Passport.js for authentication');
      }
      if (query.includes('database')) {
        suggestions.push('Use an ORM like Prisma or TypeORM');
      }
    }
    
    // File-based suggestions
    const hasTests = relevantFiles.some(f => f.path.includes('test') || f.path.includes('spec'));
    if (!hasTests && query.includes('test')) {
      suggestions.push('No test files found. Consider setting up a testing framework');
    }
    
    return suggestions;
  }
}