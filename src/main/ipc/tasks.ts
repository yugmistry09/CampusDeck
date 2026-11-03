import { ipcMain } from 'electron'
import {
  assertTrustedSender,
  parseOrThrow,
  taskCreateSchema,
  taskUpdateSchema,
  taskArchiveSchema,
  taskListSchema,
  taskCompletionSchema,
  taskDueSoonSchema,
  subjectIdSchema
} from './validation'
import type { TaskRepo } from '../db/repositories/tasks'

// ---------------------------------------------------------------------------
// Task IPC handlers
// Channels: task:list, task:get, task:get-with-subject, task:create,
//           task:update, task:archive, task:delete, task:completion,
//           task:overdue, task:due-soon, task:dashboard-stats
// ---------------------------------------------------------------------------

export function registerTaskHandlers(repo: TaskRepo): void {
  ipcMain.handle('task:list', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const opts = parseOrThrow(taskListSchema, payload ?? {})
    return repo.list({
      subjectId: opts.subjectId,
      includeArchived: opts.includeArchived,
      status: opts.status,
      priority: opts.priority,
      type: opts.type
    })
  })

  ipcMain.handle('task:get', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { id } = parseOrThrow(subjectIdSchema, payload)
    return repo.getById(id)
  })

  ipcMain.handle('task:get-with-subject', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { id } = parseOrThrow(subjectIdSchema, payload)
    return repo.getByIdWithSubject(id)
  })

  ipcMain.handle('task:create', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const input = parseOrThrow(taskCreateSchema, payload)
    return repo.create(input)
  })

  ipcMain.handle('task:update', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const input = parseOrThrow(taskUpdateSchema, payload)
    return repo.update(input)
  })

  ipcMain.handle('task:archive', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { id, archived } = parseOrThrow(taskArchiveSchema, payload)
    return repo.setArchived(id, archived)
  })

  ipcMain.handle('task:delete', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { id } = parseOrThrow(subjectIdSchema, payload)
    repo.delete(id)
  })

  ipcMain.handle('task:completion', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const opts = parseOrThrow(taskCompletionSchema, payload ?? {})
    return repo.getCompletion(opts.subjectId)
  })

  ipcMain.handle('task:overdue', (event) => {
    assertTrustedSender(event.sender)
    return repo.getOverdue()
  })

  ipcMain.handle('task:due-soon', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const opts = parseOrThrow(taskDueSoonSchema, payload ?? {})
    return repo.getUpcomingDueSoon(opts.days ?? 7)
  })

  ipcMain.handle('task:dashboard-stats', (event) => {
    assertTrustedSender(event.sender)
    return repo.getDashboardStats()
  })
}
