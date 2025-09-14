import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UltimateOrchestrator } from '../../src/orchestrator/UltimateOrchestrator.js';
import { AgentSessionManager } from '../../src/orchestrator/AgentSessionManager.js';
import { UniversalTaskDecomposer } from '../../src/orchestrator/UniversalTaskDecomposer.js';
import path from 'path';
import fs from 'fs/promises';

describe('Agent Orchestration - Integration Tests', () => {
  let orchestrator: UltimateOrchestrator;
  let mockAgentsPath: string;

  beforeEach(async () => {
    mockAgentsPath = path.join(process.cwd(), 'test-agents');
    try {
      await fs.mkdir(mockAgentsPath, { recursive: true });
      
      await fs.writeFile(
        path.join(mockAgentsPath, 'backend-developer.md'),
        `# Backend Developer Agent\n\n## Role: Backend development specialist\n\n## Core Responsibilities\n- API development and integration\n- Database design and optimization\n- Server architecture planning\n- Performance optimization\n\n## Keywords\nbackend, api, database, server, express, node, typescript`
      );

      await fs.writeFile(
        path.join(mockAgentsPath, 'frontend-developer.md'),
        `# Frontend Developer Agent\n\n## Role: Frontend development specialist\n\n## Core Responsibilities\n- UI/UX development\n- Component architecture\n- State management\n- Performance optimization\n\n## Keywords\nfrontend, ui, ux, react, component, interface`
      );

    } catch (error) {
      // Directory might already exist
    }

    orchestrator = new UltimateOrchestrator({
      maxParallelAgents: 8,
      taskTimeoutMs: 30000,
      memoryLimitMb: 150,
      enableGitWorktrees: false,
      enablePerformanceMonitoring: true,
      workingDirectory: mockAgentsPath
    });
  });

  afterEach(async () => {
    await orchestrator.emergencyStop();
    try {
      await fs.rm(mockAgentsPath, { recursive: true, force: true });
    } catch (error) {
      // Cleanup might fail
    }
  });

  describe('End-to-End Task Processing', () => {
    it('should process full-stack tasks with multiple agents', async () => {
      const query = 'build a user authentication system with login form';
      const result = await orchestrator.orchestrateQuery(query);

      expect(result.success).toBeTruthy();
      expect(result.agentsUsed).toBeGreaterThan(1);
      expect(result.tasksCompleted).toBeGreaterThan(1);
      expect(result.performanceMetrics.parallelEfficiency).toBeGreaterThan(0.8);
    }, 60000);

    it('should handle database-focused tasks appropriately', async () => {
      const query = 'create a PostgreSQL database schema for user profiles';
      const result = await orchestrator.orchestrateQuery(query);

      expect(result.success).toBeTruthy();
      expect(result.agentsUsed).toBe(1);
      expect(result.performanceMetrics.targetTimeAchieved).toBeTruthy();
    });

    it('should handle UI-focused tasks appropriately', async () => {
      const query = 'create a responsive navigation component';
      const result = await orchestrator.orchestrateQuery(query);

      expect(result.success).toBeTruthy();
      expect(result.agentsUsed).toBe(1);
      expect(result.performanceMetrics.targetTimeAchieved).toBeTruthy();
    });

    it('should handle cross-cutting concerns with multiple agents', async () => {
      const query = 'implement secure file upload with preview';
      const result = await orchestrator.orchestrateQuery(query);

      expect(result.success).toBeTruthy();
      expect(result.agentsUsed).toBeGreaterThan(1);
      expect(result.performanceMetrics.targetTimeAchieved).toBeTruthy();
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance with multiple concurrent tasks', async () => {
      const queries = [
        'create API endpoint',
        'build login form',
        'implement database schema'
      ];

      const start = Date.now();
      const results = await Promise.all(
        queries.map(query => orchestrator.orchestrateQuery(query))
      );
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(90000);
      results.forEach(result => {
        expect(result.success).toBeTruthy();
        expect(result.performanceMetrics.memoryPeakMb).toBeLessThan(150);
      });
    }, 120000);

    it('should handle rapid sequential requests efficiently', async () => {
      const query = 'quick task';
      const iterations = 5;
      const results = [];

      for (let i = 0; i < iterations; i++) {
        const result = await orchestrator.orchestrateQuery(query);
        results.push(result);
      }

      results.forEach(result => {
        expect(result.success).toBeTruthy();
        expect(result.totalTimeSeconds).toBeLessThan(30);
      });
    });

    it('should maintain memory limits under sustained load', async () => {
      const complexQueries = [
        'build GraphQL API',
        'implement real-time chat',
        'create data visualization dashboard'
      ];

      const results = await Promise.all(
        complexQueries.map(query => orchestrator.orchestrateQuery(query))
      );

      results.forEach(result => {
        expect(result.performanceMetrics.memoryPeakMb).toBeLessThan(150);
        expect(result.success).toBeTruthy();
      });
    });
  });

  describe('Error Recovery', () => {
    it('should recover from agent failures', async () => {
      const invalidAgentPath = path.join(mockAgentsPath, 'invalid-agent.md');
      await fs.writeFile(invalidAgentPath, 'Invalid agent config');

      const query = 'test task';
      const result = await orchestrator.orchestrateQuery(query);

      expect(result.success).toBeTruthy();
      expect(result.performanceMetrics.targetTimeAchieved).toBeTruthy();

      await fs.unlink(invalidAgentPath);
    });

    it('should handle task retries appropriately', async () => {
      const query = 'task that should fail once then succeed';
      const result = await orchestrator.orchestrateQuery(query);

      expect(result.success).toBeTruthy();
      expect(result.performanceMetrics.targetTimeAchieved).toBeTruthy();
    });

    it('should handle network interruptions gracefully', async () => {
      const query = 'task with potential network issues';
      const result = await orchestrator.orchestrateQuery(query);

      expect(result.success).toBeTruthy();
      expect(result.retryAttempts).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Resource Management', () => {
    it('should release resources after task completion', async () => {
      await orchestrator.orchestrateQuery('test task');
      const stats = orchestrator.getStatistics();

      expect(stats.activeExecutions).toBe(0);
      expect(stats.activeTasks).toBe(0);
      expect(stats.agentSessions).toBe(0);
      expect(stats.memoryUsageMb).toBeLessThan(150);
    });

    it('should cleanup after emergency stop', async () => {
      const orchestrationPromise = orchestrator.orchestrateQuery('long task');
      
      setTimeout(() => {
        orchestrator.emergencyStop();
      }, 100);

      await orchestrationPromise;
      const stats = orchestrator.getStatistics();

      expect(stats.activeExecutions).toBe(0);
      expect(stats.activeTasks).toBe(0);
      expect(stats.agentSessions).toBe(0);
    });

    it('should handle multiple emergency stops gracefully', async () => {
      const tasks = Array(3).fill('long task');
      const promises = tasks.map(() => orchestrator.orchestrateQuery('long task'));
      
      await orchestrator.emergencyStop();
      await orchestrator.emergencyStop();
      
      await Promise.all(promises);
      const stats = orchestrator.getStatistics();
      
      expect(stats.activeExecutions).toBe(0);
      expect(stats.activeTasks).toBe(0);
    });
  });
});