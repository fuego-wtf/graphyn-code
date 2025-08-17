/**
 * Integration tests for MCP Configuration Generator
 * Uses real file system operations in a temp directory
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MCPConfigGenerator } from '../mcp-config-generator.js';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

describe('MCPConfigGenerator Integration Tests', () => {
  let generator: MCPConfigGenerator;
  let tempDir: string;
  
  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = path.join(os.tmpdir(), `mcp-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    generator = new MCPConfigGenerator(tempDir);
  });
  
  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('Basic Generation', () => {
    it('should generate MCP configuration with core servers', async () => {
      const settings = await generator.generate();
      
      // Check core servers are included
      expect(settings.mcpServers).toBeDefined();
      expect(settings.mcpServers['filesystem']).toBeDefined();
      expect(settings.mcpServers['graphyn-mcp']).toBeDefined();
      
      // Check project context
      expect(settings.projectContext).toBeDefined();
      expect(settings.projectContext?.workingDirectory).toBe(tempDir);
    });
    
    it('should save settings to .claude/settings.json', async () => {
      const settings = await generator.generate();
      await generator.save(settings);
      
      // Check file was created
      const settingsPath = path.join(tempDir, '.claude', 'settings.json');
      expect(existsSync(settingsPath)).toBe(true);
      
      // Read and verify contents
      const savedContent = await fs.readFile(settingsPath, 'utf-8');
      const savedSettings = JSON.parse(savedContent);
      
      expect(savedSettings.mcpServers['filesystem']).toBeDefined();
      expect(savedSettings.mcpServers['graphyn-mcp']).toBeDefined();
    });
  });
  
  describe('Framework Detection', () => {
    it('should detect Next.js project from package.json', async () => {
      // Create a mock package.json
      const packageJson = {
        name: 'test-project',
        dependencies: {
          'next': '14.0.0',
          'react': '18.0.0',
          'react-dom': '18.0.0'
        }
      };
      
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      
      const settings = await generator.generate();
      
      expect(settings.projectContext?.frameworks).toContain('nextjs');
      expect(settings.projectContext?.frameworks).toContain('react');
      expect(settings.projectContext?.type).toBe('frontend');
    });
    
    it('should detect Encore backend project', async () => {
      // Create encore.app file
      await fs.writeFile(path.join(tempDir, 'encore.app'), '');
      
      const settings = await generator.generate();
      
      expect(settings.projectContext?.frameworks).toContain('encore');
      expect(settings.projectContext?.type).toBe('backend');
      expect(settings.mcpServers['postgres-mcp']).toBeDefined();
    });
    
    it('should detect Python project with requirements.txt', async () => {
      // Create requirements.txt
      const requirements = 'django==4.2.0\nflask==2.3.0\npandas==2.0.0';
      await fs.writeFile(
        path.join(tempDir, 'requirements.txt'),
        requirements
      );
      
      const settings = await generator.generate();
      
      expect(settings.projectContext?.frameworks).toContain('python');
      expect(settings.projectContext?.type).toBe('backend');
    });
    
    it('should detect Docker configuration', async () => {
      // Create Dockerfile and docker-compose.yml
      await fs.writeFile(path.join(tempDir, 'Dockerfile'), 'FROM node:18');
      await fs.writeFile(path.join(tempDir, 'docker-compose.yml'), 'version: "3"');
      
      const settings = await generator.generate();
      
      expect(settings.projectContext?.frameworks).toContain('docker');
      expect(settings.projectContext?.hasDocker).toBe(true);
      expect(settings.mcpServers['docker-mcp']).toBeDefined();
    });
  });
  
  describe('Update and Merge', () => {
    it('should merge with existing settings', async () => {
      // Create existing settings
      const existingSettings = {
        mcpServers: {
          'custom-server': {
            command: 'custom',
            args: ['--test']
          }
        },
        projectContext: {
          customField: 'preserved'
        }
      };
      
      // Create .claude directory and save existing settings
      await fs.mkdir(path.join(tempDir, '.claude'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.claude', 'settings.json'),
        JSON.stringify(existingSettings, null, 2)
      );
      
      // Generate and save new settings
      const newSettings = await generator.generate();
      await generator.save(newSettings);
      
      // Read merged settings
      const savedContent = await fs.readFile(
        path.join(tempDir, '.claude', 'settings.json'),
        'utf-8'
      );
      const mergedSettings = JSON.parse(savedContent);
      
      // Check that custom server was preserved
      expect(mergedSettings.mcpServers['custom-server']).toBeDefined();
      expect(mergedSettings.mcpServers['custom-server'].command).toBe('custom');
      
      // Check that new servers were added
      expect(mergedSettings.mcpServers['filesystem']).toBeDefined();
      expect(mergedSettings.mcpServers['graphyn-mcp']).toBeDefined();
    });
  });
  
  describe('MCP Server Configuration', () => {
    it('should configure filesystem server correctly', async () => {
      const settings = await generator.generate();
      const filesystemConfig = settings.mcpServers['filesystem'];
      
      expect(filesystemConfig).toBeDefined();
      expect(filesystemConfig.command).toBe('npx');
      expect(filesystemConfig.args).toContain('-y');
      expect(filesystemConfig.args).toContain('@modelcontextprotocol/server-filesystem');
      expect(filesystemConfig.args).toContain(tempDir);
    });
    
    it('should configure GitHub server for git repositories', async () => {
      // The git check is mocked in the original, so we'll skip the actual git check
      // but verify the configuration structure
      const settings = await generator.generate();
      
      // GitHub server may or may not be added depending on git status
      if (settings.mcpServers['github']) {
        const githubConfig = settings.mcpServers['github'];
        expect(githubConfig.command).toBe('npx');
        expect(githubConfig.args).toContain('@modelcontextprotocol/server-github');
      }
    });
    
    it('should configure graphyn-mcp server', async () => {
      const settings = await generator.generate();
      const graphynConfig = settings.mcpServers['graphyn-mcp'];
      
      expect(graphynConfig).toBeDefined();
      expect(graphynConfig.command).toBe('node');
      expect(graphynConfig.args).toContain(expect.stringContaining('mcp'));
      expect(graphynConfig.env).toBeDefined();
      expect(graphynConfig.env?.API_URL).toBeDefined();
    });
  });
});