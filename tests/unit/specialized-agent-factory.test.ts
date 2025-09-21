import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { SpecializedAgentFactory, AgentCreationOptions, AgentCapability } from '../../src/agents/SpecializedAgentFactory.js';
import { AgentConfigurationSystem, AgentSpecialization } from '../../src/core/AgentConfigurationSystem.js';
import { ClaudeCodeMCPIntegration } from '../../src/core/ClaudeCodeMCPIntegration.js';

// Mock the dependencies
vi.mock('../../src/core/AgentConfigurationSystem.js');
vi.mock('../../src/core/ClaudeCodeMCPIntegration.js');

describe('SpecializedAgentFactory', () => {
  let factory: SpecializedAgentFactory;
  let mockAgentConfig: AgentConfigurationSystem;
  let mockIntegration: ClaudeCodeMCPIntegration;

  const mockBackendSpec: AgentSpecialization = {
    type: 'backend',
    description: 'Backend development specialist',
    tools: ['write_file', 'bash', 'edit_file', 'query_database'],
    specializations: ['API Development', 'Database Design', 'Server Architecture'],
    promptTemplate: 'You are a backend development specialist focused on server-side logic, API design, and database management.\n\n## Core Responsibilities\n- Design and implement RESTful APIs\n- Optimize database queries and schemas\n- Ensure proper error handling and logging\n- Write comprehensive unit tests\n\n## Best Practices\n- Follow SOLID principles\n- Use proper authentication and authorization\n- Implement proper validation\n- Consider scalability and performance'
  };

  const mockFrontendSpec: AgentSpecialization = {
    type: 'frontend',
    description: 'Frontend development specialist',
    tools: ['write_file', 'edit_file', 'get_code', 'get_screenshot'],
    specializations: ['React Development', 'UI/UX Implementation', 'Responsive Design'],
    promptTemplate: 'You are a frontend development specialist focused on user interfaces and user experience.\n\n## Core Responsibilities\n- Create responsive and accessible UI components\n- Implement modern frontend frameworks\n- Optimize for performance and usability\n- Ensure cross-browser compatibility'
  };

  const defaultCreationOptions: AgentCreationOptions = {
    agentId: 'test-backend-001',
    task: 'Create user authentication API',
    context: { projectType: 'express', database: 'postgresql' },
    workingDirectory: '/test/workspace',
    verbose: false,
    debug: false
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Get mocked constructors
    const MockedAgentConfigurationSystem = vi.mocked(AgentConfigurationSystem, true);
    const MockedClaudeCodeMCPIntegration = vi.mocked(ClaudeCodeMCPIntegration, true);

    // Create mock instances
    mockAgentConfig = {
      isConfigurationLoaded: vi.fn().mockReturnValue(true),
      getAvailableAgentTypes: vi.fn().mockReturnValue(['backend', 'frontend', 'security']),
      getAgentSpecialization: vi.fn().mockImplementation((type: string) => {
        if (type === 'backend') return mockBackendSpec;
        if (type === 'frontend') return mockFrontendSpec;
        return null;
      })
    } as any;

    mockIntegration = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      on: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn().mockReturnValue({ isRunning: true, isConnected: true })
    } as any;

    // Mock the constructors
    MockedAgentConfigurationSystem.mockImplementation(() => mockAgentConfig);
    MockedClaudeCodeMCPIntegration.mockImplementation(() => mockIntegration);

    factory = new SpecializedAgentFactory();
  });

  describe('Initialization', () => {
    it('should initialize with agent configuration system', async () => {
      await factory.initialize(mockAgentConfig);

      expect(mockAgentConfig.isConfigurationLoaded).toHaveBeenCalled();
    });

    it('should throw error if configuration system is not loaded', async () => {
      (mockAgentConfig.isConfigurationLoaded as Mock).mockReturnValue(false);

      await expect(factory.initialize(mockAgentConfig)).rejects.toThrow(
        'AgentConfigurationSystem must be loaded before initializing factory'
      );
    });

    it('should throw error if not initialized before use', async () => {
      await expect(factory.createAgent('backend', defaultCreationOptions)).rejects.toThrow(
        'Factory not initialized. Call initialize() first.'
      );
    });
  });

  describe('Agent Creation', () => {
    beforeEach(async () => {
      await factory.initialize(mockAgentConfig);
    });

    it('should create backend agent with correct configuration', async () => {
      const integration = await factory.createAgent('backend', defaultCreationOptions);

      expect(ClaudeCodeMCPIntegration).toHaveBeenCalledWith({
        agentId: 'test-backend-001',
        agentType: 'backend',
        promptTemplate: expect.stringContaining('You are a backend development specialist'),
        task: 'Create user authentication API',
        context: { projectType: 'express', database: 'postgresql' },
        workingDirectory: '/test/workspace',
        mcpServerConfig: expect.stringContaining('claude-mcp-client-backend.json'),
        verbose: false,
        debug: false
      });

      expect(integration).toBe(mockIntegration);
    });

    it('should create frontend agent with correct configuration', async () => {
      await factory.createAgent('frontend', {
        ...defaultCreationOptions,
        agentId: 'test-frontend-001'
      });

      expect(ClaudeCodeMCPIntegration).toHaveBeenCalledWith({
        agentId: 'test-frontend-001',
        agentType: 'frontend',
        promptTemplate: expect.stringContaining('You are a frontend development specialist'),
        task: 'Create user authentication API',
        context: { projectType: 'express', database: 'postgresql' },
        workingDirectory: '/test/workspace',
        mcpServerConfig: expect.stringContaining('claude-mcp-client-frontend.json'),
        verbose: false,
        debug: false
      });
    });

    it('should throw error for unknown agent type', async () => {
      await expect(factory.createAgent('unknown-agent', defaultCreationOptions)).rejects.toThrow(
        "Agent specialization 'unknown-agent' not found"
      );
    });

    it('should build comprehensive prompt with agent context', async () => {
      await factory.createAgent('backend', defaultCreationOptions);

      const actualCall = (ClaudeCodeMCPIntegration as Mock).mock.calls[0][0];
      const prompt = actualCall.promptTemplate;

      // Should include original template
      expect(prompt).toContain('You are a backend development specialist');
      
      // Should include agent specialization context
      expect(prompt).toContain('## Agent Specialization Context');
      expect(prompt).toContain('backend specialist with the following capabilities');
      expect(prompt).toContain('API Development');
      expect(prompt).toContain('Database Design');
      
      // Should include available tools
      expect(prompt).toContain('## Available Tools');
      expect(prompt).toContain('write_file');
      expect(prompt).toContain('query_database');
      
      // Should include MCP coordination instructions
      expect(prompt).toContain('## Multi-Agent Coordination');
      expect(prompt).toContain('enqueue_task');
      expect(prompt).toContain('get_next_task');
      
      // Should include working environment info
      expect(prompt).toContain('## Working Environment');
      expect(prompt).toContain('Working Directory: /test/workspace');
      expect(prompt).toContain('Agent ID: test-backend-001');
      
      // Should include current assignment
      expect(prompt).toContain('## Current Assignment');
      expect(prompt).toContain('Create user authentication API');
      
      // Should include task-specific guidance for auth tasks
      expect(prompt).toContain('### Recommended Approach');
      expect(prompt).toContain('authentication middleware');
      expect(prompt).toContain('JWT token handling');
      
      // Should include collaboration guidelines
      expect(prompt).toContain('## Collaboration Guidelines');
      expect(prompt).toContain('check for task dependencies');
    });

    it('should include different task-specific guidance for API tasks', async () => {
      await factory.createAgent('backend', {
        ...defaultCreationOptions,
        task: 'Create REST API endpoints'
      });

      const actualCall = (ClaudeCodeMCPIntegration as Mock).mock.calls[0][0];
      const prompt = actualCall.promptTemplate;

      expect(prompt).toContain('RESTful endpoint structure');
      expect(prompt).toContain('route handlers and middleware');
      expect(prompt).toContain('API documentation');
    });

    it('should include frontend-specific guidance for component tasks', async () => {
      await factory.createAgent('frontend', {
        ...defaultCreationOptions,
        agentId: 'test-frontend-001',
        task: 'Create user profile component'
      });

      const actualCall = (ClaudeCodeMCPIntegration as Mock).mock.calls[0][0];
      const prompt = actualCall.promptTemplate;

      expect(prompt).toContain('component structure and props');
      expect(prompt).toContain('responsive design patterns');
      expect(prompt).toContain('accessibility features');
    });

    it('should work without task or context', async () => {
      const minimalOptions: AgentCreationOptions = {
        agentId: 'test-minimal-001',
        workingDirectory: '/test/workspace'
      };

      await factory.createAgent('backend', minimalOptions);

      const actualCall = (ClaudeCodeMCPIntegration as Mock).mock.calls[0][0];
      expect(actualCall.agentId).toBe('test-minimal-001');
      expect(actualCall.task).toBeUndefined();
      expect(actualCall.context).toBeUndefined();
    });
  });

  describe('Agent Capabilities', () => {
    beforeEach(async () => {
      await factory.initialize(mockAgentConfig);
    });

    it('should get available agent types', () => {
      const types = factory.getAvailableAgentTypes();

      expect(types).toEqual(['backend', 'frontend', 'security']);
      expect(mockAgentConfig.getAvailableAgentTypes).toHaveBeenCalled();
    });

    it('should get agent capabilities for backend', () => {
      const capabilities = factory.getAgentCapabilities('backend');

      expect(capabilities).toEqual({
        name: 'backend',
        description: 'Backend development specialist',
        tools: ['write_file', 'bash', 'edit_file', 'query_database'],
        mcpConfig: expect.objectContaining({
          enabled: expect.arrayContaining([
            'enqueue_task',
            'get_next_task',
            'complete_task',
            'get_task_status',
            'get_transparency_log',
            'query_database',
            'call_endpoint'
          ]),
          config: {
            timeout: 30000,
            retries: 3,
            batch_size: 10
          }
        })
      });
    });

    it('should get agent capabilities for frontend', () => {
      const capabilities = factory.getAgentCapabilities('frontend');

      expect(capabilities).toEqual({
        name: 'frontend',
        description: 'Frontend development specialist',
        tools: ['write_file', 'edit_file', 'get_code', 'get_screenshot'],
        mcpConfig: expect.objectContaining({
          enabled: expect.arrayContaining([
            'enqueue_task',
            'get_next_task',
            'complete_task',
            'get_task_status',
            'get_transparency_log',
            'get_code',
            'get_screenshot',
            'get_metadata'
          ])
        })
      });
    });

    it('should return null for unknown agent type', () => {
      const capabilities = factory.getAgentCapabilities('unknown');

      expect(capabilities).toBeNull();
    });

    it('should throw error when getting capabilities without initialization', () => {
      const uninitializedFactory = new SpecializedAgentFactory();

      expect(() => uninitializedFactory.getAgentCapabilities('backend')).toThrow(
        'Factory not initialized'
      );
    });
  });

  describe('Validation', () => {
    beforeEach(async () => {
      await factory.initialize(mockAgentConfig);
    });

    it('should validate correct creation options', () => {
      const result = factory.validateCreationOptions('backend', defaultCreationOptions);

      expect(result).toBe(true);
    });

    it('should throw error for missing agent ID', () => {
      const invalidOptions = { ...defaultCreationOptions };
      delete invalidOptions.agentId;

      expect(() => factory.validateCreationOptions('backend', invalidOptions)).toThrow(
        'Agent ID and working directory are required'
      );
    });

    it('should throw error for missing working directory', () => {
      const invalidOptions = { ...defaultCreationOptions };
      delete invalidOptions.workingDirectory;

      expect(() => factory.validateCreationOptions('backend', invalidOptions)).toThrow(
        'Agent ID and working directory are required'
      );
    });

    it('should throw error for invalid agent ID format', () => {
      const invalidOptions = {
        ...defaultCreationOptions,
        agentId: 'invalid agent id with spaces!'
      };

      expect(() => factory.validateCreationOptions('backend', invalidOptions)).toThrow(
        'Agent ID must contain only alphanumeric characters, hyphens, and underscores'
      );
    });

    it('should accept valid agent ID formats', () => {
      const validIds = [
        'backend-001',
        'frontend_agent_123',
        'test-agent-001',
        'agent123',
        'AGENT_001'
      ];

      validIds.forEach(agentId => {
        expect(() => factory.validateCreationOptions('backend', {
          ...defaultCreationOptions,
          agentId
        })).not.toThrow();
      });
    });

    it('should throw error for unknown agent type in validation', () => {
      expect(() => factory.validateCreationOptions('unknown-agent', defaultCreationOptions)).toThrow(
        "Agent type 'unknown-agent' not found"
      );
    });
  });

  describe('MCP Configuration', () => {
    beforeEach(async () => {
      await factory.initialize(mockAgentConfig);
    });

    it('should include base MCP tools for all agents', async () => {
      const backendCapabilities = factory.getAgentCapabilities('backend');
      const frontendCapabilities = factory.getAgentCapabilities('frontend');

      const baseMCPTools = [
        'enqueue_task',
        'get_next_task',
        'complete_task',
        'get_task_status',
        'get_transparency_log'
      ];

      baseMCPTools.forEach(tool => {
        expect(backendCapabilities!.mcpConfig.enabled).toContain(tool);
        expect(frontendCapabilities!.mcpConfig.enabled).toContain(tool);
      });
    });

    it('should include agent-specific MCP tools', async () => {
      const backendCapabilities = factory.getAgentCapabilities('backend');
      const frontendCapabilities = factory.getAgentCapabilities('frontend');

      // Backend-specific tools
      expect(backendCapabilities!.mcpConfig.enabled).toContain('query_database');
      expect(backendCapabilities!.mcpConfig.enabled).toContain('call_endpoint');

      // Frontend-specific tools
      expect(frontendCapabilities!.mcpConfig.enabled).toContain('get_code');
      expect(frontendCapabilities!.mcpConfig.enabled).toContain('get_screenshot');
      expect(frontendCapabilities!.mcpConfig.enabled).toContain('get_metadata');
    });

    it('should configure MCP client settings correctly', async () => {
      const capabilities = factory.getAgentCapabilities('backend');

      expect(capabilities!.mcpConfig.config).toEqual({
        timeout: 30000,
        retries: 3,
        batch_size: 10
      });
    });
  });

  describe('Task-Specific Guidance', () => {
    beforeEach(async () => {
      await factory.initialize(mockAgentConfig);
    });

    it('should provide security-specific guidance', async () => {
      const securitySpec = {
        type: 'security',
        description: 'Security specialist',
        tools: ['read_file', 'grep'],
        specializations: ['Security Analysis'],
        promptTemplate: 'You are a security specialist...'
      };

      (mockAgentConfig.getAgentSpecialization as Mock).mockReturnValue(securitySpec);

      await factory.createAgent('security', {
        ...defaultCreationOptions,
        agentId: 'test-security-001',
        task: 'Perform security audit'
      });

      const actualCall = (ClaudeCodeMCPIntegration as Mock).mock.calls[0][0];
      const prompt = actualCall.promptTemplate;

      expect(prompt).toContain('OWASP Top 10');
      expect(prompt).toContain('authentication and authorization');
      expect(prompt).toContain('input validation issues');
    });

    it('should provide test-specific guidance', async () => {
      const testSpec = {
        type: 'test',
        description: 'Test specialist',
        tools: ['write_file', 'bash'],
        specializations: ['Test Automation'],
        promptTemplate: 'You are a test specialist...'
      };

      (mockAgentConfig.getAgentSpecialization as Mock).mockReturnValue(testSpec);

      await factory.createAgent('test', {
        ...defaultCreationOptions,
        agentId: 'test-test-001',
        task: 'Create comprehensive test suite'
      });

      const actualCall = (ClaudeCodeMCPIntegration as Mock).mock.calls[0][0];
      const prompt = actualCall.promptTemplate;

      expect(prompt).toContain('code coverage requirements');
      expect(prompt).toContain('unit tests for core functions');
      expect(prompt).toContain('integration tests for workflows');
    });

    it('should provide generic guidance for unknown task types', async () => {
      // Clear previous mock calls to get fresh state
      vi.clearAllMocks();
      
      await factory.createAgent('backend', {
        ...defaultCreationOptions,
        task: 'Some unknown task type'
      });

      const actualCall = (ClaudeCodeMCPIntegration as Mock).mock.calls[0][0];
      const prompt = actualCall.promptTemplate;

      expect(prompt).toContain('Analyze requirements and break into components');
      expect(prompt).toContain('Create necessary models and schemas');
      expect(prompt).toContain('Implement core business logic');
    });
  });
});