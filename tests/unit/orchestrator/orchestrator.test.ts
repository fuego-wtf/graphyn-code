/**
 * Method-level tests for AgentOrchestrator
 * Tests core orchestration logic without external dependencies
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentOrchestrator } from '../../../src/orchestrator/AgentOrchestrator.js';
import path from 'path';
import fs from 'fs/promises';

describe('AgentOrchestrator - Method-Level Tests', () => {
  let orchestrator: AgentOrchestrator;
  let mockAgentsPath: string;

  beforeEach(async () => {
    // Create a temporary directory for mock agents
    mockAgentsPath = path.join(process.cwd(), 'test-agents');
    try {
      await fs.mkdir(mockAgentsPath, { recursive: true });
      
      // Create mock agent files
      await fs.writeFile(
        path.join(mockAgentsPath, 'backend-developer.md'),
        `# Backend Developer Agent

## Role: Backend development specialist

## Core Responsibilities
- API development and integration
- Database design and optimization
- Server architecture planning
- Performance optimization

## Specialized Knowledge Areas
- REST and GraphQL APIs
- Database management systems
- Server deployment and scaling
- Authentication and security

## Keywords
backend, api, database, server, express, node, typescript
`
      );

      await fs.writeFile(
        path.join(mockAgentsPath, 'frontend-developer.md'),
        `# Frontend Developer Agent

## Role: Frontend development specialist

## Core Responsibilities
- UI/UX development and design
- Component architecture planning
- State management implementation
- User experience optimization

## Specialized Knowledge Areas
- React and modern frameworks
- CSS and responsive design
- State management (Redux, Zustand)
- Browser performance optimization

## Keywords
frontend, ui, ux, react, component, interface, design
`
      );

    } catch (error) {
      // Directory might already exist, continue
    }

    orchestrator = new AgentOrchestrator(mockAgentsPath);
    await orchestrator.initialize();
  });

  afterEach(async () => {
    // Cleanup
    AgentOrchestrator.resetInstance();
    try {
      await fs.rm(mockAgentsPath, { recursive: true, force: true });
    } catch (error) {
      // Cleanup might fail, that's ok
    }
  });

  describe('analyzeTask', () => {
    it('should route backend queries to backend agent', async () => {
      const query = 'Create a REST API endpoint for user authentication';
      const result = await orchestrator.analyzeTask(query);

      expect(result.primaryAgent).toBe('backend-developer');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.reasoning).toBeDefined();
    });

    it('should route frontend queries to frontend agent', async () => {
      const query = 'Build a login form component with validation';
      const result = await orchestrator.analyzeTask(query);

      expect(result.primaryAgent).toBe('frontend-developer');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.reasoning).toBeDefined();
    });

    it('should handle mixed queries with supporting agents', async () => {
      const query = 'Create a full-stack user authentication system with login form';
      const result = await orchestrator.analyzeTask(query);

      expect(result.primaryAgent).toBeDefined();
      expect(result.supportingAgents).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle empty queries gracefully', async () => {
      const query = '';
      const result = await orchestrator.analyzeTask(query);

      expect(result.primaryAgent).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle simple greetings efficiently', async () => {
      const query = 'hi there';
      const result = await orchestrator.analyzeTask(query);

      expect(result.primaryAgent).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      // Should use fast routing for simple greetings
    });

    it('should provide repository context awareness', async () => {
      const query = 'fix the build errors';
      const repositoryContext = {
        packageJson: { name: 'test-project' },
        hasTypeScript: true,
        hasTests: false
      };

      const result = await orchestrator.analyzeTask(query, repositoryContext);

      expect(result.primaryAgent).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('getEmergencyResponse', () => {
    it('should return simple error message for SDK unavailability', () => {
      // Access private method through type assertion for testing
      const response = (orchestrator as any).getEmergencyResponse(
        'backend-developer',
        'create an API',
        null
      );

      expect(response).toContain('Claude Code SDK unavailable');
      expect(response).toContain('create an API');
      expect(response).toContain('Emergency mode active');
      expect(response).toContain("graphyn doctor");
    });

    it('should include query in emergency response', () => {
      const testQuery = 'build a complex system';
      const response = (orchestrator as any).getEmergencyResponse(
        'architect-agent',
        testQuery,
        null
      );

      expect(response).toContain(testQuery);
      expect(response).toContain('Emergency mode active');
    });

    it('should handle different agent names', () => {
      const response = (orchestrator as any).getEmergencyResponse(
        'frontend-developer',
        'test query',
        null
      );

      expect(response).toContain('Claude Code SDK unavailable');
      expect(response).toContain('test query');
    });

    it('should be lightweight and fast', () => {
      const start = Date.now();
      const response = (orchestrator as any).getEmergencyResponse(
        'backend-developer',
        'performance test',
        null
      );
      const duration = Date.now() - start;

      expect(response).toBeDefined();
      expect(duration).toBeLessThan(10); // Should be nearly instantaneous
    });
  });

  describe('executeQuery', () => {
    it('should return structured result for simple query', async () => {
      const query = 'hello';
      const result = await orchestrator.executeQuery(query);

      expect(result.success).toBeDefined();
      expect(result.primaryResponse).toBeDefined();
      expect(result.agentsUsed).toBeInstanceOf(Array);
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('should handle complex queries with options', async () => {
      const query = 'build a full application';
      const options = { maxAgents: 2, requireApproval: false };
      
      const result = await orchestrator.executeQuery(query, null, options);

      expect(result.success).toBeDefined();
      expect(result.primaryResponse).toBeDefined();
      expect(result.agentsUsed.length).toBeGreaterThan(0);
    });

    it('should provide error handling for failed executions', async () => {
      const query = 'test error handling';
      const result = await orchestrator.executeQuery(query);

      // In emergency mode, should always return some response
      expect(result.primaryResponse).toBeDefined();
      expect(result.agentsUsed).toBeInstanceOf(Array);
    });

    it('should track execution duration', async () => {
      const query = 'performance test';
      const start = Date.now();
      const result = await orchestrator.executeQuery(query);
      const actualDuration = Date.now() - start;

      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
      expect(result.totalDuration).toBeLessThanOrEqual(actualDuration + 100); // Some tolerance
    });

    it('should handle repository context in execution', async () => {
      const query = 'analyze this project';
      const repositoryContext = {
        packageJson: { name: 'test-project', version: '1.0.0' },
        hasTypeScript: true,
        hasTests: true
      };

      const result = await orchestrator.executeQuery(query, repositoryContext);

      expect(result.primaryResponse).toBeDefined();
      expect(result.agentsUsed.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailableAgents', () => {
    it('should return array of agent names', () => {
      const agents = orchestrator.getAvailableAgents();

      expect(agents).toBeInstanceOf(Array);
      expect(agents.length).toBeGreaterThan(0);
      expect(agents).toContain('backend-developer');
      expect(agents).toContain('frontend-developer');
    });

    it('should return consistent results', () => {
      const agents1 = orchestrator.getAvailableAgents();
      const agents2 = orchestrator.getAvailableAgents();

      expect(agents1).toEqual(agents2);
    });
  });

  describe('getAgentConfig', () => {
    it('should return valid config for existing agent', () => {
      const config = orchestrator.getAgentConfig('backend-developer');

      expect(config).toBeDefined();
      expect(config?.name).toBe('backend-developer');
      expect(config?.role).toBeDefined();
      expect(config?.responsibilities).toBeInstanceOf(Array);
      expect(config?.keywords).toBeInstanceOf(Array);
      expect(config?.priority).toBeTypeOf('number');
    });

    it('should return undefined for non-existent agent', () => {
      const config = orchestrator.getAgentConfig('nonexistent-agent');

      expect(config).toBeUndefined();
    });

    it('should have proper config structure', () => {
      const config = orchestrator.getAgentConfig('frontend-developer');

      expect(config).toBeDefined();
      expect(config?.responsibilities.length).toBeGreaterThan(0);
      expect(config?.keywords.length).toBeGreaterThan(0);
      expect(config?.specializedKnowledge).toBeDefined();
    });
  });

  describe('performKeywordAnalysis', () => {
    it('should analyze backend keywords correctly', () => {
      const analysis = (orchestrator as any).performKeywordAnalysis('create REST API with database');

      expect(analysis.primaryAgent).toBe('backend-developer');
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.reasoning).toContain('backend');
    });

    it('should analyze frontend keywords correctly', () => {
      const analysis = (orchestrator as any).performKeywordAnalysis('build responsive UI component');

      expect(analysis.primaryAgent).toBe('frontend-developer');
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.reasoning).toContain('frontend');
    });

    it('should handle mixed keywords with confidence scoring', () => {
      const analysis = (orchestrator as any).performKeywordAnalysis('create API endpoint with React interface');

      expect(analysis.primaryAgent).toBeDefined();
      expect(analysis.supportingAgents).toBeInstanceOf(Array);
      expect(analysis.confidence).toBeGreaterThan(0);
    });

    it('should filter stop words effectively', () => {
      const analysis = (orchestrator as any).performKeywordAnalysis('the quick brown fox and the database');

      expect(analysis.reasoning).not.toContain('the');
      expect(analysis.reasoning).not.toContain('and');
      expect(analysis.confidence).toBeGreaterThan(0);
    });
  });

  describe('Integration - Method Chaining', () => {
    it('should chain analyzeTask -> executeQuery seamlessly', async () => {
      const query = 'build a login system';
      
      // First analyze the task
      const analysis = await orchestrator.analyzeTask(query);
      expect(analysis.primaryAgent).toBeDefined();
      
      // Then execute based on analysis
      const result = await orchestrator.executeQuery(query);
      expect(result.primaryResponse).toBeDefined();
      expect(result.agentsUsed.length).toBeGreaterThan(0);
    });

    it('should handle concurrent method calls', async () => {
      const query1 = 'create API';
      const query2 = 'build UI';
      
      const [result1, result2] = await Promise.all([
        orchestrator.executeQuery(query1),
        orchestrator.executeQuery(query2)
      ]);

      expect(result1.primaryResponse).toBeDefined();
      expect(result2.primaryResponse).toBeDefined();
      expect(result1.agentsUsed).toBeInstanceOf(Array);
      expect(result2.agentsUsed).toBeInstanceOf(Array);
    });
  });

  describe('Performance Requirements', () => {
    it('should complete method calls within performance targets', async () => {
      const query = 'quick test';
      
      // Emergency response should be very fast
      const emergencyStart = Date.now();
      const emergencyResponse = (orchestrator as any).getEmergencyResponse('test-agent', query);
      const emergencyDuration = Date.now() - emergencyStart;
      expect(emergencyDuration).toBeLessThan(10);
      expect(emergencyResponse).toBeDefined();

      // Task analysis should be reasonably fast
      const analysisStart = Date.now();
      const analysis = await orchestrator.analyzeTask(query);
      const analysisDuration = Date.now() - analysisStart;
      expect(analysisDuration).toBeLessThan(500);
      expect(analysis.primaryAgent).toBeDefined();
    });

    it('should handle multiple queries efficiently', async () => {
      const queries = ['test1', 'test2', 'test3', 'test4', 'test5'];
      
      const start = Date.now();
      const results = await Promise.all(
        queries.map(query => orchestrator.analyzeTask(query))
      );
      const duration = Date.now() - start;

      expect(results.length).toBe(5);
      expect(duration).toBeLessThan(2000); // Should handle 5 queries in under 2s
      results.forEach(result => {
        expect(result.primaryAgent).toBeDefined();
      });
    });
  });
});