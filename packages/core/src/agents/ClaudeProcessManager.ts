import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import readline from 'readline';

export type ClaudeProcessEvent =
  | { type: 'system:init'; payload: any }
  | { type: 'assistant'; payload: any }
  | { type: 'result'; payload: any }
  | { type: 'tool_call'; payload: ClaudeToolCall }
  | { type: 'tool_result'; payload: ClaudeToolResult }
  | { type: 'stderr'; chunk: string }
  | { type: 'stdout'; chunk: string };

export interface ClaudeToolCall {
  id: string;
  name: string;
  input: any;
  raw: any;
}

export interface ClaudeToolResult {
  id: string;
  name: string;
  output: any;
}

export interface ClaudeRunOptions {
  agentId: string;
  agentType: string;
  prompt: string;
  cwd: string;
  mcpConfigPath?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
  extraArgs?: string[];
  verbose?: boolean;
}

export interface ClaudeRunResult {
  success: boolean;
  exitCode: number | null;
  durationMs: number;
  stdout: string[];
  stderr: string[];
  messages: any[];
  toolCalls: ClaudeToolCall[];
  tokensUsed?: number;
  error?: string;
}

export interface ClaudeProcessManagerOptions {
  binaryPath?: string;
  transparency?: boolean;
  logger?: (message: string) => void;
}

export class ClaudeProcessManager extends EventEmitter {
  private readonly binaryPath?: string;
  private readonly transparency: boolean;
  private readonly logger?: (message: string) => void;
  private activeProcess: ChildProcess | null = null;
  private currentToolCalls: Map<string, ClaudeToolCall> = new Map();

  constructor(options: ClaudeProcessManagerOptions = {}) {
    super();
    this.binaryPath = options.binaryPath;
    this.transparency = options.transparency ?? true;
    this.logger = options.logger;
  }

  async run(options: ClaudeRunOptions): Promise<ClaudeRunResult> {
    if (this.activeProcess) {
      throw new Error('ClaudeProcessManager currently supports a single active process.');
    }

    const start = Date.now();
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const streamMessages: any[] = [];
    const toolCalls: ClaudeToolCall[] = [];

    const claudeBinary = this.resolveBinary();
    const args = this.buildArguments(options);

    const childEnv = {
      ...process.env,
      ...(options.env ?? {}),
    } as Record<string, string>;

    const child = spawn(claudeBinary, args, {
      cwd: options.cwd,
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.activeProcess = child;

    if (this.transparency) {
      this.log(`🚀 Claude Code spawn [PID: ${child.pid}] ${claudeBinary} ${args.join(' ')}`);
    }

    const timeoutMs = options.timeoutMs ?? 300_000;
    const timeoutHandle = setTimeout(() => {
      if (this.activeProcess) {
        this.log(`⏱️ Claude process timeout after ${timeoutMs}ms – sending SIGTERM`);
        this.activeProcess.kill('SIGTERM');
      }
    }, timeoutMs);

    const stdoutRl = readline.createInterface({ input: child.stdout });
    stdoutRl.on('line', (line) => {
      stdoutChunks.push(line);
      this.emitEvent({ type: 'stdout', chunk: line });
      this.processLine(line, streamMessages, toolCalls);
    });

    child.stderr?.on('data', (buffer: Buffer) => {
      const chunk = buffer.toString();
      stderrChunks.push(chunk);
      this.emitEvent({ type: 'stderr', chunk });
      if (this.transparency) {
        this.log(`⚠️ Claude stderr: ${chunk.trim()}`);
      }
    });

    const requestPayload = this.buildPromptPayload(options.prompt);
    child.stdin?.write(JSON.stringify(requestPayload) + '\n');
    child.stdin?.end();

    const exitCode = await new Promise<number | null>((resolve) => {
      child.on('close', (code) => resolve(code));
    });

    clearTimeout(timeoutHandle);
    stdoutRl.close();
    this.activeProcess = null;
    this.currentToolCalls.clear();

    const durationMs = Date.now() - start;
    if (this.transparency) {
      const status = exitCode === 0 ? '✅' : '❌';
      this.log(`${status} Claude Code exited (agent: ${options.agentId}) in ${durationMs}ms`);
    }

    return {
      success: exitCode === 0,
      exitCode,
      durationMs,
      stdout: stdoutChunks,
      stderr: stderrChunks,
      messages: streamMessages,
      toolCalls,
      tokensUsed: this.extractTokenCount(stdoutChunks.join('\n')),
      error: exitCode === 0 ? undefined : stderrChunks.join('\n') || 'Claude process failed',
    };
  }

  sendToolResult(callId: string, output: any): void {
    if (!this.activeProcess || !this.activeProcess.stdin) {
      throw new Error('No active Claude process to send tool result.');
    }

    const response = {
      type: 'tool_response',
      tool_use_id: callId,
      content: output,
    };
    this.activeProcess.stdin.write(JSON.stringify(response) + '\n');
    this.emitEvent({ type: 'tool_result', payload: { id: callId, name: this.currentToolCalls.get(callId)?.name ?? 'unknown', output } });
  }

  stop(signal: NodeJS.Signals = 'SIGTERM'): void {
    if (this.activeProcess) {
      this.activeProcess.kill(signal);
      this.activeProcess = null;
    }
  }

  private buildPromptPayload(prompt: string): any {
    return {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    };
  }

  private processLine(line: string, streamMessages: any[], toolCalls: ClaudeToolCall[]): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const parsed = JSON.parse(trimmed);
      streamMessages.push(parsed);

      switch (parsed.type) {
        case 'system':
          if (parsed.subtype === 'init') {
            this.emitEvent({ type: 'system:init', payload: parsed });
          }
          break;
        case 'assistant': {
          this.emitEvent({ type: 'assistant', payload: parsed });
          const contentBlocks = parsed.message?.content ?? [];
          for (const block of contentBlocks) {
            if (block.type === 'tool_use') {
              const toolCall: ClaudeToolCall = {
                id: block.id || parsed.id || `tool_${Date.now()}`,
                name: block.name,
                input: block.input,
                raw: block,
              };
              toolCalls.push(toolCall);
              this.currentToolCalls.set(toolCall.id, toolCall);
              this.emitEvent({ type: 'tool_call', payload: toolCall });
            }
          }
          break;
        }
        case 'result':
          this.emitEvent({ type: 'result', payload: parsed });
          break;
        default:
          break;
      }
    } catch (error) {
      // Non-JSON line; already captured in stdout array.
    }
  }

  private buildArguments(options: ClaudeRunOptions): string[] {
    const args: string[] = [];

    if (options.prompt.trim()) {
      args.push('-p');
    }

    args.push('--output-format', 'stream-json');
    args.push('--input-format', 'stream-json');

    if (options.mcpConfigPath) {
      args.push('--mcp-server-config', options.mcpConfigPath);
    }

    if (options.verbose) {
      args.push('--verbose');
    }

    if (options.extraArgs) {
      args.push(...options.extraArgs);
    }

    return args;
  }

  private extractTokenCount(output: string): number | undefined {
    const match = output.match(/token[s]? used:?\s*(\d+)/i);
    if (!match) return undefined;
    return Number.parseInt(match[1], 10);
  }

  private resolveBinary(): string {
    if (this.binaryPath) {
      return this.binaryPath;
    }

    const configPath = process.env.CLAUDE_BIN_CONFIG;
    if (configPath) {
      try {
        const resolved = require(path.resolve(configPath));
        if (resolved?.binaryPath) {
          return resolved.binaryPath;
        }
      } catch (error) {
        this.log(`⚠️ Failed to read CLAUDE_BIN_CONFIG at ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return process.env.CLAUDE_BIN || process.env.CLAUDE_CLI_PATH || 'claude';
  }

  private emitEvent(event: ClaudeProcessEvent): void {
    this.emit(event.type, event);
  }

  private log(message: string): void {
    if (this.logger) {
      this.logger(message);
    } else {
      console.log(message);
    }
  }
}

export default ClaudeProcessManager;
