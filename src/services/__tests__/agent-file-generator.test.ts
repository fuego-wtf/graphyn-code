import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { AgentFileGenerator } from '../agent-file-generator.js';
import type { AgentConfig, AgentTask } from '../agent-file-generator.js';

describe('AgentFileGenerator', () => {
  const testDir = '/tmp/test-agent-generator';
  let generator: AgentFileGenerator;

  beforeEach(async () => {
    // Clean up and create test directory
    if (existsSync(testDir)) {
      await fs.rm(testDir, { recursive: true });
    }
    await fs.mkdir(testDir, { recursive: true });
    generator = new AgentFileGenerator(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await fs.rm(testDir, { recursive: true });
    }
  });

  describe('generateAgentFiles', () => {
    it('should create .claude/agents directory structure', async () => {
      const agents: AgentConfig[] = [
        {
          id: 'architect',
          name: 'System Architect',
          role: 'an expert system architect',
          tasks: [
            {
              id: 'task-1',
              title: 'Design database schema',
              description: 'Create the database schema for the todo application',
              successCriteria: [
                'Schema defined in schema.sql',
                'All tables have proper constraints',
                'Indexes created for performance'
              ]
            }
          ]
        }
      ];

      await generator.generateAgentFiles(agents);

      // Check directories exist
      expect(existsSync(path.join(testDir, '.claude'))).toBe(true);
      expect(existsSync(path.join(testDir, '.claude', 'agents'))).toBe(true);
      
      // Check agent file exists
      const agentFile = path.join(testDir, '.claude', 'agents', 'architect.md');
      expect(existsSync(agentFile)).toBe(true);
    });

    it('should generate minimal agent markdown files', async () => {
      const agents: AgentConfig[] = [
        {
          id: 'backend-developer',
          name: 'Backend Developer',
          role: 'a senior backend developer',
          model: 'claude-3-opus-20240229',
          tasks: [
            {
              id: 'task-1',
              title: 'Create REST API',
              description: 'Implement CRUD endpoints for todos',
              successCriteria: [
                'All CRUD endpoints working',
                'Input validation implemented',
                'Error handling in place'
              ],
              dependencies: ['architect']
            }
          ],
          dependencies: ['architect'],
          mcpTools: ['filesystem', 'postgres-mcp', 'graphyn-mcp']
        }
      ];

      const options = {
        userInstructions: 'Use TypeScript and Express.js',
        repositoryContext: {
          name: 'todo-app',
          frameworks: ['Next.js', 'Express'],
          language: 'TypeScript',
          database: 'PostgreSQL'
        }
      };

      await generator.generateAgentFiles(agents, options);

      // Read generated file
      const agentFile = path.join(testDir, '.claude', 'agents', 'backend-developer.md');
      const content = await fs.readFile(agentFile, 'utf-8');

      // Check content includes key sections
      expect(content).toContain('name: backend-developer');
      expect(content).toContain('model: claude-3-opus-20240229');
      expect(content).toContain('You are a senior backend developer');
      expect(content).toContain('## Your Current Task');
      expect(content).toContain('Create REST API');
      expect(content).toContain('## Repository Context');
      expect(content).toContain('## Available MCP Tools');
      expect(content).toContain('## Dependencies');
      expect(content).toContain('Use TypeScript and Express.js');
    });

    it('should handle multiple agents with dependencies', async () => {
      const agents: AgentConfig[] = [
        {
          id: 'architect',
          name: 'System Architect',
          role: 'an expert system architect',
          tasks: [
            {
              id: 'design',
              title: 'Design system architecture',
              description: 'Create system design',
              successCriteria: ['Architecture documented']
            }
          ]
        },
        {
          id: 'backend',
          name: 'Backend Developer',
          role: 'a backend developer',
          tasks: [
            {
              id: 'api',
              title: 'Build API',
              description: 'Create REST API',
              successCriteria: ['API working']
            }
          ],
          dependencies: ['architect']
        },
        {
          id: 'frontend',
          name: 'Frontend Developer',
          role: 'a frontend developer',
          tasks: [
            {
              id: 'ui',
              title: 'Build UI',
              description: 'Create user interface',
              successCriteria: ['UI complete']
            }
          ],
          dependencies: ['architect']
        }
      ];

      const files = await generator.generateAgentFiles(agents);

      // Check all files created
      expect(files).toHaveLength(3);
      expect(files).toContain(path.join(testDir, '.claude', 'agents', 'architect.md'));
      expect(files).toContain(path.join(testDir, '.claude', 'agents', 'backend.md'));
      expect(files).toContain(path.join(testDir, '.claude', 'agents', 'frontend.md'));

      // Check backend has dependency on architect
      const backendContent = await fs.readFile(
        path.join(testDir, '.claude', 'agents', 'backend.md'),
        'utf-8'
      );
      expect(backendContent).toContain('## Dependencies');
      expect(backendContent).toContain('architect');
    });

    it('should show multiple tasks with current and upcoming', async () => {
      const agents: AgentConfig[] = [
        {
          id: 'developer',
          name: 'Full Stack Developer',
          role: 'a full stack developer',
          tasks: [
            {
              id: 'task-1',
              title: 'Setup project',
              description: 'Initialize the project structure',
              successCriteria: ['Project initialized']
            },
            {
              id: 'task-2',
              title: 'Create database',
              description: 'Setup PostgreSQL database',
              successCriteria: ['Database created']
            },
            {
              id: 'task-3',
              title: 'Build API',
              description: 'Create REST endpoints',
              successCriteria: ['API working']
            }
          ]
        }
      ];

      await generator.generateAgentFiles(agents);

      const content = await fs.readFile(
        path.join(testDir, '.claude', 'agents', 'developer.md'),
        'utf-8'
      );

      // Current task should be the first one
      expect(content).toContain('## Your Current Task');
      expect(content).toContain('Setup project');
      
      // Other tasks should be listed as upcoming
      expect(content).toContain('### Upcoming Tasks');
      expect(content).toContain('Create database');
      expect(content).toContain('Build API');
    });
  });

  describe('cleanupOldAgents', () => {
    it('should remove old agent files', async () => {
      // Create some agent files
      const agentsDir = path.join(testDir, '.claude', 'agents');
      await fs.mkdir(agentsDir, { recursive: true });
      await fs.writeFile(path.join(agentsDir, 'old-agent.md'), 'old content');
      await fs.writeFile(path.join(agentsDir, 'another.md'), 'content');
      
      // Clean up
      await generator.cleanupOldAgents();
      
      // Check files are gone
      const files = await fs.readdir(agentsDir);
      expect(files).toHaveLength(0);
    });
  });

  describe('readAgentFiles', () => {
    it('should read existing agent files', async () => {
      // Create some agent files
      const agentsDir = path.join(testDir, '.claude', 'agents');
      await fs.mkdir(agentsDir, { recursive: true });
      await fs.writeFile(path.join(agentsDir, 'agent1.md'), 'Agent 1 content');
      await fs.writeFile(path.join(agentsDir, 'agent2.md'), 'Agent 2 content');
      
      // Read files
      const agents = await generator.readAgentFiles();
      
      expect(agents.size).toBe(2);
      expect(agents.get('agent1')).toBe('Agent 1 content');
      expect(agents.get('agent2')).toBe('Agent 2 content');
    });
  });

  describe('updateAgentTask', () => {
    it('should update an agent\'s current task', async () => {
      // First create an agent
      const agents: AgentConfig[] = [
        {
          id: 'developer',
          name: 'Developer',
          role: 'a developer',
          tasks: [
            {
              id: 'task-1',
              title: 'Initial task',
              description: 'Do something',
              successCriteria: ['Complete']
            }
          ]
        }
      ];

      await generator.generateAgentFiles(agents);

      // Update the task
      const newTask: AgentTask = {
        id: 'task-2',
        title: 'Updated task',
        description: 'Do something else',
        successCriteria: ['New criteria']
      };

      await generator.updateAgentTask('developer', newTask);

      // Read and verify
      const content = await fs.readFile(
        path.join(testDir, '.claude', 'agents', 'developer.md'),
        'utf-8'
      );

      expect(content).toContain('Updated task');
      expect(content).toContain('Do something else');
      expect(content).toContain('New criteria');
    });
  });
});