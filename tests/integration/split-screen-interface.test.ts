/**
 * Integration Tests for Split-Screen Interface
 * 
 * Tests the complete split-screen interface system including:
 * - Layout management and terminal resize handling
 * - Input handling and context switching
 * - Event routing between panels
 * - Task decomposition and approval workflow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SplitScreenInterface, SplitScreenConfig } from '../../src/ui/split-screen/SplitScreenInterface.js';
import { InputContext } from '../../src/console/EnhancedInputHandler.js';
import { TaskDecomposition, TaskStatus, TaskPriority } from '../../src/ui/split-screen/ApprovalWorkflowPanel.js';

// Mock process.stdout for testing
const mockStdout = {
  columns: 80,
  rows: 24,
  write: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn()
};

// Mock process for testing
const mockProcess = {
  stdout: mockStdout,
  on: vi.fn(),
  removeAllListeners: vi.fn(),
  cwd: () => '/test/directory'
};

// Replace global process for tests
vi.stubGlobal('process', mockProcess);

describe('SplitScreenInterface Integration', () => {
  let interface: SplitScreenInterface;
  let config: SplitScreenConfig;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    config = {
      terminalDimensions: {
        width: 80,
        height: 24
      },
      enableExitProtection: false, // Disable for tests
      enableRepositoryContext: false, // Disable for tests
      enableAnimation: false, // Disable for tests
      updateInterval: 100
    };

    interface = new SplitScreenInterface(config);
  });

  afterEach(async () => {
    if (interface) {
      await interface.cleanup();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid terminal dimensions', async () => {
      await expect(interface.initialize()).resolves.not.toThrow();
      
      const state = interface.getState();
      expect(state.isActive).toBe(true);
      expect(state.currentLayout).toBeDefined();
      expect(state.currentLayout.totalWidth).toBe(80);
      expect(state.currentLayout.totalHeight).toBe(22); // 24 - 2 reserved
    });

    it('should throw error for invalid terminal dimensions', async () => {
      const smallInterface = new SplitScreenInterface({
        terminalDimensions: { width: 20, height: 5 },
        enableExitProtection: false,
        enableRepositoryContext: false,
        enableAnimation: false
      });

      await expect(smallInterface.initialize()).rejects.toThrow('Terminal too small');
      
      await smallInterface.cleanup();
    });

    it('should setup correct panel proportions', async () => {
      await interface.initialize();
      
      const state = interface.getState();
      const layout = state.currentLayout;
      
      // Check 70%/20%/10% proportions (approximately)
      const totalHeight = layout.totalHeight;
      const outputHeight = layout.outputPanel.height;
      const approvalHeight = layout.approvalPanel.height;
      const inputHeight = layout.inputPanel.height;
      
      expect(outputHeight / totalHeight).toBeCloseTo(0.7, 1);
      expect(approvalHeight / totalHeight).toBeCloseTo(0.2, 1);
      expect(inputHeight / totalHeight).toBeCloseTo(0.1, 1);
    });
  });

  describe('Terminal Resize Handling', () => {
    it('should handle terminal resize gracefully', async () => {
      await interface.initialize();
      
      const resizeEvent = vi.fn();
      interface.on('layoutChanged', resizeEvent);
      
      // Simulate terminal resize
      mockStdout.columns = 120;
      mockStdout.rows = 40;
      
      // Trigger resize event
      const resizeHandler = mockProcess.on.mock.calls.find(call => call[0] === 'SIGWINCH')?.[1];
      if (resizeHandler) {
        resizeHandler();
      }
      
      // Wait for async resize handling
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(resizeEvent).toHaveBeenCalled();
      
      const state = interface.getState();
      expect(state.currentLayout.totalWidth).toBe(120);
      expect(state.currentLayout.totalHeight).toBe(38); // 40 - 2 reserved
    });
  });

  describe('Event Routing', () => {
    it('should route events correctly between panels', async () => {
      await interface.initialize();
      await interface.startInterface();
      
      const testDecomposition: TaskDecomposition = {
        id: 'test-decomp',
        originalQuery: 'test query',
        tasks: [
          {
            id: 'task-1',
            title: 'Test task',
            description: 'A test task',
            assignedAgent: 'backend',
            estimatedDuration: 10,
            dependencies: [],
            status: TaskStatus.PENDING,
            priority: TaskPriority.NORMAL
          }
        ],
        estimatedTotalDuration: 10,
        confidence: 0.8,
        riskFactors: []
      };
      
      // Test task decomposition event routing
      interface.handleExecutionEvent({
        type: 'task_decomposition',
        data: testDecomposition,
        timestamp: new Date(),
        source: 'test'
      });
      
      const state = interface.getState();
      expect(state.inputContext).toBe(InputContext.APPROVAL);
    });

    it('should handle agent response events', async () => {
      await interface.initialize();
      await interface.startInterface();
      
      const contentAddedEvent = vi.fn();
      interface.on('outputContentAdded', contentAddedEvent);
      
      interface.handleExecutionEvent({
        type: 'agent_response',
        data: {
          agentName: 'backend',
          content: 'Test response from backend agent'
        },
        timestamp: new Date(),
        source: 'backend'
      });
      
      expect(contentAddedEvent).toHaveBeenCalled();
    });

    it('should handle execution state changes', async () => {
      await interface.initialize();
      await interface.startInterface();
      
      // Start execution
      interface.handleExecutionEvent({
        type: 'task_started',
        data: {
          taskId: 'task-1',
          agentName: 'backend'
        },
        timestamp: new Date(),
        source: 'executor'
      });
      
      const state = interface.getState();
      expect(state.inputContext).toBe(InputContext.EXECUTION);
      
      // Complete execution
      interface.handleExecutionEvent({
        type: 'execution_complete',
        data: {},
        timestamp: new Date(),
        source: 'executor'
      });
      
      const finalState = interface.getState();
      expect(finalState.inputContext).toBe(InputContext.NORMAL);
    });
  });

  describe('Task Decomposition Display', () => {
    it('should display task decomposition correctly', async () => {
      await interface.initialize();
      await interface.startInterface();
      
      const testDecomposition: TaskDecomposition = {
        id: 'test-decomp',
        originalQuery: 'build API endpoints',
        tasks: [
          {
            id: 'task-1',
            title: 'Design API architecture',
            description: 'Create architectural design for API endpoints',
            assignedAgent: 'architect',
            estimatedDuration: 15,
            dependencies: [],
            status: TaskStatus.PENDING,
            priority: TaskPriority.HIGH
          },
          {
            id: 'task-2',
            title: 'Implement backend logic',
            description: 'Create server-side implementation',
            assignedAgent: 'backend',
            estimatedDuration: 25,
            dependencies: ['task-1'],
            status: TaskStatus.PENDING,
            priority: TaskPriority.NORMAL
          }
        ],
        estimatedTotalDuration: 40,
        confidence: 0.85,
        riskFactors: [
          {
            type: 'complexity',
            description: 'High complexity tasks may require additional time',
            severity: 'medium'
          }
        ]
      };
      
      interface.showTaskDecomposition(testDecomposition);
      
      const state = interface.getState();
      expect(state.inputContext).toBe(InputContext.APPROVAL);
    });
  });

  describe('Agent Status Management', () => {
    it('should update agent status correctly', async () => {
      await interface.initialize();
      await interface.startInterface();
      
      const statusChangeEvent = vi.fn();
      interface.on('agentStatusChanged', statusChangeEvent);
      
      interface.updateAgentStatus('backend', {
        name: 'backend',
        status: 'executing',
        currentTask: 'Building API endpoints',
        progress: 0.5,
        eta: 120
      });
      
      expect(statusChangeEvent).toHaveBeenCalledWith({
        agentName: 'backend',
        status: expect.objectContaining({
          name: 'backend',
          status: 'executing',
          progress: 0.5
        })
      });
    });
  });

  describe('Input Context Management', () => {
    it('should switch input contexts correctly', async () => {
      await interface.initialize();
      await interface.startInterface();
      
      const contextChangeEvent = vi.fn();
      interface.on('inputContextChanged', contextChangeEvent);
      
      // Test context transitions
      interface.setInputContext(InputContext.APPROVAL);
      expect(interface.getState().inputContext).toBe(InputContext.APPROVAL);
      
      interface.setInputContext(InputContext.EXECUTION);
      expect(interface.getState().inputContext).toBe(InputContext.EXECUTION);
      
      interface.setInputContext(InputContext.NORMAL);
      expect(interface.getState().inputContext).toBe(InputContext.NORMAL);
    });
  });

  describe('Performance Requirements', () => {
    it('should render within performance targets', async () => {
      await interface.initialize();
      await interface.startInterface();
      
      const startTime = performance.now();
      interface.render();
      const endTime = performance.now();
      
      const renderTime = endTime - startTime;
      
      // Should render faster than 16ms (60fps requirement)
      expect(renderTime).toBeLessThan(16);
    });

    it('should handle rapid event processing', async () => {
      await interface.initialize();
      await interface.startInterface();
      
      const startTime = performance.now();
      
      // Process 100 events rapidly
      for (let i = 0; i < 100; i++) {
        interface.handleExecutionEvent({
          type: 'agent_response',
          data: {
            agentName: 'test',
            content: `Response ${i}`
          },
          timestamp: new Date(),
          source: 'test'
        });
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should process 100 events in under 100ms
      expect(totalTime).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed events gracefully', async () => {
      await interface.initialize();
      await interface.startInterface();
      
      expect(() => {
        interface.handleExecutionEvent({
          type: 'invalid_event',
          data: null,
          timestamp: new Date()
        });
      }).not.toThrow();
    });

    it('should recover from rendering errors', async () => {
      await interface.initialize();
      await interface.startInterface();
      
      // Mock stdout write to throw error
      mockStdout.write.mockImplementationOnce(() => {
        throw new Error('Terminal write error');
      });
      
      expect(() => {
        interface.render();
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup all resources properly', async () => {
      await interface.initialize();
      await interface.startInterface();
      
      const cleanupEvent = vi.fn();
      interface.on('cleaned', cleanupEvent);
      
      await interface.cleanup();
      
      expect(cleanupEvent).toHaveBeenCalled();
      expect(interface.getState().isActive).toBe(false);
    });

    it('should handle cleanup when not initialized', async () => {
      // Should not throw when cleaning up uninitialized interface
      await expect(interface.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory during extended sessions', async () => {
      await interface.initialize();
      await interface.startInterface();
      
      // Simulate extended session with many events
      for (let i = 0; i < 1000; i++) {
        interface.addOutput({
          id: `test-${i}`,
          source: 'test',
          content: `Test message ${i}`,
          timestamp: new Date(),
          type: 'text'
        });
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Memory usage should remain reasonable
      const memUsage = process.memoryUsage();
      expect(memUsage.heapUsed).toBeLessThan(150 * 1024 * 1024); // 150MB limit
    });
  });
});