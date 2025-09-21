/**
 * CLI Dashboard Renderer - Live Mission Control Display
 * 
 * Renders real-time agent status, queue depth, and system metrics
 * with smooth ANSI updates every 500ms without flicker.
 */

import { EventEmitter } from 'events';
import type { 
  MissionControlStream, 
  AgentStatus, 
  TaskStatus, 
  SessionMetrics, 
  MissionControlEvent 
} from '@graphyn/core';

interface DashboardState {
  agents: AgentStatus[];
  tasks: TaskStatus[];
  metrics: SessionMetrics | null;
  queueDepth: number;
  deepwikiStats: {
    entries: number;
    lastIngested?: Date;
  };
  dbLatency: number;
  startTime: Date;
  lastUpdate: Date;
}

interface RenderOptions {
  updateInterval?: number;
  showDebugInfo?: boolean;
  compactMode?: boolean;
}

export class DashboardRenderer extends EventEmitter {
  private missionControl: MissionControlStream;
  private state: DashboardState;
  private renderInterval: NodeJS.Timeout | null = null;
  private options: RenderOptions;
  private terminalSize: { width: number; height: number };
  private lastRendered = '';

  constructor(missionControl: MissionControlStream, options: RenderOptions = {}) {
    super();
    this.missionControl = missionControl;
    this.options = {
      updateInterval: 500,
      showDebugInfo: false,
      compactMode: false,
      ...options
    };
    
    this.state = {
      agents: [],
      tasks: [],
      metrics: null,
      queueDepth: 0,
      deepwikiStats: { entries: 0 },
      dbLatency: 0,
      startTime: new Date(),
      lastUpdate: new Date()
    };

    this.terminalSize = {
      width: process.stdout.columns || 80,
      height: process.stdout.rows || 24
    };

    this.setupEventHandlers();
  }

  /**
   * Start the dashboard rendering
   */
  start(): void {
    if (this.renderInterval) {
      this.stop();
    }

    // Hide cursor and clear screen
    process.stdout.write('\x1b[?25l\x1b[2J\x1b[H');
    
    // Handle terminal resize
    process.stdout.on('resize', () => {
      this.terminalSize = {
        width: process.stdout.columns || 80,
        height: process.stdout.rows || 24
      };
    });

    // Handle exit signals
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());

    // Start rendering loop
    this.renderInterval = setInterval(() => {
      this.render();
    }, this.options.updateInterval);

    // Initial render
    this.render();
    
    this.emit('started');
  }

  /**
   * Stop the dashboard rendering
   */
  stop(): void {
    this.cleanup();
  }

  private setupEventHandlers(): void {
    // Subscribe to MissionControl events
    this.missionControl.subscribe((event: MissionControlEvent) => {
      this.state.lastUpdate = new Date();
      
      switch (event.type) {
        case 'agent_status_change':
          this.updateAgentStatus(event.data as AgentStatus);
          break;
        case 'task_status_change':
          this.updateTaskStatus(event.data as TaskStatus);
          break;
        case 'session_metrics_update':
          this.updateSessionMetrics(event.data as SessionMetrics);
          break;
        case 'log':
          // Handle log events for debugging
          if (this.options.showDebugInfo) {
            this.emit('log', event.data);
          }
          break;
      }
    });
  }

  private updateAgentStatus(agentStatus: AgentStatus): void {
    const existingIndex = this.state.agents.findIndex(a => a.id === agentStatus.id);
    if (existingIndex >= 0) {
      this.state.agents[existingIndex] = agentStatus;
    } else {
      this.state.agents.push(agentStatus);
    }
  }

  private updateTaskStatus(taskStatus: TaskStatus): void {
    const existingIndex = this.state.tasks.findIndex(t => t.id === taskStatus.id);
    if (existingIndex >= 0) {
      this.state.tasks[existingIndex] = taskStatus;
    } else {
      this.state.tasks.push(taskStatus);
    }

    // Update queue depth
    this.state.queueDepth = this.state.tasks.filter(t => 
      t.status === 'pending' || t.status === 'active'
    ).length;
  }

  private updateSessionMetrics(metrics: SessionMetrics): void {
    this.state.metrics = metrics;
    this.state.dbLatency = metrics.dbLatencyMs || 0;
    this.state.deepwikiStats = {
      entries: metrics.knowledgeEntries || 0,
      lastIngested: metrics.knowledgeLastIngested ? new Date(metrics.knowledgeLastIngested) : this.state.deepwikiStats.lastIngested
    };
  }

  private render(): void {
    const output = this.buildDashboard();
    
    // Only update if content changed to avoid flicker
    if (output !== this.lastRendered) {
      process.stdout.write('\x1b[H' + output);
      this.lastRendered = output;
    }
  }

  private buildDashboard(): string {
    const { width } = this.terminalSize;
    const lines: string[] = [];

    // Header
    lines.push(this.renderHeader());
    lines.push('─'.repeat(width));

    // Agent tiles (2 columns)
    lines.push(...this.renderAgentTiles());

    // Queue and metrics section
    if (!this.options.compactMode) {
      lines.push('');
      lines.push(...this.renderMetrics());
    }

    // Fill remaining space
    const remainingLines = this.terminalSize.height - lines.length - 2;
    for (let i = 0; i < remainingLines; i++) {
      lines.push(' '.repeat(width));
    }

    return lines.join('\n');
  }

  private renderHeader(): string {
    const { width } = this.terminalSize;
    const uptime = Math.floor((Date.now() - this.state.startTime.getTime()) / 1000);
    const uptimeStr = this.formatUptime(uptime);
    
    const title = '🎛️  GRAPHYN MISSION CONTROL';
    const status = `${this.state.agents.length} agents | ${this.state.tasks.length} tasks | ${uptimeStr}`;
    
    const padding = width - title.length - status.length;
    return `${title}${' '.repeat(Math.max(0, padding))}${status}`;
  }

  private renderAgentTiles(): string[] {
    const lines: string[] = [];
    const { width } = this.terminalSize;
    const tileWidth = Math.floor((width - 3) / 2); // 2 columns with divider

    // Sort agents by status priority
    const sortedAgents = [...this.state.agents].sort((a, b) => {
      const statusOrder = { active: 0, idle: 1, paused: 2, error: 3, complete: 4 };
      return (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5);
    });

    for (let i = 0; i < sortedAgents.length; i += 2) {
      const leftAgent = sortedAgents[i];
      const rightAgent = sortedAgents[i + 1];

      const leftTile = this.renderAgentTile(leftAgent, tileWidth);
      const rightTile = rightAgent ? this.renderAgentTile(rightAgent, tileWidth) : [];

      // Render tiles side by side
      const maxLines = Math.max(leftTile.length, rightTile.length);
      for (let line = 0; line < maxLines; line++) {
        const left = (leftTile[line] || '').padEnd(tileWidth);
        const right = rightTile[line] || '';
        lines.push(`${left} │ ${right}`);
      }
      
      if (i + 2 < sortedAgents.length) {
        lines.push('─'.repeat(width));
      }
    }

    return lines;
  }

  private renderAgentTile(agent: AgentStatus, width: number): string[] {
    const lines: string[] = [];
    
    // Status icon and name
    const statusIcon = this.getStatusIcon(agent.status);
    const statusColor = this.getStatusColor(agent.status);
    const header = `${statusIcon} ${agent.name} (${agent.type})`;
    lines.push(`\x1b[${statusColor}m${header.substring(0, width)}\x1b[0m`);

    // Progress bar
    if (agent.status === 'active' && agent.progress > 0) {
      const progressBar = this.renderProgressBar(agent.progress, width - 10);
      lines.push(`Progress: ${progressBar} ${agent.progress}%`);
    }

    // Current task
    if (agent.currentTask) {
      const taskText = `Task: ${agent.currentTask}`;
      lines.push(taskText.substring(0, width));
    }

    // Metrics
    const metricsLine = `✓ ${agent.metrics.tasksCompleted} | ✗ ${agent.metrics.errorCount} | ⏱ ${this.formatDuration(agent.metrics.uptime)}`;
    lines.push(metricsLine.substring(0, width));

    // Last activity
    const lastActivity = `Last: ${this.formatRelativeTime(agent.lastActivity)}`;
    lines.push(lastActivity.substring(0, width));

    return lines;
  }

  private renderMetrics(): string[] {
    const lines: string[] = [];
    const { width } = this.terminalSize;

    // Queue section
    lines.push('📋 TASK QUEUE & METRICS');
    lines.push('─'.repeat(width));

    const queueLine = `Queue Depth: ${this.state.queueDepth} tasks pending`;
    lines.push(queueLine);

    if (this.state.metrics) {
      const successRate = `Success Rate: ${this.state.metrics.successRate.toFixed(1)}%`;
      const avgDuration = `Avg Duration: ${(this.state.metrics.averageTaskDuration / 1000).toFixed(1)}s`;
      lines.push(`${successRate} | ${avgDuration}`);

      // System metrics
      lines.push('');
      lines.push('💾 SYSTEM METRICS');
      lines.push('─'.repeat(width));
      
      const cpu = `CPU: ${this.state.metrics.resourceUsage.cpuUsage.toFixed(1)}%`;
      const memory = `Memory: ${this.state.metrics.resourceUsage.memoryUsage.toFixed(1)}MB`;
      const dbLatency = `DB Latency: ${this.state.dbLatency.toFixed(1)}ms`;
      lines.push(`${cpu} | ${memory} | ${dbLatency}`);
    }

    // Deepwiki stats
    lines.push('');
    lines.push('🧠 KNOWLEDGE BASE');
    lines.push('─'.repeat(width));
    lines.push(`Entries: ${this.state.deepwikiStats.entries}`);
    if (this.state.deepwikiStats.lastIngested) {
      lines.push(`Last Ingested: ${this.formatRelativeTime(this.state.deepwikiStats.lastIngested)}`);
    }

    return lines;
  }

  private getStatusIcon(status: string): string {
    const icons = {
      idle: '⏸️ ',
      active: '🟢',
      paused: '⏸️ ',
      error: '🔴',
      complete: '✅'
    };
    return icons[status as keyof typeof icons] || '⚫';
  }

  private getStatusColor(status: string): string {
    const colors = {
      idle: '37',      // white
      active: '32',    // green
      paused: '33',    // yellow
      error: '31',     // red
      complete: '32'   // green
    };
    return colors[status as keyof typeof colors] || '37';
  }

  private renderProgressBar(progress: number, width: number): string {
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
  }

  private formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  private formatDuration(ms: number): string {
    return this.formatUptime(Math.floor(ms / 1000));
  }

  private formatRelativeTime(date: Date): string {
    const now = Date.now();
    const diff = Math.floor((now - date.getTime()) / 1000);
    
    if (diff < 60) {
      return `${diff}s ago`;
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)}m ago`;
    } else {
      return `${Math.floor(diff / 3600)}h ago`;
    }
  }

  private cleanup(): void {
    if (this.renderInterval) {
      clearInterval(this.renderInterval);
      this.renderInterval = null;
    }
    
    // Show cursor and clear screen
    process.stdout.write('\x1b[?25h\x1b[2J\x1b[H');
    
    this.emit('stopped');
  }
}
