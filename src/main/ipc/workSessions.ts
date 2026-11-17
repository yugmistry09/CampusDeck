import { ipcMain } from 'electron'
import {
  assertTrustedSender,
  parseOrThrow,
  workSessionCreateSchema,
  workSessionUpdateSchema,
  workSessionIdSchema,
  workSessionTaskSchema,
  workSessionBetweenSchema
} from './validation'
import type { WorkSessionRepo } from '../db/repositories/workSessions'

export function registerWorkSessionHandlers(repo: WorkSessionRepo): void {
  ipcMain.handle('work-session:create', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    return repo.create(parseOrThrow(workSessionCreateSchema, payload))
  })

  ipcMain.handle('work-session:get', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { id } = parseOrThrow(workSessionIdSchema, payload)
    return repo.getById(id)
  })

  ipcMain.handle('work-session:list-by-task', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { taskId } = parseOrThrow(workSessionTaskSchema, payload)
    return repo.listByTask(taskId)
  })

  ipcMain.handle('work-session:list-between', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const input = parseOrThrow(workSessionBetweenSchema, payload)
    return repo.listBetween(input.startAt, input.endAt)
  })

  ipcMain.handle('work-session:update', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    return repo.update(parseOrThrow(workSessionUpdateSchema, payload))
  })

  ipcMain.handle('work-session:delete', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { id } = parseOrThrow(workSessionIdSchema, payload)
    repo.delete(id)
  })
}
