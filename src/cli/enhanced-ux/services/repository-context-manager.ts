/**
 * RepositoryContextManager Service
 * 
 * Manages repository analysis and context-aware agent prompt generation.
 * Provides automatic directory change detection and context caching.
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { watch, type FSWatcher } from 'chokidar';
import { join, basename } from 'path';
import type {
  RepositoryInfo,
  ContextAnalysisResult,
  EnhancedUXConfig,
  PerformanceMetrics
} from '../types.js';

interface CacheEntry {
  result: ContextAnalysisResult;
  timestamp: number;
  ttl: number;
}

export class RepositoryContextManager extends EventEmitter {
  private config: EnhancedUXConfig;
  private cache = new Map<string, CacheEntry>();
  private watchers = new Map<string, FSWatcher>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes default
  private performanceMetrics: PerformanceMetrics = {
    renderTime: 0,
    analysisTime: 0,
    inputResponseTime: 0,
    memoryUsage: 0
  };

  constructor(config: EnhancedUXConfig) {
    super();
    this.config = config;
  }

  /**
   * Analyze repository context and generate agent prompts
   */
  async analyzeRepository(repositoryPath: string): Promise<ContextAnalysisResult> {
    const startTime = performance.now();

    try {
      // Check cache first if enabled
      if (this.config.features.enableContextCaching) {
        const cached = this.getCachedResult(repositoryPath);
        if (cached) {
          return cached;
        }
      }

      // Perform repository analysis
      const repository = await this.analyzeRepositoryStructure(repositoryPath);
      const agentPrompts = await this.generateAgentPrompts(repository);
      
      const analysisTime = performance.now() - startTime;
      const cacheKey = this.generateCacheKey(repository);

      const result: ContextAnalysisResult = {
        repository,
        agentPrompts,
        analysisTime,
        cacheKey,
        timestamp: Date.now()
      };

      // Update performance metrics
      this.performanceMetrics.analysisTime = analysisTime;
      this.performanceMetrics.memoryUsage = process.memoryUsage().heapUsed;

      // Check performance targets
      if (analysisTime > this.config.performance.maxAnalysisTime) {
        this.emit('performance_warning', `Repository analysis time ${analysisTime.toFixed(2)}ms exceeds ${this.config.performance.maxAnalysisTime}ms target`);
      }

      // Cache the result
      if (this.config.features.enableContextCaching) {
        this.setCachedResult(repositoryPath, result);
      }

      return result;

    } catch (error) {
      if (error instanceof Error && error.message.includes('EACCES')) {
        throw new Error('Permission denied');
      }
      throw error;
    }
  }

  /**
   * Analyze repository structure and detect tech stack
   */
  private async analyzeRepositoryStructure(repositoryPath: string): Promise<RepositoryInfo> {
    const repository: RepositoryInfo = {
      path: repositoryPath,
      name: basename(repositoryPath),
      techStack: [],
      packageManagers: [],
      frameworks: [],
      scale: 'small',
      complexity: 'simple'
    };

    try {
      // Detect Node.js/JavaScript/TypeScript stack
      await this.detectNodeStack(repositoryPath, repository);
      
      // Detect Rust stack
      await this.detectRustStack(repositoryPath, repository);
      
      // Detect Python stack
      await this.detectPythonStack(repositoryPath, repository);
      
      // Detect Go stack
      await this.detectGoStack(repositoryPath, repository);
      
      // Analyze directory structure for scale and complexity
      await this.analyzeProjectScale(repositoryPath, repository);

    } catch (error) {
      // Return basic info even if analysis fails
      console.warn(`Repository analysis partially failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return repository;
  }

  /**
   * Detect Node.js tech stack from package.json
   */
  private async detectNodeStack(repositoryPath: string, repository: RepositoryInfo): Promise<void> {
    try {
      const packageJsonPath = join(repositoryPath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      // Detect package manager
      const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb'];
      for (const lockFile of lockFiles) {
        try {
          await fs.access(join(repositoryPath, lockFile));
          if (lockFile.includes('pnpm')) repository.packageManagers.push('pnpm');
          else if (lockFile.includes('yarn')) repository.packageManagers.push('yarn');
          else if (lockFile.includes('bun')) repository.packageManagers.push('bun');
          else repository.packageManagers.push('npm');
          break;
        } catch {
          // File doesn't exist, continue
        }
      }

      // Default to npm if no lock file found
      if (repository.packageManagers.length === 0) {
        repository.packageManagers.push('npm');
      }

      // Detect tech stack from dependencies
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies
      };

      if (allDeps.typescript || allDeps['@types/node']) {
        repository.techStack.push('typescript');
      } else {
        repository.techStack.push('javascript');
      }

      // Detect frameworks
      if (allDeps.react) repository.frameworks.push('react');
      if (allDeps['next'] || allDeps['@next/core']) repository.frameworks.push('next.js');
      if (allDeps.vue) repository.frameworks.push('vue');
      if (allDeps.svelte) repository.frameworks.push('svelte');
      if (allDeps.express) repository.frameworks.push('express');
      if (allDeps.fastify) repository.frameworks.push('fastify');
      if (allDeps['@nestjs/core']) repository.frameworks.push('nestjs');

    } catch (error) {
      // package.json not found or invalid, continue with other detections
    }
  }

  /**
   * Detect Rust tech stack from Cargo.toml
   */
  private async detectRustStack(repositoryPath: string, repository: RepositoryInfo): Promise<void> {
    try {
      const cargoTomlPath = join(repositoryPath, 'Cargo.toml');
      const cargoContent = await fs.readFile(cargoTomlPath, 'utf-8');

      repository.techStack.push('rust');
      repository.packageManagers.push('cargo');

      // Parse basic TOML to detect common frameworks
      if (cargoContent.includes('tokio')) repository.frameworks.push('tokio');
      if (cargoContent.includes('axum')) repository.frameworks.push('axum');
      if (cargoContent.includes('actix')) repository.frameworks.push('actix');
      if (cargoContent.includes('warp')) repository.frameworks.push('warp');

    } catch (error) {
      // Cargo.toml not found, not a Rust project
    }
  }

  /**
   * Detect Python tech stack
   */
  private async detectPythonStack(repositoryPath: string, repository: RepositoryInfo): Promise<void> {
    try {
      const pythonFiles = ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile'];
      let hasPython = false;

      for (const file of pythonFiles) {
        try {
          await fs.access(join(repositoryPath, file));
          hasPython = true;
          break;
        } catch {
          // File doesn't exist
        }
      }

      if (hasPython) {
        repository.techStack.push('python');
        repository.packageManagers.push('pip');

        // Try to read requirements for framework detection
        try {
          const reqPath = join(repositoryPath, 'requirements.txt');
          const requirements = await fs.readFile(reqPath, 'utf-8');
          
          if (requirements.includes('django')) repository.frameworks.push('django');
          if (requirements.includes('flask')) repository.frameworks.push('flask');
          if (requirements.includes('fastapi')) repository.frameworks.push('fastapi');
          if (requirements.includes('streamlit')) repository.frameworks.push('streamlit');

        } catch {
          // Requirements file not readable
        }
      }

    } catch (error) {
      // Python detection failed
    }
  }

  /**
   * Detect Go tech stack
   */
  private async detectGoStack(repositoryPath: string, repository: RepositoryInfo): Promise<void> {
    try {
      const goModPath = join(repositoryPath, 'go.mod');
      await fs.access(goModPath);

      repository.techStack.push('go');
      repository.packageManagers.push('go-modules');

      // Read go.mod for framework detection
      const goModContent = await fs.readFile(goModPath, 'utf-8');
      if (goModContent.includes('gin-gonic')) repository.frameworks.push('gin');
      if (goModContent.includes('echo')) repository.frameworks.push('echo');
      if (goModContent.includes('fiber')) repository.frameworks.push('fiber');

    } catch (error) {
      // go.mod not found, not a Go project
    }
  }

  /**
   * Analyze project scale and complexity based on directory structure
   */
  private async analyzeProjectScale(repositoryPath: string, repository: RepositoryInfo): Promise<void> {
    try {
      const stats = await this.getDirectoryStats(repositoryPath);
      
      // Determine scale based on file count and directory depth
      if (stats.fileCount > 1000 || stats.maxDepth > 8) {
        repository.scale = 'large';
        repository.complexity = 'complex';
      } else if (stats.fileCount > 100 || stats.maxDepth > 5) {
        repository.scale = 'medium';
        repository.complexity = 'moderate';
      } else {
        repository.scale = 'small';
        repository.complexity = 'simple';
      }

      // Adjust complexity based on tech stack diversity
      if (repository.techStack.length > 2 || repository.frameworks.length > 3) {
        repository.complexity = 'complex';
      }

    } catch (error) {
      // Use defaults if analysis fails
    }
  }

  /**
   * Get directory statistics for scale analysis
   */
  private async getDirectoryStats(dirPath: string, depth = 0, maxDepth = 0): Promise<{fileCount: number, maxDepth: number}> {
    let fileCount = 0;
    maxDepth = Math.max(maxDepth, depth);

    if (depth > 10) return { fileCount, maxDepth }; // Prevent infinite recursion

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        // Skip common ignore patterns
        if (entry.name.startsWith('.') || 
            ['node_modules', 'target', 'dist', 'build', '__pycache__'].includes(entry.name)) {
          continue;
        }

        if (entry.isFile()) {
          fileCount++;
        } else if (entry.isDirectory()) {
          const subStats = await this.getDirectoryStats(join(dirPath, entry.name), depth + 1, maxDepth);
          fileCount += subStats.fileCount;
          maxDepth = Math.max(maxDepth, subStats.maxDepth);
        }
      }
    } catch (error) {
      // Directory not accessible
    }

    return { fileCount, maxDepth };
  }

  /**
   * Generate context-aware agent prompts based on repository info
   */
  async generateAgentPrompts(repository: RepositoryInfo): Promise<Record<string, string>> {
    const prompts: Record<string, string> = {};

    // Base context for all agents
    const baseContext = `
Repository: ${repository.name}
Tech Stack: ${repository.techStack.join(', ')}
Frameworks: ${repository.frameworks.join(', ')}
Package Managers: ${repository.packageManagers.join(', ')}
Scale: ${repository.scale}
Complexity: ${repository.complexity}
    `.trim();

    // Backend agent prompt
    prompts.backend = this.generateBackendPrompt(repository, baseContext);
    
    // Frontend agent prompt
    prompts.frontend = this.generateFrontendPrompt(repository, baseContext);
    
    // Architect agent prompt
    prompts.architect = this.generateArchitectPrompt(repository, baseContext);

    return prompts;
  }

  /**
   * Generate backend-specific prompt
   */
  private generateBackendPrompt(repository: RepositoryInfo, baseContext: string): string {
    const packageManager = repository.packageManagers[0] || 'npm';
    const hasTypeScript = repository.techStack.includes('typescript');
    
    let prompt = `${baseContext}

You are a backend development expert working on this ${repository.complexity} ${repository.scale} project.

Key Instructions:
- Use ${packageManager} for package management
- ${hasTypeScript ? 'Use TypeScript for type safety' : 'Consider adding TypeScript for better maintainability'}`;

    if (repository.frameworks.includes('express')) {
      prompt += '\n- Use Express.js patterns and middleware';
    }
    if (repository.frameworks.includes('nestjs')) {
      prompt += '\n- Follow NestJS architecture with modules, controllers, and services';
    }
    if (repository.frameworks.includes('fastapi')) {
      prompt += '\n- Use FastAPI with Pydantic models and async/await';
    }

    if (repository.complexity === 'complex') {
      prompt += '\n- Consider microservices architecture for scalability';
      prompt += '\n- Implement proper error handling and logging';
      prompt += '\n- Use database migrations and connection pooling';
    }

    return prompt;
  }

  /**
   * Generate frontend-specific prompt
   */
  private generateFrontendPrompt(repository: RepositoryInfo, baseContext: string): string {
    const packageManager = repository.packageManagers[0] || 'npm';
    const hasTypeScript = repository.techStack.includes('typescript');
    
    let prompt = `${baseContext}

You are a frontend development expert working on this ${repository.complexity} ${repository.scale} project.

Key Instructions:
- Use ${packageManager} for package management
- ${hasTypeScript ? 'Use TypeScript with strict type checking' : 'Consider adding TypeScript for component props'}`;

    if (repository.frameworks.includes('react')) {
      prompt += '\n- Use React with functional components and hooks';
      prompt += '\n- Follow React best practices for state management';
    }
    if (repository.frameworks.includes('next.js')) {
      prompt += '\n- Use Next.js App Router and server components where appropriate';
      prompt += '\n- Optimize for performance with Next.js built-in features';
    }
    if (repository.frameworks.includes('vue')) {
      prompt += '\n- Use Vue 3 Composition API';
    }

    if (repository.scale === 'large') {
      prompt += '\n- Consider component libraries and design systems';
      prompt += '\n- Implement proper state management (Redux, Zustand, etc.)';
    }

    return prompt;
  }

  /**
   * Generate architect-specific prompt
   */
  private generateArchitectPrompt(repository: RepositoryInfo, baseContext: string): string {
    let prompt = `${baseContext}

You are a software architect responsible for system design and technical decisions.

Key Responsibilities:`;

    if (repository.complexity === 'complex') {
      prompt += `
- Design scalable system architecture
- Define service boundaries and API contracts
- Plan database schema and data flow
- Consider performance, security, and maintainability
- Guide technical decisions across the stack`;
    } else {
      prompt += `
- Ensure clean code architecture
- Define component structure and interfaces
- Plan data models and API design
- Balance simplicity with extensibility`;
    }

    if (repository.scale === 'large') {
      prompt += '\n- Consider distributed systems patterns';
      prompt += '\n- Plan for team collaboration and code organization';
    }

    return prompt;
  }

  /**
   * Watch directory for changes
   */
  async watchDirectory(directoryPath: string): Promise<void> {
    if (this.watchers.has(directoryPath)) {
      return; // Already watching
    }

    const watcher = watch(directoryPath, {
      ignoreInitial: true,
      ignored: ['**/node_modules/**', '**/target/**', '**/.git/**', '**/dist/**'],
      persistent: true,
      depth: 3 // Limit depth for performance
    });

    // Debounce changes to avoid excessive notifications
    let changeTimeout: NodeJS.Timeout | null = null;

    watcher.on('all', () => {
      if (changeTimeout) {
        clearTimeout(changeTimeout);
      }
      
      changeTimeout = setTimeout(() => {
        this.emit('directory_change', directoryPath);
        this.invalidateCache(directoryPath);
      }, 500); // 500ms debounce
    });

    this.watchers.set(directoryPath, watcher);
  }

  /**
   * Stop watching a directory
   */
  async stopWatching(directoryPath: string): Promise<void> {
    const watcher = this.watchers.get(directoryPath);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(directoryPath);
    }
  }

  /**
   * Check if directory is being watched
   */
  isWatching(directoryPath: string): boolean {
    return this.watchers.has(directoryPath);
  }

  /**
   * Get cached analysis result
   */
  private getCachedResult(repositoryPath: string): ContextAnalysisResult | null {
    const entry = this.cache.get(repositoryPath);
    
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(repositoryPath);
      return null;
    }
    
    return entry.result;
  }

  /**
   * Set cached analysis result
   */
  private setCachedResult(repositoryPath: string, result: ContextAnalysisResult): void {
    this.cache.set(repositoryPath, {
      result,
      timestamp: Date.now(),
      ttl: this.cacheTTL
    });
  }

  /**
   * Generate cache key for repository
   */
  private generateCacheKey(repository: RepositoryInfo): string {
    return `${repository.path}-${repository.name}-${repository.techStack.join(',')}-${Date.now()}`;
  }

  /**
   * Invalidate cache for a repository
   */
  async invalidateCache(repositoryPath: string): Promise<void> {
    this.cache.delete(repositoryPath);
  }

  /**
   * Set cache TTL
   */
  setCacheTTL(ttlMs: number): void {
    this.cacheTTL = ttlMs;
  }

  /**
   * Get fallback context for failed analysis
   */
  getFallbackContext(repositoryPath: string): ContextAnalysisResult {
    return {
      repository: {
        path: repositoryPath,
        name: basename(repositoryPath),
        techStack: [],
        packageManagers: [],
        frameworks: [],
        scale: 'small',
        complexity: 'simple'
      },
      agentPrompts: {
        backend: 'Generic backend development context',
        frontend: 'Generic frontend development context',
        architect: 'Generic architecture guidance'
      },
      analysisTime: 0,
      cacheKey: `fallback-${repositoryPath}`,
      timestamp: Date.now()
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Simulate slow analysis for testing
   */
  async simulateSlowAnalysis(repositoryPath: string, delayMs: number): Promise<ContextAnalysisResult> {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return this.analyzeRepository(repositoryPath);
  }

  /**
   * Simulate directory change for testing
   */
  simulateDirectoryChange(directoryPath: string): void {
    this.emit('directory_change', directoryPath);
  }
}