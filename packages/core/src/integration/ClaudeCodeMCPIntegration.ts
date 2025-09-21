import { EventEmitter } from 'events';
import path from 'path';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { ClaudeProcessManager, ClaudeRunOptions, ClaudeRunResult, ClaudeToolCall } from '../agents/ClaudeProcessManager.js';

export interface ClaudeProcessConfig {
  agentId: string;
  agentType: string;
  sessionDir: string;
  mcpConfigPath?: string;
  timeout?: number;
  maxRetries?: number;
  env?: Record<string, string>;
  verbose?: boolean;
}

export interface ClaudeStreamMessage {
  type: string;
  timestamp: string;
  agentId: string;
  content?: any;
  toolName?: string;
  toolArgs?: any;
  toolResult?: any;
}

export interface ClaudeProcessResult {
  success: boolean;
  agentId: string;
  duration: number;
  outputFiles: string[];
  toolsUsed: string[];
  tokensUsed?: number;
  error?: string;
  streamMessages: ClaudeStreamMessage[];
}

export interface ToolCallEvent {
  agentId: string;
  agentType: string;
  tool: ClaudeToolCall;
  respond: (output: any) => void;
}

interface IntegrationOptions {
  transparencyEnabled?: boolean;
  binaryPath?: string;
  logger?: (message: string) => void;
}

export class ClaudeCodeMCPIntegration extends EventEmitter {
  private readonly transparencyEnabled: boolean;
  private readonly processManager: ClaudeProcessManager;

  constructor(options: IntegrationOptions = {}) {
    super();
    this.transparencyEnabled = options.transparencyEnabled ?? true;
    this.processManager = new ClaudeProcessManager({
      binaryPath: options.binaryPath,
      transparency: this.transparencyEnabled,
      logger: options.logger,
    });
  }

  async executeClaudeProcess(prompt: string, config: ClaudeProcessConfig): Promise<ClaudeProcessResult> {
    const { agentId, agentType, sessionDir, timeout = 300_000, maxRetries = 1, env = {}, verbose } = config;

    const mcpConfigPath = await this.prepareMCPConfig(config);

    let attempt = 0;
    let lastError: ClaudeProcessResult | undefined;

    while (attempt < maxRetries) {
      attempt += 1;

      const toolHandler = (event: ClaudeToolCall) => {
        const payload: ToolCallEvent = {
          agentId,
          agentType,
          tool: event,
          respond: (output) => {
            try {
              this.processManager.sendToolResult(event.id, output);
            } catch (error) {
              if (this.transparencyEnabled) {
                console.error(`⚠️ Failed to send tool result for ${event.name}:`, error);
              }
            }
          },
        };
        this.emit('toolCall', payload);
      };

      this.processManager.on('tool_call', toolHandler);

      try {
        const runResult = await this.processManager.run({
          agentId,
          agentType,
          prompt,
          cwd: sessionDir,
          mcpConfigPath,
          timeoutMs: timeout,
          env,
          verbose,
        } satisfies ClaudeRunOptions);

        this.processManager.off('tool_call', toolHandler);

        const result = this.transformRunResult(runResult, agentId, agentType);
        this.emit(result.success ? 'processComplete' : 'processError', result);
        if (result.success) {
          return result;
        }
        lastError = result;
      } catch (error) {
        this.processManager.off('tool_call', toolHandler);
        lastError = {
          success: false,
          agentId,
          duration: 0,
          outputFiles: [],
          toolsUsed: [],
          streamMessages: [],
          error: error instanceof Error ? error.message : String(error),
        };
        this.emit('processError', lastError);
      }

      if (attempt < maxRetries) {
        await this.delay(1000 * attempt);
      }
    }

    return lastError ?? {
      success: false,
      agentId,
      duration: 0,
      outputFiles: [],
      toolsUsed: [],
      streamMessages: [],
      error: 'Claude process failed without diagnostics',
    };
  }

  killAllProcesses(): void {
    this.processManager.stop();
  }

  private transformRunResult(runResult: ClaudeRunResult, agentId: string, agentType: string): ClaudeProcessResult {
    const outputFiles = this.collectOutputFiles(runResult.toolCalls);
    const toolsUsed = Array.from(new Set(runResult.toolCalls.map((call) => call.name)));

    const streamMessages: ClaudeStreamMessage[] = runResult.messages.map((message) => ({
      type: message.type ?? 'unknown',
      timestamp: new Date().toISOString(),
      agentId,
      content: message,
    }));

    if (this.transparencyEnabled && runResult.stderr.length > 0) {
      console.error(`⚠️ Claude stderr (${agentType}-${agentId.slice(-3)}):`, runResult.stderr.join('\n'));
    }

    return {
      success: runResult.success,
      agentId,
      duration: runResult.durationMs,
      outputFiles,
      toolsUsed,
      tokensUsed: runResult.tokensUsed,
      error: runResult.success ? undefined : runResult.error,
      streamMessages,
    };
  }

  private collectOutputFiles(toolCalls: ClaudeToolCall[]): string[] {
    const files: string[] = [];
    for (const call of toolCalls) {
      if (call.name === 'write_file') {
        const filePath = call.input?.path ?? call.input?.filepath;
        if (filePath) {
          files.push(filePath);
        }
      }
    }
    return files;
  }

  private async prepareMCPConfig(config: ClaudeProcessConfig): Promise<string | undefined> {
    if (config.mcpConfigPath) {
      return config.mcpConfigPath;
    }

    if (process.env.GRAPHYN_USE_MOCK_MCP === '1' || process.env.GRAPHYN_USE_MOCK_MCP === 'true') {
      return undefined;
    }

    const sessionDir = config.sessionDir;
    const configPath = path.join(sessionDir, 'mcp-config.json');

    if (existsSync(configPath)) {
      return configPath;
    }

    const mcpConfig = {
      clients: {
        graphyn: {
          command: 'node',
          args: [path.resolve(process.cwd(), 'services/mcp/dist/server.js')],
          env: {
            USE_MOCK_DB: 'false',
          },
        },
      },
    };

    await fs.writeFile(configPath, JSON.stringify(mcpConfig, null, 2));
    return configPath;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default ClaudeCodeMCPIntegration;
