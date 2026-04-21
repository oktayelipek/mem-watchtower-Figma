import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  teamId: text('team_id').notNull(),
  syncedAt: integer('synced_at').notNull(), // unix ms
})

export const files = sqliteTable('files', {
  key: text('key').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  lastModified: text('last_modified').notNull(),
  syncedAt: integer('synced_at').notNull(),
  isLibrary: integer('is_library').notNull().default(0),
})

export const branches = sqliteTable('branches', {
  branchKey: text('branch_key').primaryKey(),
  parentFileKey: text('parent_file_key').notNull(),
  name: text('name').notNull(),
  estimatedRamMb: real('estimated_ram_mb'),
  fetchedAt: integer('fetched_at').notNull(),
})

export const fastMetrics = sqliteTable('fast_metrics', {
  fileKey: text('file_key').primaryKey(),
  pageCount: integer('page_count').notNull(),
  frameCount: integer('frame_count').notNull(),
  componentCount: integer('component_count').notNull(),
  complexityScore: integer('complexity_score').notNull(),
  fetchedAt: integer('fetched_at').notNull(),
})

export const deepMetrics = sqliteTable('deep_metrics', {
  fileKey: text('file_key').primaryKey(),
  jsonSizeMb: real('json_size_mb').notNull(),
  nodeCount: integer('node_count').notNull(),
  estimatedRamMb: real('estimated_ram_mb').notNull(),
  fetchedAt: integer('fetched_at').notNull(),
})

export const oauthTokens = sqliteTable('oauth_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: integer('expires_at').notNull(), // unix ms
  updatedAt: integer('updated_at').notNull(),
})

export const syncLog = sqliteTable('sync_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at'),
  filesSynced: integer('files_synced').default(0),
  status: text('status').default('running'), // 'running' | 'done' | 'error'
  error: text('error'),
})
