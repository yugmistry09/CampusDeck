import { contextBridge, ipcRenderer } from 'electron'
import type {
  SubjectRow,
  SubjectWithStats,
  TaskRow,
  TaskWithSubject,
  DashboardStats,
  SubjectDocumentRow,
  SubjectDocumentRecord,
  AppSettings,
  CompletionResult,
  SubjectCreateInput,
  SubjectUpdateInput,
  TaskCreateInput,
  TaskUpdateInput,
  TaskListOptions,
  SubjectDocumentCreateInput,
  ImportSubjectDocInput,
  TaskDocumentRecord,
  TaskDocumentUpdateInput,
  TaskDocumentDeleteResult,
  ImportTaskDocInput,
  ImportTaskDocBlobInput,
  DocumentRefCount,
  NativePickedFile,
  PdfDocumentMetadata,
  StorageUsageInfo,
  BackupExportResult,
  BackupRestoreResult,
  CalendarEventRow,
  CalendarEventCreateInput,
  CalendarEventUpdateInput,
  TaskReminderRow,
  TaskReminderCreateInput,
  TaskReminderUpdateInput,
  WorkSessionRow,
  WorkSessionCreateInput,
  WorkSessionUpdateInput
} from '../shared/types'

// ---------------------------------------------------------------------------
// Preload — the ONLY bridge between the renderer and main processes.
//
// Security rules (D-012):
//   • contextIsolation: true  — renderer cannot reach this scope
//   • sandbox: true           — this script runs in a restricted Node context
//   • Raw ipcRenderer is NEVER exposed to the renderer.
//   • No Node.js built-ins (fs, path, require) are accessible from React code.
//   • Each method wraps exactly ONE named channel — no dynamic channel names.
// ---------------------------------------------------------------------------

function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  return ipcRenderer.invoke(channel, payload) as Promise<T>
}

// ---------------------------------------------------------------------------
// The typed API surface exposed as window.campusDeckAPI
// ---------------------------------------------------------------------------
const api = {
  subjects: {
    list: () => invoke<SubjectRow[]>('subject:list'),
    listWithStats: () => invoke<SubjectWithStats[]>('subject:list-with-stats'),
    get: (id: string) => invoke<SubjectRow | null>('subject:get', { id }),
    getWithStats: (id: string) => invoke<SubjectWithStats | null>('subject:get-with-stats', { id }),
    create: (input: SubjectCreateInput) => invoke<SubjectRow>('subject:create', input),
    update: (input: SubjectUpdateInput) => invoke<SubjectRow | null>('subject:update', input),
    delete: (id: string) => invoke<void>('subject:delete', { id })
  },

  tasks: {
    list: (opts?: TaskListOptions) => invoke<TaskWithSubject[]>('task:list', opts ?? {}),
    get: (id: string) => invoke<TaskRow | null>('task:get', { id }),
    getWithSubject: (id: string) => invoke<TaskWithSubject | null>('task:get-with-subject', { id }),
    create: (input: TaskCreateInput) => invoke<TaskRow>('task:create', input),
    update: (input: TaskUpdateInput) => invoke<TaskRow | null>('task:update', input),
    archive: (id: string, archived: boolean) =>
      invoke<TaskRow | null>('task:archive', { id, archived }),
    delete: (id: string) => invoke<void>('task:delete', { id }),
    completion: (subjectId?: string) =>
      invoke<CompletionResult>('task:completion', subjectId ? { subjectId } : {}),
    overdue: () => invoke<TaskRow[]>('task:overdue'),
    dueSoon: (days?: number) => invoke<TaskWithSubject[]>('task:due-soon', { days }),
    dashboardStats: () => invoke<DashboardStats>('task:dashboard-stats')
  },

  calendarEvents: {
    create: (input: CalendarEventCreateInput) =>
      invoke<CalendarEventRow>('calendar-event:create', input),
    get: (id: string) =>
      invoke<CalendarEventRow | null>('calendar-event:get', { id }),
    listAll: () =>
      invoke<CalendarEventRow[]>('calendar-event:list-all'),
    listByTask: (taskId: string) =>
      invoke<CalendarEventRow[]>('calendar-event:list-by-task', { taskId }),
    listBetween: (startAt: string, endAt: string) =>
      invoke<CalendarEventRow[]>('calendar-event:list-between', { startAt, endAt }),
    update: (input: CalendarEventUpdateInput) =>
      invoke<CalendarEventRow | null>('calendar-event:update', input),
    delete: (id: string) =>
      invoke<void>('calendar-event:delete', { id })
  },

  taskReminders: {
    create: (input: TaskReminderCreateInput) =>
      invoke<TaskReminderRow>('task-reminder:create', input),
    get: (id: string) =>
      invoke<TaskReminderRow | null>('task-reminder:get', { id }),
    listByTask: (taskId: string) =>
      invoke<TaskReminderRow[]>('task-reminder:list-by-task', { taskId }),
    listPending: (limit?: number) =>
      invoke<TaskReminderRow[]>('task-reminder:list-pending', { limit }),
    dismiss: (id: string) =>
      invoke<TaskReminderRow | null>('task-reminder:dismiss', { id }),
    update: (input: TaskReminderUpdateInput) =>
      invoke<TaskReminderRow | null>('task-reminder:update', input),
    delete: (id: string) =>
      invoke<void>('task-reminder:delete', { id })
  },

  workSessions: {
    create: (input: WorkSessionCreateInput) =>
      invoke<WorkSessionRow>('work-session:create', input),
    get: (id: string) =>
      invoke<WorkSessionRow | null>('work-session:get', { id }),
    listByTask: (taskId: string) =>
      invoke<WorkSessionRow[]>('work-session:list-by-task', { taskId }),
    listBetween: (startAt: string, endAt: string) =>
      invoke<WorkSessionRow[]>('work-session:list-between', { startAt, endAt }),
    update: (input: WorkSessionUpdateInput) =>
      invoke<WorkSessionRow | null>('work-session:update', input),
    delete: (id: string) =>
      invoke<void>('work-session:delete', { id })
  },

  taskDocs: {
    list: (taskId: string) =>
      invoke<TaskDocumentRecord[]>('task-doc:list', { taskId }),
    listBySubject: (subjectId: string) =>
      invoke<TaskDocumentRecord[]>('task-doc:list-by-subject', { subjectId }),
    listAll: () =>
      invoke<TaskDocumentRecord[]>('task-doc:list-all'),
    selectAndImport: (input: ImportTaskDocInput) =>
      invoke<{ canceled: boolean; documents?: TaskDocumentRecord[] }>(
        'task-doc:select-and-import',
        input
      ),
    importFromBlob: (input: ImportTaskDocBlobInput) =>
      invoke<{ canceled: boolean; documents?: TaskDocumentRecord[] }>(
        'task-doc:import-from-blob',
        input
      ),
    update: (input: TaskDocumentUpdateInput) =>
      invoke<TaskDocumentRecord | null>('task-doc:update', input),
    unlink: (id: string) =>
      invoke<{ success: boolean }>('task-doc:unlink', { id }),
    delete: (id: string) =>
      invoke<TaskDocumentDeleteResult>('task-doc:delete', { id }),
    getRefCount: (documentId: string) =>
      invoke<DocumentRefCount>('task-doc:ref-count', { documentId })
  },

  subjectDocs: {
    list: (subjectId: string) =>
      invoke<SubjectDocumentRecord[]>('subject-doc:list', { subjectId }),
    listAll: () =>
      invoke<SubjectDocumentRecord[]>('subject-doc:list-all'),
    create: (input: SubjectDocumentCreateInput) =>
      invoke<SubjectDocumentRow>('subject-doc:create', input),
    delete: (id: string) => invoke<void>('subject-doc:delete', { id })
  },

  files: {
    selectAndImportSubjectDoc: (input: ImportSubjectDocInput) =>
      invoke<{ canceled: boolean; document?: SubjectDocumentRecord }>(
        'file:select-and-import-subject-doc',
        input
      ),
    importFromBlob: (input: {
      subjectId: string
      title: string
      type: string
      description?: string
      files: Array<{ name: string; mimeType: string; arrayBuffer: ArrayBuffer }>
    }) =>
      invoke<{ canceled: boolean; document?: SubjectDocumentRecord }>(
        'file:import-from-blob',
        input
      ),
    openDocument: (documentId: string) =>
      invoke<{ success: boolean }>('file:open-document', { documentId }),
    revealInFolder: (documentId: string) =>
      invoke<{ success: boolean }>('file:reveal-in-folder', { documentId }),
    pickFiles: (options?: { allowMultiple?: boolean; title?: string }) =>
      invoke<{ canceled: boolean; files?: NativePickedFile[] }>('file:pick-files', options)
  },

  pdf: {
    getBytes: (documentId: string) =>
      invoke<Uint8Array>('pdf:get-document-bytes', { documentId }),
    getMetadata: (documentId: string) =>
      invoke<PdfDocumentMetadata>('pdf:get-document-metadata', { documentId })
  },

  settings: {
    get: () => invoke<AppSettings>('settings:get'),
    set: (partial: Partial<AppSettings>) => invoke<AppSettings>('settings:set', partial),
    getPaths: () =>
      invoke<{ userData: string; appDataDir: string; library: string; backups: string; version: string }>(
        'settings:get-paths'
      ),
    getStorageUsage: () => invoke<StorageUsageInfo>('settings:get-storage-usage'),
    openDataFolder: () => invoke<{ success: boolean }>('settings:open-data-folder')
  },

  backup: {
    export: () => invoke<BackupExportResult>('backup:export'),
    restore: () => invoke<BackupRestoreResult>('backup:restore')
  }
} as const

// Expose on window.campusDeckAPI — the sole entry point from the renderer.
contextBridge.exposeInMainWorld('campusDeckAPI', api)

// Export the type so renderer TypeScript files can reference it
export type CampusDeckAPI = typeof api
