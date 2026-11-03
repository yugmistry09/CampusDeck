import { ipcMain } from 'electron'
import { assertTrustedSender, parseOrThrow, subjectCreateSchema, subjectUpdateSchema, subjectIdSchema } from './validation'
import type { SubjectRepo } from '../db/repositories/subjects'

// ---------------------------------------------------------------------------
// Subject IPC handlers
// Channels: subject:list, subject:get, subject:create, subject:update, subject:delete
// ---------------------------------------------------------------------------

export function registerSubjectHandlers(repo: SubjectRepo): void {
  ipcMain.handle('subject:list', (event) => {
    assertTrustedSender(event.sender)
    return repo.list()
  })

  ipcMain.handle('subject:get', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { id } = parseOrThrow(subjectIdSchema, payload)
    return repo.getById(id)
  })

  ipcMain.handle('subject:create', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const input = parseOrThrow(subjectCreateSchema, payload)
    return repo.create(input)
  })

  ipcMain.handle('subject:update', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const input = parseOrThrow(subjectUpdateSchema, payload)
    return repo.update(input)
  })

  ipcMain.handle('subject:delete', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { id } = parseOrThrow(subjectIdSchema, payload)
    repo.delete(id)
  })
}
