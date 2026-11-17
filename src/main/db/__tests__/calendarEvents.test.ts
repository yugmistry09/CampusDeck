import Database from 'better-sqlite3'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { createCalendarEventRepo } from '../repositories/calendarEvents'

describe('calendarEvents repository', () => {
  let db: Database.Database
  let repo: ReturnType<typeof createCalendarEventRepo>

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')

    db.exec(`
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL
      );

      CREATE TABLE calendar_events (
        id TEXT PRIMARY KEY CHECK(length(id) = 36),
        task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        title TEXT NOT NULL CHECK(trim(title) != ''),
        description TEXT NOT NULL DEFAULT '',
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        all_day INTEGER NOT NULL DEFAULT 0 CHECK(all_day IN (0, 1)),
        location TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_calendar_events_task_id
        ON calendar_events(task_id);

      CREATE INDEX idx_calendar_events_start_at
        ON calendar_events(start_at);

      CREATE INDEX idx_calendar_events_end_at
        ON calendar_events(end_at);
    `)

    db.prepare(`INSERT INTO tasks(id, title) VALUES (?, ?)`)
      .run('task-001', 'Test Task')

    repo = createCalendarEventRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  it('creates and retrieves an event', () => {
    const created = repo.create({
      task_id: 'task-001',
      title: 'Study Session',
      description: 'Statistics',
      start_at: '2026-11-18T10:00:00.000Z',
      end_at: '2026-11-18T11:00:00.000Z',
      all_day: false,
      location: 'Library'
    })

    expect(created.id).toHaveLength(36)
    expect(created.task_id).toBe('task-001')
    expect(created.title).toBe('Study Session')
    expect(created.description).toBe('Statistics')
    expect(created.all_day).toBe(0)
    expect(created.location).toBe('Library')

    expect(repo.getById(created.id)).toEqual(created)
  })

  it('lists all events in start order', () => {
    repo.create({
      title: 'Later',
      start_at: '2026-11-20T10:00:00.000Z',
      end_at: '2026-11-20T11:00:00.000Z'
    })

    repo.create({
      title: 'Earlier',
      start_at: '2026-11-18T10:00:00.000Z',
      end_at: '2026-11-18T11:00:00.000Z'
    })

    expect(repo.listAll().map(event => event.title))
      .toEqual(['Earlier', 'Later'])
  })

  it('lists events by task', () => {
    const first = repo.create({
      task_id: 'task-001',
      title: 'First',
      start_at: '2026-11-18T10:00:00.000Z',
      end_at: '2026-11-18T11:00:00.000Z'
    })

    repo.create({
      title: 'Unlinked',
      start_at: '2026-11-18T12:00:00.000Z',
      end_at: '2026-11-18T13:00:00.000Z'
    })

    expect(repo.listByTask('task-001').map(event => event.id))
      .toEqual([first.id])
  })

  it('lists events overlapping a time range', () => {
    repo.create({
      title: 'Before',
      start_at: '2026-11-18T08:00:00.000Z',
      end_at: '2026-11-18T09:00:00.000Z'
    })

    const overlapping = repo.create({
      title: 'Overlapping',
      start_at: '2026-11-18T09:30:00.000Z',
      end_at: '2026-11-18T10:30:00.000Z'
    })

    repo.create({
      title: 'After',
      start_at: '2026-11-18T12:00:00.000Z',
      end_at: '2026-11-18T13:00:00.000Z'
    })

    expect(
      repo.listBetween(
        '2026-11-18T10:00:00.000Z',
        '2026-11-18T11:00:00.000Z'
      ).map(event => event.id)
    ).toEqual([overlapping.id])
  })

  it('updates an event', () => {
    const created = repo.create({
      title: 'Original',
      start_at: '2026-11-18T10:00:00.000Z',
      end_at: '2026-11-18T11:00:00.000Z'
    })

    const updated = repo.update({
      id: created.id,
      title: 'Updated',
      location: 'Room 101',
      all_day: true
    })

    expect(updated?.title).toBe('Updated')
    expect(updated?.location).toBe('Room 101')
    expect(updated?.all_day).toBe(1)
  })

  it('deletes an event', () => {
    const created = repo.create({
      title: 'Delete Me',
      start_at: '2026-11-18T10:00:00.000Z',
      end_at: '2026-11-18T11:00:00.000Z'
    })

    expect(repo.delete(created.id)).toBe(true)
    expect(repo.getById(created.id)).toBeNull()
    expect(repo.delete(created.id)).toBe(false)
  })

  it('sets task_id to null when the linked task is deleted', () => {
    const created = repo.create({
      task_id: 'task-001',
      title: 'Linked Event',
      start_at: '2026-11-18T10:00:00.000Z',
      end_at: '2026-11-18T11:00:00.000Z'
    })

    db.prepare(`DELETE FROM tasks WHERE id = ?`).run('task-001')

    expect(repo.getById(created.id)?.task_id).toBeNull()
  })
})
