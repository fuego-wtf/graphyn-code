/**
 * T009: TaskDecomposition entity tests
 * These tests MUST fail initially since no implementation exists
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskDecomposition } from '../../../src/cli/enhanced-ux/entities/task-decomposition.js';
import type { Task, AgentType, DecompositionStatus, TaskStatus, TaskPriority } from '../../../src/cli/enhanced-ux/types.js';

describe('TaskDecomposition Entity Tests', () => {
  let taskDecomposition: TaskDecomposition;
  let mockTasks: Task[];

  beforeEach(() => {
    mockTasks = [
      {
        id: 'task-1',
        title: 'Setup database',
        description: 'Create user and product tables',
        assignedAgent: 'backend' as AgentType,
        estimatedDuration: 300,
        dependencies: [],
        status: 'pending' as TaskStatus,
        priority: 'high' as TaskPriority
      },
      {
        id: 'task-2',
        title: 'Create UI components',
        description: 'Build React components',
        assignedAgent: 'frontend' as AgentType,
        estimatedDuration: 240,
        dependencies: ['task-1'],
        status: 'pending' as TaskStatus,
        priority: 'medium' as TaskPriority
      },
      {
        id: 'task-3',
        title: 'Design API',
        description: 'Plan REST endpoints',
        assignedAgent: 'architect' as AgentType,
        estimatedDuration: 180,
        dependencies: [],
        status: 'pending' as TaskStatus,
        priority: 'high' as TaskPriority
      }
    ];

    taskDecomposition = new TaskDecomposition(
      'build user system',
      mockTasks
    );
  });

  describe('Constructor and Initialization', () => {
    it('should create task decomposition with required fields', () => {
      expect(taskDecomposition).toBeDefined();
      expect(taskDecomposition.id).toBeTruthy();
      expect(typeof taskDecomposition.id).toBe('string');
      expect(taskDecomposition.originalQuery).toBe('build user system');
      expect(taskDecomposition.tasks).toEqual(mockTasks);
      expect(taskDecomposition.createdAt).toBeInstanceOf(Date);
    });

    it('should initialize with analyzing status', () => {
      expect(taskDecomposition.status).toBe('analyzing');
    });

    it('should calculate total estimated duration', () => {
      const expectedDuration = 300 + 240 + 180; // Sum of all task durations
      expect(taskDecomposition.estimatedDuration).toBe(expectedDuration);
    });

    it('should set default confidence level', () => {
      expect(taskDecomposition.confidence).toBeGreaterThan(0);
      expect(taskDecomposition.confidence).toBeLessThanOrEqual(1);
    });

    it('should create agent assignments automatically', () => {
      expect(taskDecomposition.agentAssignments).toBeInstanceOf(Map);
      
      const backendTasks = taskDecomposition.agentAssignments.get('backend');
      expect(backendTasks).toContain(mockTasks[0]);
      
      const frontendTasks = taskDecomposition.agentAssignments.get('frontend');
      expect(frontendTasks).toContain(mockTasks[1]);
      
      const architectTasks = taskDecomposition.agentAssignments.get('architect');
      expect(architectTasks).toContain(mockTasks[2]);
    });
  });

  describe('Task Management', () => {
    it('should add new task and update agent assignments', () => {
      const newTask: Task = {
        id: 'task-4',
        title: 'Add tests',
        description: 'Write unit tests',
        assignedAgent: 'tester' as AgentType,
        estimatedDuration: 120,
        dependencies: ['task-2'],
        status: 'pending' as TaskStatus,
        priority: 'low' as TaskPriority
      };

      taskDecomposition.addTask(newTask);

      expect(taskDecomposition.tasks).toContain(newTask);
      expect(taskDecomposition.estimatedDuration).toBe(840); // 720 + 120
      
      const testerTasks = taskDecomposition.agentAssignments.get('tester');
      expect(testerTasks).toContain(newTask);
    });

    it('should remove task and update assignments', () => {
      taskDecomposition.removeTask('task-2');

      expect(taskDecomposition.tasks).not.toContain(mockTasks[1]);
      expect(taskDecomposition.estimatedDuration).toBe(480); // 300 + 180
      
      const frontendTasks = taskDecomposition.agentAssignments.get('frontend');
      expect(frontendTasks).not.toContain(mockTasks[1]);
    });

    it('should update existing task', () => {
      const updatedTask: Partial<Task> = {
        id: 'task-1',
        estimatedDuration: 450,
        priority: 'medium' as TaskPriority
      };

      taskDecomposition.updateTask('task-1', updatedTask);

      const task = taskDecomposition.getTask('task-1');
      expect(task?.estimatedDuration).toBe(450);
      expect(task?.priority).toBe('medium');
      expect(taskDecomposition.estimatedDuration).toBe(870); // 450 + 240 + 180
    });

    it('should get task by ID', () => {
      const task = taskDecomposition.getTask('task-2');
      expect(task).toEqual(mockTasks[1]);
    });

    it('should return null for non-existent task', () => {
      const task = taskDecomposition.getTask('non-existent');
      expect(task).toBeNull();
    });

    it('should reorder tasks', () => {
      taskDecomposition.reorderTasks(['task-3', 'task-1', 'task-2']);

      expect(taskDecomposition.tasks[0].id).toBe('task-3');
      expect(taskDecomposition.tasks[1].id).toBe('task-1');
      expect(taskDecomposition.tasks[2].id).toBe('task-2');
    });
  });

  describe('Status Management', () => {
    it('should update status', () => {
      taskDecomposition.updateStatus('pending_approval' as DecompositionStatus);
      expect(taskDecomposition.status).toBe('pending_approval');
    });

    it('should validate status transitions', () => {
      // Valid transition
      expect(() => taskDecomposition.updateStatus('pending_approval' as DecompositionStatus)).not.toThrow();
      
      // Invalid transition (can't go backwards)
      expect(() => taskDecomposition.updateStatus('analyzing' as DecompositionStatus)).toThrow();
    });

    it('should progress through valid status flow', () => {
      taskDecomposition.updateStatus('pending_approval' as DecompositionStatus);
      taskDecomposition.updateStatus('approved' as DecompositionStatus);
      taskDecomposition.updateStatus('executing' as DecompositionStatus);
      taskDecomposition.updateStatus('completed' as DecompositionStatus);
      
      expect(taskDecomposition.status).toBe('completed');
    });

    it('should allow cancellation from any status', () => {
      taskDecomposition.updateStatus('pending_approval' as DecompositionStatus);
      taskDecomposition.updateStatus('cancelled' as DecompositionStatus);
      
      expect(taskDecomposition.status).toBe('cancelled');
    });
  });

  describe('Dependencies', () => {
    it('should validate task dependencies', () => {
      expect(taskDecomposition.validateDependencies()).toBe(true);
    });

    it('should detect circular dependencies', () => {
      // Create circular dependency
      taskDecomposition.updateTask('task-1', { dependencies: ['task-2'] });
      taskDecomposition.updateTask('task-2', { dependencies: ['task-1'] });

      expect(taskDecomposition.validateDependencies()).toBe(false);
    });

    it('should detect missing dependencies', () => {
      taskDecomposition.addTask({
        id: 'task-4',
        title: 'Invalid task',
        description: 'Has non-existent dependency',
        assignedAgent: 'backend' as AgentType,
        estimatedDuration: 100,
        dependencies: ['non-existent-task'],
        status: 'pending' as TaskStatus,
        priority: 'low' as TaskPriority
      });

      expect(taskDecomposition.validateDependencies()).toBe(false);
    });

    it('should get dependency graph', () => {
      const graph = taskDecomposition.getDependencyGraph();
      
      expect(graph).toBeInstanceOf(Map);
      expect(graph.get('task-2')).toContain('task-1');
      expect(graph.get('task-1')).toEqual([]);
      expect(graph.get('task-3')).toEqual([]);
    });

    it('should get topological order', () => {
      const order = taskDecomposition.getExecutionOrder();
      
      const task1Index = order.indexOf('task-1');
      const task2Index = order.indexOf('task-2');
      
      // task-1 should come before task-2 (dependency)
      expect(task1Index).toBeLessThan(task2Index);
    });
  });

  describe('Agent Assignments', () => {
    it('should get tasks by agent', () => {
      const backendTasks = taskDecomposition.getTasksByAgent('backend');
      expect(backendTasks).toHaveLength(1);
      expect(backendTasks[0].id).toBe('task-1');
    });

    it('should get agent workload', () => {
      const backendWorkload = taskDecomposition.getAgentWorkload('backend');
      expect(backendWorkload).toBe(300); // Duration of task-1
      
      const frontendWorkload = taskDecomposition.getAgentWorkload('frontend');
      expect(frontendWorkload).toBe(240); // Duration of task-2
    });

    it('should balance agent assignments', () => {
      // Add more tasks to create imbalance
      taskDecomposition.addTask({
        id: 'task-4',
        title: 'Heavy backend task',
        description: 'Big task',
        assignedAgent: 'backend' as AgentType,
        estimatedDuration: 600,
        dependencies: [],
        status: 'pending' as TaskStatus,
        priority: 'medium' as TaskPriority
      });

      const initialBackendLoad = taskDecomposition.getAgentWorkload('backend');
      const initialFrontendLoad = taskDecomposition.getAgentWorkload('frontend');
      
      expect(initialBackendLoad).toBeGreaterThan(initialFrontendLoad);
      
      taskDecomposition.balanceAgentAssignments();
      
      const balancedBackendLoad = taskDecomposition.getAgentWorkload('backend');
      const balancedFrontendLoad = taskDecomposition.getAgentWorkload('frontend');
      
      // Workload should be more balanced
      expect(Math.abs(balancedBackendLoad - balancedFrontendLoad))
        .toBeLessThan(Math.abs(initialBackendLoad - initialFrontendLoad));
    });

    it('should reassign task to different agent', () => {
      taskDecomposition.reassignTask('task-2', 'backend' as AgentType);
      
      const task = taskDecomposition.getTask('task-2');
      expect(task?.assignedAgent).toBe('backend');
      
      const frontendTasks = taskDecomposition.getTasksByAgent('frontend');
      expect(frontendTasks).toHaveLength(0);
      
      const backendTasks = taskDecomposition.getTasksByAgent('backend');
      expect(backendTasks).toHaveLength(2);
    });
  });

  describe('Confidence and Quality', () => {
    it('should update confidence score', () => {
      taskDecomposition.updateConfidence(0.95);
      expect(taskDecomposition.confidence).toBe(0.95);
    });

    it('should validate confidence range', () => {
      expect(() => taskDecomposition.updateConfidence(-0.1)).toThrow();
      expect(() => taskDecomposition.updateConfidence(1.1)).toThrow();
    });

    it('should calculate quality score based on completeness', () => {
      const quality = taskDecomposition.getQualityScore();
      expect(quality).toBeGreaterThan(0);
      expect(quality).toBeLessThanOrEqual(1);
    });

    it('should provide recommendations for improvement', () => {
      const recommendations = taskDecomposition.getRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('Serialization and Export', () => {
    it('should serialize to JSON', () => {
      const json = taskDecomposition.toJSON();
      expect(typeof json).toBe('string');
      expect(json).toContain('build user system');
      expect(json).toContain('task-1');
    });

    it('should deserialize from JSON', () => {
      const json = taskDecomposition.toJSON();
      const deserialized = TaskDecomposition.fromJSON(json);
      
      expect(deserialized.id).toBe(taskDecomposition.id);
      expect(deserialized.originalQuery).toBe(taskDecomposition.originalQuery);
      expect(deserialized.tasks).toHaveLength(taskDecomposition.tasks.length);
    });

    it('should export to different formats', () => {
      const markdown = taskDecomposition.toMarkdown();
      expect(markdown).toContain('# Task Decomposition');
      expect(markdown).toContain('## Tasks');
      
      const csv = taskDecomposition.toCSV();
      expect(csv).toContain('Task ID,Title,Agent,Duration');
    });
  });

  describe('Performance', () => {
    it('should handle large number of tasks efficiently', () => {
      const largeTasks: Task[] = [];
      for (let i = 0; i < 1000; i++) {
        largeTasks.push({
          id: `task-${i}`,
          title: `Task ${i}`,
          description: `Description ${i}`,
          assignedAgent: 'backend' as AgentType,
          estimatedDuration: 60,
          dependencies: i > 0 ? [`task-${i-1}`] : [],
          status: 'pending' as TaskStatus,
          priority: 'medium' as TaskPriority
        });
      }

      const startTime = performance.now();
      const largeDecomposition = new TaskDecomposition('large test', largeTasks);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should handle 1000 tasks quickly
      expect(largeDecomposition.tasks).toHaveLength(1000);
    });

    it('should validate dependencies quickly for large graphs', () => {
      // Create chain of 100 tasks
      const chainTasks: Task[] = [];
      for (let i = 0; i < 100; i++) {
        chainTasks.push({
          id: `chain-${i}`,
          title: `Chain ${i}`,
          description: `Chain task ${i}`,
          assignedAgent: 'backend' as AgentType,
          estimatedDuration: 30,
          dependencies: i > 0 ? [`chain-${i-1}`] : [],
          status: 'pending' as TaskStatus,
          priority: 'medium' as TaskPriority
        });
      }

      const chainDecomposition = new TaskDecomposition('chain test', chainTasks);
      
      const startTime = performance.now();
      const isValid = chainDecomposition.validateDependencies();
      const endTime = performance.now();
      
      expect(isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(50); // Fast dependency validation
    });
  });
});