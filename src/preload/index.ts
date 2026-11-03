import { contextBridge, ipcRenderer } from 'electron'
import type {
  SubjectRow,
  SubjectWithStats,
  TaskRow,
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
  ImportSubjectDocInput
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
// The typed API surface exposed as window.campusDeskAPI
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
    list: (opts?: TaskListOptions) => invoke<TaskRow[]>('task:list', opts ?? {}),
    get: (id: string) => invoke<TaskRow | null>('task:get', { id }),
    create: (input: TaskCreateInput) => invoke<TaskRow>('task:create', input),
    update: (input: TaskUpdateInput) => invoke<TaskRow | null>('task:update', input),
    archive: (id: string, archived: boolean) =>
      invoke<TaskRow | null>('task:archive', { id, archived }),
    delete: (id: string) => invoke<void>('task:delete', { id }),
    completion: (subjectId?: string) =>
      invoke<CompletionResult>('task:completion', subjectId ? { subjectId } : {}),
    overdue: () => invoke<TaskRow[]>('task:overdue')
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
    openDocument: (documentId: string) =>
      invoke<{ success: boolean }>('file:open-document', { documentId })
  },

  settings: {
    get: () => invoke<AppSettings>('settings:get'),
    set: (partial: Partial<AppSettings>) => invoke<AppSettings>('settings:set', partial),
    getPaths: () =>
      invoke<{ userData: string; appDataDir: string; library: string; backups: string; version: string }>(
        'settings:get-paths'
      )
  }
} as const

// Expose on window.campusDeskAPI — the sole entry point from the renderer.
contextBridge.exposeInMainWorld('campusDeskAPI', api)

// Export the type so renderer TypeScript files can reference it
export type CampusDeskAPI = typeof api
