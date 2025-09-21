import Database from 'better-sqlite3';

export interface TaskRow {
  id: string;
  description: string;
  agent_type: string;
  dependencies: string;
  priority: number;
  status: string;
  metadata: string;
  assigned_agent: string | null;
  result: string | null;
  metrics: string | null;
  created_at: string;
  updated_at: string;
  assigned_at: string | null;
  completed_at: string | null;
}

export interface TaskInsert {
  id: string;
  description: string;
  agentType: string;
  dependencies: string[];
  priority: number;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class TaskRepository {
  private readonly db: Database.Database;
  private insertStmt?: Database.Statement;
  private dependencyStmt?: Database.Statement;
  private assignStmt?: Database.Statement;
  private completeStmt?: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
  }

  insert(task: TaskInsert): void {
    if (!this.insertStmt) {
      this.insertStmt = this.db.prepare(`
        INSERT INTO tasks (
          id, description, agent_type, dependencies, priority, status, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
    }

    this.insertStmt.run(
      task.id,
      task.description,
      task.agentType,
      JSON.stringify(task.dependencies),
      task.priority,
      task.status,
      JSON.stringify(task.metadata),
      task.createdAt.toISOString(),
      task.updatedAt.toISOString()
    );
  }

  insertDependency(taskId: string, dependsOn: string): void {
    if (!this.dependencyStmt) {
      this.dependencyStmt = this.db.prepare(`
        INSERT OR IGNORE INTO task_dependencies (task_id, depends_on) VALUES (?, ?)
      `);
    }

    this.dependencyStmt.run(taskId, dependsOn);
  }

  findReadyTask(agentType: string, capabilities: string[]): TaskRow | undefined {
    const params: unknown[] = [agentType];
    let capabilityClause = '';

    if (capabilities.length > 0) {
      capabilityClause = ` OR t.agent_type IN (${capabilities.map(() => '?').join(', ')})`;
      params.push(...capabilities);
    }

    const sql = `
      WITH candidate AS (
        SELECT t.* FROM tasks t
        WHERE t.status = 'pending'
          AND (t.agent_type = ?${capabilityClause})
      )
      SELECT * FROM candidate c
      WHERE NOT EXISTS (
        SELECT 1 FROM task_dependencies td
        JOIN tasks dep ON td.depends_on = dep.id
        WHERE td.task_id = c.id AND dep.status != 'completed'
      )
      ORDER BY c.priority DESC, c.created_at ASC
      LIMIT 1
    `;

    const stmt = this.db.prepare(sql);
    return stmt.get(...params) as TaskRow | undefined;
  }

  assign(taskId: string, agentId: string, timestamp: string): void {
    if (!this.assignStmt) {
      this.assignStmt = this.db.prepare(`
        UPDATE tasks SET status = 'assigned', assigned_agent = ?, assigned_at = ?, updated_at = ?
        WHERE id = ?
      `);
    }

    this.assignStmt.run(agentId, timestamp, timestamp, taskId);
  }

  complete(taskId: string, result: Record<string, unknown>, metrics: Record<string, unknown>, completedAt: string): void {
    if (!this.completeStmt) {
      this.completeStmt = this.db.prepare(`
        UPDATE tasks SET status = 'completed', result = ?, metrics = ?, completed_at = ?, updated_at = ?
        WHERE id = ?
      `);
    }

    this.completeStmt.run(
      JSON.stringify(result),
      JSON.stringify(metrics),
      completedAt,
      completedAt,
      taskId
    );
  }

  getStatuses(taskIds?: string[], sessionId?: string): TaskRow[] {
    const params: unknown[] = [];
    let sql = 'SELECT t.* FROM tasks t';

    if (sessionId) {
      sql += ' LEFT JOIN agents a ON t.assigned_agent = a.id WHERE (a.session_id = ? OR t.assigned_agent IS NULL)';
      params.push(sessionId);
    } else {
      sql += ' WHERE 1=1';
    }

    if (taskIds && taskIds.length > 0) {
      sql += ` AND t.id IN (${taskIds.map(() => '?').join(', ')})`;
      params.push(...taskIds);
    }

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as TaskRow[];
  }

  loadActive(): TaskRow[] {
    try {
      // Check if tasks table exists first
      const tableExists = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'
      `).get();
      
      if (!tableExists) {
        console.log('🆕 Fresh database detected - no tasks table found');
        return [];
      }

      const stmt = this.db.prepare(`
        SELECT * FROM tasks WHERE status IN ('pending', 'assigned', 'in_progress')
      `);
      return stmt.all() as TaskRow[];
    } catch (error) {
      console.warn('⚠️ Error loading active tasks:', error);
      return [];
    }
  }

  countsByStatus(): Array<{ status: string; count: number }> {
    const stmt = this.db.prepare('SELECT status, COUNT(*) as count FROM tasks GROUP BY status');
    return stmt.all() as Array<{ status: string; count: number }>;
  }

  averageDuration(): number {
    const stmt = this.db.prepare(`
      SELECT AVG(CAST(json_extract(metrics, '$.duration') AS INTEGER)) as avg_duration
      FROM tasks WHERE status = 'completed' AND metrics IS NOT NULL
    `);
    const row = stmt.get() as { avg_duration: number | null } | undefined;
    return row?.avg_duration ?? 0;
  }
}
