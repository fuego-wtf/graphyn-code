import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MCPIntegrationOptions {
  agentId: string;
  agentType: string;
  promptTemplate: string;
  task?: string;
  context?: any;
  workingDirectory: string;
  mcpServerConfig?: string;
  verbose?: boolean;
  debug?: boolean;
}

export interface ClaudeMessage {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_stop' | 'tool_use' | 'error';
  content?: string;
  tool?: {
    name: string;
    input: any;
  };
  error?: {
    type: string;
    message: string;
  };
}

/**
 * ClaudeCodeMCPIntegration - Bridge between GraphynOrchestrator and Claude Code SDK
 * 
 * Manages Claude Code subprocess with MCP client configuration, handles stdio
 * transport, parses stream-json output, and provides event-driven interface.
 */
export class ClaudeCodeMCPIntegration extends EventEmitter {
  private options: MCPIntegrationOptions;
  private claudeProcess?: ChildProcess;
  private processId: number = 0;
  private isRunning: boolean = false;
  private connected: boolean = false;
  private startTime?: Date;
  private messageBuffer: string = '';

  constructor(options: MCPIntegrationOptions) {
    super();
    this.options = {
      mcpServerConfig: path.join(__dirname, '../../config/claude-mcp-client.json'),
      verbose: false,
      debug: false,
      ...options
    };
  }

  /**
   * Start the Claude Code process with MCP integration
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error(`Agent ${this.options.agentId} is already running`);
    }

    try {
      await this.spawnClaudeProcess();
      this.setupProcessEventListeners();
      this.isRunning = true;
      this.startTime = new Date();
      
      this.emit('started', {
        agentId: this.options.agentId,
        pid: this.processId,
        startTime: this.startTime
      });

      if (this.options.verbose) {
        console.log(`🚀 Claude Code agent ${this.options.agentId} started [PID: ${this.processId}]`);
      }

      // Send initial prompt and context
      await this.sendInitialPrompt();
      
    } catch (error) {
      this.emit('failed', error);
      throw error;
    }
  }

  /**
   * Stop the Claude Code process
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.claudeProcess) {
      return;
    }

    try {
      // Gracefully terminate the process
      this.claudeProcess.stdin?.write('\x03'); // Send Ctrl+C
      this.claudeProcess.kill('SIGTERM');
      
      // Wait for process to terminate
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.claudeProcess?.kill('SIGKILL'); // Force kill if not responding
          reject(new Error('Process termination timeout'));
        }, 5000);

        this.claudeProcess?.on('close', () => {
          clearTimeout(timeout);
          resolve(void 0);
        });
      });

      this.isRunning = false;
      this.connected = false;
      this.processId = 0;
      
      this.emit('stopped', { agentId: this.options.agentId });
      
      if (this.options.verbose) {
        console.log(`🛑 Claude Code agent ${this.options.agentId} stopped`);
      }
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Send a message to the Claude Code process
   */
  async sendMessage(message: string): Promise<void> {
    if (!this.isRunning || !this.claudeProcess?.stdin) {
      throw new Error(`Agent ${this.options.agentId} is not running`);
    }

    try {
      this.claudeProcess.stdin.write(message + '\n');
      
      if (this.options.debug) {
        console.log(`📤 Agent ${this.options.agentId}: ${message}`);
      }
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get the process ID of the Claude Code process
   */
  getProcessId(): number {
    return this.processId;
  }

  /**
   * Check if the integration is connected and running
   */
  isConnected(): boolean {
    return this.connected && this.isRunning;
  }

  /**
   * Get runtime statistics
   */
  getStats(): {
    agentId: string;
    pid: number;
    isRunning: boolean;
    isConnected: boolean;
    uptime?: number;
    memoryUsage?: NodeJS.MemoryUsage;
  } {
    const stats = {
      agentId: this.options.agentId,
      pid: this.processId,
      isRunning: this.isRunning,
      isConnected: this.connected,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : undefined,
      memoryUsage: process.memoryUsage() // This gives us the Node.js process memory, not the Claude subprocess
    };

    return stats;
  }

  /**
   * Spawn the Claude Code process with MCP configuration
   */
  private async spawnClaudeProcess(): Promise<void> {
    const claudeArgs = this.buildClaudeArguments();
    
    if (this.options.debug) {
      console.log(`🚀 Spawning Claude Code: claude ${claudeArgs.join(' ')}`);
    }

    this.claudeProcess = spawn('claude', claudeArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.options.workingDirectory,
      env: {
        ...process.env,
        CLAUDE_MCP_CONFIG: this.options.mcpServerConfig,
        GRAPHYN_AGENT_ID: this.options.agentId,
        GRAPHYN_AGENT_TYPE: this.options.agentType
      }
    });

    if (!this.claudeProcess.pid) {
      throw new Error('Failed to spawn Claude Code process');
    }

    this.processId = this.claudeProcess.pid;

    // Wait for process to be ready
    await this.waitForProcessReady();
  }

  /**
   * Build Claude Code command arguments
   */
  private buildClaudeArguments(): string[] {
    const args: string[] = [];

    // Enable MCP integration
    args.push('--mcp-config', this.options.mcpServerConfig!);
    
    // Enable stream-json output for parsing
    args.push('--stream-json');
    
    // Set working directory
    args.push('--working-dir', this.options.workingDirectory);
    
    // Verbose mode if requested
    if (this.options.verbose) {
      args.push('--verbose');
    }

    // Debug mode if requested
    if (this.options.debug) {
      args.push('--debug');
    }

    // Specialized prompt template
    args.push('--prompt-template', this.options.promptTemplate);

    return args;
  }

  /**
   * Wait for Claude Code process to be ready
   */
  private async waitForProcessReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Claude Code process startup timeout'));
      }, 10000); // 10 second timeout

      const onReady = () => {
        clearTimeout(timeout);
        this.isConnected = true;
        resolve();
      };

      const onError = (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      };

      // Listen for initial ready signal
      this.once('ready', onReady);
      this.once('error', onError);
    });
  }

  /**
   * Set up event listeners for the Claude Code process
   */
  private setupProcessEventListeners(): void {
    if (!this.claudeProcess) return;

    // Handle stdout (stream-json messages)
    this.claudeProcess.stdout?.on('data', (data: Buffer) => {
      this.handleStreamData(data.toString());
    });

    // Handle stderr (errors and debug info)
    this.claudeProcess.stderr?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      
      if (this.options.debug) {
        console.log(`🔍 Agent ${this.options.agentId} stderr: ${message}`);
      }

      // Check for ready signal in stderr
      if (message.includes('Ready for input') || message.includes('MCP client connected')) {
        this.emit('ready');
      }
    });

    // Handle process exit
    this.claudeProcess.on('close', (code: number | null, signal: string | null) => {
      this.isRunning = false;
      this.isConnected = false;
      
      if (code === 0) {
        this.emit('completed');
      } else {
        this.emit('failed', new Error(`Process exited with code ${code}, signal ${signal}`));
      }

      if (this.options.verbose) {
        console.log(`🏁 Agent ${this.options.agentId} process closed [code: ${code}, signal: ${signal}]`);
      }
    });

    // Handle process errors
    this.claudeProcess.on('error', (error: Error) => {
      this.emit('error', error);
      
      if (this.options.verbose) {
        console.log(`❌ Agent ${this.options.agentId} process error: ${error.message}`);
      }
    });
  }

  /**
   * Handle stream data from Claude Code process
   */
  private handleStreamData(data: string): void {
    // Accumulate data in buffer since JSON messages might be split across chunks
    this.messageBuffer += data;
    
    // Process complete JSON messages
    const lines = this.messageBuffer.split('\n');
    this.messageBuffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message: ClaudeMessage = JSON.parse(line);
          this.handleClaudeMessage(message);
        } catch (error) {
          if (this.options.debug) {
            console.log(`⚠️  Agent ${this.options.agentId} invalid JSON: ${line}`);
          }
        }
      }
    }
  }

  /**
   * Handle parsed Claude messages
   */
  private handleClaudeMessage(message: ClaudeMessage): void {
    this.emit('message', message);

    switch (message.type) {
      case 'message_start':
        this.emit('messageStart');
        break;
        
      case 'content_block_delta':
        if (message.content) {
          this.emit('content', message.content);
        }
        break;
        
      case 'tool_use':
        if (message.tool) {
          this.emit('toolUse', message.tool);
          
          if (this.options.verbose) {
            console.log(`🛠️  Agent ${this.options.agentId}: ${message.tool.name}(${JSON.stringify(message.tool.input)})`);
          }
        }
        break;
        
      case 'message_stop':
        this.emit('messageStop');
        break;
        
      case 'error':
        if (message.error) {
          this.emit('error', new Error(`${message.error.type}: ${message.error.message}`));
        }
        break;
    }

    if (this.options.debug) {
      console.log(`📨 Agent ${this.options.agentId}: ${JSON.stringify(message)}`);
    }
  }

  /**
   * Send initial prompt and context to Claude Code
   */
  private async sendInitialPrompt(): Promise<void> {
    let initialPrompt = this.options.promptTemplate;

    // Inject agent context
    initialPrompt += `\n\n## Agent Context\n`;
    initialPrompt += `- Agent ID: ${this.options.agentId}\n`;
    initialPrompt += `- Agent Type: ${this.options.agentType}\n`;
    initialPrompt += `- Working Directory: ${this.options.workingDirectory}\n`;

    if (this.options.task) {
      initialPrompt += `\n## Current Task\n${this.options.task}\n`;
    }

    if (this.options.context) {
      initialPrompt += `\n## Additional Context\n${JSON.stringify(this.options.context, null, 2)}\n`;
    }

    // Add MCP server information
    initialPrompt += `\n## MCP Integration\n`;
    initialPrompt += `Your MCP client is configured to connect to the Graphyn task coordination server.\n`;
    initialPrompt += `Available MCP tools: enqueue_task, get_next_task, complete_task, get_task_status, get_transparency_log\n`;
    initialPrompt += `Use these tools to coordinate with other agents and track progress.\n`;

    await this.sendMessage(initialPrompt);
  }
}