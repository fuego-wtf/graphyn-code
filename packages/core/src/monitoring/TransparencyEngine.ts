import { appendFile } from 'fs/promises';
import { EventEmitter } from 'events';
import path from 'path';
import { ProcessOutputCapture, ProcessMetrics, StreamEvent, ProcessTreeNode } from './ProcessOutputCapture.js';
import { ClaudeCodeMCPIntegration, ClaudeProcessResult } from '../integration/ClaudeCodeMCPIntegration.js';

export interface TransparencyEvent {
  sessionId?: string;
  source: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  eventType: string;
  message: string;
  metadata?: Record<string, any>;
  eventTime?: Date;
}

export interface TransparencyStore {
  recordTransparencyEvent(event: TransparencyEvent): Promise<void>;
}

export interface MCPTransaction {
  id: string;
  timestamp: number;
  toolName: string;
  agentId: string;
  duration: number;
  success: boolean;
  input: any;
  output?: any;
  error?: string;
}

export interface SystemMetrics {
  totalAgents: number;
  activeAgents: number;
  completedTasks: number;
  failedTasks: number;
  totalTransactions: number;
  averageQueryTime: number;
  systemUptime: number;
}

export interface DashboardState {
  agents: Map<string, ProcessMetrics>;
  systemMetrics: SystemMetrics;
  recentTransactions: MCPTransaction[];
  processTree: ProcessTreeNode[];
  sessionInfo: {
    sessionId: string;
    startTime: number;
    duration: number;
    workingDirectory: string;
  };
}

export interface TransparencyEngineOptions {
  sessionId?: string;
  logDirectory?: string;
  db: TransparencyStore;
  realTimeUpdates?: boolean;
  dashboardUpdateInterval?: number;
}

export interface TransparencyRecordInput {
  level?: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  eventType: string;
  message: string;
  metadata?: Record<string, any>;
  eventTime?: Date;
}

export class TransparencyEngine {
  private readonly sessionId?: string;
  private readonly logFile?: string;
  private readonly db: TransparencyStore;
  private readonly emitter = new EventEmitter();
  
  // Enhanced transparency features
  private processCapture: ProcessOutputCapture;
  private claudeIntegration?: ClaudeCodeMCPIntegration;
  private mcpTransactions: MCPTransaction[] = [];
  private systemStartTime: number;
  private dashboardState: DashboardState;
  private dashboardTimer?: NodeJS.Timeout;
  private realTimeUpdates: boolean;
  private dashboardUpdateInterval: number;

  constructor(options: TransparencyEngineOptions) {
    this.sessionId = options.sessionId;
    this.db = options.db;
    this.realTimeUpdates = options.realTimeUpdates ?? true;
    this.dashboardUpdateInterval = options.dashboardUpdateInterval ?? 500;
    
    if (options.logDirectory) {
      this.logFile = path.join(options.logDirectory, 'transparency.log');
    }
    
    this.systemStartTime = Date.now();
    this.processCapture = new ProcessOutputCapture({ transparencyEnabled: true });
    
    // Initialize dashboard state
    this.dashboardState = {
      agents: new Map(),
      systemMetrics: this.initializeSystemMetrics(),
      recentTransactions: [],
      processTree: [],
      sessionInfo: {
        sessionId: this.sessionId || 'unknown',
        startTime: this.systemStartTime,
        duration: 0,
        workingDirectory: process.cwd()
      }
    };
    
    this.setupEventHandlers();
    
    if (this.realTimeUpdates) {
      this.startDashboardUpdates();
    }
  }

  attachTo(coordinator: EventEmitter): void {
    coordinator.on('mcp:tool-call', (payload) => {
      this.record({
        level: 'info',
        source: 'mcp',
        eventType: 'tool_call',
        message: `${payload.name}`,
        metadata: payload,
      });
    });

    coordinator.on('mcp:tool-response', (payload) => {
      this.record({
        level: payload.success ? 'info' : 'warn',
        source: 'mcp',
        eventType: payload.success ? 'tool_response' : 'tool_error',
        message: `${payload.name}`,
        metadata: payload,
      });
    });

    coordinator.on('mcp:process-log', (payload) => {
      this.record({
        level: 'debug',
        source: 'mcp',
        eventType: 'process_log',
        message: payload.message,
      });
    });
  }

  async record(entry: TransparencyRecordInput): Promise<void> {
    const event: TransparencyEvent = {
      sessionId: this.sessionId,
      source: entry.source,
      level: entry.level ?? 'info',
      eventType: entry.eventType,
      message: entry.message,
      metadata: entry.metadata,
      eventTime: entry.eventTime ?? new Date(),
    };

    await this.db.recordTransparencyEvent(event);
    this.emitter.emit('event', event);

    if (this.logFile) {
      const line = `${event.eventTime?.toISOString()} [${event.level.toUpperCase()}] ${event.source}::${event.eventType} - ${event.message}${
        event.metadata ? ` ${JSON.stringify(event.metadata)}` : ''
      }\n`;
      await appendFile(this.logFile, line);
    }
  }

  onEvent(listener: (event: TransparencyEvent) => void): void {
    this.emitter.on('event', listener);
  }

  offEvent(listener: (event: TransparencyEvent) => void): void {
    this.emitter.off('event', listener);
  }
  
  // ======== ENHANCED TRANSPARENCY METHODS ========
  
  /**
   * Connect Claude Code MCP Integration for process monitoring
   */
  connectClaudeIntegration(integration: ClaudeCodeMCPIntegration): void {
    this.claudeIntegration = integration;
    
    // Listen to Claude process events
    integration.on('processComplete', (result: ClaudeProcessResult) => {
      this.record({
        level: 'info',
        source: 'claude',
        eventType: 'process_complete',
        message: `Agent ${result.agentId} completed: ${result.duration}ms, ${result.toolsUsed.length} tools`,
        metadata: result
      });
    });

    integration.on('processError', (result: ClaudeProcessResult) => {
      this.record({
        level: 'error',
        source: 'claude',
        eventType: 'process_error',
        message: `Agent ${result.agentId} failed: ${result.error}`,
        metadata: result
      });
    });
  }
  
  /**
   * Log MCP transaction for transparency
   */
  logMCPTransaction(transaction: Omit<MCPTransaction, 'id' | 'timestamp'>): void {
    const mcpTransaction: MCPTransaction = {
      ...transaction,
      id: this.generateTransactionId(),
      timestamp: Date.now()
    };

    this.mcpTransactions.push(mcpTransaction);
    
    // Keep only recent transactions to prevent memory issues
    if (this.mcpTransactions.length > 1000) {
      this.mcpTransactions = this.mcpTransactions.slice(-1000);
    }

    // Update dashboard state
    this.dashboardState.recentTransactions = this.mcpTransactions.slice(-20);
    this.dashboardState.systemMetrics.totalTransactions++;
    this.updateAverageQueryTime(transaction.duration);

    const durationDisplay = transaction.duration < 10 ? 
      `${transaction.duration.toFixed(1)}ms` : 
      `${Math.round(transaction.duration)}ms`;
      
    const status = transaction.success ? '✅' : '❌';
    console.log(`📤 MCP: ${transaction.toolName}(${transaction.agentId.slice(-3)}) → ${status} (${durationDisplay})`);

    this.record({
      level: transaction.success ? 'info' : 'warn',
      source: 'mcp',
      eventType: 'transaction',
      message: `${transaction.toolName} (${durationDisplay})`,
      metadata: mcpTransaction
    });
  }
  
  /**
   * Start monitoring a Claude process
   */
  startProcessMonitoring(
    agentId: string,
    agentType: string,
    process: any,
    sessionDir: string
  ): void {
    this.processCapture.startMonitoring(agentId, agentType, process, sessionDir);
    
    // Update dashboard metrics
    this.dashboardState.systemMetrics.totalAgents++;
    this.dashboardState.systemMetrics.activeAgents++;
    
    console.log(`📊 Process monitor: ${agentType}-${agentId.slice(-3)} [PID: ${process.pid}] started`);
    
    this.record({
      level: 'info',
      source: 'process',
      eventType: 'start',
      message: `Started monitoring ${agentType}-${agentId.slice(-3)}`,
      metadata: { agentId, agentType, pid: process.pid }
    });
  }
  
  /**
   * Generate live dashboard display
   */
  generateDashboardDisplay(): string {
    const state = this.dashboardState;
    const uptime = Date.now() - this.systemStartTime;
    const uptimeDisplay = this.formatDuration(uptime);
    
    let display = `┌─────────────────────────────────────────────────────────────────────────┐\n`;
    display += `│ 🔍 GRAPHYN TRANSPARENCY - Live System Operations                       │\n`;
    display += `├─────────────────────────────────────────────────────────────────────────┤\n`;
    display += `│ Session: ${state.sessionInfo.sessionId.padEnd(20)} │ Uptime: ${uptimeDisplay.padEnd(20)} │\n`;
    display += `│ Active: ${state.systemMetrics.activeAgents}/${state.systemMetrics.totalAgents} agents │ Query Avg: ${state.systemMetrics.averageQueryTime.toFixed(1)}ms │\n`;
    display += `├─────────────────────────────────────────────────────────────────────────┤\n`;
    
    // Agent Status
    display += `│ AGENT STATUS:                                                           │\n`;
    const agents = Array.from(state.agents.values());
    if (agents.length === 0) {
      display += `│   No active agents                                                      │\n`;
    } else {
      for (const agent of agents.slice(0, 3)) {
        const statusIcon = this.getAgentStatusIcon(agent.status);
        const duration = agent.duration ? `${agent.duration}ms` : 'running';
        const shortId = agent.agentId.slice(-3);
        display += `│ ${statusIcon} ${agent.agentType}-${shortId} [PID: ${agent.pid}] (${duration}) ${agent.toolCalls} tools │\n`;
      }
    }
    
    // Recent Transactions
    display += `│ MCP TRANSACTIONS (Last 3):                                             │\n`;
    const recentTransactions = state.recentTransactions.slice(-3);
    for (const tx of recentTransactions) {
      const status = tx.success ? '✅' : '❌';
      const duration = tx.duration < 10 ? `${tx.duration.toFixed(1)}ms` : `${Math.round(tx.duration)}ms`;
      display += `│ ${tx.toolName} → ${status} (${duration})                                         │\n`;
    }
    
    display += `├─────────────────────────────────────────────────────────────────────────┤\n`;
    display += `│ 🔄 Refreshing every ${this.dashboardUpdateInterval}ms | Press Ctrl+C to exit                   │\n`;
    display += `└─────────────────────────────────────────────────────────────────────────┘\n`;
    
    return display;
  }
  
  /**
   * Display real-time process transparency
   */
  displayProcessTransparency(): void {
    console.clear();
    console.log(this.generateDashboardDisplay());
  }
  
  // ======== PRIVATE HELPER METHODS ========
  
  private setupEventHandlers(): void {
    this.processCapture.on('streamEvent', (event: StreamEvent) => {
      if (event.type === 'process_end') {
        this.dashboardState.systemMetrics.activeAgents--;
        if (event.data.code === 0) {
          this.dashboardState.systemMetrics.completedTasks++;
        } else {
          this.dashboardState.systemMetrics.failedTasks++;
        }
      }
    });

    this.processCapture.on('metricsUpdate', ({ agentId, metrics }: { agentId: string; metrics: ProcessMetrics }) => {
      this.dashboardState.agents.set(agentId, metrics);
    });
  }
  
  private startDashboardUpdates(): void {
    this.dashboardTimer = setInterval(() => {
      this.updateDashboard();
      this.emitter.emit('dashboardUpdate', this.dashboardState);
    }, this.dashboardUpdateInterval);
  }
  
  private updateDashboard(): void {
    this.dashboardState.sessionInfo.duration = Date.now() - this.systemStartTime;
    this.dashboardState.agents = this.processCapture.getProcessMetrics() as Map<string, ProcessMetrics>;
    this.dashboardState.processTree = this.processCapture.getProcessTree();
  }
  
  private initializeSystemMetrics(): SystemMetrics {
    return {
      totalAgents: 0,
      activeAgents: 0,
      completedTasks: 0,
      failedTasks: 0,
      totalTransactions: 0,
      averageQueryTime: 0,
      systemUptime: 0
    };
  }
  
  private updateAverageQueryTime(newDuration: number): void {
    const metrics = this.dashboardState.systemMetrics;
    const total = metrics.averageQueryTime * (metrics.totalTransactions - 1) + newDuration;
    metrics.averageQueryTime = total / metrics.totalTransactions;
  }
  
  private getAgentStatusIcon(status: string): string {
    switch (status) {
      case 'starting': return '🟡';
      case 'running': return '🔄';
      case 'completed': return '✅';
      case 'error': return '❌';
      case 'timeout': return '⏱️';
      default: return '❓';
    }
  }
  
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
  
  /**
   * Stop transparency engine
   */
  stop(): void {
    if (this.dashboardTimer) {
      clearInterval(this.dashboardTimer);
      this.dashboardTimer = undefined;
    }

    this.processCapture.destroy();
    this.emitter.removeAllListeners();
    console.log('🔍 Transparency Engine stopped');
  }
  
  /**
   * Get current dashboard state
   */
  getDashboardState(): DashboardState {
    return { ...this.dashboardState };
  }
}

export default TransparencyEngine;
