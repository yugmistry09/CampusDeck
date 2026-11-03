import { ipcMain } from 'electron'
import {
  assertTrustedSender,
  parseOrThrow,
  subjectDocCreateSchema,
  subjectDocListSchema,
  subjectIdSchema
} from './validation'
import type { SubjectDocRepo } from '../db/repositories/subjectDocs'

// ---------------------------------------------------------------------------
// Subject Document IPC handlers
// Channels: subject-doc:list, subject-doc:create, subject-doc:delete
// (subject-doc:update is intentionally deferred — not needed for Prompt 2)
// ---------------------------------------------------------------------------

export function registerSubjectDocHandlers(repo: SubjectDocRepo): void {
  ipcMain.handle('subject-doc:list', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { subjectId } = parseOrThrow(subjectDocListSchema, payload)
    return repo.listBySubject(subjectId)
  })

  ipcMain.handle('subject-doc:create', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const input = parseOrThrow(subjectDocCreateSchema, payload)
    return repo.create(input)
  })

  ipcMain.handle('subject-doc:delete', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { id } = parseOrThrow(subjectIdSchema, payload)
    repo.delete(id)
  })
}
