import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ContextBuilderService, RepositoryContext, AnalysisData } from './context-builder.js';
import chalk from 'chalk';

interface RepositoryAnalysis {
  name: string;
  path: string;
  type: 'monorepo' | 'single' | 'unknown';
  language: string;
  framework?: string;
  packages?: string[];
  gitInfo?: {
    branch: string;
    remote?: string;
    lastCommit?: string;
  };
  structure: {
    directories: string[];
    files: Record<string, number>; // file extensions with count
  };
  context?: RepositoryContext;
}

export class RepositoryAnalyzer {
  private contextBuilder: ContextBuilderService;

  constructor() {
    this.contextBuilder = new ContextBuilderService();
  }

  /**
   * Get available context modes
   */
  getAvailableContextModes(): string[] {
    return this.contextBuilder.getAvailableModes();
  }

  /**
   * Analyze a repository and return structured information
   * @param repoPath The path to analyze (defaults to cwd)
   * @param mode The context mode to use (defaults to 'detailed')
   */
  async analyze(repoPath?: string, mode?: string): Promise<RepositoryAnalysis>;
  /**
   * Analyze a repository with options
   */
  async analyze(options?: {
    path?: string;
    includePatterns?: string[];
    excludePatterns?: string[];
  }): Promise<RepositoryAnalysis>;
  async analyze(
    pathOrOptions?: string | {
      path?: string;
      includePatterns?: string[];
      excludePatterns?: string[];
    },
    mode?: string
  ): Promise<RepositoryAnalysis> {
    // Handle overload signatures
    let repoPath: string;
    let options: {
      path?: string;
      includePatterns?: string[];
      excludePatterns?: string[];
    } = {};
    
    if (typeof pathOrOptions === 'string') {
      repoPath = pathOrOptions;
    } else if (pathOrOptions) {
      options = pathOrOptions;
      repoPath = options.path || process.cwd();
    } else {
      repoPath = process.cwd();
    }
    
    const contextMode = mode || 'detailed';
    
    // Basic repository info
    const analysis: RepositoryAnalysis = {
      name: path.basename(repoPath),
      path: repoPath,
      type: 'unknown',
      language: 'unknown',
      structure: {
        directories: [],
        files: {}
      }
    };

    // Detect repository type
    analysis.type = this.detectRepositoryType(repoPath);
    
    // Detect primary language and framework
    const { language, framework } = this.detectLanguageAndFramework(repoPath);
    analysis.language = language;
    analysis.framework = framework;
    
    // Get git information
    analysis.gitInfo = this.getGitInfo(repoPath);
    
    // Analyze directory structure
    analysis.structure = this.analyzeStructure(repoPath, options.excludePatterns);
    
    // Find packages in monorepo
    if (analysis.type === 'monorepo') {
      analysis.packages = this.findMonorepoPackages(repoPath);
    }
    
    // Build context using context builder
    const analysisData: AnalysisData = this.buildAnalysisData(analysis);
    analysis.context = this.contextBuilder.buildContext(contextMode, analysisData);
    
    return analysis;
  }

  /**
   * Detect if it's a monorepo or single project
   */
  private detectRepositoryType(repoPath: string): 'monorepo' | 'single' | 'unknown' {
    // Check for common monorepo indicators
    const indicators = [
      'lerna.json',
      'pnpm-workspace.yaml',
      'rush.json',
      'nx.json',
      '.yarn/workspaces',
      'turbo.json'
    ];
    
    for (const indicator of indicators) {
      if (fs.existsSync(path.join(repoPath, indicator))) {
        return 'monorepo';
      }
    }
    
    // Check for packages/apps directories
    const packagesDir = path.join(repoPath, 'packages');
    const appsDir = path.join(repoPath, 'apps');
    
    if (fs.existsSync(packagesDir) || fs.existsSync(appsDir)) {
      // Check if they contain package.json files
      const hasPackages = fs.existsSync(packagesDir) && 
        fs.readdirSync(packagesDir).some(dir => 
          fs.existsSync(path.join(packagesDir, dir, 'package.json'))
        );
      
      const hasApps = fs.existsSync(appsDir) && 
        fs.readdirSync(appsDir).some(dir => 
          fs.existsSync(path.join(appsDir, dir, 'package.json'))
        );
      
      if (hasPackages || hasApps) {
        return 'monorepo';
      }
    }
    
    // Check package.json for workspaces
    const packageJsonPath = path.join(repoPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.workspaces) {
          return 'monorepo';
        }
      } catch (error) {
        // Ignore parse errors
      }
    }
    
    return 'single';
  }

  /**
   * Detect primary language and framework
   */
  private detectLanguageAndFramework(repoPath: string): { language: string; framework?: string } {
    const result: { language: string; framework?: string } = { language: 'unknown' };
    
    // Check package.json for Node.js projects
    const packageJsonPath = path.join(repoPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        result.language = 'typescript'; // Default to TypeScript for modern projects
        
        // Check for TypeScript
        if (packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript) {
          result.language = 'typescript';
        } else if (fs.existsSync(path.join(repoPath, 'tsconfig.json'))) {
          result.language = 'typescript';
        } else {
          result.language = 'javascript';
        }
        
        // Detect framework
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        if (deps.next) result.framework = 'nextjs';
        else if (deps.react) result.framework = 'react';
        else if (deps.vue) result.framework = 'vue';
        else if (deps['@angular/core']) result.framework = 'angular';
        else if (deps.svelte) result.framework = 'svelte';
        else if (deps.express) result.framework = 'express';
        else if (deps.fastify) result.framework = 'fastify';
        else if (deps['@nestjs/core']) result.framework = 'nestjs';
        
        return result;
      } catch (error) {
        // Ignore parse errors
      }
    }
    
    // Check for Python projects
    if (fs.existsSync(path.join(repoPath, 'requirements.txt')) || 
        fs.existsSync(path.join(repoPath, 'pyproject.toml')) ||
        fs.existsSync(path.join(repoPath, 'Pipfile'))) {
      result.language = 'python';
      
      // Detect Python framework
      if (fs.existsSync(path.join(repoPath, 'manage.py'))) {
        result.framework = 'django';
      } else if (fs.existsSync(path.join(repoPath, 'app.py')) || fs.existsSync(path.join(repoPath, 'application.py'))) {
        result.framework = 'flask';
      }
      
      return result;
    }
    
    // Check for Go projects
    if (fs.existsSync(path.join(repoPath, 'go.mod'))) {
      result.language = 'go';
      return result;
    }
    
    // Check for Rust projects
    if (fs.existsSync(path.join(repoPath, 'Cargo.toml'))) {
      result.language = 'rust';
      return result;
    }
    
    return result;
  }

  /**
   * Get git information
   */
  private getGitInfo(repoPath: string): RepositoryAnalysis['gitInfo'] | undefined {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: repoPath,
        encoding: 'utf-8'
      }).trim();
      
      let remote: string | undefined;
      try {
        remote = execSync('git config --get remote.origin.url', {
          cwd: repoPath,
          encoding: 'utf-8'
        }).trim();
      } catch {
        // No remote configured
      }
      
      let lastCommit: string | undefined;
      try {
        lastCommit = execSync('git log -1 --format="%H %s"', {
          cwd: repoPath,
          encoding: 'utf-8'
        }).trim();
      } catch {
        // No commits
      }
      
      return {
        branch,
        remote,
        lastCommit
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Analyze directory structure
   */
  private analyzeStructure(repoPath: string, excludePatterns?: string[]): RepositoryAnalysis['structure'] {
    const structure: RepositoryAnalysis['structure'] = {
      directories: [],
      files: {}
    };
    
    const excludeDefaults = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      '__pycache__',
      '.pytest_cache',
      'venv',
      '.venv',
      'target',
      '.idea',
      '.vscode'
    ];
    
    const exclude = new Set([...excludeDefaults, ...(excludePatterns || [])]);
    
    function walkDir(dir: string, relativePath: string = '') {
      try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          if (exclude.has(item)) continue;
          
          const fullPath = path.join(dir, item);
          const relPath = path.join(relativePath, item);
          
          try {
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
              structure.directories.push(relPath);
              walkDir(fullPath, relPath);
            } else if (stat.isFile()) {
              const ext = path.extname(item).toLowerCase();
              if (ext) {
                structure.files[ext] = (structure.files[ext] || 0) + 1;
              }
            }
          } catch {
            // Ignore permission errors
          }
        }
      } catch {
        // Ignore read errors
      }
    }
    
    walkDir(repoPath);
    
    // Sort directories
    structure.directories.sort();
    
    return structure;
  }

  /**
   * Find packages in a monorepo
   */
  private findMonorepoPackages(repoPath: string): string[] {
    const packages: string[] = [];
    
    // Common monorepo package locations
    const locations = ['packages', 'apps', 'services', 'libs'];
    
    for (const location of locations) {
      const locPath = path.join(repoPath, location);
      if (fs.existsSync(locPath)) {
        try {
          const dirs = fs.readdirSync(locPath);
          for (const dir of dirs) {
            const packageJsonPath = path.join(locPath, dir, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
              try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                packages.push(packageJson.name || `${location}/${dir}`);
              } catch {
                packages.push(`${location}/${dir}`);
              }
            }
          }
        } catch {
          // Ignore read errors
        }
      }
    }
    
    return packages;
  }

  /**
   * Format analysis for display
   */
  formatAnalysisForDisplay(analysis: RepositoryAnalysis): string {
    const lines: string[] = [];
    
    lines.push(chalk.bold('📦 Repository Analysis\n'));
    lines.push(`${chalk.gray('Name:')} ${analysis.name}`);
    lines.push(`${chalk.gray('Type:')} ${analysis.type}`);
    lines.push(`${chalk.gray('Language:')} ${analysis.language}`);
    if (analysis.framework) {
      lines.push(`${chalk.gray('Framework:')} ${analysis.framework}`);
    }
    
    if (analysis.gitInfo) {
      lines.push(`\n${chalk.bold('Git Information:')}`);
      lines.push(`${chalk.gray('Branch:')} ${analysis.gitInfo.branch}`);
      if (analysis.gitInfo.remote) {
        lines.push(`${chalk.gray('Remote:')} ${analysis.gitInfo.remote}`);
      }
    }
    
    if (analysis.packages && analysis.packages.length > 0) {
      lines.push(`\n${chalk.bold('Packages:')}`);
      analysis.packages.forEach(pkg => {
        lines.push(`  - ${pkg}`);
      });
    }
    
    if (analysis.structure) {
      lines.push(`\n${chalk.bold('File Statistics:')}`);
      const sortedExts = Object.entries(analysis.structure.files)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      sortedExts.forEach(([ext, count]) => {
        lines.push(`  ${ext}: ${count} files`);
      });
    }
    
    if (analysis.context) {
      lines.push(`\n${chalk.bold('Context:')}`);
      if (analysis.context.detected_stack && analysis.context.detected_stack.length > 0) {
        lines.push(`${chalk.gray('Stack:')} ${analysis.context.detected_stack.join(', ')}`);
      }
      if (analysis.context.patterns && analysis.context.patterns.length > 0) {
        lines.push(`${chalk.gray('Patterns:')} ${analysis.context.patterns.join(', ')}`);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Build analysis data for context builder
   */
  private buildAnalysisData(analysis: RepositoryAnalysis): AnalysisData {
    const data: AnalysisData = {
      techStack: {
        languages: [analysis.language].filter(Boolean),
      },
      patterns: {
        architecture: [],
        organization: [],
        practices: [],
      },
      repository: {
        type: analysis.type,
        mainFramework: analysis.framework,
        primaryLanguage: analysis.language,
      },
    };
    
    // Detect frontend frameworks
    if (analysis.framework) {
      if (['react', 'vue', 'angular', 'svelte', 'nextjs'].includes(analysis.framework.toLowerCase())) {
        data.techStack.frontend = [analysis.framework];
      } else if (['express', 'fastify', 'nestjs', 'django', 'flask'].includes(analysis.framework.toLowerCase())) {
        data.techStack.backend = [analysis.framework];
      }
    }
    
    // Detect patterns from structure
    if (analysis.structure.directories.some(d => d.includes('test') || d.includes('spec'))) {
      data.techStack.testing = ['jest/mocha/testing-library'];
      data.patterns.practices = ['test-driven-development'];
    }
    
    if (analysis.structure.directories.some(d => d.includes('components'))) {
      data.patterns.architecture = ['component-based'];
    }
    
    if (analysis.type === 'monorepo') {
      data.patterns.organization = ['monorepo'];
    }
    
    // Detect databases from common config files
    if (analysis.structure.files['.env'] || 
        analysis.structure.directories.some(d => d.includes('prisma') || d.includes('migrations'))) {
      data.techStack.databases = ['postgresql/mysql'];
    }
    
    // Detect infrastructure
    if (analysis.structure.files['Dockerfile'] || analysis.structure.files['.dockerignore']) {
      data.techStack.infrastructure = data.techStack.infrastructure || [];
      data.techStack.infrastructure.push('Docker');
    }
    
    if (analysis.structure.files['.gitlab-ci.yml'] || 
        analysis.structure.directories.some(d => d.includes('.github/workflows'))) {
      data.techStack.infrastructure = data.techStack.infrastructure || [];
      data.techStack.infrastructure.push('CI/CD');
    }
    
    return data;
  }
}

// Export alias for backward compatibility
export { RepositoryAnalyzer as RepositoryAnalyzerService };