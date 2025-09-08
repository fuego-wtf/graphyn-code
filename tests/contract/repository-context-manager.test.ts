/**
 * Contract Tests for RepositoryContextManager
 * 
 * These tests define the interface contract for repository-aware agent prompts.
 * They MUST FAIL initially before implementation (TDD Red phase).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { 
  RepositoryInfo,
  ContextAnalysisResult,
  EnhancedUXConfig
} from '../../src/cli/enhanced-ux/types.js';

// This import WILL FAIL initially - that's the point of TDD
import { RepositoryContextManager } from '../../src/cli/enhanced-ux/services/repository-context-manager.js';

describe('RepositoryContextManager Contract', () => {
  let contextManager: RepositoryContextManager;
  const mockConfig: EnhancedUXConfig = {
    performance: {
      maxRenderTime: 16,
      maxAnalysisTime: 3000,
      maxInputResponseTime: 50,
      maxMemoryUsage: 150 * 1024 * 1024
    },
    layout: {
      streamingRatio: 0.7,
      approvalRatio: 0.2,
      inputRatio: 0.1
    },
    features: {
      enableExitProtection: true,
      enableContextCaching: true,
      enablePerformanceMonitoring: true
    }
  };
  
  beforeEach(() => {
    // This WILL FAIL until RepositoryContextManager is implemented
    contextManager = new RepositoryContextManager(mockConfig);
  });

  describe('Repository Analysis', () => {
    it('should analyze repository context within 3 seconds', async () => {
      const testRepoPath = '/test/repository';
      const startTime = performance.now();
      
      const result = await contextManager.analyzeRepository(testRepoPath);
      const analysisTime = performance.now() - startTime;
      
      expect(analysisTime).toBeLessThan(3000);
      expect(result).toHaveProperty('repository');
      expect(result).toHaveProperty('agentPrompts');
      expect(result).toHaveProperty('analysisTime');
      expect(result).toHaveProperty('cacheKey');
    });

    it('should detect tech stack from package.json', async () => {
      const mockRepoPath = '/test/node-repo';
      vi.mock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue(JSON.stringify({
          name: 'test-repo',
          dependencies: {
            react: '^18.0.0',
            typescript: '^5.0.0',
            '@types/node': '^20.0.0'
          },
          devDependencies: {
            vitest: '^1.0.0'
          }
        }))
      }));

      const result = await contextManager.analyzeRepository(mockRepoPath);
      
      expect(result.repository.techStack).toContain('typescript');
      expect(result.repository.frameworks).toContain('react');
      expect(result.repository.packageManagers).toContain('npm');
    });

    it('should detect tech stack from Cargo.toml', async () => {
      const mockRepoPath = '/test/rust-repo';
      vi.mock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue(`
[package]
name = "test-rust-app"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = "1.0"
serde = "1.0"
        `)
      }));

      const result = await contextManager.analyzeRepository(mockRepoPath);
      
      expect(result.repository.techStack).toContain('rust');
      expect(result.repository.packageManagers).toContain('cargo');
    });

    it('should analyze directory structure patterns', async () => {
      const mockRepoPath = '/test/fullstack-repo';
      const result = await contextManager.analyzeRepository(mockRepoPath);
      
      // Should detect project scale based on directory structure
      expect(result.repository.scale).toMatch(/small|medium|large/);
      expect(result.repository.complexity).toMatch(/simple|moderate|complex/);
    });

    it('should handle repository analysis failures gracefully', async () => {
      const invalidRepoPath = '/nonexistent/path';
      
      await expect(contextManager.analyzeRepository(invalidRepoPath)).rejects.toThrow();
      
      // Should provide fallback context
      const fallbackResult = contextManager.getFallbackContext(invalidRepoPath);
      expect(fallbackResult).toHaveProperty('repository');
      expect(fallbackResult.repository.path).toBe(invalidRepoPath);
    });
  });

  describe('Agent Prompt Generation', () => {
    it('should generate context-specific agent prompts', async () => {
      const mockRepoInfo: RepositoryInfo = {
        path: '/test/repo',
        name: 'test-app',
        techStack: ['typescript', 'react'],
        packageManagers: ['npm'],
        frameworks: ['next.js'],
        scale: 'medium',
        complexity: 'moderate'
      };

      const prompts = await contextManager.generateAgentPrompts(mockRepoInfo);
      
      expect(prompts).toHaveProperty('backend');
      expect(prompts).toHaveProperty('frontend');
      expect(prompts).toHaveProperty('architect');
      
      // Prompts should be context-aware
      expect(prompts.frontend).toContain('react');
      expect(prompts.frontend).toContain('typescript');
      expect(prompts.backend).toContain('typescript');
    });

    it('should customize prompts based on project complexity', async () => {
      const simpleRepo: RepositoryInfo = {
        path: '/test/simple',
        name: 'simple-app',
        techStack: ['javascript'],
        packageManagers: ['npm'],
        frameworks: [],
        scale: 'small',
        complexity: 'simple'
      };

      const complexRepo: RepositoryInfo = {
        path: '/test/complex',
        name: 'enterprise-app',
        techStack: ['typescript', 'rust', 'python'],
        packageManagers: ['npm', 'cargo', 'pip'],
        frameworks: ['next.js', 'fastapi', 'tokio'],
        scale: 'large',
        complexity: 'complex'
      };

      const simplePrompts = await contextManager.generateAgentPrompts(simpleRepo);
      const complexPrompts = await contextManager.generateAgentPrompts(complexRepo);
      
      // Complex projects should have more detailed prompts
      expect(complexPrompts.architect.length).toBeGreaterThan(simplePrompts.architect.length);
      expect(complexPrompts.backend).toContain('microservices');
      expect(simplePrompts.backend).not.toContain('microservices');
    });

    it('should include project-specific conventions', async () => {
      const repoWithConventions: RepositoryInfo = {
        path: '/test/conventions',
        name: 'convention-app',
        techStack: ['typescript'],
        packageManagers: ['pnpm'],
        frameworks: ['next.js'],
        scale: 'medium',
        complexity: 'moderate'
      };

      const prompts = await contextManager.generateAgentPrompts(repoWithConventions);
      
      // Should include pnpm-specific instructions
      expect(prompts.backend).toContain('pnpm');
      expect(prompts.frontend).toContain('pnpm');
    });
  });

  describe('Context Caching', () => {
    it('should cache analysis results for performance', async () => {
      const testPath = '/test/cached-repo';
      
      // First analysis
      const startTime1 = performance.now();
      const result1 = await contextManager.analyzeRepository(testPath);
      const time1 = performance.now() - startTime1;
      
      // Second analysis should be much faster (cached)
      const startTime2 = performance.now();
      const result2 = await contextManager.analyzeRepository(testPath);
      const time2 = performance.now() - startTime2;
      
      expect(time2).toBeLessThan(time1 / 2); // At least 50% faster
      expect(result1.cacheKey).toBe(result2.cacheKey);
    });

    it('should invalidate cache when repository changes', async () => {
      const testPath = '/test/changing-repo';
      
      const result1 = await contextManager.analyzeRepository(testPath);
      
      // Simulate repository change
      await contextManager.invalidateCache(testPath);
      
      const result2 = await contextManager.analyzeRepository(testPath);
      
      expect(result1.cacheKey).not.toBe(result2.cacheKey);
    });

    it('should respect cache TTL settings', async () => {
      const testPath = '/test/ttl-repo';
      
      // Set short TTL for testing
      contextManager.setCacheTTL(100); // 100ms
      
      const result1 = await contextManager.analyzeRepository(testPath);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const result2 = await contextManager.analyzeRepository(testPath);
      
      // Should be different analysis due to expired cache
      expect(result1.timestamp).not.toBe(result2.timestamp);
    });
  });

  describe('Directory Change Detection', () => {
    it('should detect directory changes automatically', async () => {
      const testPath = '/test/watched-repo';
      
      const changePromise = new Promise<string>((resolve) => {
        contextManager.on('directory_change', resolve);
      });
      
      // Start watching
      await contextManager.watchDirectory(testPath);
      
      // Simulate directory change
      contextManager.simulateDirectoryChange(testPath);
      
      const changedPath = await changePromise;
      expect(changedPath).toBe(testPath);
    });

    it('should debounce rapid file changes', async () => {
      const testPath = '/test/rapid-changes';
      let changeCount = 0;
      
      contextManager.on('directory_change', () => {
        changeCount++;
      });
      
      await contextManager.watchDirectory(testPath);
      
      // Simulate rapid changes
      for (let i = 0; i < 10; i++) {
        contextManager.simulateDirectoryChange(testPath);
      }
      
      // Wait for debounce period
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should only trigger once due to debouncing
      expect(changeCount).toBe(1);
    });

    it('should stop watching when requested', async () => {
      const testPath = '/test/unwatched-repo';
      
      await contextManager.watchDirectory(testPath);
      expect(contextManager.isWatching(testPath)).toBe(true);
      
      await contextManager.stopWatching(testPath);
      expect(contextManager.isWatching(testPath)).toBe(false);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track analysis performance metrics', async () => {
      const testPath = '/test/perf-repo';
      
      await contextManager.analyzeRepository(testPath);
      
      const metrics = contextManager.getPerformanceMetrics();
      expect(metrics).toHaveProperty('analysisTime');
      expect(metrics.analysisTime).toBeTypeOf('number');
      expect(metrics.analysisTime).toBeGreaterThan(0);
    });

    it('should warn when analysis exceeds 3 second target', async () => {
      const slowRepoPath = '/test/slow-repo';
      
      const warningPromise = new Promise<string>((resolve) => {
        contextManager.on('performance_warning', resolve);
      });
      
      // Simulate slow analysis
      await contextManager.simulateSlowAnalysis(slowRepoPath, 4000); // 4 seconds
      
      const warning = await warningPromise;
      expect(warning).toContain('analysis time');
    });

    it('should provide memory usage metrics', () => {
      const metrics = contextManager.getPerformanceMetrics();
      
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics.memoryUsage).toBeTypeOf('number');
      expect(metrics.memoryUsage).toBeLessThan(150 * 1024 * 1024); // 150MB target
    });
  });

  describe('Error Handling', () => {
    it('should handle permission denied errors', async () => {
      const restrictedPath = '/root/restricted';
      
      await expect(contextManager.analyzeRepository(restrictedPath)).rejects.toThrow('Permission denied');
    });

    it('should handle corrupted configuration files', async () => {
      const corruptedRepoPath = '/test/corrupted-repo';
      
      // Mock corrupted package.json
      vi.mock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue('invalid json content')
      }));
      
      const result = await contextManager.analyzeRepository(corruptedRepoPath);
      
      // Should still provide basic repository info
      expect(result.repository.path).toBe(corruptedRepoPath);
      expect(result.repository.techStack).toEqual([]);
    });

    it('should recover from file system errors', async () => {
      const errorRepoPath = '/test/fs-error-repo';
      
      // Simulate file system error, then recovery
      await expect(contextManager.analyzeRepository(errorRepoPath)).rejects.toThrow();
      
      // Should work after error
      const result = await contextManager.analyzeRepository('/test/valid-repo');
      expect(result).toHaveProperty('repository');
    });
  });
});