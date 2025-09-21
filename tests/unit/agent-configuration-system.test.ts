import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentConfigurationSystem } from '../../src/core/AgentConfigurationSystem';
import { join } from 'path';

describe('Agent Configuration System', () => {
  let configSystem: AgentConfigurationSystem;
  const configPath = join(process.cwd(), 'config', 'agent-specializations.json');

  beforeEach(() => {
    configSystem = new AgentConfigurationSystem(configPath);
  });

  describe('Configuration Loading', () => {
    it('should load agent configuration successfully', async () => {
      const config = await configSystem.loadConfiguration();
      
      expect(config).toBeDefined();
      expect(config.version).toBe('1.0.0');
      expect(config.agentTypes).toBeDefined();
      expect(Object.keys(config.agentTypes)).toHaveLength(6);
    });

    it('should validate configuration structure', async () => {
      await configSystem.loadConfiguration();
      
      const stats = configSystem.getStats();
      expect(stats.agentsCount).toBe(6);
      expect(stats.workflowsCount).toBe(3);
      expect(stats.mcpEnabled).toBe(true);
      expect(stats.figmaEnabled).toBe(true);
    });
  });

  describe('Agent Specializations', () => {
    beforeEach(async () => {
      await configSystem.loadConfiguration();
    });

    it('should retrieve agent specialization by type', () => {
      const backendAgent = configSystem.getAgentSpecialization('backend');
      
      expect(backendAgent).toBeDefined();
      expect(backendAgent?.name).toBe('Backend Implementor');
      expect(backendAgent?.capabilities).toContain('api_development');
      expect(backendAgent?.defaultTools).toContain('write_file');
      expect(backendAgent?.priority).toBe(8);
    });

    it('should return null for unknown agent type', () => {
      const unknownAgent = configSystem.getAgentSpecialization('unknown');
      expect(unknownAgent).toBeNull();
    });

    it('should get all available agent types', () => {
      const agentTypes = configSystem.getAvailableAgentTypes();
      
      expect(agentTypes).toContain('backend');
      expect(agentTypes).toContain('frontend');
      expect(agentTypes).toContain('security');
      expect(agentTypes).toContain('test');
      expect(agentTypes).toContain('figma');
      expect(agentTypes).toContain('devops');
    });

    it('should load agent prompt templates', async () => {
      const backendPrompt = configSystem.getAgentPrompt('backend');
      const frontendPrompt = configSystem.getAgentPrompt('frontend');
      
      expect(backendPrompt).toBeDefined();
      expect(backendPrompt).toContain('Backend Implementor');
      expect(frontendPrompt).toBeDefined();
      expect(frontendPrompt).toContain('Frontend Builder');
    });
  });

  describe('Workflows', () => {
    beforeEach(async () => {
      await configSystem.loadConfiguration();
    });

    it('should retrieve workflow by name', () => {
      const fullStackWorkflow = configSystem.getWorkflow('full-stack-development');
      
      expect(fullStackWorkflow).toBeDefined();
      expect(fullStackWorkflow?.steps).toHaveLength(6);
      expect(fullStackWorkflow?.steps[0].agent).toBe('figma');
    });

    it('should get available workflows', () => {
      const workflows = configSystem.getAvailableWorkflows();
      
      expect(workflows).toContain('full-stack-development');
      expect(workflows).toContain('api-development');
      expect(workflows).toContain('ui-implementation');
    });
  });

  describe('Integration Settings', () => {
    beforeEach(async () => {
      await configSystem.loadConfiguration();
    });

    it('should check MCP integration status', () => {
      expect(configSystem.isMCPEnabled()).toBe(true);
      
      const mcpTools = configSystem.getMCPCoordinationTools();
      expect(mcpTools).toContain('enqueue_task');
      expect(mcpTools).toContain('get_next_task');
      expect(mcpTools).toContain('complete_task');
      expect(mcpTools).toContain('get_task_status');
    });

    it('should check Figma integration status', () => {
      expect(configSystem.isFigmaEnabled()).toBe(true);
      
      const figmaTools = configSystem.getFigmaExtractionTools();
      expect(figmaTools).toContain('add_figma_file');
      expect(figmaTools).toContain('get_metadata');
      expect(figmaTools).toContain('get_code');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when configuration file not found', async () => {
      const invalidConfigSystem = new AgentConfigurationSystem('/invalid/path.json');
      
      await expect(invalidConfigSystem.loadConfiguration()).rejects.toThrow('Agent configuration file not found');
    });

    it('should throw error when accessing config before loading', () => {
      const newConfigSystem = new AgentConfigurationSystem();
      
      expect(() => newConfigSystem.getAvailableAgentTypes()).toThrow('Configuration not loaded');
      expect(() => newConfigSystem.getAgentSpecialization('backend')).toThrow('Configuration not loaded');
    });
  });
});