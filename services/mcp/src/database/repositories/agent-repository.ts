import Database from 'better-sqlite3';

export interface AgentInsert {
  id: string;
  type: string;
  capabilities: string[];
  sessionId: string;
  metadata: Record<string, unknown>;
  status: string;
  registeredAt: Date;
  updatedAt: Date;
}

export interface AgentStatusUpdate {
  status: string;
  currentTask?: string;
  metrics?: Record<string, unknown>;
  updatedAt: Date;
}

export class AgentRepository {
  private readonly db: Database.Database;
  private insertStmt?: Database.Statement;
  private updateStatusStmt?: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
  }

  upsert(agent: AgentInsert): void {
    if (!this.insertStmt) {
      this.insertStmt = this.db.prepare(`
        INSERT INTO agents (
          id, type, capabilities, session_id, metadata, status, registered_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          type = excluded.type,
          capabilities = excluded.capabilities,
          session_id = excluded.session_id,
          metadata = excluded.metadata,
          status = excluded.status,
          updated_at = excluded.updated_at
      `);
    }

    this.insertStmt.run(
      agent.id,
      agent.type,
      JSON.stringify(agent.capabilities),
      agent.sessionId,
      JSON.stringify(agent.metadata),
      agent.status,
      agent.registeredAt.toISOString(),
      agent.updatedAt.toISOString()
    );
  }

  updateStatus(agentId: string, update: AgentStatusUpdate): void {
    if (!this.updateStatusStmt) {
      this.updateStatusStmt = this.db.prepare(`
        UPDATE agents SET status = ?, current_task = ?, metrics = ?, updated_at = ?
        WHERE id = ?
      `);
    }

    this.updateStatusStmt.run(
      update.status,
      update.currentTask ?? null,
      JSON.stringify(update.metrics ?? {}),
      update.updatedAt.toISOString(),
      agentId
    );
  }

  markAllOffline(timestamp: string): void {
    this.db.prepare(`
      UPDATE agents SET status = 'offline', current_task = NULL, updated_at = ?
    `).run(timestamp);
  }

  loadActive(): Array<{
    id: string;
    type: string;
    capabilities: string;
    session_id: string;
    metadata: string;
    status: string;
    current_task: string | null;
    metrics: string | null;
    registered_at: string;
    updated_at: string;
  }> {
    try {
      // Check if agents table exists first
      const tableExists = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='agents'
      `).get();
      
      if (!tableExists) {
        console.log('🆕 Fresh database detected - no agents table found');
        return [];
      }

      const stmt = this.db.prepare(`
        SELECT * FROM agents WHERE status != 'offline'
      `);
      return stmt.all() as Array<{
        id: string;
        type: string;
        capabilities: string;
        session_id: string;
        metadata: string;
        status: string;
        current_task: string | null;
        metrics: string | null;
        registered_at: string;
        updated_at: string;
      }>;
    } catch (error) {
      console.warn('⚠️ Error loading active agents:', error);
      return [];
    }
  }

  countsByStatusAndType(): Array<{ status: string; type: string; count: number }> {
    const stmt = this.db.prepare('SELECT status, type, COUNT(*) as count FROM agents GROUP BY status, type');
    return stmt.all() as Array<{ status: string; type: string; count: number }>;
  }
}
