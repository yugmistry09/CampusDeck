import type { Database } from 'better-sqlite3'
import { createSubjectRepo } from '../db/repositories/subjects'
import { createTaskRepo } from '../db/repositories/tasks'
import { createSettingsRepo } from '../db/repositories/settings'
import { createSubjectDocRepo } from '../db/repositories/subjectDocs'
import { registerSubjectHandlers } from './subjects'
import { registerTaskHandlers } from './tasks'
import { registerSettingsHandlers } from './settings'
import { registerSubjectDocHandlers } from './subjectDocs'

// ---------------------------------------------------------------------------
// IPC handler registration entry point
// Called once from main/index.ts after the DB is open and ready.
// Each handler group gets its own repository instance backed by the same DB.
// ---------------------------------------------------------------------------

export function registerAllIpcHandlers(db: Database): void {
  const subjectRepo = createSubjectRepo(db)
  const taskRepo = createTaskRepo(db)
  const settingsRepo = createSettingsRepo(db)
  const subjectDocRepo = createSubjectDocRepo(db)

  registerSubjectHandlers(subjectRepo)
  registerTaskHandlers(taskRepo)
  registerSettingsHandlers(settingsRepo)
  registerSubjectDocHandlers(subjectDocRepo)
}
