/**
 * Agent Tool System
 * 
 * Provides real file system, bash, and MCP tool integrations for agents
 */

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { EventEmitter } from 'events';

const execAsync = promisify(exec);

export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  output?: string;
}

export class AgentToolSystem extends EventEmitter {
  private workingDirectory: string;
  private allowedPaths: string[];

  constructor(workingDirectory: string = process.cwd()) {
    super();
    this.workingDirectory = workingDirectory;
    this.allowedPaths = [workingDirectory]; // Security: restrict file operations
  }

  getAvailableTools(): Tool[] {
    return [
      {
        name: 'write_file',
        description: 'Write content to a file',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to working directory' },
            content: { type: 'string', description: 'File content to write' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'read_file',
        description: 'Read content from a file',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to working directory' }
          },
          required: ['path']
        }
      },
      {
        name: 'bash_command',
        description: 'Execute a bash command safely',
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Bash command to execute' },
            timeout: { type: 'number', description: 'Timeout in milliseconds', default: 30000 }
          },
          required: ['command']
        }
      },
      {
        name: 'list_files',
        description: 'List files and directories',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path to list (default: current directory)' },
            recursive: { type: 'boolean', description: 'List recursively', default: false }
          }
        }
      },
      {
        name: 'create_directory',
        description: 'Create a directory',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path to create' }
          },
          required: ['path']
        }
      }
    ];
  }

  async executeTool(toolName: string, input: any): Promise<ToolExecutionResult> {
    try {
      this.emit('tool_start', { toolName, input });

      switch (toolName) {
        case 'write_file':
          return await this.writeFile(input.path, input.content);
        
        case 'read_file':
          return await this.readFile(input.path);
        
        case 'bash_command':
          return await this.executeBashCommand(input.command, input.timeout || 30000);
        
        case 'list_files':
          return await this.listFiles(input.path || '.', input.recursive || false);
        
        case 'create_directory':
          return await this.createDirectory(input.path);
        
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('tool_error', { toolName, input, error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      this.emit('tool_complete', { toolName, input });
    }
  }

  private async writeFile(filePath: string, content: string): Promise<ToolExecutionResult> {
    const fullPath = this.resolvePath(filePath);
    
    if (!this.isPathAllowed(fullPath)) {
      return { success: false, error: `Path not allowed: ${filePath}` };
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write file
      await fs.writeFile(fullPath, content, 'utf-8');
      
      return { 
        success: true, 
        result: `File written successfully: ${filePath}`,
        output: `✅ Created/Updated file: ${filePath} (${content.length} characters)`
      };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private async readFile(filePath: string): Promise<ToolExecutionResult> {
    const fullPath = this.resolvePath(filePath);
    
    if (!this.isPathAllowed(fullPath)) {
      return { success: false, error: `Path not allowed: ${filePath}` };
    }

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      
      return { 
        success: true, 
        result: content,
        output: `📖 Read file: ${filePath} (${content.length} characters)`
      };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private async executeBashCommand(command: string, timeout: number): Promise<ToolExecutionResult> {
    // Security: block dangerous commands
    const dangerousPatterns = [
      /rm\s+-rf\s+\//, // rm -rf /
      />\s*\/dev\/sda/, // overwrite disk
      /curl.*\|\s*sh/, // pipe curl to shell
      /wget.*\|\s*sh/, // pipe wget to shell
      /sudo\s+/, // sudo commands
    ];

    if (dangerousPatterns.some(pattern => pattern.test(command))) {
      return { success: false, error: `Command blocked for security: ${command}` };
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workingDirectory,
        timeout,
        maxBuffer: 1024 * 1024 // 1MB buffer
      });

      return {
        success: true,
        result: stdout,
        output: `🔧 Executed: ${command}\n${stdout}${stderr ? `\nStderr: ${stderr}` : ''}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Command failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async listFiles(dirPath: string, recursive: boolean): Promise<ToolExecutionResult> {
    const fullPath = this.resolvePath(dirPath);
    
    if (!this.isPathAllowed(fullPath)) {
      return { success: false, error: `Path not allowed: ${dirPath}` };
    }

    try {
      const files = await this.listFilesRecursive(fullPath, recursive);
      
      return {
        success: true,
        result: files,
        output: `📁 Listed ${files.length} items in ${dirPath}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async listFilesRecursive(dirPath: string, recursive: boolean): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(this.workingDirectory, fullPath);

      if (entry.isDirectory()) {
        files.push(`${relativePath}/`);
        if (recursive) {
          const subFiles = await this.listFilesRecursive(fullPath, recursive);
          files.push(...subFiles);
        }
      } else {
        files.push(relativePath);
      }
    }

    return files;
  }

  private async createDirectory(dirPath: string): Promise<ToolExecutionResult> {
    const fullPath = this.resolvePath(dirPath);
    
    if (!this.isPathAllowed(fullPath)) {
      return { success: false, error: `Path not allowed: ${dirPath}` };
    }

    try {
      await fs.mkdir(fullPath, { recursive: true });
      
      return {
        success: true,
        result: `Directory created: ${dirPath}`,
        output: `📁 Created directory: ${dirPath}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(this.workingDirectory, filePath);
  }

  private isPathAllowed(fullPath: string): boolean {
    return this.allowedPaths.some(allowedPath => {
      const resolvedAllowedPath = path.resolve(allowedPath);
      return fullPath.startsWith(resolvedAllowedPath);
    });
  }

  addAllowedPath(pathToAdd: string): void {
    const resolvedPath = path.resolve(pathToAdd);
    if (!this.allowedPaths.includes(resolvedPath)) {
      this.allowedPaths.push(resolvedPath);
    }
  }

  getWorkingDirectory(): string {
    return this.workingDirectory;
  }

  setWorkingDirectory(newDirectory: string): void {
    this.workingDirectory = newDirectory;
    this.allowedPaths = [newDirectory, ...this.allowedPaths.filter(p => p !== this.workingDirectory)];
  }
}

export default AgentToolSystem;