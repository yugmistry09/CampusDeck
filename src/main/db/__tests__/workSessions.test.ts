import Database from 'better-sqlite3'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { createWorkSessionRepo } from '../repositories/workSessions'

describe('workSessions repository', () => {
  let db: Database.Database
  let repo: ReturnType<typeof createWorkSessionRepo>

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')

    db.exec(`
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL
      );

      CREATE TABLE work_sessions (
        id TEXT PRIMARY KEY CHECK(length(id) = 36),
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        title TEXT NOT NULL CHECK(trim(title) != ''),
        note TEXT NOT NULL DEFAULT '',
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'planned'
          CHECK(status IN ('planned', 'completed', 'cancelled')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_work_sessions_task_id
        ON work_sessions(task_id);

      CREATE INDEX idx_work_sessions_start_at
        ON work_sessions(start_at);

      CREATE INDEX idx_work_sessions_end_at
        ON work_sessions(end_at);

      CREATE INDEX idx_work_sessions_status
        ON work_sessions(status);
    `)

    db.prepare(`INSERT INTO tasks(id, title) VALUES (?, ?)`)
      .run('task-001', 'Test Task')

    repo = createWorkSessionRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  it('creates and retrieves a work session', () => {
    const created = repo.create({
      task_id: 'task-001',
      title: 'Statistics Practice',
      note: 'Do hypothesis testing questions',
      start_at: '2026-11-18T10:00:00.000Z',
      end_at: '2026-11-18T11:00:00.000Z'
    })

    expect(created.id).toHaveLength(36)
    expect(created.task_id).toBe('task-001')
    expect(created.title).toBe('Statistics Practice')
    expect(created.status).toBe('planned')

    expect(repo.getById(created.id)).toEqual(created)
  })

  it('lists sessions by task in start order', () => {
    repo.create({
      task_id: 'task-001',
      title: 'Later',
      start_at: '2026-11-18T12:00:00.000Z',
      end_at: '2026-11-18T13:00:00.000Z'
    })

    const earlier = repo.create({
      task_id: 'task-001',
      title: 'Earlier',
      start_at: '2026-11-18T09:00:00.000Z',
      end_at: '2026-11-18T10:00:00.000Z'
    })

    expect(repo.listByTask('task-001').map(session => session.id))
      .toEqual([earlier.id, expect.any(String)])
  })

  it('lists sessions overlapping a time range', () => {
    repo.create({
      task_id: 'task-001',
      title: 'Before',
      start_at: '2026-11-18T08:00:00.000Z',
      end_at: '2026-11-18T09:00:00.000Z'
    })

    const overlapping = repo.create({
      task_id: 'task-001',
      title: 'Overlapping',
      start_at: '2026-11-18T09:30:00.000Z',
      end_at: '2026-11-18T10:30:00.000Z'
    })

    repo.create({
      task_id: 'task-001',
      title: 'After',
      start_at: '2026-11-18T12:00:00.000Z',
      end_at: '2026-11-18T13:00:00.000Z'
    })

    expect(
      repo.listBetween(
        '2026-11-18T10:00:00.000Z',
        '2026-11-18T11:00:00.000Z'
      ).map(session => session.id)
    ).toEqual([overlapping.id])
  })

  it('updates a work session', () => {
    const created = repo.create({
      task_id: 'task-001',
      title: 'Original',
      start_at: '2026-11-18T10:00:00.000Z',
      end_at: '2026-11-18T11:00:00.000Z'
    })

    const updated = repo.update({
      id: created.id,
      title: 'Updated',
      note: 'Finished',
      status: 'completed'
    })

    expect(updated?.title).toBe('Updated')
    expect(updated?.note).toBe('Finished')
    expect(updated?.status).toBe('completed')
  })

  it('deletes a work session', () => {
    const created = repo.create({
      task_id: 'task-001',
      title: 'Delete Me',
      start_at: '2026-11-18T10:00:00.000Z',
      end_at: '2026-11-18T11:00:00.000Z'
    })

    expect(repo.delete(created.id)).toBe(true)
    expect(repo.getById(created.id)).toBeNull()
    expect(repo.delete(created.id)).toBe(false)
  })

  it('cascades when the linked task is deleted', () => {
    const created = repo.create({
      task_id: 'task-001',
      title: 'Linked Session',
      start_at: '2026-11-18T10:00:00.000Z',
      end_at: '2026-11-18T11:00:00.000Z'
    })

    db.prepare(`DELETE FROM tasks WHERE id = ?`).run('task-001')

    expect(repo.getById(created.id)).toBeNull()
  })
})
