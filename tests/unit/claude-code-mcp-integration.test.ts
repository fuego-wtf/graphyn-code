import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { ClaudeCodeMCPIntegration, MCPIntegrationOptions, ClaudeMessage } from '../../src/core/ClaudeCodeMCPIntegration.js';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

// Create a mock ChildProcess
class MockChildProcess extends EventEmitter {
  pid: number = 12345;
  stdin = {
    write: vi.fn()
  };
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
}

describe('ClaudeCodeMCPIntegration', () => {
  let integration: ClaudeCodeMCPIntegration;
  let mockChildProcess: MockChildProcess;

  const defaultOptions: MCPIntegrationOptions = {
    agentId: 'test-agent-001',
    agentType: 'backend',
    promptTemplate: 'You are a backend development specialist...',
    workingDirectory: '/test/workspace',
    task: 'Test task description',
    context: { projectType: 'node.js' },
    verbose: false,
    debug: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock child process
    mockChildProcess = new MockChildProcess();
    (spawn as Mock).mockReturnValue(mockChildProcess);

    integration = new ClaudeCodeMCPIntegration(defaultOptions);
  });

  afterEach(async () => {
    if (integration) {
      try {
        await integration.stop();
      } catch {
        // Ignore errors during cleanup
      }
    }
  });

  describe('Initialization', () => {
    it('should create integration with correct options', () => {
      expect(integration).toBeDefined();
      expect(integration.getProcessId()).toBe(0); // Not started yet
      expect(integration.isConnected()).toBe(false);
    });

    it('should use default MCP config path if not provided', () => {
      const optionsWithoutMCPConfig = { ...defaultOptions };
      delete optionsWithoutMCPConfig.mcpServerConfig;
      
      const integration2 = new ClaudeCodeMCPIntegration(optionsWithoutMCPConfig);
      expect(integration2).toBeDefined();
    });
  });

  describe.skip('Process Management', () => {
    it('should spawn Claude Code process with correct arguments', async () => {
      // Immediately simulate ready signal
      process.nextTick(() => {
        mockChildProcess.stderr.emit('data', Buffer.from('Ready for input'));
      });

      await integration.start();

      expect(spawn).toHaveBeenCalledWith('claude', expect.arrayContaining([
        '--mcp-config',
        expect.stringContaining('claude-mcp-client.json'),
        '--stream-json',
        '--working-dir',
        '/test/workspace',
        '--prompt-template',
        'You are a backend development specialist...'
      ]), expect.objectContaining({
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: '/test/workspace',
        env: expect.objectContaining({
          CLAUDE_MCP_CONFIG: expect.any(String),
          GRAPHYN_AGENT_ID: 'test-agent-001',
          GRAPHYN_AGENT_TYPE: 'backend'
        })
      }));
    });

    it('should set process ID after spawning', async () => {
      process.nextTick(() => {
        mockChildProcess.stderr.emit('data', Buffer.from('MCP client connected'));
      });

      await integration.start();

      expect(integration.getProcessId()).toBe(12345);
      expect(integration.isConnected()).toBe(true);
    });

    it('should throw error if process fails to spawn', async () => {
      mockChildProcess.pid = undefined;

      await expect(integration.start()).rejects.toThrow('Failed to spawn Claude Code process');
    });

    it('should timeout if process takes too long to start', async () => {
      vi.useFakeTimers();
      
      const startPromise = integration.start();
      
      // Advance timer past the 10 second timeout
      vi.advanceTimersByTime(11000);

      await expect(startPromise).rejects.toThrow('Claude Code process startup timeout');
      
      vi.useRealTimers();
    });

    it('should stop process gracefully', async () => {
      // Start first
      process.nextTick(() => {
        mockChildProcess.stderr.emit('data', Buffer.from('Ready for input'));
      });
      await integration.start();

      // Then stop
      const stopPromise = integration.stop();
      process.nextTick(() => {
        mockChildProcess.emit('close', 0, null);
      });

      await stopPromise;

      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith('\x03');
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(integration.isConnected()).toBe(false);
    });

    it('should force kill if process does not respond to SIGTERM', async () => {
      vi.useFakeTimers();
      
      // Start first
      process.nextTick(() => {
        mockChildProcess.stderr.emit('data', Buffer.from('Ready for input'));
      });
      await integration.start();

      // Try to stop but don't emit close event
      const stopPromise = integration.stop();
      
      // Advance timer to trigger force kill
      vi.advanceTimersByTime(6000);

      await expect(stopPromise).rejects.toThrow('Process termination timeout');
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');

      vi.useRealTimers();
    });
  });

  describe.skip('Message Handling', () => {
    beforeEach(async () => {
      // Start the integration for message testing
      process.nextTick(() => {
        mockChildProcess.stderr.emit('data', Buffer.from('Ready for input'));
      });
      await integration.start();
    });

    it('should send message to Claude Code process', async () => {
      const message = 'Test message for Claude';
      
      await integration.sendMessage(message);

      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith('Test message for Claude\n');
    });

    it('should throw error when sending message to stopped process', async () => {
      await integration.stop();

      await expect(integration.sendMessage('test')).rejects.toThrow(
        'Agent test-agent-001 is not running'
      );
    });

    it('should parse JSON messages from stdout correctly', async () => {
      const messageSpy = vi.fn();
      integration.on('message', messageSpy);

      const jsonMessage: ClaudeMessage = {
        type: 'content_block_delta',
        content: 'Hello from Claude'
      };

      mockChildProcess.stdout.emit('data', Buffer.from(JSON.stringify(jsonMessage) + '\n'));

      expect(messageSpy).toHaveBeenCalledWith(jsonMessage);
    });

    it('should handle multiple JSON messages in single data chunk', async () => {
      const messageSpy = vi.fn();
      integration.on('message', messageSpy);

      const message1: ClaudeMessage = { type: 'message_start' };
      const message2: ClaudeMessage = { type: 'content_block_delta', content: 'test' };
      const message3: ClaudeMessage = { type: 'message_stop' };

      const combinedData = [
        JSON.stringify(message1),
        JSON.stringify(message2),
        JSON.stringify(message3)
      ].join('\n') + '\n';

      mockChildProcess.stdout.emit('data', Buffer.from(combinedData));

      expect(messageSpy).toHaveBeenCalledTimes(3);
      expect(messageSpy).toHaveBeenNthCalledWith(1, message1);
      expect(messageSpy).toHaveBeenNthCalledWith(2, message2);
      expect(messageSpy).toHaveBeenNthCalledWith(3, message3);
    });

    it('should handle split JSON messages across data chunks', async () => {
      const messageSpy = vi.fn();
      integration.on('message', messageSpy);

      const fullMessage = JSON.stringify({ type: 'content_block_delta', content: 'split message' });
      const part1 = fullMessage.substring(0, 20);
      const part2 = fullMessage.substring(20) + '\n';

      mockChildProcess.stdout.emit('data', Buffer.from(part1));
      mockChildProcess.stdout.emit('data', Buffer.from(part2));

      expect(messageSpy).toHaveBeenCalledWith({
        type: 'content_block_delta',
        content: 'split message'
      });
    });

    it('should ignore invalid JSON in stdout', async () => {
      const messageSpy = vi.fn();
      integration.on('message', messageSpy);

      mockChildProcess.stdout.emit('data', Buffer.from('invalid json\n'));
      mockChildProcess.stdout.emit('data', Buffer.from('{"type": "message_start"}\n'));

      expect(messageSpy).toHaveBeenCalledTimes(1);
      expect(messageSpy).toHaveBeenCalledWith({ type: 'message_start' });
    });
  });

  describe.skip('Event Emission', () => {
    beforeEach(async () => {
      const startPromise = integration.start();
      setTimeout(() => {
        mockChildProcess.stderr.emit('data', Buffer.from('Ready for input'));
      }, 10);
      await startPromise;
    });

    it('should emit messageStart event', async () => {
      const spy = vi.fn();
      integration.on('messageStart', spy);

      mockChildProcess.stdout.emit('data', Buffer.from('{"type": "message_start"}\n'));

      expect(spy).toHaveBeenCalled();
    });

    it('should emit content event with content', async () => {
      const spy = vi.fn();
      integration.on('content', spy);

      mockChildProcess.stdout.emit('data', Buffer.from(
        '{"type": "content_block_delta", "content": "Hello world"}\n'
      ));

      expect(spy).toHaveBeenCalledWith('Hello world');
    });

    it('should emit toolUse event with tool details', async () => {
      const spy = vi.fn();
      integration.on('toolUse', spy);

      const toolMessage = {
        type: 'tool_use',
        tool: {
          name: 'write_file',
          input: { path: 'test.js', content: 'console.log("test");' }
        }
      };

      mockChildProcess.stdout.emit('data', Buffer.from(JSON.stringify(toolMessage) + '\n'));

      expect(spy).toHaveBeenCalledWith(toolMessage.tool);
    });

    it('should emit error event for error messages', async () => {
      const spy = vi.fn();
      integration.on('error', spy);

      const errorMessage = {
        type: 'error',
        error: {
          type: 'validation_error',
          message: 'Invalid input provided'
        }
      };

      mockChildProcess.stdout.emit('data', Buffer.from(JSON.stringify(errorMessage) + '\n'));

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        message: 'validation_error: Invalid input provided'
      }));
    });

    it('should emit completed event on normal process exit', async () => {
      const spy = vi.fn();
      integration.on('completed', spy);

      mockChildProcess.emit('close', 0, null);

      expect(spy).toHaveBeenCalled();
    });

    it('should emit failed event on abnormal process exit', async () => {
      const spy = vi.fn();
      integration.on('failed', spy);

      mockChildProcess.emit('close', 1, null);

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Process exited with code 1')
      }));
    });
  });

  describe.skip('Statistics', () => {
    beforeEach(async () => {
      process.nextTick(() => {
        mockChildProcess.stderr.emit('data', Buffer.from('Ready for input'));
      });
      await integration.start();
    });

    it('should provide runtime statistics', () => {
      const stats = integration.getStats();

      expect(stats).toMatchObject({
        agentId: 'test-agent-001',
        pid: 12345,
        isRunning: true,
        isConnected: true,
        uptime: expect.any(Number),
        memoryUsage: expect.objectContaining({
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number)
        })
      });
    });

    it('should show correct uptime', async () => {
      const stats1 = integration.getStats();
      
      // Wait a bit
      await new Promise(resolve => {
        setTimeout(() => {
          const stats2 = integration.getStats();
          expect(stats2.uptime).toBeGreaterThanOrEqual(stats1.uptime!);
          resolve(undefined);
        }, 10);
      });
    });
  });

  describe.skip('Error Handling', () => {
    it('should handle process spawn errors', async () => {
      const errorSpy = vi.fn();
      integration.on('error', errorSpy);

      process.nextTick(() => {
        mockChildProcess.emit('error', new Error('Spawn failed'));
      });

      const startPromise = integration.start();
      process.nextTick(() => {
        mockChildProcess.stderr.emit('data', Buffer.from('Ready for input'));
      });

      await startPromise;

      expect(errorSpy).toHaveBeenCalledWith(new Error('Spawn failed'));
    });

    it('should handle stderr messages in debug mode', async () => {
      const debugIntegration = new ClaudeCodeMCPIntegration({
        ...defaultOptions,
        debug: true
      });

      const startPromise = debugIntegration.start();
      process.nextTick(() => {
        mockChildProcess.stderr.emit('data', Buffer.from('Debug message from Claude'));
        mockChildProcess.stderr.emit('data', Buffer.from('Ready for input'));
      });

      await startPromise;

      // Should not throw, just log debug messages
      expect(debugIntegration.isConnected()).toBe(true);
    });
  });
});