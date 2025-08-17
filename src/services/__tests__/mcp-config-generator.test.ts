/**
 * Tests for MCP Configuration Generator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPConfigGenerator } from '../mcp-config-generator.js';
import * as fsPromises from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

// Mock modules
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn()
  },
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn()
}));

vi.mock('fs', () => ({
  existsSync: vi.fn()
}));

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    checkIsRepo: vi.fn().mockResolvedValue(true),
    branch: vi.fn().mockResolvedValue({
      all: ['main', 'develop', 'feature/test'],
      current: 'main'
    })
  }))
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: ''
  }))
}));

describe('MCPConfigGenerator', () => {
  let generator: MCPConfigGenerator;
  let mockWorkingDir: string;
  
  beforeEach(() => {
    mockWorkingDir = '/test/project';
    generator = new MCPConfigGenerator(mockWorkingDir);
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('Framework Detection', () => {
    it('should detect Next.js project', async () => {
      const mockPackageJson = {
        dependencies: {
          'next': '14.0.0',
          'react': '18.0.0',
          'react-dom': '18.0.0'
        }
      };
      
      vi.mocked(existsSync).mockImplementation((path) => {
        if (path.includes('package.json')) return true;
        return false;
      });
      
      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify(mockPackageJson)
      );
      
      const settings = await generator.generate();
      
      expect(settings.projectContext?.frameworks).toContain('nextjs');
      expect(settings.projectContext?.frameworks).toContain('react');
      expect(settings.projectContext?.type).toBe('frontend');
    });
    
    it('should detect Encore backend project', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (path.includes('encore.app')) return true;
        return false;
      });
      
      const settings = await generator.generate();
      
      expect(settings.projectContext?.frameworks).toContain('encore');
      expect(settings.projectContext?.type).toBe('backend');
      expect(settings.mcpServers['postgres-mcp']).toBeDefined();
    });
    
    it('should detect Python project with Django', async () => {
      const mockRequirements = `
django==4.2.0
djangorestframework==3.14.0
psycopg2==2.9.0
      `;
      
      vi.mocked(existsSync).mockImplementation((path) => {
        if (path.includes('requirements.txt')) return true;
        return false;
      });
      
      vi.mocked(fsPromises.readFile).mockResolvedValue(mockRequirements);
      
      const settings = await generator.generate();
      
      expect(settings.projectContext?.frameworks).toContain('python');
      expect(settings.projectContext?.frameworks).toContain('django');
      expect(settings.projectContext?.type).toBe('backend');
    });
    
    it('should detect Docker configuration', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (path.includes('docker-compose.yml')) return true;
        if (path.includes('Dockerfile')) return true;
        return false;
      });
      
      const settings = await generator.generate();
      
      expect(settings.projectContext?.frameworks).toContain('docker');
      expect(settings.projectContext?.hasDocker).toBe(true);
      expect(settings.mcpServers['docker-mcp']).toBeDefined();
    });
  });
  
  describe('MCP Server Configuration', () => {
    it('should always include core MCP servers', async () => {
      const settings = await generator.generate();
      
      // Core servers that should always be present
      expect(settings.mcpServers['filesystem']).toBeDefined();
      expect(settings.mcpServers['graphyn-mcp']).toBeDefined();
      
      // Filesystem server configuration
      expect(settings.mcpServers['filesystem'].command).toBe('npx');
      expect(settings.mcpServers['filesystem'].args).toContain(
        '@modelcontextprotocol/server-filesystem'
      );
      
      // Graphyn MCP configuration
      expect(settings.mcpServers['graphyn-mcp'].command).toBe('graphyn');
      expect(settings.mcpServers['graphyn-mcp'].args).toContain('mcp');
    });
    
    it('should add GitHub MCP for git repositories', async () => {
      // simpleGit is already mocked to return true for checkIsRepo
      const settings = await generator.generate();
      
      expect(settings.mcpServers['github']).toBeDefined();
      expect(settings.mcpServers['github'].env).toHaveProperty(
        'GITHUB_PERSONAL_ACCESS_TOKEN'
      );
    });
    
    it('should add Figma MCP for frontend projects', async () => {
      const mockPackageJson = {
        dependencies: {
          'react': '18.0.0'
        }
      };
      
      vi.mocked(existsSync).mockImplementation((path) => {
        if (path.includes('package.json')) return true;
        return false;
      });
      
      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify(mockPackageJson)
      );
      
      const settings = await generator.generate();
      
      expect(settings.mcpServers['figma-mcp']).toBeDefined();
      expect(settings.mcpServers['figma-mcp'].env).toHaveProperty(
        'FIGMA_PERSONAL_ACCESS_TOKEN'
      );
    });
  });
  
  describe('Settings Management', () => {
    it('should save settings to .claude/settings.json', async () => {
      const settings = await generator.generate();
      await generator.save(settings);
      
      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        path.join(mockWorkingDir, '.claude'),
        { recursive: true }
      );
      
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        path.join(mockWorkingDir, '.claude', 'settings.json'),
        expect.any(String)
      );
      
      // Verify the written content is valid JSON
      const writtenContent = vi.mocked(fsPromises.writeFile).mock.calls[0][1];
      expect(() => JSON.parse(writtenContent as string)).not.toThrow();
    });
    
    it('should merge with existing settings', async () => {
      const existingSettings = {
        mcpServers: {
          'custom-server': {
            command: 'custom',
            args: ['--test']
          }
        },
        projectContext: {
          name: 'existing-project',
          type: 'backend',
          mainBranch: 'master',
          workingDirectory: mockWorkingDir
        }
      };
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify(existingSettings)
      );
      
      const newSettings = await generator.generate();
      await generator.save(newSettings);
      
      const writtenContent = vi.mocked(fsPromises.writeFile).mock.calls[0][1];
      const savedSettings = JSON.parse(writtenContent as string);
      
      // Should preserve custom server
      expect(savedSettings.mcpServers['custom-server']).toBeDefined();
      // Should have new servers
      expect(savedSettings.mcpServers['filesystem']).toBeDefined();
      expect(savedSettings.mcpServers['graphyn-mcp']).toBeDefined();
    });
  });
  
  describe('Project Context', () => {
    it('should build correct project context', async () => {
      const settings = await generator.generate();
      
      expect(settings.projectContext).toBeDefined();
      expect(settings.projectContext?.name).toBe('project');
      expect(settings.projectContext?.mainBranch).toBe('main');
      expect(settings.projectContext?.workingDirectory).toBe(mockWorkingDir);
    });
    
    it('should detect main branch correctly', async () => {
      // Already mocked in beforeEach to return 'main'
      const settings = await generator.generate();
      
      expect(settings.projectContext?.mainBranch).toBe('main');
    });
  });
  
  describe('Validation', () => {
    it('should validate server availability', async () => {
      const settings = await generator.generate();
      const validation = await generator.validateServers(settings);
      
      // All npx-based servers should be marked as available
      expect(validation.get('filesystem')).toBe(true);
      expect(validation.get('github')).toBe(true);
      
      // Graphyn MCP availability depends on whether CLI is installed
      // This test would need actual system checks
    });
  });
});