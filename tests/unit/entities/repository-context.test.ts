/**
 * T010: RepositoryContext entity tests
 * These tests MUST fail initially since no implementation exists
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RepositoryContext } from '../../../src/cli/enhanced-ux/entities/repository-context.js';
import type { RepositoryFingerprint, AgentType } from '../../../src/cli/enhanced-ux/types.js';

describe('RepositoryContext Entity Tests', () => {
  let repositoryContext: RepositoryContext;
  let mockFingerprint: RepositoryFingerprint;

  beforeEach(() => {
    mockFingerprint = {
      techStack: {
        languages: ['typescript', 'javascript'],
        frameworks: ['react', 'next'],
        dependencies: [{ name: 'react', version: '^18.0.0', type: 'dependency' }],
        buildTools: ['webpack', 'vite'],
        testFrameworks: ['vitest', 'jest']
      },
      architecture: [{ name: 'MVC', description: 'Model-View-Controller', confidence: 0.8 }],
      scale: { fileCount: 150, lineCount: 5000, complexity: 'medium' },
      conventions: {
        indentStyle: 'spaces',
        indentSize: 2,
        lineEndings: 'lf',
        trailingComma: true,
        semicolons: true
      },
      documentation: {
        hasReadme: true,
        hasApiDocs: false,
        hasTypeDefinitions: true,
        documentationCoverage: 0.7
      }
    };

    repositoryContext = new RepositoryContext('/test/project', mockFingerprint);
  });

  describe('Constructor and Initialization', () => {
    it('should create repository context with required fields', () => {
      expect(repositoryContext).toBeDefined();
      expect(repositoryContext.id).toBeTruthy();
      expect(repositoryContext.workingDirectory).toBe('/test/project');
      expect(repositoryContext.fingerprint).toEqual(mockFingerprint);
      expect(repositoryContext.lastAnalyzed).toBeInstanceOf(Date);
      expect(repositoryContext.cached).toBe(false);
    });

    it('should generate unique IDs', () => {
      const context1 = new RepositoryContext('/test/1', mockFingerprint);
      const context2 = new RepositoryContext('/test/2', mockFingerprint);
      expect(context1.id).not.toBe(context2.id);
    });

    it('should initialize with empty agent prompts map', () => {
      expect(repositoryContext.agentPrompts).toBeInstanceOf(Map);
      expect(repositoryContext.agentPrompts.size).toBe(0);
    });
  });

  describe('Agent Prompts Management', () => {
    it('should set agent prompt', () => {
      const prompt = 'You are a React expert working on a TypeScript project...';
      repositoryContext.setAgentPrompt('frontend', prompt);
      
      expect(repositoryContext.agentPrompts.get('frontend')).toBe(prompt);
    });

    it('should update agent prompt', () => {
      const prompt1 = 'Original prompt';
      const prompt2 = 'Updated prompt';
      
      repositoryContext.setAgentPrompt('backend', prompt1);
      repositoryContext.setAgentPrompt('backend', prompt2);
      
      expect(repositoryContext.agentPrompts.get('backend')).toBe(prompt2);
    });

    it('should get all agent types with prompts', () => {
      repositoryContext.setAgentPrompt('frontend', 'Frontend prompt');
      repositoryContext.setAgentPrompt('backend', 'Backend prompt');
      
      const agentTypes = repositoryContext.getAgentTypes();
      expect(agentTypes).toContain('frontend');
      expect(agentTypes).toContain('backend');
      expect(agentTypes).toHaveLength(2);
    });

    it('should clear all agent prompts', () => {
      repositoryContext.setAgentPrompt('frontend', 'Test');
      repositoryContext.setAgentPrompt('backend', 'Test');
      
      repositoryContext.clearAgentPrompts();
      expect(repositoryContext.agentPrompts.size).toBe(0);
    });
  });

  describe('Fingerprint Analysis', () => {
    it('should detect primary language', () => {
      const primaryLang = repositoryContext.getPrimaryLanguage();
      expect(primaryLang).toBe('typescript'); // First in list
    });

    it('should detect if project uses framework', () => {
      expect(repositoryContext.usesFramework('react')).toBe(true);
      expect(repositoryContext.usesFramework('vue')).toBe(false);
    });

    it('should get project complexity level', () => {
      expect(repositoryContext.getComplexity()).toBe('medium');
    });

    it('should check documentation completeness', () => {
      expect(repositoryContext.hasDocumentation()).toBe(true);
      expect(repositoryContext.getDocumentationCoverage()).toBe(0.7);
    });

    it('should identify build tools', () => {
      const buildTools = repositoryContext.getBuildTools();
      expect(buildTools).toContain('webpack');
      expect(buildTools).toContain('vite');
    });
  });

  describe('Context Updates', () => {
    it('should update fingerprint and reset analysis timestamp', () => {
      const initialTime = repositoryContext.lastAnalyzed.getTime();
      const newFingerprint = { ...mockFingerprint };
      newFingerprint.scale.complexity = 'large';
      
      setTimeout(() => {
        repositoryContext.updateFingerprint(newFingerprint);
        expect(repositoryContext.fingerprint.scale.complexity).toBe('large');
        expect(repositoryContext.lastAnalyzed.getTime()).toBeGreaterThan(initialTime);
      }, 10);
    });

    it('should mark context as cached', () => {
      repositoryContext.markAsCached();
      expect(repositoryContext.cached).toBe(true);
    });

    it('should invalidate cache', () => {
      repositoryContext.markAsCached();
      repositoryContext.invalidateCache();
      expect(repositoryContext.cached).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate complete context', () => {
      expect(repositoryContext.validate()).toBe(true);
    });

    it('should detect invalid working directory', () => {
      const invalidContext = new RepositoryContext('', mockFingerprint);
      expect(invalidContext.validate()).toBe(false);
    });

    it('should detect incomplete fingerprint', () => {
      const incompleteFingerprint = { ...mockFingerprint };
      delete (incompleteFingerprint as any).techStack;
      
      const invalidContext = new RepositoryContext('/test', incompleteFingerprint);
      expect(invalidContext.validate()).toBe(false);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      repositoryContext.setAgentPrompt('frontend', 'Test prompt');
      const json = repositoryContext.toJSON();
      
      expect(json).toContain('/test/project');
      expect(json).toContain('typescript');
    });

    it('should deserialize from JSON', () => {
      repositoryContext.setAgentPrompt('backend', 'Backend prompt');
      const json = repositoryContext.toJSON();
      const deserialized = RepositoryContext.fromJSON(json);
      
      expect(deserialized.workingDirectory).toBe(repositoryContext.workingDirectory);
      expect(deserialized.agentPrompts.get('backend')).toBe('Backend prompt');
    });
  });
});