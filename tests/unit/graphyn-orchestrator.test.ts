import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { GraphynOrchestrator, OrchestratorOptions, AgentProcess } from '../../src/core/GraphynOrchestrator.js';
import { AgentConfigurationSystem } from '../../src/core/AgentConfigurationSystem.js';
import { SpecializedAgentFactory } from '../../src/agents/SpecializedAgentFactory.js';
import { ClaudeCodeMCPIntegration } from '../../src/core/ClaudeCodeMCPIntegration.js';

// Mock the dependencies
vi.mock('../../src/core/AgentConfigurationSystem.js');
vi.mock('../../src/agents/SpecializedAgentFactory.js');
vi.mock('../../src/core/ClaudeCodeMCPIntegration.js');

describe('GraphynOrchestrator', () => {
  let orchestrator: GraphynOrchestrator;
  let mockAgentConfig: AgentConfigurationSystem;
  let mockAgentFactory: SpecializedAgentFactory;
  let mockIntegration: ClaudeCodeMCPIntegration;

  const defaultOptions: OrchestratorOptions = {
    configPath: '/test/config/agent-specializations.json',
    templatePath: '/test/templates',
    workingDirectory: '/test/workspace',
    verbose: false,
    debug: false
  };

  const mockWorkflow = {
    name: 'test-workflow',
    description: 'Test workflow for unit testing',
    agents: ['backend', 'frontend'],
    steps: [
      {
        agent: 'backend',
        description: 'Create API endpoints',
        dependencies: [],
        estimatedDuration: 300
      },
      {
        agent: 'frontend',
        description: 'Build UI components',
        dependencies: ['backend'],
        estimatedDuration: 240
      }
    ]
  };

  const mockAgentSpec = {
    type: 'backend',
    description: 'Backend development specialist',
    tools: ['write_file', 'bash', 'edit_file'],
    specializations: ['API Development', 'Database Design'],
    promptTemplate: 'You are a backend specialist...'
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Get mocked constructors
    const MockedAgentConfigurationSystem = vi.mocked(AgentConfigurationSystem, true);
    const MockedSpecializedAgentFactory = vi.mocked(SpecializedAgentFactory, true);
    const MockedClaudeCodeMCPIntegration = vi.mocked(ClaudeCodeMCPIntegration, true);

    // Create mock instances
    mockAgentConfig = {
      loadConfiguration: vi.fn().mockResolvedValue(undefined),
      isConfigurationLoaded: vi.fn().mockReturnValue(true),
      getAvailableAgentTypes: vi.fn().mockReturnValue(['backend', 'frontend']),
      getAvailableWorkflows: vi.fn().mockReturnValue(['test-workflow']),
      getWorkflow: vi.fn().mockReturnValue(mockWorkflow),
      getAgentSpecialization: vi.fn().mockReturnValue(mockAgentSpec)
    } as any;

    mockIntegration = {
      getProcessId: vi.fn().mockReturnValue(12345),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      on: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn().mockReturnValue({ isRunning: true, isConnected: true })
    } as any;

    mockAgentFactory = {
      initialize: vi.fn().mockResolvedValue(undefined),
      createAgent: vi.fn().mockResolvedValue(mockIntegration)
    } as any;

    // Mock the constructors to return our mock instances
    MockedAgentConfigurationSystem.mockImplementation(() => mockAgentConfig);
    MockedSpecializedAgentFactory.mockImplementation(() => mockAgentFactory);
    MockedClaudeCodeMCPIntegration.mockImplementation(() => mockIntegration);

    orchestrator = new GraphynOrchestrator(defaultOptions);
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      const initSpy = vi.fn();
      orchestrator.on('initialized', initSpy);

      await orchestrator.initialize();

      expect(mockAgentConfig.loadConfiguration).toHaveBeenCalledWith(
        defaultOptions.configPath,
        defaultOptions.templatePath
      );
      expect(mockAgentFactory.initialize).toHaveBeenCalledWith(mockAgentConfig);
      expect(initSpy).toHaveBeenCalledWith({
        agents: ['backend', 'frontend'],
        workflows: ['test-workflow']
      });
    });

    it('should throw error when configuration loading fails', async () => {
      const configError = new Error('Failed to load configuration');
      (mockAgentConfig.loadConfiguration as Mock).mockRejectedValue(configError);

      await expect(orchestrator.initialize()).rejects.toThrow('Failed to load configuration');
    });

    it('should emit error event when initialization fails', async () => {
      const errorSpy = vi.fn();
      orchestrator.on('error', errorSpy);

      const configError = new Error('Configuration error');
      (mockAgentConfig.loadConfiguration as Mock).mockRejectedValue(configError);

      await expect(orchestrator.initialize()).rejects.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(configError);
    });
  });

  describe('Agent Management', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should launch agent successfully', async () => {
      const launchSpy = vi.fn();
      orchestrator.on('agentLaunched', launchSpy);

      const agent = await orchestrator.launchAgent('backend', 'Test task');

      expect(agent).toBeDefined();
      expect(agent.type).toBe('backend');
      expect(agent.task).toBe('Test task');
      expect(agent.status).toBe('running');
      expect(agent.pid).toBe(12345);
      expect(mockAgentFactory.createAgent).toHaveBeenCalledWith('backend', {
        agentId: expect.stringMatching(/^backend-\d+-[a-z0-9]+$/),
        task: 'Test task',
        context: undefined,
        workingDirectory: '/test/workspace',
        verbose: false,
        debug: false
      });
      expect(mockIntegration.start).toHaveBeenCalled();
      expect(launchSpy).toHaveBeenCalledWith(agent);
    });

    it('should throw error for unknown agent type', async () => {
      (mockAgentConfig.getAgentSpecialization as Mock).mockReturnValue(null);

      await expect(orchestrator.launchAgent('unknown-agent')).rejects.toThrow(
        "Agent type 'unknown-agent' not found"
      );
    });

    it('should throw error when orchestrator not initialized', async () => {
      // Create a separate mock that returns false for isConfigurationLoaded
      const uninitializedMockConfig = {
        ...mockAgentConfig,
        isConfigurationLoaded: vi.fn().mockReturnValue(false)
      } as any;
      
      // Override the mocked constructor temporarily
      const MockedAgentConfigurationSystem = vi.mocked(AgentConfigurationSystem, true);
      MockedAgentConfigurationSystem.mockImplementationOnce(() => uninitializedMockConfig);
      
      const uninitializedOrchestrator = new GraphynOrchestrator(defaultOptions);

      await expect(uninitializedOrchestrator.launchAgent('backend')).rejects.toThrow(
        'Orchestrator not initialized. Call initialize() first.'
      );
    });

    it('should terminate agent successfully', async () => {
      const agent = await orchestrator.launchAgent('backend');
      const terminateSpy = vi.fn();
      orchestrator.on('agentTerminated', terminateSpy);

      await orchestrator.terminateAgent(agent.id);

      expect(mockIntegration.stop).toHaveBeenCalled();
      expect(terminateSpy).toHaveBeenCalledWith({
        agent: expect.objectContaining({ id: agent.id, status: 'terminated' }),
        reason: 'User requested'
      });
    });

    it('should throw error when terminating non-existent agent', async () => {
      await expect(orchestrator.terminateAgent('non-existent')).rejects.toThrow(
        'Agent non-existent not found'
      );
    });

    it('should get agent status correctly', async () => {
      const agent1 = await orchestrator.launchAgent('backend');
      const agent2 = await orchestrator.launchAgent('frontend');

      const status = orchestrator.getAgentStatus();

      expect(status).toHaveLength(2);
      expect(status.map(a => a.id)).toContain(agent1.id);
      expect(status.map(a => a.id)).toContain(agent2.id);
    });

    it('should terminate all agents successfully', async () => {
      await orchestrator.launchAgent('backend');
      await orchestrator.launchAgent('frontend');

      expect(orchestrator.getAgentStatus()).toHaveLength(2);

      await orchestrator.terminateAllAgents('Test shutdown');

      expect(orchestrator.getAgentStatus()).toHaveLength(0);
      expect(mockIntegration.stop).toHaveBeenCalledTimes(2);
    });
  });

  describe('Workflow Execution', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should create workflow execution plan correctly', async () => {
      // Mock workflow execution to avoid complexity in unit test
      const startSpy = vi.fn();
      orchestrator.on('workflowStarted', startSpy);

      // Mock the executeWorkflowSteps to avoid agent launching complexity
      const originalExecuteSteps = (orchestrator as any).executeWorkflowSteps;
      (orchestrator as any).executeWorkflowSteps = vi.fn().mockResolvedValue(undefined);

      const executionPlan = await orchestrator.executeWorkflow('test-workflow');

      expect(executionPlan.workflowName).toBe('test-workflow');
      expect(executionPlan.steps).toHaveLength(2);
      expect(executionPlan.steps[0].agentType).toBe('backend');
      expect(executionPlan.steps[1].agentType).toBe('frontend');
      expect(executionPlan.steps[1].dependencies).toContain('backend');
      expect(executionPlan.totalEstimatedTime).toBe(540); // 300 + 240

      expect(startSpy).toHaveBeenCalledWith(executionPlan);

      // Restore original method
      (orchestrator as any).executeWorkflowSteps = originalExecuteSteps;
    });

    it('should throw error for unknown workflow', async () => {
      (mockAgentConfig.getWorkflow as Mock).mockReturnValue(null);

      await expect(orchestrator.executeWorkflow('unknown-workflow')).rejects.toThrow(
        "Workflow 'unknown-workflow' not found"
      );
    });

    it('should get workflow status correctly', async () => {
      // Mock the executeWorkflowSteps to complete immediately
      (orchestrator as any).executeWorkflowSteps = vi.fn().mockResolvedValue(undefined);

      await orchestrator.executeWorkflow('test-workflow');
      const status = orchestrator.getWorkflowStatus('test-workflow');

      expect(status).toBeDefined();
      expect(status!.workflowName).toBe('test-workflow');
    });
  });

  describe('System Health', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should report healthy system with no agents', async () => {
      const health = await orchestrator.getSystemHealth();

      expect(health.status).toBe('healthy');
      expect(health.activeAgents).toBe(0);
      expect(health.mcpConnections).toBe(0);
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.memoryUsage).toBeDefined();
    });

    it('should report healthy system with connected agents', async () => {
      await orchestrator.launchAgent('backend');
      
      const health = await orchestrator.getSystemHealth();

      expect(health.status).toBe('healthy');
      expect(health.activeAgents).toBe(1);
      expect(health.mcpConnections).toBe(1);
    });

    it('should report degraded system with disconnected agents', async () => {
      await orchestrator.launchAgent('backend');
      (mockIntegration.isConnected as Mock).mockReturnValue(false);
      
      const health = await orchestrator.getSystemHealth();

      expect(health.status).toBe('degraded');
      expect(health.activeAgents).toBe(1);
      expect(health.mcpConnections).toBe(0);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should emit agentLaunched event', async () => {
      const spy = vi.fn();
      orchestrator.on('agentLaunched', spy);

      const agent = await orchestrator.launchAgent('backend');

      expect(spy).toHaveBeenCalledWith(agent);
    });

    it('should emit agentTerminated event', async () => {
      const agent = await orchestrator.launchAgent('backend');
      const spy = vi.fn();
      orchestrator.on('agentTerminated', spy);

      await orchestrator.terminateAgent(agent.id, 'Test reason');

      expect(spy).toHaveBeenCalledWith({
        agent: expect.objectContaining({ id: agent.id }),
        reason: 'Test reason'
      });
    });

    it('should emit workflowStarted event', async () => {
      const spy = vi.fn();
      orchestrator.on('workflowStarted', spy);

      // Mock the executeWorkflowSteps to avoid complexity
      (orchestrator as any).executeWorkflowSteps = vi.fn().mockResolvedValue(undefined);

      await orchestrator.executeWorkflow('test-workflow');

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowName: 'test-workflow',
          steps: expect.arrayContaining([
            expect.objectContaining({ agentType: 'backend' }),
            expect.objectContaining({ agentType: 'frontend' })
          ])
        })
      );
    });
  });

  describe('Shutdown', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should shutdown gracefully with no agents', async () => {
      await expect(orchestrator.shutdown()).resolves.not.toThrow();
    });

    it('should shutdown gracefully with active agents', async () => {
      await orchestrator.launchAgent('backend');
      await orchestrator.launchAgent('frontend');

      await orchestrator.shutdown();

      expect(mockIntegration.stop).toHaveBeenCalledTimes(2);
      expect(orchestrator.getAgentStatus()).toHaveLength(0);
    });

    it('should remove all event listeners on shutdown', async () => {
      const spy = vi.fn();
      orchestrator.on('test-event', spy);

      expect(orchestrator.listenerCount('test-event')).toBe(1);

      await orchestrator.shutdown();

      expect(orchestrator.listenerCount('test-event')).toBe(0);
    });
  });
});