import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { runMigrationsFromDir } from '../connection'

describe('Database Migrations', () => {
  let db: Database.Database
  const migrationsDir = join(process.cwd(), 'src/main/db/migrations')

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
  })

  afterEach(() => {
    db.close()
  })

  it('runs all versioned migrations and creates all required tables and views', () => {
    runMigrationsFromDir(db, migrationsDir)

    // Verify schema_migrations table exists and has 001, 002, and 003
    const migrations = db
      .prepare('SELECT version FROM schema_migrations')
      .all() as { version: string }[]
    expect(migrations.length).toBe(3)
    expect(migrations.some((m) => m.version === '001_initial')).toBe(true)
    expect(migrations.some((m) => m.version === '002_subject_fields_and_categories')).toBe(true)
    expect(migrations.some((m) => m.version === '003_task_attachment_roles')).toBe(true)

    // Verify all 6 required core tables exist
    const tables = (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
        .all() as { name: string }[]
    ).map((t) => t.name)

    expect(tables).toContain('schema_migrations')
    expect(tables).toContain('subjects')
    expect(tables).toContain('tasks')
    expect(tables).toContain('documents')
    expect(tables).toContain('task_documents')
    expect(tables).toContain('subject_documents')
    expect(tables).toContain('settings')

    // Verify views exist
    const views = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='view'")
        .all() as { name: string }[]
    ).map((v) => v.name)

    expect(views).toContain('task_files')
    expect(views).toContain('subject_document_files')
  })

  it('creates required indexes for performance and integrity', () => {
    runMigrationsFromDir(db, migrationsDir)

    const indexes = (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
        )
        .all() as { name: string }[]
    ).map((i) => i.name)

    expect(indexes).toContain('idx_subjects_name')
    expect(indexes).toContain('idx_tasks_subject_id')
    expect(indexes).toContain('idx_tasks_status')
    expect(indexes).toContain('idx_tasks_due_date')
    expect(indexes).toContain('idx_tasks_priority')
    expect(indexes).toContain('idx_tasks_is_archived')
    expect(indexes).toContain('idx_documents_relative_path')
    expect(indexes).toContain('idx_task_documents_task_id')
    expect(indexes).toContain('idx_task_documents_document_id')
    expect(indexes).toContain('idx_subject_docs_subject_id')
  })

  it('is idempotent when run multiple times', () => {
    runMigrationsFromDir(db, migrationsDir)
    expect(() => runMigrationsFromDir(db, migrationsDir)).not.toThrow()

    const count = (
      db.prepare('SELECT COUNT(*) as count FROM schema_migrations').get() as {
        count: number
      }
    ).count
    expect(count).toBe(3)
  })

  it('seeds default settings on initial run', () => {
    runMigrationsFromDir(db, migrationsDir)

    const settingsRows = db.prepare('SELECT key, value FROM settings').all() as {
      key: string
      value: string
    }[]
    const settingsMap = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]))

    expect(settingsMap['theme']).toBe('system')
    expect(settingsMap['backup_schedule']).toBe('daily')
    expect(settingsMap['backup_retain']).toBe('30')
  })
})
