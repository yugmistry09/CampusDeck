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

  it('progressively migrates from schema 001 to 002 to 003 to 004 without data loss', () => {
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

    // 4. Apply Migration 004 (adds calendar events, task reminders, and work sessions)
    const sql004 = readFileSync(
      join(migrationsDir, '004_calendar_reminders_work_sessions.sql'),
      'utf-8'
    )
    db.exec(sql004)
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      '004_calendar_reminders_work_sessions',
      new Date().toISOString()
    )

    // Verify the new scheduling tables exist
    const newTables = (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('calendar_events', 'task_reminders', 'work_sessions')"
        )
        .all() as { name: string }[]
    ).map((t) => t.name)

    expect(newTables).toContain('calendar_events')
    expect(newTables).toContain('task_reminders')
    expect(newTables).toContain('work_sessions')

    // Verify task-linked records can be created
    const calendarEventId = uuidv4()
    db.prepare(`
      INSERT INTO calendar_events (
        id, task_id, title, description, start_at, end_at,
        all_day, location, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      calendarEventId,
      taskId,
      'Dynamic Programming Study Session',
      'Review recurrence relations',
      '2026-11-18T18:00:00.000Z',
      '2026-11-18T19:00:00.000Z',
      0,
      'Library',
      new Date().toISOString(),
      new Date().toISOString()
    )

    const reminderId = uuidv4()
    db.prepare(`
      INSERT INTO task_reminders (
        id, task_id, remind_at, dismissed_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      reminderId,
      taskId,
      '2026-11-18T17:45:00.000Z',
      null,
      new Date().toISOString(),
      new Date().toISOString()
    )

    const workSessionId = uuidv4()
    db.prepare(`
      INSERT INTO work_sessions (
        id, task_id, title, note, start_at, end_at,
        status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      workSessionId,
      taskId,
      'Dynamic Programming Study',
      'Finish recurrence relations notes',
      '2026-11-18T18:00:00.000Z',
      '2026-11-18T19:00:00.000Z',
      'planned',
      new Date().toISOString(),
      new Date().toISOString()
    )

    const eventRow = db.prepare(
      'SELECT task_id, title, all_day FROM calendar_events WHERE id = ?'
    ).get(calendarEventId) as any
    expect(eventRow.task_id).toBe(taskId)
    expect(eventRow.title).toBe('Dynamic Programming Study Session')
    expect(eventRow.all_day).toBe(0)

    const reminderRow = db.prepare(
      'SELECT task_id, dismissed_at FROM task_reminders WHERE id = ?'
    ).get(reminderId) as any
    expect(reminderRow.task_id).toBe(taskId)
    expect(reminderRow.dismissed_at).toBeNull()

    const sessionRow = db.prepare(
      'SELECT task_id, status FROM work_sessions WHERE id = ?'
    ).get(workSessionId) as any
    expect(sessionRow.task_id).toBe(taskId)
    expect(sessionRow.status).toBe('planned')

    // 5. Now run migration runner again to verify idempotency
    runMigrationsFromDir(db, migrationsDir)

    const migrations = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as any[]
    expect(migrations.map((m) => m.version)).toEqual([
      '001_initial',
      '002_subject_fields_and_categories',
      '003_task_attachment_roles',
      '004_calendar_reminders_work_sessions'
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
    expect(tables).toContain('calendar_events')
    expect(tables).toContain('task_reminders')
    expect(tables).toContain('work_sessions')

    // Verify views
    const views = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='view'").all() as any[]
    ).map((v) => v.name)

    expect(views).toContain('task_files')
    expect(views).toContain('subject_document_files')
  })
})
