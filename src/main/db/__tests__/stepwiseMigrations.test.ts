import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { readFileSync } from 'fs'
import { runMigrationsFromDir, runEmbeddedMigrations } from '../connection'
import { v4 as uuidv4 } from 'uuid'

describe('Stepwise Database Migrations & Prior-Schema Compatibility', () => {
  let db: Database.Database
  const migrationsDir = join(process.cwd(), 'src/main/db/migrations')

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
  })

  afterEach(() => {
    db.close()
  })

  it('progressively migrates from schema 001 to 002 to 003 without data loss', () => {
    // 1. Apply Migration 001 only
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `)
    const sql001 = readFileSync(join(migrationsDir, '001_initial.sql'), 'utf-8')
    db.exec(sql001)
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      '001_initial',
      new Date().toISOString()
    )

    // Insert pre-migration data under schema 001
    const subjectId = uuidv4()
    db.prepare(`
      INSERT INTO subjects (id, name, code, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(subjectId, 'Algorithms & Complexity', 'CS301', '#4F46E5', new Date().toISOString(), new Date().toISOString())

    const taskId = uuidv4()
    db.prepare(`
      INSERT INTO tasks (id, subject_id, type, title, status, priority, is_archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(taskId, subjectId, 'assignment', 'Dynamic Programming Lab', 'todo', 'high', 0, new Date().toISOString(), new Date().toISOString())

    const docId = uuidv4()
    db.prepare(`
      INSERT INTO documents (id, display_name, relative_path, mime_type, size_bytes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(docId, 'ProblemSet.pdf', 'tasks/dp_lab.pdf', 'application/pdf', 1024, new Date().toISOString(), new Date().toISOString())

    const taskDocId = uuidv4()
    db.prepare(`
      INSERT INTO task_documents (id, task_id, document_id, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(taskDocId, taskId, docId, 'assignment', new Date().toISOString())

    // 2. Apply Migration 002 (Adds semester, notes, recreates subject_documents)
    const sql002 = readFileSync(join(migrationsDir, '002_subject_fields_and_categories.sql'), 'utf-8')
    db.exec(sql002)
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      '002_subject_fields_and_categories',
      new Date().toISOString()
    )

    // Verify subject retained its data and acquired semester and notes defaults
    const subjectRowAfter002 = db.prepare('SELECT * FROM subjects WHERE id = ?').get(subjectId) as any
    expect(subjectRowAfter002.name).toBe('Algorithms & Complexity')
    expect(subjectRowAfter002.semester).toBeNull()
    expect(subjectRowAfter002.notes).toBe('')

    // Update new fields
    db.prepare('UPDATE subjects SET semester = ?, notes = ? WHERE id = ?').run(
      'Fall 2026',
      'Prof. Alan Turing',
      subjectId
    )
    const subjectUpdated = db.prepare('SELECT * FROM subjects WHERE id = ?').get(subjectId) as any
    expect(subjectUpdated.semester).toBe('Fall 2026')
    expect(subjectUpdated.notes).toBe('Prof. Alan Turing')

    // 3. Apply Migration 003 (Expands task_documents role check and adds variant_label)
    const sql003 = readFileSync(join(migrationsDir, '003_task_attachment_roles.sql'), 'utf-8')
    db.exec(sql003)
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      '003_task_attachment_roles',
      new Date().toISOString()
    )

    // Verify task_documents data was preserved and 'assignment' was mapped to 'assignment_file'
    const taskDocAfter003 = db.prepare('SELECT * FROM task_documents WHERE id = ?').get(taskDocId) as any
    expect(taskDocAfter003).toBeDefined()
    expect(taskDocAfter003.role).toBe('assignment_file')
    expect(taskDocAfter003.variant_label).toBeNull()

    // Verify task_files view resolves correctly
    const viewRow = db.prepare('SELECT * FROM task_files WHERE id = ?').get(taskDocId) as any
    expect(viewRow.display_name).toBe('ProblemSet.pdf')
    expect(viewRow.role).toBe('assignment_file')

    // 4. Now run migration runner again to verify idempotency
    runMigrationsFromDir(db, migrationsDir)

    const migrations = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as any[]
    expect(migrations.map((m) => m.version)).toEqual([
      '001_initial',
      '002_subject_fields_and_categories',
      '003_task_attachment_roles'
    ])
  })

  it('initializes a fresh database cleanly using embedded migrations fallback', () => {
    runEmbeddedMigrations(db)

    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[]
    ).map((t) => t.name)

    expect(tables).toContain('schema_migrations')
    expect(tables).toContain('subjects')
    expect(tables).toContain('tasks')
    expect(tables).toContain('documents')
    expect(tables).toContain('task_documents')
    expect(tables).toContain('subject_documents')
    expect(tables).toContain('settings')

    // Verify views
    const views = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='view'").all() as any[]
    ).map((v) => v.name)

    expect(views).toContain('task_files')
    expect(views).toContain('subject_document_files')
  })
})
