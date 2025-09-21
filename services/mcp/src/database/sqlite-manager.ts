/**
 * SQLite Manager - High-performance SQLite database with WAL2 support
 * 
 * Manages SQLite database connections for task coordination, agent tracking,
 * and transparency logging with optimal performance settings
 */

import Database from 'better-sqlite3';
import { promises as fs } from 'fs';
import path from 'path';
import { runMigrations } from './migrations/index.js';

export interface SQLiteConfig {
  path: string;
  enableWAL2: boolean;
  maxConnections: number;
  timeout: number;
  busyTimeout: number;
}

export class SQLiteManager {
  private db!: Database.Database;
  private config: SQLiteConfig;
  private isInitialized = false;

  constructor(config: Partial<SQLiteConfig>) {
    this.config = {
      path: config.path || './data/graphyn-tasks.db',
      enableWAL2: config.enableWAL2 ?? true,
      maxConnections: config.maxConnections || 10,
      timeout: config.timeout || 30000,
      busyTimeout: config.busyTimeout || 10000
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Ensure data directory exists
    const dbDir = path.dirname(this.config.path);
    await fs.mkdir(dbDir, { recursive: true });

    // Open database connection
    this.db = new Database(this.config.path, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
      timeout: this.config.timeout,
      fileMustExist: false
    });

    // Configure database for performance
    await this.configurePragmas();

    await runMigrations(this.db);

    this.isInitialized = true;
    console.log(`📁 SQLite database initialized: ${this.config.path}`);
  }

  private async configurePragmas(): Promise<void> {
    const pragmas = [
      // Enable WAL2 mode for better concurrency
      `PRAGMA journal_mode = ${this.config.enableWAL2 ? 'WAL2' : 'WAL'}`,
      
      // Synchronous mode for balance of safety and performance
      'PRAGMA synchronous = NORMAL',
      
      // Busy timeout
      `PRAGMA busy_timeout = ${this.config.busyTimeout}`,
      
      // Cache settings
      'PRAGMA cache_size = -64000', // 64MB cache
      'PRAGMA temp_store = MEMORY',
      
      // Optimize for modern hardware
      'PRAGMA mmap_size = 268435456', // 256MB mmap
      'PRAGMA optimize',
      
      // Enable foreign key constraints
      'PRAGMA foreign_keys = ON'
    ];

    for (const pragma of pragmas) {
      try {
        this.db.exec(pragma);
      } catch (error) {
        // WAL2 might not be available, fallback to WAL
        if (pragma.includes('WAL2')) {
          this.db.exec('PRAGMA journal_mode = WAL');
          console.warn('⚠️  WAL2 not available, using WAL mode');
        } else {
          console.warn(`⚠️  Failed to set pragma: ${pragma}`, error);
        }
      }
    }
  }

  /**
   * Execute a prepared statement
   */
  prepare(sql: string): Database.Statement {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }
    return this.db.prepare(sql);
  }

  /**
   * Execute a SQL statement
   */
  exec(sql: string): void {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }
    this.db.exec(sql);
  }

  /**
   * Begin a transaction
   */
  transaction<T>(fn: () => T): T {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }
    return this.db.transaction(fn)();
  }

  /**
   * Get database connection for direct access
   */
  getConnection(): Database.Database {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Get database status and metrics
   */
  async getStatus(): Promise<any> {
    if (!this.isInitialized) {
      return { status: 'not_initialized' };
    }

    const info = this.db.pragma('database_list');
    const stats = this.db.pragma('table_list');
    const walInfo = this.db.pragma('journal_mode');

    // Get table row counts
    const tableCounts: Record<string, number> = {};
    const tables = ['tasks', 'agents', 'transparency_events', 'sessions', 'task_dependencies'];
    
    for (const table of tables) {
      try {
        const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
        tableCounts[table] = result.count;
      } catch (error) {
        tableCounts[table] = -1; // Table doesn't exist or error
      }
    }

    return {
      status: 'initialized',
      path: this.config.path,
      journalMode: walInfo,
      config: this.config,
      tables: tableCounts,
      info,
      stats
    };
  }

  /**
   * Optimize database performance
   */
  async optimize(): Promise<void> {
    if (!this.isInitialized) return;

    this.db.exec('PRAGMA optimize');
    this.db.exec('VACUUM');
    
    console.log('🔧 Database optimized');
  }

  /**
   * Backup database to specified path
   */
  async backup(backupPath: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const backupDir = path.dirname(backupPath);
    await fs.mkdir(backupDir, { recursive: true });

    this.db.backup(backupPath);
    console.log(`💾 Database backed up to: ${backupPath}`);
  }

  /**
   * Close database connection
   */
  async cleanup(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Final optimize before closing
      this.db.exec('PRAGMA optimize');
      
      // Close connection
      this.db.close();
      
      this.isInitialized = false;
      console.log('🔒 SQLite database connection closed');
    } catch (error) {
      console.error('❌ Error closing database:', error);
    }
  }

  /**
   * Check if database is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }
}
