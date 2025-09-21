/**
 * Integration Tests for Real-Time Streaming Components
 * 
 * Tests the complete integration of:
 * - RealTimeLogger with progress updates
 * - ProgressBar with various scenarios
 * - Spinner animations and states
 * - Dashboard rendering with live data
 * - GraphynOrchestrator streaming integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RealTimeLogger } from '../../packages/core/src/ui/real-time-logger.js';
import { ProgressBar, MultiStepProgress } from '../../packages/core/src/ui/progress-bar.js';
import { Spinner, MultiSpinner } from '../../packages/core/src/ui/spinner.js';
import { DashboardRenderer } from '../../packages/core/src/ui/dashboard-renderer.js';
import type { AgentStatus, TaskStatus, SessionMetrics } from '../../packages/core/src/monitoring/MissionControlStream.js';

// Mock stdout to capture output
const mockStdout = {
  write: vi.fn(),
  isTTY: true,
  columns: 120
};

// Mock process for global access
Object.defineProperty(process, 'stdout', {
  value: mockStdout,
  writable: true,
  configurable: true
});

describe('Real-Time Streaming Integration', () => {
  let logger: RealTimeLogger;
  let dashboard: DashboardRenderer;

  beforeEach(() => {
    mockStdout.write.mockClear();
    logger = new RealTimeLogger({ interactive: true });
    dashboard = new DashboardRenderer({ autoRefresh: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('RealTimeLogger Integration', () => {
    it('should handle rapid progress updates with throttling', async () => {
      const startTime = Date.now();
      
      // Simulate rapid updates (should be throttled)
      for (let i = 0; i <= 100; i += 5) {
        logger.updateProgress('Processing files', i, { total: 100 });
        await new Promise(resolve => setTimeout(resolve, 10)); // 10ms intervals
      }
      
      const duration = Date.now() - startTime;
      
      // Should have throttled the updates (not all 21 calls should result in writes)
      expect(mockStdout.write.mock.calls.length).toBeLessThan(21);
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('Processing files')
      );
    });

    it('should handle agent-specific progress updates', () => {
      logger.updateAgentProgress('Backend-001', 'Creating database models', 45);
      
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('🤖 [Backend-001] Creating database models')
      );
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('[████████████████████▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒] 45%')
      );
    });

    it('should complete progress with success message', () => {
      logger.updateProgress('Building application', 80);
      logger.completeProgress('Application built successfully');
      
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('✅ Application built successfully\\n')
      );
    });

    it('should handle child loggers with prefixes', () => {
      const childLogger = logger.createChild('Security-001');
      childLogger.logStatus('info', 'Scanning for vulnerabilities');
      
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('[Graphyn:Security-001] ℹ️ Scanning for vulnerabilities')
      );
    });
  });

  describe('ProgressBar Integration', () => {
    it('should handle multi-step workflow progress', async () => {
      const steps = [
        { name: 'Repository Analysis', weight: 2 },
        { name: 'Agent Creation', weight: 1 },
        { name: 'Task Execution', weight: 4 }
      ];
      
      const multiProgress = new MultiStepProgress(steps, {
        prefix: 'Workflow',
        showETA: true
      });
      
      // Execute steps
      multiProgress.nextStep();
      await new Promise(resolve => setTimeout(resolve, 100));
      multiProgress.completeCurrentStep();
      
      multiProgress.nextStep();
      await new Promise(resolve => setTimeout(resolve, 50));
      multiProgress.completeCurrentStep();
      
      multiProgress.nextStep();
      await new Promise(resolve => setTimeout(resolve, 200));
      multiProgress.complete();
      
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('All steps completed successfully! 🎉')
      );
    });

    it('should handle progress bar failure states', () => {
      const progressBar = new ProgressBar({ 
        total: 100, 
        prefix: 'Deploy',
        color: 'red'
      });
      
      progressBar.update(60, 'Deploying to production...');
      progressBar.fail('Deployment failed: Connection timeout');
      
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('❌')
      );
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('Deployment failed: Connection timeout')
      );
    });
  });

  describe('Spinner Integration', () => {
    it('should handle spinner lifecycle with different outcomes', async () => {
      const spinner = new Spinner({
        text: 'Initializing agents...',
        color: 'cyan',
        style: 'dots'
      });
      
      spinner.start();
      expect(spinner.isRunning()).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      spinner.succeed('Agents initialized successfully');
      expect(spinner.isRunning()).toBe(false);
      
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('✅ Agents initialized successfully')
      );
    });

    it('should handle multi-spinner coordination', async () => {
      const multiSpinner = new MultiSpinner();
      
      multiSpinner.add('agent1', 'Backend agent working...');
      multiSpinner.add('agent2', 'Security agent scanning...');
      multiSpinner.add('agent3', 'Frontend agent building...');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      multiSpinner.succeed('agent1', 'Backend tasks completed');
      multiSpinner.update('agent2', 'Security scan 80% complete');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      multiSpinner.succeed('agent2', 'Security scan completed');
      multiSpinner.succeed('agent3', 'Frontend build completed');
      
      multiSpinner.stopAll();
      
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('✅ Backend tasks completed')
      );
    });

    it('should handle timer spinner with elapsed time', async () => {
      const spinner = new Spinner({ text: 'Processing large dataset' });
      
      spinner.startTimer('Processing large dataset');
      
      // Simulate time passing
      await new Promise(resolve => setTimeout(resolve, 1100)); // Just over 1 second
      
      spinner.succeed('Dataset processing completed');
      
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('Processing large dataset (1s)')
      );
    });
  });

  describe('Dashboard Integration', () => {
    let mockAgents: AgentStatus[];
    let mockTasks: TaskStatus[];
    let mockMetrics: SessionMetrics;

    beforeEach(() => {
      mockAgents = [
        {
          id: 'backend-001',
          type: 'backend',
          name: 'Backend Specialist',
          status: 'active',
          currentTask: 'Creating authentication system',
          progress: 75,
          metrics: { tasksCompleted: 2, tasksActive: 1, errorCount: 0, uptime: 300000 },
          lastActivity: new Date(),
          startedAt: new Date(Date.now() - 300000)
        },
        {
          id: 'security-001',
          type: 'security',
          name: 'Security Expert',
          status: 'idle',
          progress: 0,
          metrics: { tasksCompleted: 1, tasksActive: 0, errorCount: 0, uptime: 150000 },
          lastActivity: new Date(Date.now() - 60000),
          startedAt: new Date(Date.now() - 150000)
        }
      ];

      mockTasks = [
        {
          id: 'task-1',
          title: 'Implement JWT authentication',
          status: 'active',
          assignedAgent: 'backend-001',
          priority: 1,
          dependencies: [],
          progress: 75,
          startTime: new Date(Date.now() - 180000),
          metrics: { estimatedDuration: 300000, complexity: 3 }
        },
        {
          id: 'task-2',
          title: 'Security audit',
          status: 'pending',
          priority: 2,
          dependencies: ['task-1'],
          progress: 0,
          metrics: { estimatedDuration: 240000, complexity: 2 }
        }
      ];

      mockMetrics = {
        sessionId: 'test-session',
        startTime: new Date(Date.now() - 600000),
        totalTasks: 2,
        completedTasks: 0,
        activeTasks: 1,
        errorTasks: 0,
        activeAgents: 1,
        averageTaskDuration: 180000,
        successRate: 0,
        resourceUsage: { cpuUsage: 45.2, memoryUsage: 256, diskUsage: 1024 },
        dbLatencyMs: 2,
        knowledgeEntries: 15,
        knowledgeLastIngested: new Date(Date.now() - 120000)
      };
    });

    it('should render complete dashboard with all sections', () => {
      dashboard.render(mockAgents, mockTasks, mockMetrics);
      
      // Check that dashboard sections are rendered
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('🎛️ Graphyn Mission Control')
      );
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('AGENT STATUS GRID')
      );
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('TASK QUEUE STATUS')
      );
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('SYSTEM HEALTH')
      );
    });

    it('should render agent grid with correct status indicators', () => {
      dashboard.renderAgentGrid(mockAgents);
      
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringMatching(/🤖.*Backend Specialist/)
      );
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringMatching(/🛡️.*Security Expert/)
      );
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('75%')
      );
    });

    it('should handle summary rendering', () => {
      dashboard.renderSummary(mockAgents, mockTasks, mockMetrics);
      
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('Active Agents: 1/2')
      );
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('Tasks Completed: 0/2')
      );
    });

    it('should handle compact mode for smaller terminals', () => {
      const compactDashboard = new DashboardRenderer({ 
        compact: true, 
        autoRefresh: false,
        maxWidth: 80
      });
      
      compactDashboard.render(mockAgents, mockTasks, mockMetrics);
      
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringMatching(/🎛️ Graphyn \| Agents: 1\/2 \| Tasks: 0\/2/)
      );
    });
  });

  describe('Cross-Component Integration', () => {
    it('should coordinate logger and dashboard updates', async () => {
      // Simulate a workflow that uses both logger and dashboard
      logger.logLine('🚀 Starting multi-agent workflow');
      
      const spinner = new Spinner({ text: 'Initializing...' });
      spinner.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      spinner.succeed('Initialization complete');
      
      const progressBar = new ProgressBar({ 
        total: 3, 
        prefix: 'Executing',
        showCounts: true
      });
      
      progressBar.update(1, 'Phase 1 complete');
      progressBar.update(2, 'Phase 2 complete');
      progressBar.complete('All phases completed');
      
      logger.logStatus('success', 'Workflow completed successfully');
      
      // Verify the sequence of operations
      const writeCalls = mockStdout.write.mock.calls.map(call => call[0]);
      const hasWorkflowStart = writeCalls.some(call => 
        call.includes('Starting multi-agent workflow')
      );
      const hasSuccess = writeCalls.some(call => 
        call.includes('Workflow completed successfully')
      );
      
      expect(hasWorkflowStart).toBe(true);
      expect(hasSuccess).toBe(true);
    });

    it('should handle graceful degradation for non-interactive mode', () => {
      // Mock non-interactive environment
      mockStdout.isTTY = false;
      
      const nonInteractiveLogger = new RealTimeLogger({ interactive: false });
      const nonInteractiveDashboard = new DashboardRenderer({ autoRefresh: false });
      
      nonInteractiveLogger.updateProgress('Processing', 50);
      nonInteractiveDashboard.render([], []);
      
      // Should fall back to simple text output
      expect(mockStdout.write).toHaveBeenCalled();
    });
  });

  describe('Performance and Memory', () => {
    it('should handle rapid updates without memory leaks', async () => {
      const startMemory = process.memoryUsage();
      
      // Simulate intensive logging
      for (let i = 0; i < 1000; i++) {
        logger.updateProgress(`Processing item ${i}`, i, { total: 1000 });
        if (i % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      
      logger.completeProgress('Processing completed');
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const endMemory = process.memoryUsage();
      const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 10MB for this test)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should throttle dashboard updates appropriately', async () => {
      const startTime = Date.now();
      const updateCount = mockStdout.write.mock.calls.length;
      
      // Create mock data for this test
      const testAgents: AgentStatus[] = [];
      const testTasks: TaskStatus[] = [];
      const testMetrics: SessionMetrics = {
        sessionId: 'test',
        startTime: new Date(),
        totalTasks: 0,
        completedTasks: 0,
        activeTasks: 0,
        errorTasks: 0,
        activeAgents: 0,
        averageTaskDuration: 0,
        successRate: 0,
        resourceUsage: { cpuUsage: 0, memoryUsage: 0, diskUsage: 0 },
        dbLatencyMs: 0,
        knowledgeEntries: 0
      };
      
      // Simulate rapid dashboard updates
      for (let i = 0; i < 50; i++) {
        dashboard.render(testAgents, testTasks, testMetrics);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const endTime = Date.now();
      const finalUpdateCount = mockStdout.write.mock.calls.length;
      const actualUpdates = finalUpdateCount - updateCount;
      
      // Should have throttled updates (not all 50 should result in renders)
      expect(actualUpdates).toBeLessThan(50);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
    });
  });
});