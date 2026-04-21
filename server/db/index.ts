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
  console.log('DB migrations applied.')
}
