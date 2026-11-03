import Database from 'better-sqlite3'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'

// ---------------------------------------------------------------------------
// Module-level singleton — one DB connection for the entire main process.
// better-sqlite3 is synchronous and not thread-safe; Electron's main process
// is single-threaded, so a singleton is safe and correct.
// ---------------------------------------------------------------------------
let _db: Database.Database | null = null

/**
 * Returns the open database connection. Opens and migrates on first call.
 * @param dbPath Absolute path to the SQLite file (from getAppPaths().dbPath)
 */
export function openDatabase(dbPath: string): Database.Database {
  if (_db) return _db

  // Ensure the parent directory exists (userData may not exist yet on first launch)
  mkdirSync(dirname(dbPath), { recursive: true })

  const db = new Database(dbPath)

  // ---------------------------------------------------------------------------
  // Connection-level PRAGMAs
  // ---------------------------------------------------------------------------
  // WAL mode: readers don't block writers; superior for desktop apps.
  db.pragma('journal_mode = WAL')
  // Enforce FK constraints on every connection (SQLite default is OFF).
  db.pragma('foreign_keys = ON')
  // Use synchronous=NORMAL for good durability without the full-sync overhead.
  db.pragma('synchronous = NORMAL')
  // Increase cache to 16 MB for snappier queries on large datasets.
  db.pragma('cache_size = -16000')
  // Store temp tables in memory.
  db.pragma('temp_store = MEMORY')

  // Run all pending migrations
  runMigrations(db)

  _db = db
  return db
}

/**
 * Returns the already-open database. Throws if openDatabase() was not called.
 * Use this in IPC handlers after app.whenReady().
 */
export function getDatabase(): Database.Database {
  if (!_db) throw new Error('Database not initialised. Call openDatabase() first.')
  return _db
}

/**
 * Closes the connection. Call on app quit.
 */
export function closeDatabase(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}

// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------
// Migrations live in src/main/db/migrations/ as numbered SQL files.
// ---------------------------------------------------------------------------

function resolveMigrationsDir(): string {
  const candidates = [
    join(__dirname, 'migrations'),
    join(__dirname, 'db', 'migrations'),
    join(process.cwd(), 'src', 'main', 'db', 'migrations')
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return candidates[0]!
}

function runMigrations(db: Database.Database): void {
  const dir = resolveMigrationsDir()
  if (existsSync(dir)) {
    runMigrationsFromDir(db, dir)
  }
}

/**
 * Run migrations from an explicit directory. Used by tests that open an
 * in-memory database and need to point to the source migrations folder.
 */
export function runMigrationsFromDir(db: Database.Database, dir: string): void {
  // Bootstrap the schema_migrations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)

  const applied = new Set<string>(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: string }[]).map(
      (r) => r.version
    )
  )

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const insertMigration = db.prepare(
    'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)'
  )

  for (const file of files) {
    const version = file.replace('.sql', '')
    if (applied.has(version)) continue
    const sql = readFileSync(join(dir, file), 'utf-8')
    db.transaction(() => {
      db.exec(sql)
      insertMigration.run(version, new Date().toISOString())
    })()
  }
}
