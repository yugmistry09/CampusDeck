# CampusDeck — Architecture Document (v0.1)

> **Stage**: Prompt 1 — Design only. No product code exists.
> **Date**: 2026-10-29

---

## 1. Process Architecture

Electron runs three distinct JavaScript contexts. CampusDeck keeps them strictly isolated.

```
┌─────────────────────────────────────────────────────────────────┐
│  Renderer Process (Chromium, sandboxed)                         │
│  React + TypeScript UI                                          │
│  nodeIntegration: false  │  contextIsolation: true             │
│  No direct Node or FS access                                    │
│                          │                                      │
│          window.campusDeckAPI  (exposed by preload)             │
└─────────────────────────┬───────────────────────────────────────┘
                          │ contextBridge + typed IPC channels
┌─────────────────────────▼───────────────────────────────────────┐
│  Preload Script (Node context, sandboxed)                       │
│  Bridges renderer ↔ main via ipcRenderer.invoke / on           │
│  Exposes ONLY the named API surface — nothing else              │
└─────────────────────────┬───────────────────────────────────────┘
                          │ ipcMain.handle (async, named channels)
┌─────────────────────────▼───────────────────────────────────────┐
│  Main Process (Node.js, full OS access)                         │
│  App lifecycle, BrowserWindow management                        │
│  SQLite queries via better-sqlite3                              │
│  File system operations (copy, delete, read)                    │
│  PDF.js viewer window management                                │
│  Backup scheduler                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Folder Structure

```
CampusDeck/
├── src/
│   ├── main/
│   │   ├── index.ts            ← App entry; creates BrowserWindow
│   │   ├── ipc/
│   │   │   ├── tasks.ts        ← IPC handlers for task CRUD
│   │   │   ├── subjects.ts     ← IPC handlers for subject CRUD
│   │   │   ├── files.ts        ← IPC handlers for file import/delete/open
│   │   │   ├── settings.ts     ← IPC handlers for settings get/set
│   │   │   └── index.ts        ← Registers all handlers
│   │   ├── db/
│   │   │   ├── connection.ts   ← Opens / migrates the SQLite database
│   │   │   ├── migrations/     ← Numbered SQL migration files
│   │   │   │   └── 001_initial.sql
│   │   │   ├── queries/
│   │   │   │   ├── tasks.ts
│   │   │   │   ├── subjects.ts
│   │   │   │   ├── files.ts
│   │   │   │   └── settings.ts
│   │   │   └── schema.ts       ← TypeScript types mirroring DB schema
│   │   ├── services/
│   │   │   ├── fileLibrary.ts  ← Copy-in, unique-name, delete from library
│   │   │   ├── backup.ts       ← Scheduled SQLite backup
│   │   │   └── pdfViewer.ts    ← Open PDF.js window for a given file path
│   │   └── utils/
│   │       └── paths.ts        ← Resolves userData, library, backup paths
│   │
│   ├── preload/
│   │   └── index.ts            ← contextBridge.exposeInMainWorld('campusDeckAPI', …)
│   │
│   └── renderer/
│       ├── index.html          ← Shell HTML
│       ├── main.tsx            ← React root; router setup
│       ├── routes/
│       │   ├── Dashboard.tsx
│       │   ├── Tasks.tsx
│       │   ├── Subjects.tsx
│       │   ├── SubjectDetail.tsx
│       │   ├── AllFiles.tsx
│       │   └── Settings.tsx
│       ├── components/         ← Shared UI components
│       ├── hooks/              ← Custom React hooks (useTaskList, etc.)
│       ├── store/              ← Local state (Zustand or React Context)
│       └── types/              ← TypeScript types for the IPC API contract
│
├── resources/
│   ├── pdfjs/                  ← Bundled PDF.js viewer (web build)
│   └── icons/                  ← App icons (png, icns, ico)
│
├── docs/                       ← All planning docs (this file, etc.)
├── scripts/                    ← Dev helper scripts
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── electron-builder.yml
└── package.json
```

---

## 3. IPC Contract (Channel Naming Convention)

All channels follow `domain:action` naming. The preload exposes them as typed
async functions. The main process registers handlers in `src/main/ipc/`.

### 3.1 Task Channels

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `task:list` | renderer→main | `{ subjectId?: string, includeArchived?: boolean }` | `Task[]` |
| `task:get` | renderer→main | `{ id: string }` | `Task \| null` |
| `task:create` | renderer→main | `TaskCreateInput` | `Task` |
| `task:update` | renderer→main | `TaskUpdateInput` | `Task` |
| `task:archive` | renderer→main | `{ id: string, archived: boolean }` | `Task` |
| `task:delete` | renderer→main | `{ id: string }` | `void` |
| `task:completion` | renderer→main | `{ subjectId?: string }` | `CompletionResult` |

### 3.2 Subject Channels

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `subject:list` | renderer→main | `{}` | `Subject[]` |
| `subject:get` | renderer→main | `{ id: string }` | `Subject \| null` |
| `subject:create` | renderer→main | `SubjectCreateInput` | `Subject` |
| `subject:update` | renderer→main | `SubjectUpdateInput` | `Subject` |
| `subject:delete` | renderer→main | `{ id: string }` | `void` |

### 3.3 File Channels

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `file:import` | renderer→main | `{ sourcePath: string, role: FileRole, taskId?: string, subjectDocId?: string, displayName: string, variantLabel?: string }` | `FileRecord` |
| `file:delete` | renderer→main | `{ id: string }` | `void` |
| `file:open` | renderer→main | `{ id: string }` | `void` (opens viewer window) |
| `file:list` | renderer→main | `{ taskId?: string, subjectDocId?: string }` | `FileRecord[]` |
| `file:list-all` | renderer→main | `{}` | `FileRecord[]` |

### 3.4 Subject Document Channels

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `subject-doc:list` | renderer→main | `{ subjectId: string }` | `SubjectDocument[]` |
| `subject-doc:create` | renderer→main | `SubjectDocumentCreateInput` | `SubjectDocument` |
| `subject-doc:delete` | renderer→main | `{ id: string }` | `void` |

### 3.5 Settings Channels

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `settings:get` | renderer→main | `{}` | `AppSettings` |
| `settings:set` | renderer→main | `Partial<AppSettings>` | `AppSettings` |
| `settings:get-paths` | renderer→main | `{}` | `{ userData: string, library: string, backups: string }` |

---

## 4. Security Architecture

### 4.1 contextBridge API Surface

The preload script exposes **one** object on `window`:

```typescript
window.campusDeckAPI = {
  tasks: { list, get, create, update, archive, delete, completion },
  subjects: { list, get, create, update, delete },
  files: { import, delete, open, list, listAll },
  subjectDocs: { list, create, delete },
  settings: { get, set, getPaths },
}
```

No other Node.js API is exposed. The renderer has no way to access `require`,
`fs`, `path`, `child_process`, or any Electron internal.

### 4.2 BrowserWindow Configuration

```typescript
new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, '../preload/index.js'),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
  }
})
```

### 4.3 PDF Viewer Window

The PDF.js viewer opens in a **separate** `BrowserWindow` with:
- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- The file is loaded by the main process reading the file bytes and passing them
  via a local protocol handler (registered with `protocol.registerBufferProtocol`)
  rather than by exposing the raw filesystem path to the renderer.

---

## 5. Data Flow — Adding a Task File

```
User picks a file in renderer
        ↓
renderer calls window.campusDeckAPI.files.import(sourcePath, role, taskId, displayName)
        ↓
IPC channel: "file:import"
        ↓
main/ipc/files.ts handler
        ↓
main/services/fileLibrary.ts
  • Generates UUID for internal filename
  • Copies source → <userData>/library/<uuid>.<ext>
  • Computes relative path: "library/<uuid>.<ext>"
        ↓
main/db/queries/files.ts
  • INSERT INTO files (relative_path, display_name, role, task_id, ...)
        ↓
Returns FileRecord to renderer
```

---

## 6. Backup Architecture

```
App launch  ──→  backup.ts
                   • Opens <userData>/campusdeck.db
                   • sqlite3 backup API → <userData>/backups/<timestamp>.db
                   • Prunes backups older than configurable retention window
                   • Default: keep last 30 daily backups
```

No network is used. Restore is manual (documented in Settings view).

---

## 7. PDF.js Integration

- PDF.js is downloaded and bundled in `resources/pdfjs/` during setup (before first build).
- The viewer HTML (`resources/pdfjs/web/viewer.html`) is served via a custom local
  `campusdeck://` protocol registered in the main process.
- The file bytes are read by the main process (has FS access) and streamed to the
  protocol response. The renderer and viewer never see the absolute path of the file.

---

## 8. Build and Package

```
npm run dev        → electron-vite dev server + hot reload
npm run build      → Vite production build for all three processes
npm run package    → electron-builder packages into .deb / .AppImage (Linux)
```

- `electron-builder.yml` specifies `linux.targets: [deb, AppImage]`.
- `asar: true` bundles source into an Electron archive.
- `extraResources` copies `resources/pdfjs/` into the packaged app.
- `node_modules` is pruned to production-only dependencies before packaging.
