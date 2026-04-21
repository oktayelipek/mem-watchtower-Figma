import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import fs from 'fs'
import * as schema from './schema.js'

const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'watchtower.db')

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

const migrationsFolder = path.join(path.dirname(new URL(import.meta.url).pathname), 'migrations')

export function runMigrations() {
  migrate(db, { migrationsFolder })

  // Idempotent patches — guard against migration runner skipping ALTER TABLE on existing DBs
  try { sqlite.exec('ALTER TABLE files ADD COLUMN is_library INTEGER NOT NULL DEFAULT 0') } catch { /* already exists */ }
  try {
    sqlite.exec(`CREATE TABLE IF NOT EXISTS branches (
      branch_key TEXT PRIMARY KEY NOT NULL,
      parent_file_key TEXT NOT NULL,
      name TEXT NOT NULL,
      estimated_ram_mb REAL,
      last_modified TEXT,
      fetched_at INTEGER NOT NULL
    )`)
  } catch { /* already exists */ }
  try { sqlite.exec('ALTER TABLE branches ADD COLUMN last_modified TEXT') } catch { /* already exists */ }

  console.log('DB migrations applied.')
}
