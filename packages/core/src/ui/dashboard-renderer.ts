/**
 * Dashboard Renderer for Graphyn Mission Control
 * 
 * Provides real-time visualization of:
 * - Agent status grid with live updates
 * - Task queue and execution progress
 * - System health metrics
 * - Process transparency information
 */

import { ANSI, COLORS, SYMBOLS } from './ansi-codes.js';
import type { AgentStatus, TaskStatus, SessionMetrics } from '../monitoring/MissionControlStream.js';

export interface DashboardOptions {
  /**
   * Maximum width for the dashboard
   * @default process.stdout.columns || 120
   */
  maxWidth?: number;
  
  /**
   * Whether to show the dashboard in compact mode
   * @default false
   */
  compact?: boolean;
  
  /**
   * Update frequency in milliseconds
   * @default 500
   */
  updateInterval?: number;
  
  /**
   * Whether to auto-refresh the dashboard
   * @default true
   */
  autoRefresh?: boolean;
  
  /**
   * Theme for the dashboard
   * @default 'dark'
   */
  theme?: 'dark' | 'light' | 'minimal';
}

export class DashboardRenderer {
  private readonly maxWidth: number;
  private readonly compact: boolean;
  private readonly updateInterval: number;
  private readonly autoRefresh: boolean;
  private readonly theme: string;
  private readonly isInteractive: boolean;
  
  private refreshTimer: NodeJS.Timeout | null = null;
  private lastRenderTime = 0;
  private renderCount = 0;

  constructor(options: DashboardOptions = {}) {
    this.maxWidth = options.maxWidth ?? (process.stdout.columns || 120);
    this.compact = options.compact ?? false;
    this.updateInterval = options.updateInterval ?? 500;
    this.autoRefresh = options.autoRefresh ?? true;
    this.theme = options.theme ?? 'dark';
    this.isInteractive = process.stdout.isTTY && process.env.CI !== 'true';
  }

  /**
   * Render the complete dashboard
   */
  render(agents: AgentStatus[], tasks: TaskStatus[], metrics?: SessionMetrics): void {
    if (!this.isInteractive) {
      this.renderNonInteractive(agents, tasks, metrics);
      return;
    }

    // Throttle renders to avoid overwhelming the terminal
    const now = Date.now();
    if (now - this.lastRenderTime < this.updateInterval / 2) {
      return;
    }
    this.lastRenderTime = now;
    this.renderCount++;

    // Clear screen and move to top
    process.stdout.write(ANSI.CLEAR_SCREEN + ANSI.CURSOR_TO_COLUMN(1) + '\x1b[H');
    
    if (this.compact) {
      this.renderCompactDashboard(agents, tasks, metrics);
    } else {
      this.renderFullDashboard(agents, tasks, metrics);
    }
  }

  /**
   * Start auto-refresh
   */
  startAutoRefresh(
    getAgents: () => AgentStatus[],
    getTasks: () => TaskStatus[],
    getMetrics: () => SessionMetrics | undefined
  ): void {
    if (!this.autoRefresh || this.refreshTimer) {
      return;
    }

    this.refreshTimer = setInterval(() => {
      const agents = getAgents();
      const tasks = getTasks();
      const metrics = getMetrics();
      this.render(agents, tasks, metrics);
    }, this.updateInterval);
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Render a static summary (one-time)
   */
  renderSummary(agents: AgentStatus[], tasks: TaskStatus[], metrics?: SessionMetrics): void {
    const activeAgents = agents.filter(a => a.status === 'active').length;
    const completedTasks = tasks.filter(t => t.status === 'complete').length;
    const totalTasks = tasks.length;
    const successRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    const lines = [
      `${SYMBOLS.CONTROL} Graphyn Mission Control Summary`,
      `${SYMBOLS.ROBOT} Active Agents: ${activeAgents}/${agents.length}`,
      `${SYMBOLS.GRAPH} Tasks Completed: ${completedTasks}/${totalTasks} (${successRate}%)`,
      metrics ? `${SYMBOLS.TIMER} Session Duration: ${this.formatDuration(Date.now() - metrics.startTime.getTime())}` : '',
      ''
    ].filter(Boolean);

    this.renderBlock(lines);
  }

  /**
   * Render agent grid only
   */
  renderAgentGrid(agents: AgentStatus[]): void {
    const lines = [
      this.createSeparatorLine('AGENT STATUS GRID', '='),
      '',
      ...this.createAgentGrid(agents),
      ''
    ];
    
    this.renderBlock(lines);
  }

  /**
   * Clean up and restore terminal
   */
  cleanup(): void {
    this.stopAutoRefresh();
    
    if (this.isInteractive) {
      process.stdout.write(ANSI.CURSOR_SHOW);
      process.stdout.write('\n');
    }
  }

  /**
   * Render full dashboard with all sections
   */
  private renderFullDashboard(agents: AgentStatus[], tasks: TaskStatus[], metrics?: SessionMetrics): void {
    const lines: string[] = [];
    
    // Header
    lines.push(this.createHeader(metrics));
    lines.push('');
    
    // Agent Status Grid
    lines.push(this.createSeparatorLine('AGENT STATUS GRID', '─'));
    lines.push('');
    lines.push(...this.createAgentGrid(agents));
    lines.push('');
    
    // Task Queue Status
    lines.push(this.createSeparatorLine('TASK QUEUE STATUS', '─'));
    lines.push('');
    lines.push(...this.createTaskQueue(tasks));
    lines.push('');
    
    // System Health & Metrics
    if (metrics) {
      lines.push(this.createSeparatorLine('SYSTEM HEALTH', '─'));
      lines.push('');
      lines.push(...this.createSystemHealth(metrics));
      lines.push('');
    }
    
    // Recent Activity
    lines.push(this.createSeparatorLine('RECENT ACTIVITY', '─'));
    lines.push('');
    lines.push(...this.createRecentActivity(agents, tasks));
    lines.push('');
    
    // Footer with controls
    lines.push(this.createFooter());
    
    this.renderBlock(lines);
  }

  /**
   * Render compact dashboard for smaller terminals
   */
  private renderCompactDashboard(agents: AgentStatus[], tasks: TaskStatus[], metrics?: SessionMetrics): void {
    const lines: string[] = [];
    
    // Compact header
    const activeAgents = agents.filter(a => a.status === 'active').length;
    const completedTasks = tasks.filter(t => t.status === 'complete').length;
    
    lines.push(`${SYMBOLS.CONTROL} Graphyn | Agents: ${activeAgents}/${agents.length} | Tasks: ${completedTasks}/${tasks.length} | ${this.formatTime()}`);
    lines.push('');
    
    // Compact agent list
    agents.forEach(agent => {
      const statusIcon = this.getStatusIcon(agent.status);
      const progressBar = this.createMiniProgressBar(agent.progress);
      lines.push(`${statusIcon} ${agent.name.padEnd(15)} ${progressBar} ${agent.currentTask || 'Idle'}`);
    });
    
    if (tasks.some(t => t.status === 'error')) {
      lines.push('');
      lines.push(`${SYMBOLS.ERROR} Errors detected - check logs for details`);
    }
    
    this.renderBlock(lines);
  }

  /**
   * Render for non-interactive terminals (CI, pipes, etc.)
   */
  private renderNonInteractive(agents: AgentStatus[], tasks: TaskStatus[], metrics?: SessionMetrics): void {
    const activeAgents = agents.filter(a => a.status === 'active').length;
    const completedTasks = tasks.filter(t => t.status === 'complete').length;
    const errorTasks = tasks.filter(t => t.status === 'error').length;
    
    // Only log significant changes
    const summary = `Agents: ${activeAgents}/${agents.length} active | Tasks: ${completedTasks}/${tasks.length} complete`;
    
    if (errorTasks > 0) {
      console.log(`${summary} | ${errorTasks} errors`);
    } else if (completedTasks > this.getLastCompletedCount()) {
      console.log(summary);
    }
    
    this.setLastCompletedCount(completedTasks);
  }

  /**
   * Create dashboard header with session info
   */
  private createHeader(metrics?: SessionMetrics): string {
    const sessionInfo = metrics 
      ? `Session: ${metrics.sessionId} | Duration: ${this.formatDuration(Date.now() - metrics.startTime.getTime())}`
      : 'Graphyn Mission Control';
    
    const rightAlign = `${this.formatTime()} | Render: #${this.renderCount}`;
    const padding = Math.max(0, this.maxWidth - sessionInfo.length - rightAlign.length);
    
    return this.colorize(`${SYMBOLS.CONTROL} ${sessionInfo}${' '.repeat(padding)}${rightAlign}`, COLORS.EMPHASIS);
  }

  /**
   * Create agent status grid
   */
  private createAgentGrid(agents: AgentStatus[]): string[] {
    if (agents.length === 0) {
      return ['No agents currently active'];
    }

    const lines: string[] = [];
    const cols = Math.min(3, Math.ceil(this.maxWidth / 40)); // Responsive columns
    
    for (let i = 0; i < agents.length; i += cols) {
      const row = agents.slice(i, i + cols);
      const agentCells = row.map(agent => this.createAgentCell(agent));
      
      // Pad cells to equal width
      const cellWidth = Math.floor((this.maxWidth - 4) / cols);
      const paddedCells = agentCells.map(cell => this.padCell(cell, cellWidth));
      
      lines.push(paddedCells.join(' │ '));
      
      if (i + cols < agents.length) {
        lines.push('─'.repeat(this.maxWidth));
      }
    }
    
    return lines;
  }

  /**
   * Create individual agent cell
   */
  private createAgentCell(agent: AgentStatus): string {
    const statusIcon = this.getStatusIcon(agent.status);
    const emoji = this.getAgentEmoji(agent.type);
    const progressBar = this.createMiniProgressBar(agent.progress);
    
    const lines = [
      `${emoji} ${agent.name}`,
      `${statusIcon} ${this.capitalizeFirst(agent.status)}`,
      `Task: ${agent.currentTask || 'Idle'}`,
      `Progress: ${progressBar} ${Math.round(agent.progress)}%`,
      `Completed: ${agent.metrics.tasksCompleted}`,
      agent.startedAt ? `Uptime: ${this.formatDuration(Date.now() - agent.startedAt.getTime())}` : ''
    ].filter(Boolean);
    
    return lines.join('\n');
  }

  /**
   * Create task queue visualization
   */
  private createTaskQueue(tasks: TaskStatus[]): string[] {
    const pending = tasks.filter(t => t.status === 'pending').length;
    const active = tasks.filter(t => t.status === 'active').length;
    const complete = tasks.filter(t => t.status === 'complete').length;
    const error = tasks.filter(t => t.status === 'error').length;
    
    const lines = [
      `Total: ${tasks.length} | ${this.colorize(`Running: ${active}`, COLORS.INFO)} | ${this.colorize(`Completed: ${complete}`, COLORS.SUCCESS)} | ${this.colorize(`Pending: ${pending}`, COLORS.WARNING)}`,
    ];
    
    if (error > 0) {
      lines[0] += ` | ${this.colorize(`Failed: ${error}`, COLORS.ERROR)}`;
    }
    
    // Show active tasks
    const activeTasks = tasks.filter(t => t.status === 'active');
    if (activeTasks.length > 0) {
      lines.push('');
      lines.push('Active Tasks:');
      activeTasks.forEach(task => {
        const progressBar = this.createMiniProgressBar(task.progress);
        const agent = task.assignedAgent ? `[${task.assignedAgent}]` : '';
        lines.push(`  ${SYMBOLS.ARROW_RIGHT} ${task.title} ${progressBar} ${Math.round(task.progress)}% ${agent}`);
      });
    }
    
    return lines;
  }

  /**
   * Create system health section
   */
  private createSystemHealth(metrics: SessionMetrics): string[] {
    const healthIcon = metrics.successRate > 90 ? SYMBOLS.SUCCESS : 
                      metrics.successRate > 70 ? SYMBOLS.WARNING : SYMBOLS.ERROR;
    
    return [
      `${healthIcon} Success Rate: ${Math.round(metrics.successRate)}%`,
      `${SYMBOLS.DATABASE} DB Latency: ${metrics.dbLatencyMs}ms | Knowledge: ${metrics.knowledgeEntries} entries`,
      `${SYMBOLS.GRAPH} Memory: ${Math.round(metrics.resourceUsage.memoryUsage)}MB | CPU: ${Math.round(metrics.resourceUsage.cpuUsage * 100)}%`,
      `${SYMBOLS.TIMER} Avg Task Duration: ${Math.round(metrics.averageTaskDuration / 1000)}s`
    ];
  }

  /**
   * Create recent activity log
   */
  private createRecentActivity(agents: AgentStatus[], tasks: TaskStatus[]): string[] {
    const recentEvents: Array<{ time: Date; message: string; type: string }> = [];
    
    // Add recent agent activities
    agents.forEach(agent => {
      if (agent.lastActivity && Date.now() - agent.lastActivity.getTime() < 60000) {
        recentEvents.push({
          time: agent.lastActivity,
          message: `${agent.name}: ${agent.status === 'active' ? `Working on ${agent.currentTask}` : `Status: ${agent.status}`}`,
          type: 'agent'
        });
      }
    });
    
    // Add recent task completions
    tasks
      .filter(t => t.completedTime && Date.now() - t.completedTime.getTime() < 300000) // Last 5 minutes
      .forEach(task => {
        if (task.completedTime) {
          recentEvents.push({
            time: task.completedTime,
            message: `Task completed: ${task.title}`,
            type: task.status === 'complete' ? 'success' : 'error'
          });
        }
      });
    
    // Sort by time, most recent first
    recentEvents.sort((a, b) => b.time.getTime() - a.time.getTime());
    
    if (recentEvents.length === 0) {
      return ['No recent activity'];
    }
    
    return recentEvents.slice(0, 5).map(event => {
      const timeAgo = this.formatTimeAgo(event.time);
      const icon = event.type === 'success' ? SYMBOLS.SUCCESS :
                  event.type === 'error' ? SYMBOLS.ERROR :
                  event.type === 'agent' ? SYMBOLS.ROBOT : SYMBOLS.INFO;
      return `[${timeAgo}] ${icon} ${event.message}`;
    });
  }

  /**
   * Create footer with controls
   */
  private createFooter(): string {
    const controls = this.compact 
      ? 'Press Ctrl+C to exit'
      : 'Commands: [t]ransparency [l]ogs [f]igma [s]tatus [h]elp [q]uit';
    
    const separator = '─'.repeat(this.maxWidth);
    return `${separator}\n${SYMBOLS.DOT} ${controls}`;
  }

  /**
   * Utility functions
   */
  private createSeparatorLine(title: string, char: string): string {
    const padding = Math.max(0, (this.maxWidth - title.length - 2) / 2);
    const leftPad = char.repeat(Math.floor(padding));
    const rightPad = char.repeat(Math.ceil(padding));
    return `${leftPad} ${title} ${rightPad}`;
  }

  private createMiniProgressBar(progress: number, width = 10): string {
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    return `[${SYMBOLS.PROGRESS_FULL.repeat(filled)}${SYMBOLS.PROGRESS_EMPTY.repeat(empty)}]`;
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'active': return this.colorize(SYMBOLS.SUCCESS, COLORS.SUCCESS);
      case 'idle': return this.colorize(SYMBOLS.DOT, COLORS.WARNING);
      case 'error': return this.colorize(SYMBOLS.ERROR, COLORS.ERROR);
      case 'complete': return this.colorize(SYMBOLS.SUCCESS, COLORS.SUCCESS);
      case 'paused': return this.colorize(SYMBOLS.WARNING, COLORS.WARNING);
      default: return SYMBOLS.DOT;
    }
  }

  private getAgentEmoji(type: string): string {
    switch (type) {
      case 'backend': return SYMBOLS.ROBOT;
      case 'frontend': return '⚛️';
      case 'security': return SYMBOLS.SHIELD;
      case 'test': return SYMBOLS.TEST;
      case 'figma': return SYMBOLS.FIGMA;
      case 'devops': return '🔧';
      default: return SYMBOLS.ROBOT;
    }
  }

  private padCell(content: string, width: number): string {
    const lines = content.split('\n');
    const maxLineLength = Math.max(...lines.map(line => this.stripAnsi(line).length));
    
    return lines.map(line => {
      const strippedLength = this.stripAnsi(line).length;
      const padding = Math.max(0, width - strippedLength);
      return line + ' '.repeat(padding);
    }).join('\n');
  }

  private renderBlock(lines: string[]): void {
    process.stdout.write(lines.join('\n'));
  }

  private colorize(text: string, color: string): string {
    return this.isInteractive ? `${color}${text}${ANSI.RESET}` : text;
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  private formatTime(): string {
    return new Date().toTimeString().substring(0, 8);
  }

  private stripAnsi(str: string): string {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  // State tracking for non-interactive mode
  private lastCompletedCount = 0;
  private getLastCompletedCount(): number {
    return this.lastCompletedCount;
  }
  private setLastCompletedCount(count: number): void {
    this.lastCompletedCount = count;
  }
}