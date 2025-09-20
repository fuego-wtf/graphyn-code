/**
 * @graphyn/db - Database abstractions and utilities
 * 
 * Provides SQLite-based persistence layer with:
 * - Task queue management with priority and dependencies
 * - Session state tracking
 * - WAL2 mode optimization for concurrent access
 * - Mock implementations for development/testing
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

function createIdentifier(prefix: string): string {
  const ts = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${random}`;
}

// Types
export interface Task {
  id: string;
  agentType: string;
  description: string;
  priority: number;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  workspace?: string;
  config?: any;
  result?: any;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface TaskQueue {
  enqueueTask(taskId: string, config: Omit<Task, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<void>;
  getNextTask(agentType?: string): Promise<Task | null>;
  completeTask(taskId: string, result: { success: boolean; result?: any; error?: string }): Promise<void>;
  getTaskStatus(options?: {
    includeDetails?: boolean;
    agentType?: string;
    status?: string;
    taskId?: string;
  }): Promise<any>;
  getTasks(filters?: { status?: string; agentType?: string; limit?: number }): Promise<Task[]>;
}

export interface SessionManager {
  createSession(sessionId: string, config: any): Promise<void>;
  getSession(sessionId: string): Promise<any | null>;
  updateSession(sessionId: string, updates: any): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(): Promise<any[]>;
}

export type TransparencyLevel = 'info' | 'warn' | 'error' | 'debug';

export interface TransparencyEvent {
  id?: string;
  sessionId?: string;
  eventTime?: Date;
  source: string;
  level: TransparencyLevel;
  eventType: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface KnowledgeEntry {
  id?: string;
  source: string;
  sourceId?: string;
  sessionId?: string;
  title: string;
  url?: string;
  tags?: string[];
  content: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TransparencyStore {
  recordTransparencyEvent(event: TransparencyEvent): Promise<void>;
  getTransparencyEvents(options?: { sessionId?: string; limit?: number }): Promise<TransparencyEvent[]>;
}

export interface KnowledgeStore {
  upsertKnowledgeEntry(entry: KnowledgeEntry): Promise<void>;
  getKnowledgeEntries(options?: { sessionId?: string; source?: string; limit?: number }): Promise<KnowledgeEntry[]>;
}

/**
 * Production SQLite Database Manager
 * Migrated and enhanced from src/mcp-server/database/sqlite-manager.ts
 * Implements task queueing, session management, and WAL2 optimization
 */
export class SQLiteManager implements TaskQueue, SessionManager, TransparencyStore, KnowledgeStore {
  private statements: Record<string, any> = {};
  private db: Database.Database;
  private initialized = false;

  constructor(dbPath: string = './data/graphyn.db') {
    // Ensure data directory exists
    const dbDir = join(dbPath, '..');
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    
    // Configure for performance and concurrent access
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');
    this.db.pragma('temp_store = memory');
    
    this.initializeSchema();
  }

  private initializeSchema(): void {
    if (this.initialized) return;

    // Tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        agent_type TEXT NOT NULL,
        description TEXT NOT NULL,
        priority INTEGER DEFAULT 5,
        dependencies TEXT, -- JSON array
        status TEXT DEFAULT 'pending',
        workspace TEXT,
        config TEXT, -- JSON
        result TEXT, -- JSON
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER,
        error TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_agent_type ON tasks(agent_type);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority DESC);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
    `);

    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        config TEXT NOT NULL, -- JSON
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    `);

    // Transparency events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transparency_events (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        event_time INTEGER NOT NULL,
        level TEXT NOT NULL,
        source TEXT NOT NULL,
        event_type TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_transparency_session ON transparency_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_transparency_time ON transparency_events(event_time DESC);
    `);

    // Knowledge base table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_entries (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        source_id TEXT,
        session_id TEXT,
        title TEXT NOT NULL,
        url TEXT,
        tags TEXT,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge_entries(source);
      CREATE INDEX IF NOT EXISTS idx_knowledge_session ON knowledge_entries(session_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_updated ON knowledge_entries(updated_at DESC);
    `);

    this.initialized = true;
  }

  // Task Queue Implementation
  async enqueueTask(taskId: string, config: Omit<Task, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, agent_type, description, priority, dependencies, 
        workspace, config, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      taskId,
      config.agentType,
      config.description,
      config.priority || 5,
      JSON.stringify(config.dependencies || []),
      config.workspace,
      config.config ? JSON.stringify(config.config) : null,
      now,
      now
    );
  }

  async getNextTask(agentType?: string): Promise<Task | null> {
    let query = `
      SELECT * FROM tasks 
      WHERE status = 'pending'
    `;
    const params: any[] = [];

    if (agentType) {
      query += ` AND agent_type = ?`;
      params.push(agentType);
    }

    query += ` ORDER BY priority DESC, created_at ASC LIMIT 1`;

    const row = this.db.prepare(query).get(...params) as any;
    
    if (!row) return null;

    // Mark as running
    const updateStmt = this.db.prepare(`
      UPDATE tasks 
      SET status = 'running', started_at = ?, updated_at = ?
      WHERE id = ?
    `);
    const now = Date.now();
    updateStmt.run(now, now, row.id);

    return this.mapRowToTask(row);
  }

  async completeTask(taskId: string, result: { success: boolean; result?: any; error?: string }): Promise<void> {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE tasks 
      SET status = ?, result = ?, error = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      result.success ? 'completed' : 'failed',
      result.result ? JSON.stringify(result.result) : null,
      result.error || null,
      now,
      now,
      taskId
    );
  }

  async getTaskStatus(options: any = {}): Promise<any> {
    const countQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM tasks 
      GROUP BY status
    `;

    const statusRows = this.db.prepare(countQuery).all() as any[];
    const statusMap = Object.fromEntries(
      statusRows.map(row => [row.status, row.count])
    );

    const total = statusRows.reduce((sum, row) => sum + row.count, 0);

    // Get next ready task info
    const nextTaskQuery = `
      SELECT id, agent_type, priority, created_at
      FROM tasks 
      WHERE status = 'pending'
      ORDER BY priority DESC, created_at ASC 
      LIMIT 1
    `;
    const nextTask = this.db.prepare(nextTaskQuery).get() as any;

    return {
      total,
      pending: statusMap.pending || 0,
      running: statusMap.running || 0,
      completed: statusMap.completed || 0,
      failed: statusMap.failed || 0,
      ready: statusMap.pending || 0,
      nextReady: nextTask ? {
        id: nextTask.id,
        agentType: nextTask.agent_type,
        priority: nextTask.priority,
        createdAt: new Date(nextTask.created_at)
      } : null,
      system: {
        healthy: true,
        database: 'sqlite',
        wal2: this.db.pragma('journal_mode') === 'wal'
      }
    };
  }

  async getTasks(filters: any = {}): Promise<Task[]> {
    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params: any[] = [];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.agentType) {
      query += ' AND agent_type = ?';
      params.push(filters.agentType);
    }

    query += ' ORDER BY created_at DESC';
    
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(row => this.mapRowToTask(row));
  }

  // Session Management Implementation
  async createSession(sessionId: string, config: any): Promise<void> {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions (id, config, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(sessionId, JSON.stringify(config), now, now);
  }

  async getSession(sessionId: string): Promise<any | null> {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(sessionId) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      config: JSON.parse(row.config),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : null
    };
  }

  async updateSession(sessionId: string, updates: any): Promise<void> {
    const existing = await this.getSession(sessionId);
    if (!existing) throw new Error(`Session ${sessionId} not found`);

    const newConfig = { ...existing.config, ...updates };
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET config = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(JSON.stringify(newConfig), Date.now(), sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    stmt.run(sessionId);
  }

  async listSessions(): Promise<any[]> {
    const stmt = this.db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC');
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      id: row.id,
      config: JSON.parse(row.config),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : null
    }));
  }

  private mapRowToTask(row: any): Task {
    return {
      id: row.id,
      agentType: row.agent_type,
      description: row.description,
      priority: row.priority,
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : [],
      status: row.status,
      workspace: row.workspace,
      config: row.config ? JSON.parse(row.config) : undefined,
      result: row.result ? JSON.parse(row.result) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      error: row.error
    };
  }

  // Enhanced methods from original SQLite manager
  async getReadyTasks(): Promise<Task[]> {
    try {
      const pendingTasks = await this.getTasks({ status: 'pending' });
      const readyTasks: Task[] = [];

      for (const task of pendingTasks) {
        const dependencies = task.dependencies;
        if (dependencies.length === 0 || await this.checkDependencies(dependencies)) {
          readyTasks.push(task);
        }
      }

      return readyTasks.sort((a, b) => b.priority - a.priority);
    } catch (error: any) {
      console.error('❌ Failed to get ready tasks:', error);
      throw error;
    }
  }

  async getNextReadyTask(): Promise<Task | null> {
    const readyTasks = await this.getReadyTasks();
    return readyTasks.length > 0 ? readyTasks[0] : null;
  }

  async markTaskRunning(taskId: string): Promise<boolean> {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE tasks 
      SET status = 'running', started_at = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'
    `);
    
    const result = stmt.run(now, now, taskId);
    const success = result.changes > 0;
    
    if (success) {
      console.log(`✅ Task ${taskId} marked as running`);
    } else {
      console.warn(`⚠️ Task ${taskId} was not in pending status`);
    }
    
    return success;
  }

  private async checkDependencies(dependencies: string[]): Promise<boolean> {
    if (dependencies.length === 0) return true;

    try {
      const placeholders = dependencies.map(() => '?').join(',');
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM tasks 
        WHERE id IN (${placeholders}) AND status = 'completed'
      `);
      const result = stmt.get(...dependencies) as any;
      
      return result.count === dependencies.length;
    } catch (error: any) {
      console.error('❌ Failed to check dependencies:', error);
      return false;
    }
  }

  async transaction<T>(operation: () => Promise<T> | T): Promise<T> {
    // Simple transaction wrapper for better-sqlite3
    try {
      this.db.exec('BEGIN TRANSACTION');
      const result = await operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      console.error('❌ Transaction failed:', error);
      throw error;
    }
  }

  // Test helper methods
  async getAllTasks(): Promise<Task[]> {
    const stmt = this.db.prepare('SELECT * FROM tasks ORDER BY created_at ASC');
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapRowToTask(row));
  }

  async clearAllTasks(): Promise<void> {
    this.db.exec('DELETE FROM tasks');
    console.log('🧹 All tasks cleared');
  }

  async recordTransparencyEvent(event: TransparencyEvent): Promise<void> {
    const id = event.id ?? createIdentifier('tev');
    const eventTime = (event.eventTime ?? new Date()).getTime();
    const createdAt = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO transparency_events (id, session_id, event_time, level, source, event_type, message, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      event.sessionId || null,
      eventTime,
      event.level,
      event.source,
      event.eventType,
      event.message,
      event.metadata ? JSON.stringify(event.metadata) : null,
      createdAt
    );
  }

  async getTransparencyEvents(options: { sessionId?: string; limit?: number } = {}): Promise<TransparencyEvent[]> {
    const clauses: string[] = [];
    const params: any[] = [];

    if (options.sessionId) {
      clauses.push('session_id = ?');
      params.push(options.sessionId);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = options.limit ? `LIMIT ${options.limit}` : '';

    const rows = this.db.prepare(`
      SELECT id, session_id, event_time, level, source, event_type, message, metadata
      FROM transparency_events
      ${where}
      ORDER BY event_time DESC
      ${limit}
    `).all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id || undefined,
      eventTime: new Date(row.event_time),
      level: row.level,
      source: row.source,
      eventType: row.event_type,
      message: row.message,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    } satisfies TransparencyEvent));
  }

  async upsertKnowledgeEntry(entry: KnowledgeEntry): Promise<void> {
    const now = Date.now();
    const id = entry.id ?? createIdentifier('kb');

    const stmt = this.db.prepare(`
      INSERT INTO knowledge_entries (
        id, source, source_id, session_id, title, url, tags, content, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source = excluded.source,
        source_id = excluded.source_id,
        session_id = excluded.session_id,
        title = excluded.title,
        url = excluded.url,
        tags = excluded.tags,
        content = excluded.content,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      id,
      entry.source,
      entry.sourceId || null,
      entry.sessionId || null,
      entry.title,
      entry.url || null,
      entry.tags ? JSON.stringify(entry.tags) : null,
      entry.content,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      entry.createdAt ? entry.createdAt.getTime() : now,
      entry.updatedAt ? entry.updatedAt.getTime() : now
    );
  }

  async getKnowledgeEntries(options: { sessionId?: string; source?: string; limit?: number } = {}): Promise<KnowledgeEntry[]> {
    const clauses: string[] = [];
    const params: any[] = [];

    if (options.sessionId) {
      clauses.push('session_id = ?');
      params.push(options.sessionId);
    }

    if (options.source) {
      clauses.push('source = ?');
      params.push(options.source);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = options.limit ? `LIMIT ${options.limit}` : '';

    const rows = this.db.prepare(`
      SELECT id, source, source_id, session_id, title, url, tags, content, metadata, created_at, updated_at
      FROM knowledge_entries
      ${where}
      ORDER BY updated_at DESC
      ${limit}
    `).all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      source: row.source,
      sourceId: row.source_id || undefined,
      sessionId: row.session_id || undefined,
      title: row.title,
      url: row.url || undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    } satisfies KnowledgeEntry));
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Mock Database Manager for development and testing
 * Provides same interface as SQLiteManager but uses in-memory storage
 */
export class MockDatabaseManager implements TaskQueue, SessionManager, TransparencyStore, KnowledgeStore {
  private tasks = new Map<string, Task>();
  private sessions = new Map<string, any>();
  private taskCounter = 0;
  private transparencyEvents: TransparencyEvent[] = [];
  private knowledgeEntries: KnowledgeEntry[] = [];

  async enqueueTask(taskId: string, config: Omit<Task, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const task: Task = {
      id: taskId,
      ...config,
      dependencies: config.dependencies || [],
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.tasks.set(taskId, task);
    console.log(`📤 Mock: Enqueued task ${taskId}`);
  }

  async getNextTask(agentType?: string): Promise<Task | null> {
    for (const [id, task] of this.tasks.entries()) {
      if (task.status === 'pending' && (!agentType || task.agentType === agentType)) {
        task.status = 'running';
        task.startedAt = new Date();
        task.updatedAt = new Date();
        console.log(`📥 Mock: Getting task ${id} for ${agentType || 'any'} agent`);
        return task;
      }
    }
    return null;
  }

  async completeTask(taskId: string, result: { success: boolean; result?: any; error?: string }): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = result.success ? 'completed' : 'failed';
      task.result = result.result;
      task.error = result.error;
      task.completedAt = new Date();
      task.updatedAt = new Date();
      console.log(`✅ Mock: Completed task ${taskId}`);
    }
  }

  async getTaskStatus(): Promise<any> {
    const tasks = Array.from(this.tasks.values());
    const nextTask = tasks.find(t => t.status === 'pending');
    
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      ready: tasks.filter(t => t.status === 'pending').length,
      nextReady: nextTask ? {
        id: nextTask.id,
        agentType: nextTask.agentType,
        priority: nextTask.priority,
        createdAt: nextTask.createdAt
      } : null,
      system: {
        healthy: true,
        database: 'mock',
        wal2: false
      }
    };
  }

  async getTasks(filters: any = {}): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values());
    
    if (filters.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }
    if (filters.agentType) {
      tasks = tasks.filter(t => t.agentType === filters.agentType);
    }
    if (filters.limit) {
      tasks = tasks.slice(0, filters.limit);
    }
    
    return tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Session Management
  async createSession(sessionId: string, config: any): Promise<void> {
    this.sessions.set(sessionId, {
      id: sessionId,
      config,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async getSession(sessionId: string): Promise<any | null> {
    return this.sessions.get(sessionId) || null;
  }

  async updateSession(sessionId: string, updates: any): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.config = { ...session.config, ...updates };
      session.updatedAt = new Date();
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async listSessions(): Promise<any[]> {
    return Array.from(this.sessions.values());
  }

  async recordTransparencyEvent(event: TransparencyEvent): Promise<void> {
    const stored: TransparencyEvent = {
      ...event,
      id: event.id ?? createIdentifier('tev'),
      eventTime: event.eventTime ?? new Date()
    };
    this.transparencyEvents.push(stored);
  }

  async getTransparencyEvents(options: { sessionId?: string; limit?: number } = {}): Promise<TransparencyEvent[]> {
    let events = [...this.transparencyEvents];
    if (options.sessionId) {
      events = events.filter(evt => evt.sessionId === options.sessionId);
    }
    events.sort((a, b) => (b.eventTime?.getTime() || 0) - (a.eventTime?.getTime() || 0));
    if (options.limit) {
      events = events.slice(0, options.limit);
    }
    return events;
  }

  async upsertKnowledgeEntry(entry: KnowledgeEntry): Promise<void> {
    const id = entry.id ?? createIdentifier('kb');
    const existingIndex = this.knowledgeEntries.findIndex(item => item.id === id);
    const now = new Date();
    const stored: KnowledgeEntry = {
      ...entry,
      id,
      createdAt: entry.createdAt ?? now,
      updatedAt: entry.updatedAt ?? now
    };

    if (existingIndex >= 0) {
      this.knowledgeEntries[existingIndex] = stored;
    } else {
      this.knowledgeEntries.push(stored);
    }
  }

  async getKnowledgeEntries(options: { sessionId?: string; source?: string; limit?: number } = {}): Promise<KnowledgeEntry[]> {
    let entries = [...this.knowledgeEntries];
    if (options.sessionId) {
      entries = entries.filter(entry => entry.sessionId === options.sessionId);
    }
    if (options.source) {
      entries = entries.filter(entry => entry.source === options.source);
    }
    entries.sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));
    if (options.limit) {
      entries = entries.slice(0, options.limit);
    }
    return entries;
  }
}

// Factory function for creating database instances
export function createDatabase(options?: {
  type?: 'sqlite' | 'mock';
  path?: string;
}): TaskQueue & SessionManager & TransparencyStore & KnowledgeStore {
  const { type = 'sqlite', path = './data/graphyn.db' } = options || {};
  
  if (type === 'mock' || process.env.NODE_ENV === 'test') {
    return new MockDatabaseManager();
  } else {
    return new SQLiteManager(path);
  }
}

export default createDatabase;

// Re-export mock SQLite manager types and classes
export { MockSQLiteManager } from './mock-sqlite-manager';
export type {
  Task as MockTask,
  TaskParams as MockTaskParams, 
  TaskMetrics as MockTaskMetrics,
  SystemStatus as MockSystemStatus
} from './mock-sqlite-manager';
