import { ipcMain } from 'electron'
import {
  assertTrustedSender,
  parseOrThrow,
  taskReminderCreateSchema,
  taskReminderUpdateSchema,
  taskReminderIdSchema,
  taskReminderTaskSchema,
  taskReminderPendingSchema
} from './validation'
import type { TaskReminderRepo } from '../db/repositories/taskReminders'

export function registerTaskReminderHandlers(repo: TaskReminderRepo): void {
  ipcMain.handle('task-reminder:create', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    return repo.create(parseOrThrow(taskReminderCreateSchema, payload))
  })

  ipcMain.handle('task-reminder:get', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { id } = parseOrThrow(taskReminderIdSchema, payload)
    return repo.getById(id)
  })

  ipcMain.handle('task-reminder:list-by-task', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { taskId } = parseOrThrow(taskReminderTaskSchema, payload)
    return repo.listByTask(taskId)
  })

  ipcMain.handle('task-reminder:list-pending', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { limit } = parseOrThrow(taskReminderPendingSchema, payload ?? {})
    return repo.listPending(limit)
  })

  ipcMain.handle('task-reminder:dismiss', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { id } = parseOrThrow(taskReminderIdSchema, payload)
    return repo.dismiss(id)
  })

  ipcMain.handle('task-reminder:update', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    return repo.update(parseOrThrow(taskReminderUpdateSchema, payload))
  })

  ipcMain.handle('task-reminder:delete', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { id } = parseOrThrow(taskReminderIdSchema, payload)
    repo.delete(id)
  })
}
