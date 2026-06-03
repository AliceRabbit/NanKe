import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export function resolveDataDir(): string {
  return process.env.NANKE_DATA_DIR ?? path.join(process.cwd(), '.nanke');
}

export function resolveDatabasePath(): string {
  return process.env.NANKE_DB_PATH ?? path.join(resolveDataDir(), 'nanke.db');
}

let cached: { sqlite: Database.Database; db: ReturnType<typeof drizzle<typeof schema>> } | undefined;

export function getDatabaseHandle() {
  if (cached) return cached;
  fs.mkdirSync(resolveDataDir(), { recursive: true });
  const sqlite = new Database(resolveDatabasePath());
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  cached = { sqlite, db };
  initializeDatabase(sqlite);
  return cached;
}

export function getDatabase() {
  return getDatabaseHandle().db;
}

export function initializeDatabase(sqlite: Database.Database = getDatabaseHandle().sqlite): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      character_id TEXT,
      persona_id TEXT,
      profile_id TEXT,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
      ON messages (conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS world_books (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generation_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_personas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_reports (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  const conversationColumns = sqlite.prepare(`PRAGMA table_info(conversations)`).all() as Array<{ name: string }>;
  if (!conversationColumns.some((column) => column.name === 'persona_id')) {
    sqlite.exec(`ALTER TABLE conversations ADD COLUMN persona_id TEXT;`);
  }
}
