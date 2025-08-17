import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

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
  context?: {
    files: string[];
    summary: string;
    metadata: any;
  };
}

export class RepositoryAnalyzer {
  private apiClient: any;

  constructor(apiClient?: any) {
    this.apiClient = apiClient;
  }

  /**
   * Get available context modes for analysis
   */
  getAvailableContextModes(): string[] {
    return ['basic', 'detailed', 'full', 'minimal'];
  }

  /**
   * Format analysis results for display
   */
  formatAnalysisForDisplay(analysis: RepositoryAnalysis): string {
    const lines: string[] = [];
    lines.push(`Repository: ${analysis.name}`);
    lines.push(`Type: ${analysis.type}`);
    lines.push(`Language: ${analysis.language}`);
    if (analysis.framework) {
      lines.push(`Framework: ${analysis.framework}`);
    }
    if (analysis.packages) {
      lines.push(`Packages: ${analysis.packages.length}`);
      analysis.packages.forEach(pkg => lines.push(`  - ${pkg}`));
    }
    if (analysis.gitInfo) {
      lines.push(`Git Branch: ${analysis.gitInfo.branch}`);
    }
    lines.push(`\nStructure:`);
    lines.push(`  Directories: ${analysis.structure.directories.length}`);
    lines.push(`  File Types: ${Object.keys(analysis.structure.files).length}`);
    
    return lines.join('\n');
  }

  /**
   * Analyze a repository and return structured information
   */
  async analyze(pathOrOptions: string | {
    path?: string;
    includePatterns?: string[];
    excludePatterns?: string[];
  } = {}, mode?: string): Promise<RepositoryAnalysis> {
    // Handle overloaded parameters
    let options: {
      path?: string;
      includePatterns?: string[];
      excludePatterns?: string[];
    };
    
    if (typeof pathOrOptions === 'string') {
      options = { path: pathOrOptions };
    } else {
      options = pathOrOptions;
    }
    const repoPath = options.path || process.cwd();
    
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
}

// Export alias for backward compatibility
export { RepositoryAnalyzer as RepositoryAnalyzerService };