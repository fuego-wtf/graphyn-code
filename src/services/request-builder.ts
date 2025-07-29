import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Interface for the ask endpoint request
 */
export interface AskRequest {
  user_message: string;
  repo_url?: string;
  repo_branch?: string;
  team_id?: string;
  organization_id?: string;
  context?: RequestContext;
}

/**
 * Context information about the repository
 */
export interface RequestContext {
  detected_stack?: string[];
  patterns?: string[];
  framework?: string;
  language?: string;
  dependencies?: Record<string, string>;
  structure?: {
    hasTests?: boolean;
    hasCI?: boolean;
    hasDocs?: boolean;
  };
}

/**
 * Repository information
 */
export interface RepositoryInfo {
  url?: string;
  branch?: string;
  isGitRepo: boolean;
}

/**
 * Detects Git repository information
 */
export async function detectRepository(rootPath: string = process.cwd()): Promise<RepositoryInfo> {
  try {
    // Check if it's a git repository
    await execAsync('git rev-parse --git-dir', { cwd: rootPath });
    
    // Get remote URL
    let url: string | undefined;
    try {
      const { stdout: remoteUrl } = await execAsync('git config --get remote.origin.url', { cwd: rootPath });
      url = remoteUrl.trim();
      
      // Convert SSH URLs to HTTPS
      if (url.startsWith('git@')) {
        url = url
          .replace('git@', 'https://')
          .replace('.com:', '.com/')
          .replace(/\.git$/, '');
      }
    } catch {
      // No remote configured
    }
    
    // Get current branch
    let branch: string | undefined;
    try {
      const { stdout: branchName } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: rootPath });
      branch = branchName.trim();
    } catch {
      branch = 'main';
    }
    
    return {
      url,
      branch,
      isGitRepo: true
    };
  } catch {
    return {
      isGitRepo: false
    };
  }
}

/**
 * Basic context detection - can be extended with more sophisticated analysis
 */
export async function detectBasicContext(rootPath: string = process.cwd()): Promise<RequestContext> {
  const context: RequestContext = {};
  
  try {
    // Check for package.json
    const packageJsonPath = path.join(rootPath, 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      // Detect dependencies
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      context.dependencies = allDeps;
      
      // Detect stack from dependencies
      const detectedStack: string[] = [];
      
      // Frameworks
      if (allDeps['next']) detectedStack.push(`next@${allDeps['next']}`);
      else if (allDeps['react']) detectedStack.push(`react@${allDeps['react']}`);
      else if (allDeps['vue']) detectedStack.push(`vue@${allDeps['vue']}`);
      else if (allDeps['@angular/core']) detectedStack.push(`angular@${allDeps['@angular/core']}`);
      else if (allDeps['svelte']) detectedStack.push(`svelte@${allDeps['svelte']}`);
      
      // Backend
      if (allDeps['express']) detectedStack.push('express');
      else if (allDeps['fastify']) detectedStack.push('fastify');
      else if (allDeps['@nestjs/core']) detectedStack.push('nestjs');
      
      // Database
      if (allDeps['prisma'] || allDeps['@prisma/client']) detectedStack.push('prisma');
      if (allDeps['mongoose']) detectedStack.push('mongodb');
      if (allDeps['pg']) detectedStack.push('postgresql');
      if (allDeps['mysql2']) detectedStack.push('mysql');
      
      // Auth
      if (allDeps['better-auth']) detectedStack.push('better-auth');
      else if (allDeps['next-auth']) detectedStack.push('next-auth');
      else if (allDeps['@auth0/nextjs-auth0']) detectedStack.push('auth0');
      
      context.detected_stack = detectedStack;
      
      // Detect language
      if (allDeps['typescript'] || allDeps['@types/node']) {
        context.language = 'typescript';
      } else {
        context.language = 'javascript';
      }
      
      // Detect main framework
      if (allDeps['next']) context.framework = 'next.js';
      else if (allDeps['react']) context.framework = 'react';
      else if (allDeps['vue']) context.framework = 'vue';
      else if (allDeps['@angular/core']) context.framework = 'angular';
      else if (allDeps['express']) context.framework = 'express';
      else if (allDeps['fastify']) context.framework = 'fastify';
    } catch {
      // No package.json or invalid JSON
    }
    
    // Detect patterns from folder structure
    const patterns: string[] = [];
    
    // Check for common patterns
    try {
      const entries = await fs.readdir(rootPath);
      
      // Feature folders pattern
      if (entries.includes('features') || entries.includes('modules')) {
        patterns.push('feature-folders');
      }
      
      // Monorepo
      if (entries.includes('packages') || entries.includes('apps')) {
        patterns.push('monorepo');
      }
      
      // Check for mock data
      const srcPath = path.join(rootPath, 'src');
      try {
        const srcEntries = await fs.readdir(srcPath);
        const hasMocks = srcEntries.some(entry => 
          entry.includes('mock') || entry.includes('fixture') || entry.includes('seed')
        );
        if (!hasMocks) patterns.push('no-mock-data');
      } catch {
        // No src directory
      }
      
      context.patterns = patterns;
      
      // Check structure
      context.structure = {
        hasTests: entries.some(e => e.includes('test') || e.includes('spec') || e === '__tests__'),
        hasCI: entries.includes('.github') || entries.includes('.gitlab-ci.yml'),
        hasDocs: entries.includes('docs') || entries.includes('documentation')
      };
    } catch {
      // Unable to read directory
    }
    
  } catch (error) {
    console.error('Error detecting context:', error);
  }
  
  return context;
}

/**
 * Advanced context detection using AI analysis
 */
export async function detectAdvancedContext(rootPath: string = process.cwd()): Promise<RequestContext> {
  // Start with basic detection
  const basicContext = await detectBasicContext(rootPath);
  
  // TODO: Add AI-powered analysis here
  // This could call an agent to analyze the codebase more deeply
  
  return basicContext;
}

/**
 * Context builder factory - allows for different context detection strategies
 */
export type ContextBuilder = (rootPath: string) => Promise<RequestContext>;

export const contextBuilders: Record<string, ContextBuilder> = {
  basic: detectBasicContext,
  advanced: detectAdvancedContext,
  minimal: async () => ({}), // No context
  custom: async (rootPath) => {
    // Custom context detection logic can be added here
    return detectBasicContext(rootPath);
  }
};

/**
 * Main request builder
 */
export class AskRequestBuilder {
  private request: Partial<AskRequest> = {};
  
  /**
   * Set the user message
   */
  withMessage(message: string): this {
    this.request.user_message = message;
    return this;
  }
  
  /**
   * Set repository information
   */
  withRepository(info: RepositoryInfo): this {
    if (info.url) this.request.repo_url = info.url;
    if (info.branch) this.request.repo_branch = info.branch;
    return this;
  }
  
  /**
   * Set team ID
   */
  withTeamId(teamId: string): this {
    this.request.team_id = teamId;
    return this;
  }
  
  /**
   * Set organization ID
   */
  withOrganizationId(orgId: string): this {
    this.request.organization_id = orgId;
    return this;
  }
  
  /**
   * Set context
   */
  withContext(context: RequestContext): this {
    this.request.context = context;
    return this;
  }
  
  /**
   * Build the final request
   */
  build(): AskRequest {
    if (!this.request.user_message) {
      throw new Error('User message is required');
    }
    
    return this.request as AskRequest;
  }
}

/**
 * Convenience function to build a request with automatic detection
 */
export async function buildAskRequest(
  userMessage: string,
  options: {
    rootPath?: string;
    contextMode?: keyof typeof contextBuilders;
    teamId?: string;
    organizationId?: string;
  } = {}
): Promise<AskRequest> {
  const rootPath = options.rootPath || process.cwd();
  const contextMode = options.contextMode || 'basic';
  
  // Detect repository info
  const repoInfo = await detectRepository(rootPath);
  
  // Build context using selected mode
  const contextBuilder = contextBuilders[contextMode];
  const context = await contextBuilder(rootPath);
  
  // Build the request
  const builder = new AskRequestBuilder()
    .withMessage(userMessage)
    .withRepository(repoInfo)
    .withContext(context);
  
  if (options.teamId) {
    builder.withTeamId(options.teamId);
  }
  
  if (options.organizationId) {
    builder.withOrganizationId(options.organizationId);
  }
  
  return builder.build();
}