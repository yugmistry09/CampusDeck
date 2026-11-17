import Database from 'better-sqlite3'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { createTaskReminderRepo } from '../repositories/taskReminders'

describe('taskReminders repository', () => {
  let db: Database.Database
  let repo: ReturnType<typeof createTaskReminderRepo>

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')

    db.exec(`
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL
      );

      CREATE TABLE task_reminders (
        id TEXT PRIMARY KEY CHECK(length(id) = 36),
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        remind_at TEXT NOT NULL,
        dismissed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_task_reminders_task_id
        ON task_reminders(task_id);

      CREATE INDEX idx_task_reminders_remind_at
        ON task_reminders(remind_at);

      CREATE INDEX idx_task_reminders_dismissed_at
        ON task_reminders(dismissed_at);
    `)

    db.prepare(`INSERT INTO tasks(id, title) VALUES (?, ?)`)
      .run('task-001', 'Test Task')

    repo = createTaskReminderRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  it('creates and retrieves a reminder', () => {
    const created = repo.create({
      task_id: 'task-001',
      remind_at: '2026-11-18T09:00:00.000Z'
    })

    expect(created.id).toHaveLength(36)
    expect(created.task_id).toBe('task-001')
    expect(created.remind_at).toBe('2026-11-18T09:00:00.000Z')
    expect(created.dismissed_at).toBeNull()

    expect(repo.getById(created.id)).toEqual(created)
  })

  it('lists reminders by task in reminder order', () => {
    repo.create({
      task_id: 'task-001',
      remind_at: '2026-11-18T12:00:00.000Z'
    })

    const earlier = repo.create({
      task_id: 'task-001',
      remind_at: '2026-11-18T09:00:00.000Z'
    })

    expect(repo.listByTask('task-001').map(reminder => reminder.id))
      .toEqual([earlier.id, expect.any(String)])
  })

  it('returns only due pending reminders', () => {
    const due = repo.create({
      task_id: 'task-001',
      remind_at: '2000-01-01T00:00:00.000Z'
    })

    const future = repo.create({
      task_id: 'task-001',
      remind_at: '2999-01-01T00:00:00.000Z'
    })

    const pending = repo.listPending()

    expect(pending.map(reminder => reminder.id)).toContain(due.id)
    expect(pending.map(reminder => reminder.id)).not.toContain(future.id)
  })

  it('dismisses a reminder', () => {
    const created = repo.create({
      task_id: 'task-001',
      remind_at: '2000-01-01T00:00:00.000Z'
    })

    const dismissed = repo.dismiss(created.id)

    expect(dismissed?.dismissed_at).not.toBeNull()
    expect(repo.listPending().map(reminder => reminder.id))
      .not.toContain(created.id)
  })

  it('updates reminder time and dismissal state', () => {
    const created = repo.create({
      task_id: 'task-001',
      remind_at: '2026-11-18T09:00:00.000Z'
    })

    const updated = repo.update({
      id: created.id,
      remind_at: '2026-11-18T10:00:00.000Z',
      dismissed_at: null
    })

    expect(updated?.remind_at).toBe('2026-11-18T10:00:00.000Z')
    expect(updated?.dismissed_at).toBeNull()
  })

  it('deletes a reminder', () => {
    const created = repo.create({
      task_id: 'task-001',
      remind_at: '2026-11-18T09:00:00.000Z'
    })

    expect(repo.delete(created.id)).toBe(true)
    expect(repo.getById(created.id)).toBeNull()
    expect(repo.delete(created.id)).toBe(false)
  })

  it('cascades when the linked task is deleted', () => {
    const created = repo.create({
      task_id: 'task-001',
      remind_at: '2026-11-18T09:00:00.000Z'
    })

    db.prepare(`DELETE FROM tasks WHERE id = ?`).run('task-001')

    expect(repo.getById(created.id)).toBeNull()
  })
})
