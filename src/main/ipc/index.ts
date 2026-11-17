import type { Database } from 'better-sqlite3'
import { app } from 'electron'
import { createSubjectRepo, type SubjectRepo } from '../db/repositories/subjects'
import { createTaskRepo, type TaskRepo } from '../db/repositories/tasks'
import { createSettingsRepo, type SettingsRepo } from '../db/repositories/settings'
import { createSubjectDocRepo, type SubjectDocRepo } from '../db/repositories/subjectDocs'
import { createDocumentRepo, type DocumentRepo } from '../db/repositories/documents'
import { createTaskDocRepo, type TaskDocRepo } from '../db/repositories/taskDocs'
import { createCalendarEventRepo, type CalendarEventRepo } from '../db/repositories/calendarEvents'
import { createTaskReminderRepo, type TaskReminderRepo } from '../db/repositories/taskReminders'
import { createWorkSessionRepo, type WorkSessionRepo } from '../db/repositories/workSessions'
import { createFileLibraryService, type FileLibraryService } from '../services/fileLibrary'
import { createBackupService } from '../services/backupService'
import { registerSubjectHandlers } from './subjects'
import { registerTaskHandlers } from './tasks'
import { registerSettingsHandlers } from './settings'
import { registerSubjectDocHandlers } from './subjectDocs'
import { registerTaskDocHandlers } from './taskDocs'
import { registerFileHandlers } from './files'
import { registerPdfHandlers } from './pdf'
import { registerCalendarEventHandlers } from './calendarEvents'
import { registerTaskReminderHandlers } from './taskReminders'
import { registerWorkSessionHandlers } from './workSessions'

// ---------------------------------------------------------------------------
// IPC handler registration entry point
// Called once from main/index.ts after the DB is open and ready.
// Employs dynamic proxy delegates so active repositories remain bound
// across atomic database restores without requiring IPC re-registration.
// ---------------------------------------------------------------------------

export function registerAllIpcHandlers(initialDb: Database): void {
  let currentDb = initialDb

  let currentSubjectRepo = createSubjectRepo(currentDb)
  let currentTaskRepo = createTaskRepo(currentDb)
  let currentSettingsRepo = createSettingsRepo(currentDb)
  let currentSubjectDocRepo = createSubjectDocRepo(currentDb)
  let currentDocumentRepo = createDocumentRepo(currentDb)
  let currentTaskDocRepo = createTaskDocRepo(currentDb)
  let currentCalendarEventRepo = createCalendarEventRepo(currentDb)
  let currentTaskReminderRepo = createTaskReminderRepo(currentDb)
  let currentWorkSessionRepo = createWorkSessionRepo(currentDb)
  let currentFileLibrary = createFileLibraryService(
    currentDocumentRepo,
    currentSubjectDocRepo,
    currentTaskDocRepo
  )

  const rebind = (newDb: Database) => {
    currentDb = newDb
    currentSubjectRepo = createSubjectRepo(currentDb)
    currentTaskRepo = createTaskRepo(currentDb)
    currentSettingsRepo = createSettingsRepo(currentDb)
    currentSubjectDocRepo = createSubjectDocRepo(currentDb)
    currentDocumentRepo = createDocumentRepo(currentDb)
    currentTaskDocRepo = createTaskDocRepo(currentDb)
    currentCalendarEventRepo = createCalendarEventRepo(currentDb)
    currentTaskReminderRepo = createTaskReminderRepo(currentDb)
    currentWorkSessionRepo = createWorkSessionRepo(currentDb)
    currentFileLibrary = createFileLibraryService(
      currentDocumentRepo,
      currentSubjectDocRepo,
      currentTaskDocRepo
    )
  }

  // Proxies delegating to currently active repository instances
  const subjectRepoProxy = new Proxy({} as SubjectRepo, {
    get: (_, prop) => (currentSubjectRepo as any)[prop]
  })
  const taskRepoProxy = new Proxy({} as TaskRepo, {
    get: (_, prop) => (currentTaskRepo as any)[prop]
  })
  const settingsRepoProxy = new Proxy({} as SettingsRepo, {
    get: (_, prop) => (currentSettingsRepo as any)[prop]
  })
  const subjectDocRepoProxy = new Proxy({} as SubjectDocRepo, {
    get: (_, prop) => (currentSubjectDocRepo as any)[prop]
  })
  const documentRepoProxy = new Proxy({} as DocumentRepo, {
    get: (_, prop) => (currentDocumentRepo as any)[prop]
  })
  const taskDocRepoProxy = new Proxy({} as TaskDocRepo, {
    get: (_, prop) => (currentTaskDocRepo as any)[prop]
  })
  const calendarEventRepoProxy = new Proxy({} as CalendarEventRepo, {
    get: (_, prop) => (currentCalendarEventRepo as any)[prop]
  })
  const taskReminderRepoProxy = new Proxy({} as TaskReminderRepo, {
    get: (_, prop) => (currentTaskReminderRepo as any)[prop]
  })
  const workSessionRepoProxy = new Proxy({} as WorkSessionRepo, {
    get: (_, prop) => (currentWorkSessionRepo as any)[prop]
  })
  const fileLibraryProxy = new Proxy({} as FileLibraryService, {
    get: (_, prop) => (currentFileLibrary as any)[prop]
  })

  let appVersion = '0.2.0'
  try {
    appVersion = app.getVersion()
  } catch {}

  const backupService = createBackupService(() => currentDb, appVersion, rebind)

  registerSubjectHandlers(subjectRepoProxy)
  registerTaskHandlers(taskRepoProxy)
  registerSettingsHandlers(settingsRepoProxy, backupService)
  registerSubjectDocHandlers(subjectDocRepoProxy)
  registerTaskDocHandlers(taskDocRepoProxy, fileLibraryProxy)
  registerFileHandlers(fileLibraryProxy)
  registerPdfHandlers(documentRepoProxy, fileLibraryProxy)
  registerCalendarEventHandlers(calendarEventRepoProxy)
  registerTaskReminderHandlers(taskReminderRepoProxy)
  registerWorkSessionHandlers(workSessionRepoProxy)
}
