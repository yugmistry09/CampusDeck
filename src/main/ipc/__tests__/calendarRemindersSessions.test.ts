import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { runMigrationsFromDir } from '../../db/connection'
import { createTaskRepo } from '../../db/repositories/tasks'
import { createCalendarEventRepo } from '../../db/repositories/calendarEvents'
import { createTaskReminderRepo } from '../../db/repositories/taskReminders'
import { createWorkSessionRepo } from '../../db/repositories/workSessions'

const handlers: Record<string, (event: any, payload?: any) => any> = {}
const fakeWebContents = { id: 1 }

function invokeHandler(channel: string, event: any, payload?: any): any {
  const handler = handlers[channel]
  if (!handler) {
    throw new Error(`Handler for "${channel}" is not registered`)
  }
  return handler(event, payload)
}

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (event: any, payload?: any) => any) => {
      handlers[channel] = fn
    }
  },
  BrowserWindow: {
    getAllWindows: () => [{ webContents: fakeWebContents }]
  }
}))

import { registerCalendarEventHandlers } from '../calendarEvents'
import { registerTaskReminderHandlers } from '../taskReminders'
import { registerWorkSessionHandlers } from '../workSessions'

describe('Calendar, Reminder & Work Session IPC', () => {
  let db: Database.Database
  let taskId: string

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrationsFromDir(db, join(process.cwd(), 'src/main/db/migrations'))

    const taskRepo = createTaskRepo(db)
    const task = taskRepo.create({
      type: 'assignment',
      title: 'IPC Test Task'
    })
    taskId = task.id

    registerCalendarEventHandlers(createCalendarEventRepo(db))
    registerTaskReminderHandlers(createTaskReminderRepo(db))
    registerWorkSessionHandlers(createWorkSessionRepo(db))
  })

  it('creates and retrieves a calendar event', () => {
    const id = uuidv4()
    const event = invokeHandler('calendar-event:create',
      { sender: fakeWebContents },
      {
        id,
        task_id: taskId,
        title: 'Study Session',
        start_at: '2026-12-01T10:00:00Z',
        end_at: '2026-12-01T11:00:00Z'
      }
    )

    expect(event.id).toBeDefined()
    expect(event.task_id).toBe(taskId)

    const result = invokeHandler('calendar-event:get',
      { sender: fakeWebContents },
      { id: event.id }
    )

    expect(result.title).toBe('Study Session')
  })

  it('lists calendar events between timestamps', () => {
    invokeHandler('calendar-event:create',
      { sender: fakeWebContents },
      {
        task_id: taskId,
        title: 'Inside',
        start_at: '2026-12-01T10:00:00Z',
        end_at: '2026-12-01T11:00:00Z'
      }
    )

    const result = invokeHandler('calendar-event:list-between',
      { sender: fakeWebContents },
      {
        startAt: '2026-12-01T09:30:00Z',
        endAt: '2026-12-01T10:30:00Z'
      }
    )

    expect(result).toHaveLength(1)
  })

  it('updates, lists all, lists by task, and deletes a calendar event', () => {
    const event = invokeHandler('calendar-event:create',
      { sender: fakeWebContents },
      {
        task_id: taskId,
        title: 'Original Event',
        start_at: '2026-12-01T10:00:00Z',
        end_at: '2026-12-01T11:00:00Z'
      }
    )

    const updated = invokeHandler('calendar-event:update',
      { sender: fakeWebContents },
      {
        id: event.id,
        title: 'Updated Event',
        location: 'Hall B'
      }
    )
    expect(updated.title).toBe('Updated Event')
    expect(updated.location).toBe('Hall B')

    const allEvents = invokeHandler('calendar-event:list-all', { sender: fakeWebContents })
    expect(allEvents.map((e: any) => e.id)).toContain(event.id)

    const taskEvents = invokeHandler('calendar-event:list-by-task',
      { sender: fakeWebContents },
      { taskId }
    )
    expect(taskEvents.map((e: any) => e.id)).toContain(event.id)

    invokeHandler('calendar-event:delete',
      { sender: fakeWebContents },
      { id: event.id }
    )

    const fetchedAfterDelete = invokeHandler('calendar-event:get',
      { sender: fakeWebContents },
      { id: event.id }
    )
    expect(fetchedAfterDelete).toBeNull()
  })

  it('creates and dismisses a task reminder', () => {
    const reminder = invokeHandler('task-reminder:create',
      { sender: fakeWebContents },
      {
        task_id: taskId,
        remind_at: '2026-12-01T09:00:00Z'
      }
    )

    expect(reminder.task_id).toBe(taskId)
    expect(reminder.dismissed_at).toBeNull()

    const dismissed = invokeHandler('task-reminder:dismiss',
      { sender: fakeWebContents },
      { id: reminder.id }
    )

    expect(dismissed.dismissed_at).not.toBeNull()
  })

  it('manages task reminder retrieval, listing, updating, and deletion', () => {
    const reminder = invokeHandler('task-reminder:create',
      { sender: fakeWebContents },
      {
        task_id: taskId,
        remind_at: '2000-01-01T08:00:00Z'
      }
    )

    const fetched = invokeHandler('task-reminder:get',
      { sender: fakeWebContents },
      { id: reminder.id }
    )
    expect(fetched.id).toBe(reminder.id)

    const byTask = invokeHandler('task-reminder:list-by-task',
      { sender: fakeWebContents },
      { taskId }
    )
    expect(byTask.map((r: any) => r.id)).toContain(reminder.id)

    const pending = invokeHandler('task-reminder:list-pending',
      { sender: fakeWebContents },
      { limit: 10 }
    )
    expect(pending.map((r: any) => r.id)).toContain(reminder.id)

    const updated = invokeHandler('task-reminder:update',
      { sender: fakeWebContents },
      {
        id: reminder.id,
        remind_at: '2026-12-01T08:30:00Z'
      }
    )
    expect(updated.remind_at).toBe('2026-12-01T08:30:00Z')

    invokeHandler('task-reminder:delete',
      { sender: fakeWebContents },
      { id: reminder.id }
    )

    const afterDelete = invokeHandler('task-reminder:get',
      { sender: fakeWebContents },
      { id: reminder.id }
    )
    expect(afterDelete).toBeNull()
  })

  it('creates and updates a work session', () => {
    const session = invokeHandler('work-session:create',
      { sender: fakeWebContents },
      {
        task_id: taskId,
        title: 'Deep Work',
        start_at: '2026-12-01T14:00:00Z',
        end_at: '2026-12-01T15:00:00Z'
      }
    )

    expect(session.status).toBe('planned')

    const updated = invokeHandler('work-session:update',
      { sender: fakeWebContents },
      {
        id: session.id,
        status: 'completed'
      }
    )

    expect(updated.status).toBe('completed')
  })

  it('manages work session retrieval, listing, range filtering, and deletion', () => {
    const session = invokeHandler('work-session:create',
      { sender: fakeWebContents },
      {
        task_id: taskId,
        title: 'Work Block',
        start_at: '2026-12-01T16:00:00Z',
        end_at: '2026-12-01T17:00:00Z'
      }
    )

    const fetched = invokeHandler('work-session:get',
      { sender: fakeWebContents },
      { id: session.id }
    )
    expect(fetched.id).toBe(session.id)

    const byTask = invokeHandler('work-session:list-by-task',
      { sender: fakeWebContents },
      { taskId }
    )
    expect(byTask.map((s: any) => s.id)).toContain(session.id)

    const between = invokeHandler('work-session:list-between',
      { sender: fakeWebContents },
      {
        startAt: '2026-12-01T15:30:00Z',
        endAt: '2026-12-01T16:30:00Z'
      }
    )
    expect(between.map((s: any) => s.id)).toContain(session.id)

    invokeHandler('work-session:delete',
      { sender: fakeWebContents },
      { id: session.id }
    )

    const afterDelete = invokeHandler('work-session:get',
      { sender: fakeWebContents },
      { id: session.id }
    )
    expect(afterDelete).toBeNull()
  })

  it('rejects invalid UUIDs', () => {
    expect(() =>
      invokeHandler('calendar-event:get',
        { sender: fakeWebContents },
        { id: 'not-a-uuid' }
      )
    ).toThrow(/Validation error/)
  })

  it('rejects an untrusted sender', () => {
    expect(() =>
      invokeHandler('calendar-event:list-all',
        { sender: { id: 999 } },
        undefined
      )
    ).toThrow(/sender is not a trusted application window/)
  })
})
