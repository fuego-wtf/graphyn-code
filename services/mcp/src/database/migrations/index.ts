import { promises as fs } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

interface Migration {
  version: string;
  filepath: string;
}

const MIGRATIONS_DIR = new URL('./', import.meta.url).pathname;

export async function runMigrations(db: Database.Database): Promise<void> {
  await ensureMigrationsTable(db);

  const applied = new Set<string>(
    db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all().map((row: any) => row.version)
  );

  const migrations = await loadMigrations();
  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }

    const sql = await fs.readFile(migration.filepath, 'utf-8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, CURRENT_TIMESTAMP)').run(migration.version);
      db.exec('COMMIT');
      console.log(`⬆️  Applied migration ${migration.version}`);
    } catch (error) {
      db.exec('ROLLBACK');
      console.error(`❌ Failed to apply migration ${migration.version}:`, error);
      throw error;
    }
  }
}

async function ensureMigrationsTable(db: Database.Database): Promise<void> {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function loadMigrations(): Promise<Migration[]> {
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });
  const migrations = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => ({
      version: entry.name.split('.sql')[0],
      filepath: path.join(MIGRATIONS_DIR, entry.name)
    }))
    .sort((a, b) => a.version.localeCompare(b.version));

  return migrations;
}
