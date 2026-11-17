# CampusDeck — Architecture Document (v0.2.0)

> **Stage**: v0.2.0 Foundation — Multi-process isolation, relational persistence, and scheduling foundations.
> **Date**: 2026-11-17

---

## 1. Process Architecture

Electron runs three distinct JavaScript contexts. CampusDeck keeps them strictly isolated.

```
┌─────────────────────────────────────────────────────────────────┐
│  Renderer Process (Chromium, sandboxed)                         │
│  React + TypeScript UI                                          │
│  nodeIntegration: false  │  contextIsolation: true             │
│  No direct Node or SQLite access                                │
│                          │                                      │
│          window.campusDeckAPI  (exposed by preload)             │
└─────────────────────────┬───────────────────────────────────────┘
                          │ contextBridge + typed IPC channels
┌─────────────────────────▼───────────────────────────────────────┐
│  Preload Script (Node context, sandboxed)                       │
│  Bridges renderer ↔ main via ipcRenderer.invoke                │
│  Exposes ONLY the typed API surface — nothing else              │
└─────────────────────────┬───────────────────────────────────────┘
                          │ ipcMain.handle (async, validated channels)
┌─────────────────────────▼───────────────────────────────────────┐
│  Main Process (Node.js, full OS access)                         │
│  App lifecycle, BrowserWindow management                        │
│  SQLite queries via better-sqlite3 (WAL mode)                   │
│  Repositories (subjects, tasks, documents, scheduling)          │
│  Services (fileLibrary, backupService)                          │
│  PDF streaming bytes & metadata via IPC                         │
│  Zod runtime payload validation & assertTrustedSender           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Folder Structure

```
CampusDeck/
├── src/
│   ├── main/
│   │   ├── index.ts            ← App entry; BrowserWindow creation & security
│   │   ├── ipc/
│   │   │   ├── tasks.ts        ← IPC handlers for task CRUD
│   │   │   ├── subjects.ts     ← IPC handlers for subject CRUD
│   │   │   ├── taskDocs.ts     ← IPC handlers for task document linking/unlinking
│   │   │   ├── subjectDocs.ts  ← IPC handlers for subject document CRUD
│   │   │   ├── files.ts        ← IPC handlers for file import/open/delete
│   │   │   ├── pdf.ts          ← IPC handlers for streaming PDF bytes & metadata
│   │   │   ├── calendarEvents.ts← IPC handlers for calendar event scheduling
│   │   │   ├── taskReminders.ts← IPC handlers for task notifications/reminders
│   │   │   ├── workSessions.ts ← IPC handlers for planned/recorded work blocks
│   │   │   ├── settings.ts     ← IPC handlers for storage metrics & backup
│   │   │   ├── validation.ts   ← Zod schemas & assertTrustedSender
│   │   │   └── index.ts        ← Registers all handlers with repo proxies
│   │   ├── db/
│   │   │   ├── connection.ts   ← SQLite initialization, WAL mode & migrations
│   │   │   ├── migrations/     ← Numbered SQL migrations (001 to 004)
│   │   │   │   ├── 001_initial.sql
│   │   │   │   ├── 002_subject_fields_and_categories.sql
│   │   │   │   ├── 003_task_attachment_roles.sql
│   │   │   │   └── 004_calendar_reminders_work_sessions.sql
│   │   │   └── repositories/   ← Relational data access repositories
│   │   │       ├── subjects.ts
│   │   │       ├── tasks.ts
│   │   │       ├── documents.ts
│   │   │       ├── taskDocs.ts
│   │   │       ├── subjectDocs.ts
│   │   │       ├── calendarEvents.ts
│   │   │       ├── taskReminders.ts
│   │   │       ├── workSessions.ts
│   │   │       └── settings.ts
│   │   ├── services/
│   │   │   ├── fileLibrary.ts  ← Safe copy-in, unique UUID names, ref-counting
│   │   │   └── backupService.ts← Native db.backup(), safe staging & atomic swap
│   │   └── utils/
│   │       └── paths.ts        ← Resolves userData, library, backup paths
│   │
│   ├── preload/
│   │   └── index.ts            ← contextBridge exposing window.campusDeckAPI
│   │
│   ├── shared/
│   │   └── types.ts            ← Canonical TypeScript interfaces shared across layers
│   │
│   └── renderer/
│       ├── index.html          ← Shell HTML
│       ├── src/
│       │   ├── main.tsx        ← React root
│       │   ├── App.tsx         ← App layout, routing & global state
│       │   ├── routes/         ← Pages (Dashboard, Tasks, Subjects, etc.)
│       │   ├── components/     ← UI components (Modals, TaskCard, PdfViewer)
│       │   ├── services/       ← Renderer services (pdfService)
│       │   └── types/          ← Global window typings
│
├── docs/                       ← Architecture, specifications & test plans
├── vitest.config.ts            ← Vitest configuration (Node environment)
├── electron.vite.config.ts     ← electron-vite multi-process bundle config
└── package.json
```

---

## 3. IPC Contract (Channel Naming Convention)

All channels follow `domain:action` naming. Handlers validate runtime payloads with Zod and check caller sender authenticity.

### 3.1 Task Channels

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `task:list` | renderer→main | `{ subject_id?: string, type?: TaskType, status?: TaskStatus, is_archived?: boolean, search?: string }` | `TaskRow[]` |
| `task:get` | renderer→main | `{ id: string }` | `TaskRow \| null` |
| `task:get-with-subject` | renderer→main | `{ id: string }` | `TaskWithSubject \| null` |
| `task:create` | renderer→main | `TaskCreateInput` | `TaskRow` |
| `task:update` | renderer→main | `TaskUpdateInput` | `TaskRow \| null` |
| `task:archive` | renderer→main | `{ id: string, archived: boolean }` | `TaskRow \| null` |
| `task:delete` | renderer→main | `{ id: string }` | `void` |
| `task:completion` | renderer→main | `{ subject_id?: string }` | `CompletionResult` |
| `task:overdue` | renderer→main | `{}` | `TaskRow[]` |
| `task:due-soon` | renderer→main | `{ withinDays?: number }` | `TaskRow[]` |
| `task:dashboard-stats` | renderer→main | `{}` | `DashboardStats` |

### 3.2 Subject Channels

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `subject:list` | renderer→main | `{}` | `SubjectWithStats[]` |
| `subject:get` | renderer→main | `{ id: string }` | `SubjectWithStats \| null` |
| `subject:create` | renderer→main | `SubjectCreateInput` | `SubjectRow` |
| `subject:update` | renderer→main | `SubjectUpdateInput` | `SubjectRow \| null` |
| `subject:delete` | renderer→main | `{ id: string }` | `void` |

### 3.3 Calendar Event Channels (v0.2.0)

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `calendar-event:create` | renderer→main | `CalendarEventCreateInput` | `CalendarEventRow` |
| `calendar-event:get` | renderer→main | `{ id: string }` | `CalendarEventRow \| null` |
| `calendar-event:list-all` | renderer→main | `{}` | `CalendarEventRow[]` |
| `calendar-event:list-by-task` | renderer→main | `{ taskId: string }` | `CalendarEventRow[]` |
| `calendar-event:list-between` | renderer→main | `{ startAt: string, endAt: string }` | `CalendarEventRow[]` |
| `calendar-event:update` | renderer→main | `CalendarEventUpdateInput` | `CalendarEventRow \| null` |
| `calendar-event:delete` | renderer→main | `{ id: string }` | `void` |

### 3.4 Task Reminder Channels (v0.2.0)

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `task-reminder:create` | renderer→main | `TaskReminderCreateInput` | `TaskReminderRow` |
| `task-reminder:get` | renderer→main | `{ id: string }` | `TaskReminderRow \| null` |
| `task-reminder:list-by-task` | renderer→main | `{ taskId: string }` | `TaskReminderRow[]` |
| `task-reminder:list-pending` | renderer→main | `{ limit?: number }` | `TaskReminderRow[]` |
| `task-reminder:dismiss` | renderer→main | `{ id: string }` | `TaskReminderRow \| null` |
| `task-reminder:update` | renderer→main | `TaskReminderUpdateInput` | `TaskReminderRow \| null` |
| `task-reminder:delete` | renderer→main | `{ id: string }` | `void` |

### 3.5 Work Session Channels (v0.2.0)

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `work-session:create` | renderer→main | `WorkSessionCreateInput` | `WorkSessionRow` |
| `work-session:get` | renderer→main | `{ id: string }` | `WorkSessionRow \| null` |
| `work-session:list-by-task` | renderer→main | `{ taskId: string }` | `WorkSessionRow[]` |
| `work-session:list-between` | renderer→main | `{ startAt: string, endAt: string }` | `WorkSessionRow[]` |
| `work-session:update` | renderer→main | `WorkSessionUpdateInput` | `WorkSessionRow \| null` |
| `work-session:delete` | renderer→main | `{ id: string }` | `void` |

### 3.6 Task Document Channels

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `task-doc:list` | renderer→main | `{ taskId: string }` | `TaskDocumentRecord[]` |
| `task-doc:list-by-subject` | renderer→main | `{ subjectId: string }` | `TaskDocumentRecord[]` |
| `task-doc:list-all` | renderer→main | `{}` | `TaskDocumentRecord[]` |
| `task-doc:select-and-import` | renderer→main | `ImportTaskDocInput` | `TaskDocumentRecord[]` |
| `task-doc:update` | renderer→main | `TaskDocumentUpdateInput` | `TaskDocumentRecord` |
| `task-doc:unlink` | renderer→main | `{ id: string }` | `void` |
| `task-doc:delete` | renderer→main | `{ id: string }` | `TaskDocumentDeleteResult` |
| `task-doc:ref-count` | renderer→main | `{ documentId: string }` | `DocumentRefCount` |

### 3.7 Subject Document Channels

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `subject-doc:list` | renderer→main | `{ subjectId: string }` | `SubjectDocumentRecord[]` |
| `subject-doc:list-all` | renderer→main | `{}` | `SubjectDocumentRecord[]` |
| `subject-doc:select-and-import` | renderer→main | `ImportSubjectDocInput` | `SubjectDocumentRecord[]` |
| `subject-doc:delete` | renderer→main | `{ id: string }` | `void` |

### 3.8 PDF Streaming Channels

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `pdf:get-document-bytes` | renderer→main | `{ documentId: string }` | `Uint8Array` |
| `pdf:get-document-metadata` | renderer→main | `{ documentId: string }` | `PdfDocumentMetadata` |

### 3.9 Settings & Backup Channels

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `settings:get` | renderer→main | `{}` | `Record<string, string>` |
| `settings:set` | renderer→main | `Record<string, string>` | `Record<string, string>` |
| `settings:get-storage-usage`| renderer→main | `{}` | `StorageUsageInfo` |
| `settings:open-data-folder` | renderer→main | `{}` | `void` |
| `backup:export` | renderer→main | `{}` | `BackupExportResult` |
| `backup:restore` | renderer→main | `{}` | `BackupRestoreResult` |

---

## 4. Security Architecture

### 4.1 contextBridge API Surface

The preload script exposes typed domain namespaces on `window.campusDeckAPI`:

```typescript
window.campusDeckAPI = {
  subjects: { list, get, create, update, delete },
  tasks: { list, get, getWithSubject, create, update, archive, delete, completion, overdue, dueSoon, dashboardStats },
  calendarEvents: { create, get, listAll, listByTask, listBetween, update, delete },
  taskReminders: { create, get, listByTask, listPending, dismiss, update, delete },
  workSessions: { create, get, listByTask, listBetween, update, delete },
  taskDocs: { list, listBySubject, listAll, selectAndImport, update, unlink, delete, getRefCount },
  subjectDocs: { list, listAll, selectAndImport, delete },
  files: { open, delete },
  pdf: { getBytes, getMetadata },
  settings: { get, set, getStorageUsage, openDataFolder },
  backup: { export, restore }
}
```

No raw Electron or Node.js APIs (`ipcRenderer`, `require`, `fs`) are accessible to the renderer.

### 4.2 BrowserWindow Configuration

```typescript
new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, '../preload/index.js'),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true
  }
})
```

### 4.3 In-App PDF Viewer Security

The PDF viewer is rendered directly in the React renderer via `pdfjs-dist` with:
- Locally bundled Web Worker (`pdf.worker.min.mjs`, zero CDN / network access).
- CSP enforcing `worker-src 'self' blob:` and `connect-src 'none'`.
- Document bytes streamed from the main process via IPC channel `pdf:get-document-bytes`.
- The renderer never receives raw or absolute filesystem paths.

---

## 5. Data Flow — Attaching a Task Document

```
User selects file(s) via native dialog in renderer
        ↓
renderer calls window.campusDeckAPI.taskDocs.selectAndImport({ taskId, role, variantLabel })
        ↓
IPC channel: "task-doc:select-and-import"
        ↓
main/ipc/taskDocs.ts handler
        ↓
main/services/fileLibrary.ts
  • Opens native dialog with supported extensions
  • Validates file MIME and format
  • Copies source → <userData>/campusdeck_storage/library/<uuid>.<ext>
  • Computes relative path: "library/<uuid>.<ext>"
        ↓
main/db/repositories/documents.ts & taskDocs.ts
  • INSERT INTO documents (id, display_name, relative_path, mime_type, size_bytes)
  • INSERT INTO task_documents (id, task_id, document_id, role, variant_label)
        ↓
Returns TaskDocumentRecord[] to renderer
```

---

## 6. Backup Architecture

Full manual backup export and atomic restore via `backupService.ts`:
- **Export**: Uses SQLite's native `.backup()` API to snapshot the active database without stopping writes. Gathers all files in `library/`, computes SHA-256 checksums, generates `manifest.json`, and packages into a ZIP archive.
- **Restore Pipeline**: 
  1. Validates ZIP integrity and path traversal absence.
  2. Verifies manifest schema compatibility (`CURRENT_MAX_SCHEMA_VERSION = 4`).
  3. Stages extraction to temporary directory and validates SHA-256 hashes.
  4. Takes a pre-restore rollback snapshot of active database and library.
  5. Performs atomic swap and re-opens SQLite database.
  6. Rebinds ES6 dynamic proxy delegates so active IPC handlers seamlessly use the restored database.

---

## 7. PDF.js Offline Integration

- `pdfjs-dist` is installed as a production dependency.
- The PDF worker is configured via Vite bundled asset:
  ```typescript
  import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  ```
- All rendering uses HTML5 Canvas with DPR scaling and render-task cancellation to prevent race conditions during rapid page switching.
- 100% offline; zero external network calls.

---

## 8. Build and Package

```bash
npm run dev        # electron-vite dev server + hot reload
npm run build      # Vite production build & migration copy
npm run package    # electron-builder packages into .deb / .AppImage (Linux)
```

- `electron-builder.yml` specifies Linux AppImage and deb targets.
- Embedded SQL migrations provide an automated fallback if migration files are isolated from binary bundles.

