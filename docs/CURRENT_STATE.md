# CampusDeck — Current State (CURRENT_STATE.md)

> This file is updated at the start and completion of each development stage to reflect what exists,
> what is complete, what was verified, and what comes next.

---

## Snapshot Date: 2026-11-17 (v0.2.0 Foundation Phase)

---

## What Exists Right Now

| Component | State | Details |
|---|---|---|
| Repository & Environment | ✅ Complete | Node v22.23.4 (via fnm), npm v10.9.9, Git repository on dedicated `v2` development branch |
| Desktop Runtime | ✅ Complete | Electron v33.4.11, electron-vite v2.3.0, TypeScript v5.6.3 (strict mode) |
| UI Framework & Styling | ✅ Complete | React 18, Tailwind CSS 3.4 (dark mode `class` strategy), Lucide Icons, responsive shell |
| Security Boundary | ✅ Complete | `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, restrictive CSP with `worker-src 'self' blob:` and `connect-src 'none'`, `assertTrustedSender` window verification |
| Preload API | ✅ Complete | Narrow, typed `contextBridge` exposing `window.campusDeckAPI` (including `calendarEvents`, `taskReminders`, `workSessions`, `taskDocs`, `pdf`, `backup`) |
| Storage Location | ✅ Complete | Dedicated directory beneath `userData`: `<userData>/campusdeck_storage/` (db, library, backups) |
| Database Engine | ✅ Complete | SQLite via `better-sqlite3` (11.10.0) in WAL mode, `foreign_keys = ON`, `synchronous = NORMAL` |
| Migrations | ✅ Complete | 4 versioned migrations (`001_initial.sql`, `002_subject_fields_and_categories.sql`, `003_task_attachment_roles.sql`, `004_calendar_reminders_work_sessions.sql`) with `schema_migrations` tracking & embedded fallback |
| Relational Schema | ✅ Complete | `subjects`, `tasks`, `documents`, `task_documents`, `subject_documents`, `settings`, `calendar_events`, `task_reminders`, `work_sessions`, views (`task_files`, `subject_document_files`) |
| Scheduling Repositories | ✅ Complete | `calendarEvents`, `taskReminders`, `workSessions` repositories with CRUD, interval overlap `listBetween`, and pending reminder queries |
| Scheduling IPC & Validation | ✅ Complete | 20 scheduling IPC channels with Zod payload validation, UUID & ISO-8601 offset parsing, and `assertTrustedSender` |
| Subject Management | ✅ Complete | Full CRUD with validation, code, semester, color picker, notes, stats, and delete confirmation |
| Subject Drill-down View | ✅ Complete | Detail view with Overview, Files tab with category filtering, and integrated Tasks tab with attachment previews |
| Task Model & CRUD | ✅ Complete | Single source of truth across all 7 types (`general`, `assignment`, `lab_manual`, `practical`, `project`, `exam_prep`, `other`), 3 statuses (`todo`, `in_progress`, `completed`), 3 priorities (`low`, `medium`, `high`), due date (`YYYY-MM-DD`), and archive state |
| Unified To-Do List | ✅ Complete | Unified tasks view with status tabs, subject & type dropdowns, due-date condition filters, search bar, and multi-criteria sorting |
| Local Overdue Calculation | ✅ Complete | Evaluated against local calendar date (`DATE('now', 'localtime')`); completed and archived tasks excluded |
| Real Dashboard Metrics | ✅ Complete | Open tasks, due soon (≤7d), overdue, completed, overall progress bar (D-008 formula), upcoming deadlines, and per-subject progress |
| Task Document Attachments | ✅ Complete | Multi-role attachments (`assignment_file`, `solution`, `reference`, `other`), multi-file selection, and storage in managed local library |
| Solution Variant Management | ✅ Complete | Multiple solution files per task, each with editable variant labels (e.g., "Variant A", "Variant B", "Teacher's solution") |
| Attachment Metadata Editing | ✅ Complete | Inline rename/edit display name, change attachment role, and modify solution variant label |
| Unlinking & Vault Deletion | ✅ Complete | Safe unlinking from task (leaving vault file intact) and deletion with reference count verification |
| Shared Document Protection | ✅ Complete | Referential integrity safeguard: shared files linked to multiple tasks or subjects are NEVER deleted from disk when unlinked |
| File Integrity & Missing File Detection | ✅ Complete | Verification of file presence on disk; visual badge and graceful error handling for missing files |
| In-App PDF Viewer | ✅ Complete | Built with `pdfjs-dist` and locally bundled Web Worker (zero CDN, 100% offline). Page navigation, jump-to-page, zoom controls, fit-to-width, canvas rendering with DPR scaling, and task attachment switching |
| Secure PDF Access IPC | ✅ Complete | Main-process IPC `pdf:get-document-bytes` & `pdf:get-document-metadata` streaming vault bytes by document ID; strict validation, path traversal guard, and MIME verification |
| Settings & Theme Switcher | ✅ Complete | Light, Dark, and System theme preferences with instant UI application and persistent storage in SQLite `settings` table |
| Storage Usage & Data Folder | ✅ Complete | Real-time disk utilization metrics (database size, file vault size, total files, total storage) and native "Open Data Folder" action via `shell.openPath` |
| Manual Backup Export (.zip) | ✅ Complete | Consistent SQLite snapshot via native `db.backup()`, managed files bundle, and `manifest.json` with SHA-256 checksums and schema version 4 |
| Safe Atomic Restore & Rollback | ✅ Complete | Staged extraction, path traversal rejection, checksum validation, database closure, rollback snapshots, atomic swap, and dynamic IPC proxy rebinding across all 9 repositories |
| Non-PDF Default Application Action | ✅ Complete | Clearly labelled "Open with default app" action for non-PDF attachments and subject documents |
| Subject Task Attachment Display | ✅ Complete | Attachment badges on task cards in subject task lists without duplicating task records |
| Document Import Flow | ✅ Complete | Native main-process dialog (with multi-select support), format & metadata validation, UUID-safe storage, transactional linking |
| Document Opening | ✅ Complete | Secure `shell.openPath` via verified document ID only (never raw path from renderer) |
| Non-Task Files Library | ✅ Complete | Subject Files tab and global All Files page with category tags, search, and delete |
| Deletion Safeguards | ✅ Complete | Subject deletion sets `tasks.subject_id = NULL` (preserves tasks per D-006) and safely cleans unreferenced files; task deletion cascades reminders/sessions and preserves calendar events per D-015 |
| Automated Tests | ✅ Complete | Vitest unit, repository, service, IPC validation, stepwise migration, and domain calculation test suites (18 test suites, 138 tests passing, 100% green) |
| Release Hardening & Packaging | ✅ Complete | Window open denial, navigation block, embedded SQL migration fallback, ESLint flat config, Linux AppImage & .deb packages |

---

## Exact Test Results (v0.2.0 Foundation Verification)

Command run:
```bash
npm run typecheck
npm test
```

Vitest output:
```
 ✓ src/main/db/__tests__/calendarEvents.test.ts (7)
 ✓ src/main/db/__tests__/documents.test.ts (6)
 ✓ src/main/db/__tests__/domainCalculations.test.ts (11)
 ✓ src/main/db/__tests__/migrations.test.ts (4)
 ✓ src/main/db/__tests__/settings.test.ts (4)
 ✓ src/main/db/__tests__/stepwiseMigrations.test.ts (2)
 ✓ src/main/db/__tests__/subjectDocs.test.ts (4)
 ✓ src/main/db/__tests__/subjects.test.ts (7)
 ✓ src/main/db/__tests__/taskDocs.test.ts (8)
 ✓ src/main/db/__tests__/taskReminders.test.ts (7)
 ✓ src/main/db/__tests__/tasks.test.ts (12)
 ✓ src/main/db/__tests__/workSessions.test.ts (6)
 ✓ src/main/ipc/__tests__/calendarRemindersSessions.test.ts (9)
 ✓ src/main/ipc/__tests__/pdfAccess.test.ts (8)
 ✓ src/main/ipc/__tests__/validation.test.ts (25)
 ✓ src/main/services/__tests__/backupRestore.test.ts (7)
 ✓ src/main/services/__tests__/fileLibrary.test.ts (6)
 ✓ src/main/services/__tests__/fileLibraryErrors.test.ts (5)

 Test Files  18 passed (18)
      Tests  138 passed (138)
```

Production Build output:
```
✓ built in 6.54s (main process)
✓ built in 65ms (preload)
out/renderer/assets/pdf.worker.min-CIqJB0yW.mjs  1,271.92 kB
out/renderer/assets/index-Ccr76zb8.css              53.63 kB
out/renderer/assets/index-CXq87Fdf.js            1,411.80 kB
✓ built in 39.19s
```

Exact test breakdown:
0. `backupRestore.test.ts` (7 tests):
   - Performs complete round-trip backup and restore with SHA-256 file integrity verification.
   - Strictly rejects corrupt or malformed archive files without affecting current app state.
   - Strictly rejects archives missing `manifest.json` or `campusdeck.db`.
   - Strictly rejects malicious archives containing path traversal (`../` or absolute) entries.
   - Rejects archives with incompatible future schema versions.
   - Detects missing files or checksum mismatches declared in manifest and initiates rollback.
   - Calculates storage usage accurately across database, library files, and total counts.
1. `pdfAccess.test.ts` (8 tests):
   - Retrieves valid PDF document bytes matching vault disk content.
   - Retrieves accurate PDF metadata for valid document ID.
   - Rejects non-existent document ID with not-found error.
   - Rejects invalid UUID formats via Zod schema.
   - Rejects non-PDF files when requesting PDF bytes.
   - Safely handles missing physical disk files with descriptive error.
   - Guards against path traversal in relative paths (`toAbsolutePath`).
   - Rejects untrusted sender `webContents` via `assertTrustedSender`.
2. `taskDocs.test.ts` (8 tests):
   - Multiple assignment document attachments to a single task (`assignment_file`).
   - Multiple solution variants with distinct variant labels ("Variant A", "Variant B", "Teacher's solution").
   - Attachment role changes and variant label updates (e.g. from `reference` to `solution`).
   - Unlinking attachment from task without deleting physical file or document entry.
   - Shared document protection: never deleting a file still referenced by another task.
   - Shared document protection: preserving files linked between a task and a subject document.
   - Missing file detection: flagging `file_exists === false` when a file is removed externally.
   - Subject-scoped task documents listing without duplicating task records.
2. `tasks.test.ts` (12 tests):
   - Tasks creation across all 7 types (`general`, `assignment`, `lab_manual`, `practical`, `project`, `exam_prep`, `other`).
   - Constraint check rejecting invalid task types.
   - Status transitions (`todo` -> `in_progress` -> `completed`) and priority assignments (`low`, `medium`, `high`).
   - Due date validation enforcing `YYYY-MM-DD` or NULL.
   - Task archiving sets `is_archived = 1` and `archived_at` timestamp; excludes archived from default active list.
   - Completion formula calculation (`completed / total`, 0% when total is 0, never NaN).
   - Subject-scoped completion calculations.
   - Local date-evaluated overdue detection (`due_date < DATE('now', 'localtime')`).
   - Type filtering (`list({ type })`).
   - Due soon query within N days (`getUpcomingDueSoon(7)`).
   - Complete dashboard aggregate stats calculation (`getDashboardStats()`).
   - Subject metadata join (`getByIdWithSubject` and `list`).
3. `subjects.test.ts` (7 tests):
   - Subject creation, retrieval, listing, and updates (including code, semester, color, notes).
   - Validation checks on non-empty name.
   - Foreign key behavior: deleting a subject sets `tasks.subject_id = NULL` (preserving tasks per D-006).
   - Foreign key behavior: deleting a subject cascades to `subject_documents` and cleans unreferenced files.
4. `documents.test.ts` (6 tests):
   - Document creation and unique path constraints.
   - Task document links and cascade behaviors.
   - View compatibility (`task_files`).
5. `subjectDocs.test.ts` (4 tests):
   - Document attachment with categories (`syllabus`, `marks`, `notice`, `reference`, `timetable`, `notes`, `other`).
   - Listing by subject and global listing across all subjects.
   - Unreferenced document cleanup upon deletion.
6. `fileLibrary.test.ts` (6 tests):
   - Supported academic formats validation (PDF, images, DOCX, PPTX, XLSX, TXT, MD, CSV).
   - Unsupported file rejection (EXE, script, binary).
   - Accurate MIME type resolution.
   - Preserving original files upon import and assigning UUID-prefixed relative paths.
   - Transactional import and document link creation.
   - Safe document opening error handling for non-existent document IDs.
7. `migrations.test.ts` (4 tests):
   - Migrations 001, 002, and 003 run sequentially, creating all tables and views.
   - Indexes and constraints verified.
   - Idempotency verified: re-running migrations does not fail.
   - Default settings seeded.
8. `settings.test.ts` (4 tests):
   - Key-value get, set, getAll, and partial preferences upserts.

Typecheck verification:
```bash
npm run typecheck
```
Result: Clean exit (code 0) across `tsconfig.json` (Node main/preload) and `tsconfig.web.json` (React renderer).

Build verification:
```bash
npm run build
```
Result: Clean production bundle created for main process (`out/main/index.js`), preload bridge (`out/preload/index.js`), and renderer assets (`out/renderer/`).

---

## Files Created & Modified in Prompt 5

### Database & Migrations
- `src/main/db/migrations/003_task_attachment_roles.sql`: Recreated `task_documents` table with `CHECK(role IN ('assignment_file', 'solution', 'reference', 'other', 'assignment'))`, migrated legacy `assignment` records, and recreated indexes and `task_files` view.
- `src/main/db/repositories/taskDocs.ts`: Created repository with `listByTask` (with `file_exists` integrity check), `listBySubject`, `listAll`, `getById`, `link`, `update`, `unlink`, `deleteWithFileCheck` (shared document protection), and `getRefCount`.
- `src/main/db/__tests__/taskDocs.test.ts`: Added 8 tests covering multiple assignments, solution variants, role changes, unlinking, shared-document handling, and file integrity.
- `src/main/db/__tests__/migrations.test.ts`: Updated to verify migration 003.

### Shared Contracts & IPC
- `src/shared/types.ts`: Expanded `TaskDocumentRole` to include `assignment_file`, `reference`, and `other`; added `TaskDocumentRecord`, `TaskDocumentUpdateInput`, `TaskDocumentDeleteResult`, `ImportTaskDocInput`, and `DocumentRefCount`.
- `src/main/ipc/validation.ts`: Added Zod schemas for `taskDocumentRoleSchema`, `taskDocIdSchema`, `taskDocUpdateSchema`, `importTaskDocSchema`, and `documentRefCountSchema`.
- `src/main/services/fileLibrary.ts`: Added multi-file selection support in `showNativeFileDialog`, enhanced `importTaskDocument`, and added `importMultipleTaskDocuments`.
- `src/main/ipc/taskDocs.ts`: Registered IPC handlers for `task-doc:list`, `task-doc:list-by-subject`, `task-doc:list-all`, `task-doc:select-and-import`, `task-doc:update`, `task-doc:unlink`, `task-doc:delete`, and `task-doc:ref-count`.
- `src/main/ipc/index.ts`: Wired `taskDocRepo` and `registerTaskDocHandlers`.
- `src/preload/index.ts`: Exposed `window.campusDeckAPI.taskDocs` methods.

### Renderer & UI Layer
- `src/renderer/src/components/TaskAttachmentModal.tsx`: File upload modal supporting multi-file selection, role picker (`assignment_file`, `solution`, `reference`, `other`), solution variant label with quick suggestion chips, and custom display name.
- `src/renderer/src/components/TaskAttachmentEditModal.tsx`: Edit modal allowing inline renaming, role updates, and solution variant label changes.
- `src/renderer/src/routes/TaskDetailPage.tsx`: Comprehensive Task Attachments & Solutions section with filter tabs, file type badges, role badges, variant labels, missing file indicators, open, edit, unlink, and delete with safety confirmation dialogs.
- `src/renderer/src/components/TaskCard.tsx`: Displays attached file badges and variant labels on task cards without duplicating task records.
- `src/renderer/src/routes/SubjectDetailPage.tsx`: Loads task attachments for course tasks, displays attachment badges on task cards, and wires task click to open task detail view.
- `src/renderer/src/routes/TasksPage.tsx`: Loads task attachments and passes them to task cards.

---

## Implementation Details for Prompt 6

### Dependencies
- Added `pdfjs-dist@6.5.438` for locally bundled, modern ES module PDF rendering.

### Main Process & Security Boundary
- `src/main/index.ts`: Updated Content Security Policy to include `worker-src 'self' blob:`; maintained strict `connect-src 'none'`, `object-src 'none'`, and `frame-src 'none'`.
- `src/main/ipc/validation.ts`: Added `pdfDocumentBytesSchema` validating `{ documentId: uuidSchema }`.
- `src/main/ipc/pdf.ts`: Created `registerPdfHandlers` with channels `pdf:get-document-bytes` and `pdf:get-document-metadata`. Validates caller sender, resolves vault paths with path traversal protection, checks physical existence, and streams raw `Uint8Array` bytes.
- `src/main/ipc/index.ts`: Registered `registerPdfHandlers` with SQLite `documentRepo` and `fileLibrary`.

### Shared Contracts & Preload
- `src/shared/types.ts`: Added `PdfDocumentMetadata` interface.
- `src/preload/index.ts`: Exposed typed `campusDeckAPI.pdf.getBytes` and `campusDeckAPI.pdf.getMetadata`.

### Renderer Layer
- `src/renderer/src/services/pdfService.ts`: Configured `pdfjsLib.GlobalWorkerOptions.workerSrc` using locally bundled Vite asset (`pdf.worker.min.mjs?url`). Provided `loadPdfDocumentFromVault`.
- `src/renderer/src/components/PdfViewer.tsx`: Full-featured in-app PDF viewer:
  - Header: Back to Task, breadcrumb with task title and document name, role badges, solution variant labels, attached PDF dropdown switcher (allows cycling between assignment sheet and solution variants without losing context), and external open button.
  - Toolbar: Previous / Next page buttons, interactive page jump input (`Page X of Y`), Zoom In, Zoom Out, zoom percentage indicator, Fit-to-Width, and Reset Zoom (100%).
  - Canvas Rendering Engine: High-DPI scaling (`window.devicePixelRatio`), render cancellation queue (`renderTask.cancel()`) to prevent race conditions during rapid navigation or resizing.
  - Graceful loading spinner and error handling for missing/corrupted files with safe return to task.
- `src/renderer/src/routes/TaskDetailPage.tsx`:
  - Integrated `PdfViewer` in place of task details when a PDF document is selected.
  - Added primary "View" button on PDF attachment items to open in-app.
  - Added clearly labelled "Open with default app" action for non-PDF attachments (e.g. DOCX, TXT).
  - Clicking on a PDF attachment title launches the in-app PDF viewer.

---

## Implementation Details for Prompt 7 (Settings, Storage Usage, Backup & Atomic Restore)

### Dependencies
- Added `adm-zip` and `@types/adm-zip` for in-memory and streaming ZIP archive extraction, manipulation, and creation without spawning external shell processes.

### Main Process Services & IPC
- `src/main/utils/paths.ts`:
  - Updated `getAppPaths()` with `TEST_USER_DATA_DIR` support for completely isolated parallel test runner worker directories.
- `src/main/services/backupService.ts`:
  - `getStorageUsage()`: Reads database file size, iterates recursively over `libraryRoot` measuring total bytes and file counts safely, returning `StorageUsageInfo`.
  - `exportBackup(targetZipPath)`:
    - Creates a consistent SQLite database snapshot using SQLite's native online backup API (`await db.backup(tempDbPath)`), preventing corruption or copying half-written WAL files.
    - Inspects current schema version from `schema_migrations` table.
    - Scans all files in `library/`, computing SHA-256 integrity checksums for each file.
    - Generates `manifest.json` containing `format_version: 1`, `schema_version`, `app_version`, `created_at`, `total_files`, and `files` array.
    - Packages `manifest.json`, `campusdeck.db`, and all managed files into a user-selected ZIP archive.
  - `restoreBackup(archivePath, onDatabaseReopened)`:
    - Stage 1 — Validation: Inspects ZIP entries, rejects corrupt/malformed archives, strictly validates that no entries contain path traversal sequences (`../`, absolute paths, drive letters).
    - Stage 2 — Manifest & Schema Check: Verifies presence of `manifest.json` and `campusdeck.db`, verifies manifest schema version against current database migrations.
    - Stage 3 — Staged Extraction: Extracts into an isolated timestamped staging directory (`<appDataDir>/staging_restore_<timestamp>/`). Computes SHA-256 for all extracted files and verifies match against manifest.
    - Stage 4 — Safe Atomic Swap & Rollback:
      - Closes existing database connection (`closeDatabase()`).
      - Moves existing `campusdeck.db` (plus WAL/SHM) and `library/` into a backup rollback directory (`<appDataDir>/pre_restore_rollback_<timestamp>/`).
      - Moves staged database and library into place.
      - If any step fails, automatically triggers rollback restoring the previous database and library.
      - Reopens database via `openDatabase()` and invokes `onDatabaseReopened(newDb)`.
      - Cleans up staging and rollback temporary directories upon success.
- `src/main/ipc/index.ts`:
  - Wrapped all repositories in ES6 dynamic Proxy delegates (`subjectRepoProxy`, `taskRepoProxy`, etc.) so that active IPC handlers immediately delegate to the newly restored and reopened SQLite connection without requiring manual handler re-registration.
- `src/main/ipc/settings.ts`:
  - Handlers for `settings:get-storage-usage`, `settings:open-data-folder` (via `shell.openPath`), `backup:export` (via native `dialog.showSaveDialog`), and `backup:restore` (via native `dialog.showOpenDialog`).

### Shared Contracts & Preload
- `src/shared/types.ts`:
  - Added types: `StorageUsageInfo`, `BackupManifestFileEntry`, `BackupManifest`, `BackupExportResult`, `BackupRestoreResult`, `BackupValidationResult`.
- `src/preload/index.ts`:
  - Exposed `campusDeckAPI.settings.getStorageUsage()`, `campusDeckAPI.settings.openDataFolder()`, `campusDeckAPI.backup.export()`, and `campusDeckAPI.backup.restore()`.

### Renderer Layer
- `src/renderer/src/routes/SettingsPage.tsx`:
  - Appearance section: Theme cards for Light, Dark, and System with immediate live styling toggle and database persistence.
  - Application Information section: App version, data location paths (`Data Root`, `Database`, `File Vault`, `Backups Folder`), and "Open Data Folder" button.
  - Storage Utilization section: Disk usage cards for Database size, File Library size, Total Files, and Total Managed Storage, with a manual refresh button.
  - Backup & Disaster Recovery section:
    - "Export Backup (.zip)" button with progress states and export summary banner.
    - "Restore from Backup" flow with prominent Warning Confirmation Modal: alerts the user that restore replaces current application data, advises creating a backup first, requires explicit confirmation checkbox, and shows restore results.
- `src/renderer/src/App.tsx`:
  - Wired `currentTheme={theme}` and `onThemeChange={handleThemeChange}` to `SettingsPage`.

---

## Release Hardening & Packaging Stage (Complete)

### Security Hardening
- `src/main/index.ts`:
  - Enforced `setWindowOpenHandler(() => ({ action: 'deny' }))` blocking child windows, popups, and arbitrary external windows.
  - Enforced `will-navigate` listener denying any navigation away from the bundled app origin or files.
  - Retained strict CSP (`script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none';`).
  - Verified `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.

### Reliability & Production Migrations
- `src/main/db/connection.ts`:
  - Added embedded SQL migration strings as a bulletproof fallback if `.sql` files are separated from the executable directory during packaging.
  - Updated `resolveMigrationsDir()` to probe `out/main/migrations/`, `src/main/db/migrations/`, and `process.resourcesPath/migrations/`.
  - Package script builds and copies migrations into `out/main/migrations/`.
- `electron-builder.yml`:
  - Added `maintainer: CampusDeck Contributors <dev@campusdeck.local>`.
  - Added application icon configuration (`resources/icon.png`, `resources/icons/256x256.png`).
- `package.json`:
  - Added `author` email, `homepage` URL, and post-build migration copy script.
- `eslint.config.mjs`:
  - Converted ESLint configuration to Flat Config format with `@eslint/js` and `eslint-config-prettier`. Zero lint warnings/errors.

### Packaging Deliverables (Linux x86_64)
- `dist/CampusDeck-0.1.0.AppImage` (149 MB) — Standalone portable executable.
- `dist/campusdeck_0.1.0_amd64.deb` (94 MB) — Debian/Ubuntu package.
- `dist/linux-unpacked/` — Unpacked binary bundle verified with smoke run.

---

## v0.2.0 Foundation Phase (Complete)

### Database & Migrations
- `src/main/db/migrations/004_calendar_reminders_work_sessions.sql`: Added tables and indexes for `calendar_events`, `task_reminders`, and `work_sessions`.
- `src/main/db/connection.ts`: Registered migration 004 in embedded migration fallback and disk migration probe.
- `src/main/db/__tests__/migrations.test.ts` & `src/main/db/__tests__/stepwiseMigrations.test.ts`: Verified 4-step progressive migration and idempotency without data loss.

### Repositories
- `src/main/db/repositories/calendarEvents.ts`: Created repository with `create`, `getById`, `listAll`, `listByTask`, `listBetween` (interval overlap), `update`, `delete`.
- `src/main/db/repositories/taskReminders.ts`: Created repository with `create`, `getById`, `listByTask`, `listPending` (limit filter), `dismiss`, `update`, `delete`.
- `src/main/db/repositories/workSessions.ts`: Created repository with `create`, `getById`, `listByTask`, `listBetween` (interval overlap), `update`, `delete`.

### IPC Layer & Preload Surface
- `src/main/ipc/calendarEvents.ts`: 7 handlers for calendar event CRUD, range lookup, and task association.
- `src/main/ipc/taskReminders.ts`: 7 handlers for reminder creation, pending notifications, dismissals, and updates.
- `src/main/ipc/workSessions.ts`: 6 handlers for planned/recorded study sessions.
- `src/main/ipc/validation.ts`: Zod schemas for all scheduling inputs, ISO-8601 offset strings, status enums, and UUIDs.
- `src/main/ipc/index.ts`: Rebound repository proxies so dynamic SQLite reconnection (e.g. on backup restore) seamlessly routes to reopened instances.
- `src/preload/index.ts`: Exposed typed `campusDeckAPI.calendarEvents`, `taskReminders`, and `workSessions`.
- `src/shared/types.ts`: Added canonical interfaces for scheduling models, inputs, and statuses.

### Backup Service
- `src/main/services/backupService.ts`: Updated `CURRENT_MAX_SCHEMA_VERSION = 4` to recognize migration 004 archives.

---

## Next Stage: Phase 2 — File System & Document Workflow

**Status**: v0.2.0 Foundation Complete. 138 tests passing across 18 test files, typechecking clean.

**Upcoming in Phase 2**:
1. Drag and drop file upload support.
2. Direct document attachment during task creation flow.
3. Enhanced external file export/sharing actions.



