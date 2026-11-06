import type { Database } from 'better-sqlite3'
import { createSubjectRepo } from '../db/repositories/subjects'
import { createTaskRepo } from '../db/repositories/tasks'
import { createSettingsRepo } from '../db/repositories/settings'
import { createSubjectDocRepo } from '../db/repositories/subjectDocs'
import { createDocumentRepo } from '../db/repositories/documents'
import { createTaskDocRepo } from '../db/repositories/taskDocs'
import { createFileLibraryService } from '../services/fileLibrary'
import { registerSubjectHandlers } from './subjects'
import { registerTaskHandlers } from './tasks'
import { registerSettingsHandlers } from './settings'
import { registerSubjectDocHandlers } from './subjectDocs'
import { registerTaskDocHandlers } from './taskDocs'
import { registerFileHandlers } from './files'

// ---------------------------------------------------------------------------
// IPC handler registration entry point
// Called once from main/index.ts after the DB is open and ready.
// ---------------------------------------------------------------------------

export function registerAllIpcHandlers(db: Database): void {
  const subjectRepo = createSubjectRepo(db)
  const taskRepo = createTaskRepo(db)
  const settingsRepo = createSettingsRepo(db)
  const subjectDocRepo = createSubjectDocRepo(db)
  const documentRepo = createDocumentRepo(db)
  const taskDocRepo = createTaskDocRepo(db)
  const fileLibrary = createFileLibraryService(documentRepo, subjectDocRepo, taskDocRepo)

  registerSubjectHandlers(subjectRepo)
  registerTaskHandlers(taskRepo)
  registerSettingsHandlers(settingsRepo)
  registerSubjectDocHandlers(subjectDocRepo)
  registerTaskDocHandlers(taskDocRepo, fileLibrary)
  registerFileHandlers(fileLibrary)
}
