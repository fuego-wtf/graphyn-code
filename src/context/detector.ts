import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import { createHash } from 'crypto';
import { platform } from 'os';
import { LRUCache } from 'lru-cache';
import type { SimpleGit } from 'simple-git';
import { simpleGit } from 'simple-git';

export interface FrameworkInfo {
  name: string;
  version?: string;
  confidence: number;
  category: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'desktop' | 'ai-ml';
}

export interface DatabaseConfig {
  type: string;
  version?: string;
  orm?: string;
  connection?: {
    host?: string;
    port?: number;
    database?: string;
  };
}

export interface CodingConvention {
  linter?: 'eslint' | 'tslint' | 'biome' | 'oxlint';
  formatter?: 'prettier' | 'biome' | 'dprint';
  style?: {
    indent: 'tabs' | 'spaces';
    indentSize: number;
    quotes: 'single' | 'double';
    semicolons: boolean;
    lineEndings: 'lf' | 'crlf';
  };
}

export interface GitContext {
  type: 'repository' | 'submodule' | 'none';
  root?: string;
  branch?: string;
  remotes?: Array<{ name: string; url: string }>;
  isClean?: boolean;
  lastCommit?: {
    hash: string;
    message: string;
    author: string;
    date: Date;
  };
}

export interface AIMLContext {
  frameworks: string[];
  providers: string[];
  capabilities: string[];
  vectorDatabases?: string[];
  localModels?: boolean;
}

export interface TechStackContext {
  // Core detection
  detected_stack: string[];
  patterns: string[];
  
  // Framework detection
  frameworks: FrameworkInfo[];
  
  // Database detection
  databases: DatabaseConfig[];
  
  // Authentication
  authentication: string[];
  
  // Deployment
  deployment: string[];
  
  // Git information
  git?: GitContext;
  
  // Coding conventions
  conventions?: CodingConvention;
  
  // AI/ML context
  ai?: AIMLContext;
  
  // Performance metrics
  detectionTime?: number;
  
  // Errors during detection
  detectionErrors?: Array<{ phase: string; error: Error }>;
  
  // Whether this is a partial result
  partial?: boolean;
}

export interface DetectionOptions {
  maxFiles?: number;
  maxFileSize?: number;
  timeout?: number;
  parallel?: boolean;
  forceRefresh?: boolean;
}

export class ContextDetectionError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: Error,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'ContextDetectionError';
  }
}

// Cache implementation
class ContextDetectorCache {
  private cache: LRUCache<string, TechStackContext>;

  constructor() {
    this.cache = new LRUCache<string, TechStackContext>({
      max: 100,
      ttl: 1000 * 60 * 15, // 15 minutes
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });
  }

  async get(rootPath: string): Promise<TechStackContext | null> {
    const cacheKey = await this.generateCacheKey(rootPath);
    return this.cache.get(cacheKey) || null;
  }

  async set(rootPath: string, context: TechStackContext): Promise<void> {
    const cacheKey = await this.generateCacheKey(rootPath);
    this.cache.set(cacheKey, context);
  }

  private async generateCacheKey(rootPath: string): Promise<string> {
    try {
      const stats = await fs.stat(path.join(rootPath, 'package.json'));
      const mtime = stats?.mtime.getTime() || 0;
      return createHash('md5').update(`${rootPath}:${mtime}`).digest('hex');
    } catch {
      return createHash('md5').update(rootPath).digest('hex');
    }
  }

  clear(rootPath?: string): void {
    if (rootPath) {
      const keysToDelete: string[] = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(rootPath)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }
}

const contextCache = new ContextDetectorCache();

// Main detection function
export async function detectTechStack(
  rootPath: string,
  options?: DetectionOptions
): Promise<TechStackContext> {
  const startTime = Date.now();
  
  // Check cache first
  if (!options?.forceRefresh) {
    const cached = await contextCache.get(rootPath);
    if (cached) {
      return cached;
    }
  }
  
  const detector = options?.parallel !== false 
    ? new ParallelDetector(options)
    : new SequentialDetector(options);
  
  try {
    const context = await detector.detect(rootPath);
    context.detectionTime = Date.now() - startTime;
    
    // Cache the result
    await contextCache.set(rootPath, context);
    
    return context;
  } catch (error) {
    if (error instanceof ContextDetectionError && !error.recoverable) {
      throw error;
    }
    
    // Return partial context with errors
    const partialContext = createBaseContext();
    partialContext.detectionErrors = [{ phase: 'main', error: error as Error }];
    partialContext.partial = true;
    partialContext.detectionTime = Date.now() - startTime;
    
    return partialContext;
  }
}

// Helper to create base context
function createBaseContext(): TechStackContext {
  return {
    detected_stack: [],
    patterns: [],
    frameworks: [],
    databases: [],
    authentication: [],
    deployment: [],
    detectionErrors: []
  };
}

// Base detector class
abstract class BaseDetector {
  constructor(protected options: DetectionOptions = {}) {}
  
  abstract detect(rootPath: string): Promise<TechStackContext>;
  
  protected async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  protected async readFile(filePath: string): Promise<string | null> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.size > (this.options.maxFileSize || 1024 * 1024)) {
        return null; // Skip large files
      }
      return await fs.readFile(filePath, 'utf8');
    } catch {
      return null;
    }
  }
}

// Sequential detector implementation
class SequentialDetector extends BaseDetector {
  async detect(rootPath: string): Promise<TechStackContext> {
    const context = createBaseContext();
    const errors: Array<{ phase: string; error: Error }> = [];
    
    // Phase 1: Package.json analysis
    try {
      await this.analyzePackageJson(rootPath, context);
    } catch (error) {
      errors.push({ phase: 'package.json', error: error as Error });
    }
    
    // Phase 2: Git detection
    try {
      context.git = await this.detectGit(rootPath);
    } catch (error) {
      errors.push({ phase: 'git', error: error as Error });
    }
    
    // Phase 3: Config files
    try {
      await this.checkConfigFiles(rootPath, context);
    } catch (error) {
      errors.push({ phase: 'config', error: error as Error });
    }
    
    // Phase 4: Framework patterns
    try {
      await this.detectFrameworkPatterns(rootPath, context);
    } catch (error) {
      errors.push({ phase: 'frameworks', error: error as Error });
    }
    
    // Phase 5: Conventions
    try {
      context.conventions = await this.detectConventions(rootPath);
    } catch (error) {
      errors.push({ phase: 'conventions', error: error as Error });
    }
    
    // Phase 6: AI/ML detection
    try {
      context.ai = await this.detectAIML(rootPath, context);
    } catch (error) {
      errors.push({ phase: 'ai-ml', error: error as Error });
    }
    
    if (errors.length > 0) {
      context.detectionErrors = errors;
    }
    
    // Deduplicate arrays
    this.deduplicateContext(context);
    
    return context;
  }
  
  protected async analyzePackageJson(rootPath: string, context: TechStackContext): Promise<void> {
    const packageJsonPath = path.join(rootPath, 'package.json');
    const content = await this.readFile(packageJsonPath);
    
    if (!content) return;
    
    try {
      const packageJson = JSON.parse(content);
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      // Detect frameworks
      const detectedFrameworks = await this.detectFrameworksFromDeps(deps);
      context.frameworks.push(...detectedFrameworks);
      
      // Detect databases
      const detectedDatabases = this.detectDatabasesFromDeps(deps);
      context.databases.push(...detectedDatabases);
      
      // Detect authentication
      const detectedAuth = this.detectAuthFromDeps(deps);
      context.authentication.push(...detectedAuth);
      
      // Detect patterns
      this.detectPatternsFromDeps(deps, context);
      
    } catch (error) {
      throw new ContextDetectionError(
        'Failed to parse package.json',
        'PACKAGE_JSON_PARSE_ERROR',
        error as Error
      );
    }
  }
  
  protected async detectFrameworksFromDeps(deps: Record<string, string>): Promise<FrameworkInfo[]> {
    const frameworks: FrameworkInfo[] = [];
    
    const FRAMEWORK_DETECTORS = [
      // Frontend frameworks
      { dep: 'next', name: 'Next.js', category: 'fullstack' as const },
      { dep: 'react', name: 'React', category: 'frontend' as const },
      { dep: 'vue', name: 'Vue.js', category: 'frontend' as const },
      { dep: '@angular/core', name: 'Angular', category: 'frontend' as const },
      { dep: 'svelte', name: 'Svelte', category: 'frontend' as const },
      { dep: '@sveltejs/kit', name: 'SvelteKit', category: 'fullstack' as const },
      { dep: '@remix-run/react', name: 'Remix', category: 'fullstack' as const },
      { dep: 'astro', name: 'Astro', category: 'fullstack' as const },
      { dep: 'solid-js', name: 'SolidJS', category: 'frontend' as const },
      { dep: '@builder.io/qwik', name: 'Qwik', category: 'frontend' as const },
      
      // Backend frameworks
      { dep: 'express', name: 'Express.js', category: 'backend' as const },
      { dep: 'fastify', name: 'Fastify', category: 'backend' as const },
      { dep: '@nestjs/core', name: 'NestJS', category: 'backend' as const },
      { dep: 'koa', name: 'Koa', category: 'backend' as const },
      { dep: '@hapi/hapi', name: 'Hapi', category: 'backend' as const },
      
      // AI/ML frameworks
      { dep: 'langchain', name: 'LangChain', category: 'ai-ml' as const },
      { dep: '@langchain/core', name: 'LangChain', category: 'ai-ml' as const },
      { dep: 'ai', name: 'Vercel AI SDK', category: 'ai-ml' as const },
      { dep: 'openai', name: 'OpenAI SDK', category: 'ai-ml' as const },
      { dep: '@anthropic-ai/sdk', name: 'Anthropic SDK', category: 'ai-ml' as const },
    ];
    
    for (const detector of FRAMEWORK_DETECTORS) {
      if (deps[detector.dep]) {
        frameworks.push({
          name: detector.name,
          version: deps[detector.dep],
          confidence: 1.0,
          category: detector.category
        });
      }
    }
    
    return frameworks;
  }
  
  protected detectDatabasesFromDeps(deps: Record<string, string>): DatabaseConfig[] {
    const databases: DatabaseConfig[] = [];
    
    const DATABASE_DETECTORS = [
      { dep: 'mongoose', db: 'MongoDB', orm: 'Mongoose' },
      { dep: 'pg', db: 'PostgreSQL' },
      { dep: 'postgres', db: 'PostgreSQL' },
      { dep: 'mysql', db: 'MySQL' },
      { dep: 'mysql2', db: 'MySQL' },
      { dep: 'redis', db: 'Redis' },
      { dep: '@prisma/client', db: 'Prisma', orm: 'Prisma' },
      { dep: 'typeorm', db: 'TypeORM', orm: 'TypeORM' },
      { dep: 'sequelize', db: 'Sequelize', orm: 'Sequelize' },
      { dep: 'knex', db: 'Knex.js', orm: 'Knex.js' },
      { dep: '@pinecone-database/pinecone', db: 'Pinecone', type: 'vector' },
      { dep: 'chromadb', db: 'ChromaDB', type: 'vector' },
      { dep: 'weaviate-ts-client', db: 'Weaviate', type: 'vector' },
    ];
    
    for (const detector of DATABASE_DETECTORS) {
      if (deps[detector.dep]) {
        databases.push({
          type: detector.db,
          version: deps[detector.dep],
          orm: detector.orm
        });
      }
    }
    
    return databases;
  }
  
  protected detectAuthFromDeps(deps: Record<string, string>): string[] {
    const auth: string[] = [];
    
    const AUTH_DETECTORS = [
      { dep: 'passport', name: 'Passport.js' },
      { dep: 'jsonwebtoken', name: 'JWT' },
      { dep: '@clerk/nextjs', name: 'Clerk' },
      { dep: '@clerk/clerk-sdk-node', name: 'Clerk' },
      { dep: '@auth0/nextjs-auth0', name: 'Auth0' },
      { dep: 'better-auth', name: 'Better Auth' },
      { dep: '@supabase/auth-helpers', name: 'Supabase Auth' },
      { dep: 'firebase', name: 'Firebase Auth' },
      { dep: '@lucia-auth/lucia', name: 'Lucia Auth' },
    ];
    
    for (const detector of AUTH_DETECTORS) {
      if (deps[detector.dep]) {
        auth.push(detector.name);
      }
    }
    
    return auth;
  }
  
  protected detectPatternsFromDeps(deps: Record<string, string>, context: TechStackContext): void {
    // TypeScript
    if (deps['typescript']) {
      context.detected_stack.push('typescript');
      context.patterns.push('TypeScript');
    }
    
    // Testing
    if (deps['jest'] || deps['vitest'] || deps['@testing-library/react']) {
      context.patterns.push('Testing Framework');
    }
    
    // CSS/Styling
    if (deps['tailwindcss']) context.patterns.push('Tailwind CSS');
    if (deps['styled-components']) context.patterns.push('CSS-in-JS');
    if (deps['@emotion/react']) context.patterns.push('Emotion CSS-in-JS');
    
    // Build tools
    if (deps['vite']) context.patterns.push('Vite');
    if (deps['webpack']) context.patterns.push('Webpack');
    if (deps['esbuild']) context.patterns.push('esbuild');
    if (deps['rollup']) context.patterns.push('Rollup');
    
    // State management
    if (deps['redux'] || deps['@reduxjs/toolkit']) context.patterns.push('Redux');
    if (deps['zustand']) context.patterns.push('Zustand');
    if (deps['mobx']) context.patterns.push('MobX');
    if (deps['jotai']) context.patterns.push('Jotai');
    if (deps['valtio']) context.patterns.push('Valtio');
  }
  
  protected async detectGit(rootPath: string): Promise<GitContext> {
    try {
      const git: SimpleGit = simpleGit(rootPath);
      const isRepo = await git.checkIsRepo();
      
      if (!isRepo) {
        return { type: 'none' };
      }
      
      const [branch, remotes, status, log] = await Promise.all([
        git.branchLocal(),
        git.getRemotes(true),
        git.status(),
        git.log({ maxCount: 1 })
      ]);
      
      return {
        type: 'repository',
        root: rootPath,
        branch: branch.current,
        remotes: remotes.map(r => ({ name: r.name, url: r.refs.fetch })),
        isClean: status.isClean(),
        lastCommit: log.latest ? {
          hash: log.latest.hash,
          message: log.latest.message,
          author: log.latest.author_name,
          date: new Date(log.latest.date)
        } : undefined
      };
    } catch {
      return { type: 'none' };
    }
  }
  
  protected async checkConfigFiles(rootPath: string, context: TechStackContext): Promise<void> {
    // Check for Next.js
    if (await this.fileExists(path.join(rootPath, 'next.config.js')) || 
        await this.fileExists(path.join(rootPath, 'next.config.mjs'))) {
      if (!context.frameworks.some(f => f.name === 'Next.js')) {
        context.frameworks.push({
          name: 'Next.js',
          confidence: 1.0,
          category: 'fullstack'
        });
      }
    }
    
    // Check for Remix
    if (await this.fileExists(path.join(rootPath, 'remix.config.js'))) {
      if (!context.frameworks.some(f => f.name === 'Remix')) {
        context.frameworks.push({
          name: 'Remix',
          confidence: 1.0,
          category: 'fullstack'
        });
      }
    }
    
    // Check for Docker
    if (await this.fileExists(path.join(rootPath, 'Dockerfile')) || 
        await this.fileExists(path.join(rootPath, 'docker-compose.yml'))) {
      context.deployment.push('Docker');
    }
    
    // Check for Vercel
    if (await this.fileExists(path.join(rootPath, 'vercel.json'))) {
      context.deployment.push('Vercel');
    }
    
    // Check for Netlify
    if (await this.fileExists(path.join(rootPath, 'netlify.toml'))) {
      context.deployment.push('Netlify');
    }
  }
  
  protected async detectFrameworkPatterns(rootPath: string, context: TechStackContext): Promise<void> {
    // Check for JSX/TSX files
    const jsxFiles = await glob('**/*.{jsx,tsx}', {
      cwd: rootPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**'],
      nodir: true,
      follow: false
    });
    
    if (jsxFiles.length > 0) {
      context.patterns.push('JSX/TSX Components');
    }
    
    // Check for API routes
    if (await this.fileExists(path.join(rootPath, 'pages/api')) || 
        await this.fileExists(path.join(rootPath, 'app/api'))) {
      context.patterns.push('API Routes');
    }
  }
  
  protected async detectConventions(rootPath: string): Promise<CodingConvention | undefined> {
    const convention: CodingConvention = {};
    
    // Check for ESLint
    const eslintConfigs = [
      '.eslintrc.js',
      '.eslintrc.json',
      '.eslintrc.yaml',
      'eslint.config.js'
    ];
    
    for (const configFile of eslintConfigs) {
      if (await this.fileExists(path.join(rootPath, configFile))) {
        convention.linter = 'eslint';
        break;
      }
    }
    
    // Check for Prettier
    const prettierConfigs = ['.prettierrc', '.prettierrc.json', 'prettier.config.js'];
    for (const configFile of prettierConfigs) {
      if (await this.fileExists(path.join(rootPath, configFile))) {
        convention.formatter = 'prettier';
        break;
      }
    }
    
    return Object.keys(convention).length > 0 ? convention : undefined;
  }
  
  protected async detectAIML(rootPath: string, context: TechStackContext): Promise<AIMLContext | undefined> {
    const aiContext: AIMLContext = {
      frameworks: [],
      providers: [],
      capabilities: [],
      vectorDatabases: []
    };
    
    // Check from frameworks already detected
    const aiFrameworks = context.frameworks.filter(f => f.category === 'ai-ml');
    aiContext.frameworks = aiFrameworks.map(f => f.name);
    
    // Check for vector databases
    const vectorDbs = context.databases.filter(db => 
      ['Pinecone', 'ChromaDB', 'Weaviate'].includes(db.type)
    );
    aiContext.vectorDatabases = vectorDbs.map(db => db.type);
    
    // Check .env for API keys
    const envPath = path.join(rootPath, '.env');
    if (await this.fileExists(envPath)) {
      const envContent = await this.readFile(envPath);
      if (envContent) {
        if (envContent.includes('OPENAI_API_KEY')) aiContext.providers.push('OpenAI');
        if (envContent.includes('ANTHROPIC_API_KEY')) aiContext.providers.push('Anthropic');
        if (envContent.includes('GOOGLE_AI_API_KEY')) aiContext.providers.push('Google AI');
        if (envContent.includes('HUGGINGFACE_API_KEY')) aiContext.providers.push('Hugging Face');
      }
    }
    
    return aiContext.frameworks.length > 0 || aiContext.providers.length > 0 
      ? aiContext 
      : undefined;
  }
  
  protected deduplicateContext(context: TechStackContext): void {
    context.detected_stack = [...new Set(context.detected_stack)];
    context.patterns = [...new Set(context.patterns)];
    context.authentication = [...new Set(context.authentication)];
    context.deployment = [...new Set(context.deployment)];
    
    // Deduplicate frameworks by name
    const seenFrameworks = new Map<string, FrameworkInfo>();
    for (const framework of context.frameworks) {
      const existing = seenFrameworks.get(framework.name);
      if (!existing || framework.confidence > existing.confidence) {
        seenFrameworks.set(framework.name, framework);
      }
    }
    context.frameworks = Array.from(seenFrameworks.values());
    
    // Deduplicate databases by type
    const seenDatabases = new Map<string, DatabaseConfig>();
    for (const db of context.databases) {
      if (!seenDatabases.has(db.type)) {
        seenDatabases.set(db.type, db);
      }
    }
    context.databases = Array.from(seenDatabases.values());
  }
}

// Parallel detector implementation
class ParallelDetector extends SequentialDetector {
  async detect(rootPath: string): Promise<TechStackContext> {
    const context = createBaseContext();
    const errors: Array<{ phase: string; error: Error }> = [];
    
    // Group independent operations
    const independentTasks = {
      packageJson: this.analyzePackageJson(rootPath, context),
      git: this.detectGit(rootPath),
      configFiles: this.checkConfigFiles(rootPath, context),
      conventions: this.detectConventions(rootPath)
    };
    
    // Execute in parallel with timeout
    const results = await Promise.allSettled(
      Object.entries(independentTasks).map(async ([key, task]) => ({
        key,
        result: await Promise.race([
          task,
          this.timeout(this.options.timeout || 5000, `${key} detection`)
        ])
      }))
    );
    
    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { key, result: value } = result.value;
        switch (key) {
          case 'git':
            context.git = value as GitContext;
            break;
          case 'conventions':
            context.conventions = value as CodingConvention | undefined;
            break;
        }
      } else {
        errors.push({
          phase: 'parallel',
          error: result.reason
        });
      }
    }
    
    // Dependent operations (need package.json results)
    const dependentTasks = [
      this.detectFrameworkPatterns(rootPath, context),
      this.detectAIML(rootPath, context)
    ];
    
    const dependentResults = await Promise.allSettled(dependentTasks);
    
    // Process AI/ML results
    if (dependentResults[1].status === 'fulfilled') {
      context.ai = dependentResults[1].value as AIMLContext | undefined;
    }
    
    if (errors.length > 0) {
      context.detectionErrors = errors;
    }
    
    // Deduplicate arrays
    this.deduplicateContext(context);
    
    return context;
  }
  
  private timeout(ms: number, operation: string): Promise<never> {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
    );
  }
}

// Export the detector API
export const contextDetector = {
  detect: detectTechStack,
  clearCache: (rootPath?: string) => contextCache.clear(rootPath)
};