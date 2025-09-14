import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UltimateOrchestrator } from '../../../src/orchestrator/UltimateOrchestrator.js';
import path from 'path';
import fs from 'fs/promises';

describe('UltimateOrchestrator - Unit Tests', () => {
  let orchestrator: UltimateOrchestrator;

  beforeEach(() => {
    orchestrator = new UltimateOrchestrator({
      maxParallelAgents: 8,
      taskTimeoutMs: 30000,
      memoryLimitMb: 150,
      enableGitWorktrees: false,
      enablePerformanceMonitoring: false
    });
  });

  afterEach(async () => {
    await orchestrator.emergencyStop();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultOrchestrator = new UltimateOrchestrator();
      expect(defaultOrchestrator).toBeDefined();
    });

    it('should handle custom configuration', () => {
      const customOrchestrator = new UltimateOrchestrator({
        maxParallelAgents: 4,
        taskTimeoutMs: 15000,
        memoryLimitMb: 100
      });
      expect(customOrchestrator).toBeDefined();
    });

    it('should validate configuration values', () => {
      expect(() => {
        new UltimateOrchestrator({
          maxParallelAgents: -1,
          taskTimeoutMs: -1000
        });
      }).toThrow();
    });
  });

  describe('Task Processing', () => {
    it('should process single-agent tasks', async () => {
      const result = await orchestrator.orchestrateQuery('simple backend task');
      expect(result.success).toBeTruthy();
      expect(result.agentsUsed).toBe(1);
    });

    it('should handle empty queries', async () => {
      const result = await orchestrator.orchestrateQuery('');
      expect(result.success).toBeFalsy();
      expect(result.errors).toHaveLength(1);
    });

    it('should respect task timeouts', async () => {
      const shortTimeoutOrchestrator = new UltimateOrchestrator({
        taskTimeoutMs: 100
      });
      const result = await shortTimeoutOrchestrator.orchestrateQuery('long task');
      expect(result.success).toBeFalsy();
      expect(result.errors[0]).toContain('timeout');
    });

    it('should validate input parameters', async () => {
      const result = await orchestrator.orchestrateQuery('   ');
      expect(result.success).toBeFalsy();
      expect(result.errors[0]).toContain('invalid input');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track memory usage', async () => {
      const result = await orchestrator.orchestrateQuery('memory intensive task');
      expect(result.performanceMetrics.memoryPeakMb).toBeDefined();
      expect(result.performanceMetrics.memoryPeakMb).toBeLessThan(150);
    });

    it('should measure task duration', async () => {
      const result = await orchestrator.orchestrateQuery('quick task');
      expect(result.totalTimeSeconds).toBeDefined();
      expect(result.totalTimeSeconds).toBeLessThan(30);
    });

    it('should calculate parallel efficiency', async () => {
      const result = await orchestrator.orchestrateQuery('parallel task');
      expect(result.performanceMetrics.parallelEfficiency).toBeDefined();
      expect(result.performanceMetrics.parallelEfficiency).toBeGreaterThan(0);
    });
  });

  describe('Agent Management', () => {
    it('should limit parallel agent sessions', async () => {
      const limitedOrchestrator = new UltimateOrchestrator({
        maxParallelAgents: 2
      });
      const result = await limitedOrchestrator.orchestrateQuery('multi-agent task');
      expect(result.agentsUsed).toBeLessThanOrEqual(2);
    });

    it('should allocate agents based on task requirements', async () => {
      const result = await orchestrator.orchestrateQuery('frontend task');
      expect(result.agentsUsed).toBe(1);
      expect(result.agentTypes).toContain('frontend');
    });

    it('should handle agent initialization failures', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await orchestrator.orchestrateQuery('invalid agent task');
      expect(result.success).toBeFalsy();
      expect(result.errors[0]).toContain('agent initialization');
    });
  });

  describe('Resource Management', () => {
    it('should track active resources', async () => {
      await orchestrator.orchestrateQuery('test task');
      const stats = orchestrator.getStatistics();
      expect(stats.activeExecutions).toBe(0);
      expect(stats.activeTasks).toBe(0);
      expect(stats.agentSessions).toBe(0);
    });

    it('should handle emergency stop', async () => {
      const promise = orchestrator.orchestrateQuery('long task');
      setTimeout(() => orchestrator.emergencyStop(), 10);
      const result = await promise;
      expect(result.success).toBeFalsy();
      expect(result.errors[0]).toContain('emergency stop');
    });

    it('should cleanup resources after errors', async () => {
      try {
        await orchestrator.orchestrateQuery('error task');
      } catch (error) {
        const stats = orchestrator.getStatistics();
        expect(stats.activeExecutions).toBe(0);
        expect(stats.agentSessions).toBe(0);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid configurations', () => {
      expect(() => {
        new UltimateOrchestrator({
          maxParallelAgents: 0,
          taskTimeoutMs: 0,
          memoryLimitMb: -1
        });
      }).toThrow();
    });

    it('should handle runtime errors', async () => {
      const result = await orchestrator.orchestrateQuery('error prone task');
      expect(result.success).toBeFalsy();
      expect(result.errors).toHaveLength(1);
    });

    it('should handle concurrent errors', async () => {
      const promises = Array(3).fill('error task').map(task => 
        orchestrator.orchestrateQuery(task)
      );
      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result.success).toBeFalsy();
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('State Management', () => {
    it('should maintain clean state between tasks', async () => {
      await orchestrator.orchestrateQuery('task 1');
      const result = await orchestrator.orchestrateQuery('task 2');
      expect(result.previousTaskInfluence).toBeFalsy();
    });

    it('should persist essential state during task execution', async () => {
      const result = await orchestrator.orchestrateQuery('stateful task');
      expect(result.stateTransitions).toBeGreaterThan(0);
    });

    it('should reset state after completion', async () => {
      await orchestrator.orchestrateQuery('complex task');
      const stats = orchestrator.getStatistics();
      expect(stats.activeExecutions).toBe(0);
      expect(stats.activeTasks).toBe(0);
    });
  });
});