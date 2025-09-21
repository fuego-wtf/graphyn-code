import type { MCPCoordinator } from '../orchestrator/MCPCoordinator.js';

interface ToolRecord {
  name: string;
  status: 'pending' | 'success' | 'error';
  durationMs?: number;
}

interface AgentRecord {
  agentType: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  workspaceDir?: string;
  taskId?: string;
  durationMs?: number;
  error?: string;
  events: string[];
}

interface ProcessEventPayload {
  type: string;
  agentId?: string;
  pid?: number;
  format?: string;
  code?: number | null;
  error?: string;
}

export class ProcessTreeVisualizer {
  private mcpInfo: { pid?: number; connected?: boolean } = {};
  private toolHistory: ToolRecord[] = [];
  private agents = new Map<string, AgentRecord>();

  constructor(coordinator: MCPCoordinator) {
    coordinator.on('connected', (status) => {
      this.mcpInfo = { pid: status.pid, connected: status.connected };
    });

    coordinator.on('process', (payload: ProcessEventPayload) => {
      if (!payload.agentId) {
        this.mcpInfo.pid = payload.pid ?? this.mcpInfo.pid;
      } else {
        this.recordAgentProcess(payload.agentId, payload);
      }
    });

    coordinator.on('mcp:tool-call', (payload: any) => {
      this.toolHistory.push({ name: payload.name, status: 'pending' });
      if (this.toolHistory.length > 12) this.toolHistory.shift();
    });

    coordinator.on('mcp:tool-response', (payload: any) => {
      const record = [...this.toolHistory].reverse().find((tool) => tool.name === payload.name && tool.status === 'pending');
      if (record) {
        record.status = payload.success ? 'success' : 'error';
        record.durationMs = payload.duration;
      }
    });
  }

  recordAgentStart(agentId: string, info: { agentType: string; taskId: string; workspaceDir?: string }): void {
    this.agents.set(agentId, {
      agentType: info.agentType,
      status: 'running',
      workspaceDir: info.workspaceDir,
      taskId: info.taskId,
      events: ['spawn'],
    });
  }

  recordAgentFinish(agentId: string, info: { status: 'completed' | 'failed'; durationMs?: number; error?: string }): void {
    const record = this.agents.get(agentId);
    if (!record) return;

    record.status = info.status;
    record.durationMs = info.durationMs;
    if (info.error) {
      record.error = info.error;
      record.events.push(`error: ${info.error}`);
    } else {
      record.events.push(info.status);
    }
  }

  recordAgentProcess(agentId: string, payload: any): void {
    const record = this.agents.get(agentId) ?? {
      agentType: 'unknown',
      status: 'running',
      events: [],
    };

    record.events.push(payload.type || 'event');
    this.agents.set(agentId, record);
  }

  render(): string {
    const lines: string[] = [];
    const mcpLabel = this.mcpInfo.pid ? `MCP Server [PID: ${this.mcpInfo.pid}]` : 'MCP Server';
    lines.push(mcpLabel + (this.mcpInfo.connected ? ' ✅' : ' ⚠️'));

    // Tool history
    lines.push('├─ Tool Calls');
    if (this.toolHistory.length === 0) {
      lines.push('│  └─ (none)');
    } else {
      this.toolHistory.forEach((tool, index) => {
        const prefix = index === this.toolHistory.length - 1 ? '│  └─' : '│  ├─';
        const statusIcon = tool.status === 'pending' ? '⏳' : tool.status === 'success' ? '✅' : '❌';
        const duration = tool.durationMs !== undefined ? ` (${tool.durationMs}ms)` : '';
        lines.push(`${prefix} ${statusIcon} ${tool.name}${duration}`);
      });
    }

    // Agent section
    lines.push('└─ Agents');
    if (this.agents.size === 0) {
      lines.push('   └─ (none)');
    } else {
      const entries = Array.from(this.agents.entries());
      entries.forEach(([agentId, info], index) => {
        const isLastAgent = index === entries.length - 1;
        const branch = isLastAgent ? '   └─' : '   ├─';
        const statusIcon = info.status === 'running' ? '⏱️' : info.status === 'completed' ? '✅' : info.status === 'failed' ? '❌' : 'ℹ️';
        const duration = info.durationMs !== undefined ? ` [${info.durationMs}ms]` : '';
        const taskLabel = info.taskId ? ` (task: ${info.taskId})` : '';
        lines.push(`${branch} ${statusIcon} ${agentId} (${info.agentType})${duration}${taskLabel}`);

        if (info.error) {
          lines.push(`${isLastAgent ? '      ' : '   │  '}Error: ${info.error}`);
        }

        const events = info.events.slice(-5);
        if (events.length > 0) {
          lines.push(`${isLastAgent ? '      ' : '   │  '}Events: ${events.join(' → ')}`);
        }
      });
    }

    return lines.join('\n');
  }

  /**
   * Create a ProcessTreeVisualizer from transparency events
   */
  static fromTransparencyEvents(events: any[]): ProcessTreeVisualizer {
    // Create a minimal coordinator for the visualizer
    const mockCoordinator = {
      on: (event: string, callback: Function) => {
        // Mock event emitter
      },
      emit: (event: string, data?: any) => {}
    } as any;
    
    const visualizer = new ProcessTreeVisualizer(mockCoordinator);
    
    // Process events to build the tree
    for (const event of events) {
      if (event.type === 'agent_spawn' && event.agentId) {
        visualizer.recordAgentStart(event.agentId, {
          agentType: event.agentType || 'unknown',
          taskId: event.taskId || 'unknown',
          workspaceDir: event.workspaceDir
        });
      } else if (event.type === 'agent_complete' && event.agentId) {
        visualizer.recordAgentFinish(event.agentId, {
          status: 'completed',
          durationMs: event.duration,
        });
      } else if (event.type === 'agent_error' && event.agentId) {
        visualizer.recordAgentFinish(event.agentId, {
          status: 'failed',
          error: event.error,
          durationMs: event.duration
        });
      } else if (event.agentId) {
        visualizer.recordAgentProcess(event.agentId, event);
      }
    }
    
    return visualizer;
  }

  /**
   * Render the tree with options
   */
  renderTree(options?: { format?: string; showTimestamps?: boolean; showMetrics?: boolean; compactMode?: boolean; maxDepth?: number }): string {
    return this.render();
  }

  /**
   * Get statistics about the processes
   */
  getStatistics(): { agents: number; tools: number; errors: number } {
    const errorCount = Array.from(this.agents.values())
      .filter(agent => agent.status === 'failed').length;
    
    return {
      agents: this.agents.size,
      tools: this.toolHistory.length,
      errors: errorCount
    };
  }
}
