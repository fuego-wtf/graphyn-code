import Database from 'better-sqlite3';

export interface TransparencyInsert {
  type: string;
  sessionId?: string;
  agentId?: string;
  toolName?: string;
  duration?: number;
  success?: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface TransparencyFilter {
  sessionId?: string;
  agentId?: string;
  eventType?: string;
  since?: Date;
  until?: Date;
  success?: boolean;
  limit?: number;
}

export class TransparencyRepository {
  private readonly db: Database.Database;
  private insertStmt?: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
  }

  insert(event: TransparencyInsert): void {
    if (!this.insertStmt) {
      this.insertStmt = this.db.prepare(`
        INSERT INTO transparency_events (
          type, session_id, agent_id, tool_name, duration, success, error, metadata, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
    }

    this.insertStmt.run(
      event.type,
      event.sessionId ?? null,
      event.agentId ?? null,
      event.toolName ?? null,
      event.duration ?? null,
      event.success === undefined ? null : event.success ? 1 : 0,
      event.error ?? null,
      JSON.stringify(event.metadata ?? {}),
      event.timestamp.toISOString()
    );
  }

  fetch(filter: TransparencyFilter): any[] {
    const params: unknown[] = [];
    let sql = 'SELECT * FROM transparency_events WHERE 1=1';

    if (filter.sessionId) {
      sql += ' AND session_id = ?';
      params.push(filter.sessionId);
    }

    if (filter.agentId) {
      sql += ' AND agent_id = ?';
      params.push(filter.agentId);
    }

    if (filter.eventType) {
      sql += ' AND type = ?';
      params.push(filter.eventType);
    }

    if (filter.since) {
      sql += ' AND timestamp >= ?';
      params.push(filter.since.toISOString());
    }

    if (filter.until) {
      sql += ' AND timestamp <= ?';
      params.push(filter.until.toISOString());
    }

    if (filter.success !== undefined) {
      sql += ' AND success = ?';
      params.push(filter.success ? 1 : 0);
    }

    sql += ' ORDER BY timestamp DESC';

    if (filter.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as any[];
  }

  stats(filter: Omit<TransparencyFilter, 'limit'>): {
    totals: { totalEvents: number; successRate: number; averageDuration: number };
    byType: Array<{ type: string; count: number }>;
    byAgent: Array<{ agent_id: string; count: number }>;
    recentErrors: any[];
  } {
    const params: unknown[] = [];
    let base = 'FROM transparency_events WHERE 1=1';

    if (filter.sessionId) {
      base += ' AND session_id = ?';
      params.push(filter.sessionId);
    }

    if (filter.agentId) {
      base += ' AND agent_id = ?';
      params.push(filter.agentId);
    }

    if (filter.eventType) {
      base += ' AND type = ?';
      params.push(filter.eventType);
    }

    if (filter.since) {
      base += ' AND timestamp >= ?';
      params.push(filter.since.toISOString());
    }

    if (filter.until) {
      base += ' AND timestamp <= ?';
      params.push(filter.until.toISOString());
    }

    const totalsStmt = this.db.prepare(`
      SELECT COUNT(*) as total,
             AVG(duration) as avg_duration,
             AVG(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_rate
      ${base}
    `);
    const totalsRow = totalsStmt.get(...params) as { total: number; avg_duration: number | null; success_rate: number | null };

    const byTypeStmt = this.db.prepare(`
      SELECT type, COUNT(*) as count ${base} GROUP BY type
    `);
    const byAgentStmt = this.db.prepare(`
      SELECT agent_id, COUNT(*) as count ${base} GROUP BY agent_id
    `);
    const recentErrorsStmt = this.db.prepare(`
      SELECT * ${base} AND success = 0 ORDER BY timestamp DESC LIMIT 10
    `);

    return {
      totals: {
        totalEvents: totalsRow?.total ?? 0,
        successRate: totalsRow?.success_rate ?? 0,
        averageDuration: totalsRow?.avg_duration ?? 0
      },
      byType: byTypeStmt.all(...params) as Array<{ type: string; count: number }> ,
      byAgent: byAgentStmt.all(...params) as Array<{ agent_id: string; count: number }> ,
      recentErrors: recentErrorsStmt.all(...params) as any[]
    };
  }

  deleteOlderThan(timestamp: string): number {
    const stmt = this.db.prepare('DELETE FROM transparency_events WHERE timestamp < ?');
    return stmt.run(timestamp).changes;
  }
}
