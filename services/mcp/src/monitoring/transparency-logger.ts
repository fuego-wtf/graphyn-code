/**
 * Transparency Logger - Event tracking and monitoring for MCP server
 *
 * Logs all MCP tool calls, agent activities, and system events for
 * complete transparency and auditing.
 */

import { SQLiteManager } from '../database/sqlite-manager.js';
import { TransparencyRepository, TransparencyFilter, TransparencyInsert } from '../database/repositories/transparency-repository.js';

export interface TransparencyEvent {
  id?: number;
  type: string;
  sessionId?: string;
  agentId?: string;
  toolName?: string;
  duration?: number;
  success?: boolean;
  error?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface EventFilter {
  sessionId?: string;
  agentId?: string;
  eventType?: string;
  since?: Date;
  until?: Date;
  success?: boolean;
  limit?: number;
}

export interface EventStats {
  totalEvents: number;
  successRate: number;
  averageDuration: number;
  eventsByType: Record<string, number>;
  eventsByAgent: Record<string, number>;
  recentErrors: TransparencyEvent[];
}

export class TransparencyLogger {
  private readonly repository: TransparencyRepository;

  constructor(dbManager: SQLiteManager) {
    this.repository = new TransparencyRepository(dbManager.getConnection());
  }

  async logEvent(event: Omit<TransparencyEvent, 'id'>): Promise<void> {
    const payload: TransparencyInsert = {
      type: event.type,
      sessionId: event.sessionId,
      agentId: event.agentId,
      toolName: event.toolName,
      duration: event.duration,
      success: event.success,
      error: event.error,
      metadata: event.metadata,
      timestamp: event.timestamp,
    };

    this.repository.insert(payload);

    if (process.env.NODE_ENV === 'development') {
      const status = event.success === true ? '✅' : event.success === false ? '❌' : 'ℹ️';
      console.log(
        `${status} [${event.type}] ${event.toolName ? `${event.toolName} ` : ''}` +
        `${event.duration ? `(${event.duration}ms) ` : ''}` +
        `${event.agentId ? `agent:${event.agentId} ` : ''}` +
        `${event.error ? `error:${event.error}` : ''}`
      );
    }
  }

  async getEvents(filter: EventFilter = {}): Promise<TransparencyEvent[]> {
    const rows = this.repository.fetch(filter as TransparencyFilter);
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      sessionId: row.session_id ?? undefined,
      agentId: row.agent_id ?? undefined,
      toolName: row.tool_name ?? undefined,
      duration: row.duration ?? undefined,
      success: row.success === null ? undefined : Boolean(row.success),
      error: row.error ?? undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      timestamp: new Date(row.timestamp)
    }));
  }

  async getStats(filter: Omit<EventFilter, 'limit'> = {}): Promise<EventStats> {
    const stats = this.repository.stats(filter as TransparencyFilter);

    const eventsByType = stats.byType.reduce<Record<string, number>>((acc, row) => {
      acc[row.type] = row.count;
      return acc;
    }, {});

    const eventsByAgent = stats.byAgent.reduce<Record<string, number>>((acc, row) => {
      const agentId = row.agent_id ?? 'unknown';
      acc[agentId] = row.count;
      return acc;
    }, {});

    const recentErrors: TransparencyEvent[] = stats.recentErrors.map(row => ({
      id: row.id,
      type: row.type,
      sessionId: row.session_id ?? undefined,
      agentId: row.agent_id ?? undefined,
      toolName: row.tool_name ?? undefined,
      duration: row.duration ?? undefined,
      success: row.success === null ? undefined : Boolean(row.success),
      error: row.error ?? undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      timestamp: new Date(row.timestamp)
    }));

    return {
      totalEvents: stats.totals.totalEvents,
      successRate: stats.totals.successRate,
      averageDuration: stats.totals.averageDuration,
      eventsByType,
      eventsByAgent,
      recentErrors,
    };
  }

  async logToolCall(
    toolName: string,
    duration: number,
    success: boolean,
    sessionId?: string,
    agentId?: string,
    error?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      type: 'mcp_tool_call',
      sessionId,
      agentId,
      toolName,
      duration,
      success,
      error,
      metadata,
      timestamp: new Date()
    });
  }

  async logAgentEvent(
    eventType: 'agent_register' | 'agent_status_update' | 'agent_task_assign' | 'agent_task_complete',
    agentId: string,
    sessionId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      type: eventType,
      sessionId,
      agentId,
      metadata,
      timestamp: new Date()
    });
  }

  async logSystemEvent(
    eventType: 'server_start' | 'server_stop' | 'database_init' | 'database_backup' | 'coordinator_cleanup',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      type: eventType,
      metadata,
      timestamp: new Date()
    });
  }

  async logSessionEvent(
    eventType: 'session_start' | 'session_end' | 'session_pause' | 'session_resume',
    sessionId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      type: eventType,
      sessionId,
      metadata,
      timestamp: new Date()
    });
  }

  async logPerformanceMetrics(
    sessionId?: string,
    agentId?: string,
    metrics?: {
      memoryUsage?: number;
      cpuUsage?: number;
      taskQueueSize?: number;
      databaseSize?: number;
    }
  ): Promise<void> {
    await this.logEvent({
      type: 'performance_metrics',
      sessionId,
      agentId,
      metadata: metrics,
      timestamp: new Date()
    });
  }

  async cleanup(retentionDays: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deleted = this.repository.deleteOlderThan(cutoffDate.toISOString());

    console.log(`🧹 Cleaned up ${deleted} old transparency events (older than ${retentionDays} days)`);

    await this.logEvent({
      type: 'transparency_cleanup',
      metadata: {
        deletedEvents: deleted,
        retentionDays,
        cutoffDate: cutoffDate.toISOString()
      },
      timestamp: new Date()
    });
  }

  async exportEvents(filter: EventFilter = {}): Promise<string> {
    const events = await this.getEvents(filter);
    const stats = await this.getStats(filter);

    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        filter,
        totalEvents: events.length,
        stats
      },
      events
    };

    return JSON.stringify(exportData, null, 2);
  }

  async getRecentEvents(minutes: number = 5): Promise<TransparencyEvent[]> {
    const since = new Date();
    since.setMinutes(since.getMinutes() - minutes);

    return this.getEvents({ since, limit: 100 });
  }
}
