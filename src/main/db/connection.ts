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

export const EMBEDDED_MIGRATIONS: Array<{ version: string; sql: string }> = [
  {
    version: '001_initial',
    sql: `
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subjects (
    id         TEXT PRIMARY KEY CHECK(length(id) = 36),
    name       TEXT NOT NULL CHECK(trim(name) != ''),
    code       TEXT,
    color      TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS tasks (
    id          TEXT PRIMARY KEY CHECK(length(id) = 36),
    subject_id  TEXT REFERENCES subjects(id) ON DELETE SET NULL,
    type        TEXT NOT NULL CHECK(type IN (
                    'general', 'assignment', 'lab_manual', 'practical',
                    'project', 'exam_prep', 'other'
                )),
    title       TEXT NOT NULL CHECK(trim(title) != ''),
    description TEXT NOT NULL DEFAULT '',
    due_date    TEXT CHECK(
                    due_date IS NULL OR
                    (due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
                ),
    priority    TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
    status      TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'completed')),
    is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0, 1)),
    archived_at TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_subject_id  ON tasks(subject_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date    ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_is_archived ON tasks(is_archived);
CREATE INDEX IF NOT EXISTS idx_tasks_priority    ON tasks(priority);

CREATE TABLE IF NOT EXISTS documents (
    id            TEXT PRIMARY KEY CHECK(length(id) = 36),
    display_name  TEXT NOT NULL CHECK(trim(display_name) != ''),
    relative_path TEXT NOT NULL UNIQUE CHECK(trim(relative_path) != ''),
    mime_type     TEXT NOT NULL DEFAULT 'application/pdf',
    size_bytes    INTEGER,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_relative_path ON documents(relative_path);

CREATE TABLE IF NOT EXISTS task_documents (
    id            TEXT PRIMARY KEY CHECK(length(id) = 36),
    task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    document_id   TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    role          TEXT NOT NULL CHECK(role IN ('assignment', 'solution')),
    variant_label TEXT,
    created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_documents_task_id     ON task_documents(task_id);
CREATE INDEX IF NOT EXISTS idx_task_documents_document_id ON task_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_task_documents_role        ON task_documents(role);

CREATE TABLE IF NOT EXISTS subject_documents (
    id          TEXT PRIMARY KEY CHECK(length(id) = 36),
    subject_id  TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK(type IN (
                    'syllabus', 'marks_scheme', 'notice', 'timetable', 'other'
                )),
    title       TEXT NOT NULL CHECK(trim(title) != ''),
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subject_docs_subject_id  ON subject_documents(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_docs_document_id ON subject_documents(document_id);

CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY CHECK(trim(key) != ''),
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO settings(key, value, updated_at)
    VALUES ('theme', 'system', datetime('now'));
INSERT OR IGNORE INTO settings(key, value, updated_at)
    VALUES ('backup_schedule', 'daily', datetime('now'));
INSERT OR IGNORE INTO settings(key, value, updated_at)
    VALUES ('backup_retain', '30', datetime('now'));

CREATE VIEW IF NOT EXISTS task_files AS
SELECT
    td.id AS id,
    td.task_id AS task_id,
    td.role AS role,
    d.display_name AS display_name,
    d.relative_path AS relative_path,
    td.variant_label AS variant_label,
    d.mime_type AS mime_type,
    d.size_bytes AS size_bytes,
    td.created_at AS added_at
FROM task_documents td
JOIN documents d ON td.document_id = d.id;

CREATE VIEW IF NOT EXISTS subject_document_files AS
SELECT
    sd.id AS id,
    sd.id AS subject_document_id,
    d.display_name AS display_name,
    d.relative_path AS relative_path,
    d.mime_type AS mime_type,
    d.size_bytes AS size_bytes,
    sd.created_at AS added_at
FROM subject_documents sd
JOIN documents d ON sd.document_id = d.id
WHERE sd.document_id IS NOT NULL;
`
  },
  {
    version: '002_subject_fields_and_categories',
    sql: `
ALTER TABLE subjects ADD COLUMN semester TEXT;
ALTER TABLE subjects ADD COLUMN notes TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS subject_documents_new (
    id          TEXT PRIMARY KEY CHECK(length(id) = 36),
    subject_id  TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK(type IN (
                    'syllabus', 'marks', 'marks_scheme', 'notice',
                    'reference', 'timetable', 'notes', 'other'
                )),
    title       TEXT NOT NULL CHECK(trim(title) != ''),
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

INSERT INTO subject_documents_new (id, subject_id, document_id, type, title, description, created_at, updated_at)
SELECT id, subject_id, document_id, type, title, description, created_at, updated_at
FROM subject_documents;

DROP VIEW IF EXISTS subject_document_files;
DROP TABLE subject_documents;
ALTER TABLE subject_documents_new RENAME TO subject_documents;

CREATE INDEX IF NOT EXISTS idx_subject_docs_subject_id  ON subject_documents(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_docs_document_id ON subject_documents(document_id);

DROP VIEW IF EXISTS subject_document_files;
CREATE VIEW IF NOT EXISTS subject_document_files AS
SELECT
    sd.id AS id,
    sd.id AS subject_document_id,
    d.display_name AS display_name,
    d.relative_path AS relative_path,
    d.mime_type AS mime_type,
    d.size_bytes AS size_bytes,
    sd.created_at AS added_at
FROM subject_documents sd
JOIN documents d ON sd.document_id = d.id
WHERE sd.document_id IS NOT NULL;
`
  },
  {
    version: '003_task_attachment_roles',
    sql: `
CREATE TABLE IF NOT EXISTS task_documents_new (
    id            TEXT PRIMARY KEY CHECK(length(id) = 36),
    task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    document_id   TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    role          TEXT NOT NULL CHECK(role IN ('assignment_file', 'solution', 'reference', 'other', 'assignment')),
    variant_label TEXT,
    created_at    TEXT NOT NULL
);

INSERT INTO task_documents_new (id, task_id, document_id, role, variant_label, created_at)
SELECT
    id,
    task_id,
    document_id,
    CASE WHEN role = 'assignment' THEN 'assignment_file' ELSE role END,
    variant_label,
    created_at
FROM task_documents;

DROP VIEW IF EXISTS task_files;
DROP TABLE task_documents;
ALTER TABLE task_documents_new RENAME TO task_documents;

CREATE INDEX IF NOT EXISTS idx_task_documents_task_id     ON task_documents(task_id);
CREATE INDEX IF NOT EXISTS idx_task_documents_document_id ON task_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_task_documents_role        ON task_documents(role);

CREATE VIEW IF NOT EXISTS task_files AS
SELECT
    td.id AS id,
    td.task_id AS task_id,
    td.role AS role,
    d.display_name AS display_name,
    d.relative_path AS relative_path,
    td.variant_label AS variant_label,
    d.mime_type AS mime_type,
    d.size_bytes AS size_bytes,
    td.created_at AS added_at
FROM task_documents td
JOIN documents d ON td.document_id = d.id;
`
  },

  {
    version: '004_calendar_reminders_work_sessions',
    sql: `
CREATE TABLE IF NOT EXISTS calendar_events (
    id          TEXT PRIMARY KEY CHECK(length(id) = 36),
    task_id     TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    title       TEXT NOT NULL CHECK(trim(title) != ''),
    description TEXT NOT NULL DEFAULT '',
    start_at    TEXT NOT NULL,
    end_at      TEXT NOT NULL,
    all_day     INTEGER NOT NULL DEFAULT 0 CHECK(all_day IN (0, 1)),
    location    TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_task_id
    ON calendar_events(task_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_start_at
    ON calendar_events(start_at);

CREATE INDEX IF NOT EXISTS idx_calendar_events_end_at
    ON calendar_events(end_at);

CREATE TABLE IF NOT EXISTS task_reminders (
    id           TEXT PRIMARY KEY CHECK(length(id) = 36),
    task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    remind_at    TEXT NOT NULL,
    dismissed_at TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_reminders_task_id
    ON task_reminders(task_id);

CREATE INDEX IF NOT EXISTS idx_task_reminders_remind_at
    ON task_reminders(remind_at);

CREATE INDEX IF NOT EXISTS idx_task_reminders_dismissed_at
    ON task_reminders(dismissed_at);

CREATE TABLE IF NOT EXISTS work_sessions (
    id         TEXT PRIMARY KEY CHECK(length(id) = 36),
    task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title      TEXT NOT NULL CHECK(trim(title) != ''),
    note       TEXT NOT NULL DEFAULT '',
    start_at   TEXT NOT NULL,
    end_at     TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'planned'
               CHECK(status IN ('planned', 'completed', 'cancelled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_sessions_task_id
    ON work_sessions(task_id);

CREATE INDEX IF NOT EXISTS idx_work_sessions_start_at
    ON work_sessions(start_at);

CREATE INDEX IF NOT EXISTS idx_work_sessions_end_at
    ON work_sessions(end_at);

CREATE INDEX IF NOT EXISTS idx_work_sessions_status
    ON work_sessions(status);
`
  }

]

function resolveMigrationsDir(): string | null {
  const candidates = [
    join(__dirname, 'migrations'),
    join(__dirname, 'db', 'migrations'),
    join(__dirname, '..', '..', 'src', 'main', 'db', 'migrations'),
    join(process.cwd(), 'src', 'main', 'db', 'migrations'),
    join(process.cwd(), 'out', 'main', 'migrations'),
    process.resourcesPath ? join(process.resourcesPath, 'migrations') : ''
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        const files = readdirSync(candidate).filter((f) => f.endsWith('.sql'))
        if (files.length > 0) {
          return candidate
        }
      } catch {}
    }
  }

  return null
}

function runMigrations(db: Database.Database): void {
  const dir = resolveMigrationsDir()
  if (dir) {
    runMigrationsFromDir(db, dir)
  } else {
    runEmbeddedMigrations(db)
  }
}

/**
 * Fallback migration runner using compiled embedded migration scripts.
 * Guarantees that packaged apps and unusual launch environments never fail.
 */
export function runEmbeddedMigrations(db: Database.Database): void {
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

  const insertMigration = db.prepare(
    'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)'
  )

  for (const mig of EMBEDDED_MIGRATIONS) {
    if (applied.has(mig.version)) continue
    db.transaction(() => {
      db.exec(mig.sql)
      insertMigration.run(mig.version, new Date().toISOString())
    })()
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
