# CampusDeck — Test Plan (v1.0 — Release Hardening Complete)

> **Stage**: Release Hardening & Verification — 14 Test Suites, 103 Tests Passing (100% Green)
> **Date**: 2026-11-12

---

## 1. Test Strategy

CampusDeck uses a three-tier test approach:

| Tier | Tool | What it covers | When run |
|---|---|---|---|
| **Unit** | Vitest | Pure functions, DB queries, file service logic | On every file save (watch mode) / CI |
| **Integration** | Vitest + in-memory SQLite | IPC handler → DB layer end-to-end | Pre-commit / CI |
| **E2E** | Playwright + `@playwright/test` + Electron driver | Full UI flows in the running app | Pre-release / CI |

---

## 2. Test File Locations

```
src/
├── main/
│   ├── db/queries/__tests__/        ← Unit: SQL query functions
│   ├── services/__tests__/          ← Unit: fileLibrary, backup, pdfViewer
│   └── ipc/__tests__/              ← Integration: IPC handlers with real DB
└── renderer/
    └── components/__tests__/        ← Unit: React components (Vitest + jsdom)

tests/
└── e2e/                            ← E2E: Playwright scenarios
    ├── tasks.spec.ts
    ├── subjects.spec.ts
    ├── files.spec.ts
    ├── completion.spec.ts
    └── settings.spec.ts
```

---

## 3. Unit Tests — DB Query Layer

All tests in this section use an **in-memory SQLite database** populated by the
migration runner before each test suite.

### 3.1 Task Queries

| Test | Assertion |
|---|---|
| `createTask` with all fields | Row exists with correct values |
| `createTask` with no `due_date` | `due_date` is NULL |
| `listTasks()` | Returns all non-archived tasks |
| `listTasks({ subjectId })` | Returns only tasks for that subject |
| `listTasks({ includeArchived: true })` | Returns archived + non-archived |
| `updateTask` changes `status` | Row reflects new status; `updated_at` changes |
| `archiveTask(id, true)` | `is_archived = 1` |
| `deleteTask(id)` | Row removed; associated `task_files` rows removed (CASCADE) |
| `getOverdueTasks()` | Returns tasks where `due_date < DATE('now','localtime')` |
| `getOverdueTasks()` with future date | Returns empty array |
| `getCompletion()` | Returns correct ratio |
| `getCompletion()` with zero tasks | Returns `{ ratio: 0, total: 0, completed: 0 }` |
| `getCompletion({ subjectId })` | Returns subject-scoped ratio |

### 3.2 Subject Queries

| Test | Assertion |
|---|---|
| `createSubject` | Row created with correct fields |
| `deleteSubject(id)` | Subject row removed; tasks' `subject_id` set to NULL |
| `deleteSubject(id)` | Subject documents cascade-deleted |
| `listSubjects()` | Returns all subjects sorted by name |

### 3.3 File Library (Unit)

Tests mock the filesystem using a temp directory (no real `userData`).

| Test | Assertion |
|---|---|
| `importFile(sourcePath, ...)` | File copied to library with UUID prefix |
| `importFile` | Original file is still present at `sourcePath` |
| `importFile` | `relative_path` is relative, not absolute |
| `deleteFile(relativePath)` | Physical file removed from library |
| `deleteFile` on missing path | Does not throw; logs warning |
| Two imports of same filename | Produce different `relative_path` values (UUID) |

### 3.4 Domain Calculations & Business Logic (`domainCalculations.test.ts`)

| Test | Assertion |
|---|---|
| `getCompletion` rounding | `Math.round((completed / total) * 100)` correctly rounds non-integer values (e.g. 1/3 = 33%) |
| `getCompletion` excludes archived | Archived tasks are excluded from both numerator and denominator |
| `getCompletion` zero tasks | Returns `{ total: 0, completed: 0, percentage: 0 }` without NaN |
| `getCompletion` subject scoped | Computes completion accurately per subject ID |
| `getOverdueTasks` past due | Returns tasks where `due_date < local_today` and status != 'completed' |
| `getOverdueTasks` today | Tasks due today are NOT overdue |
| `getOverdueTasks` future | Tasks due in future are NOT overdue |
| `getOverdueTasks` completed | Completed tasks with past due date are NOT overdue |
| `getOverdueTasks` archived | Archived tasks with past due date are NOT overdue |
| `getDueSoonTasks` window | Tasks with `due_date` within next 7 days returned, completed excluded |
| `getDashboardStats` | Aggregates open, due soon, overdue, completed, and overall percentage consistently |

### 3.5 Stepwise Database Migrations & Embedded Fallback (`stepwiseMigrations.test.ts`)

| Test | Assertion |
|---|---|
| Progressive migration 001 → 002 → 003 | Migrates schema stepwise, preserves all data across steps, updates `schema_migrations` table |
| Embedded migration fallback | Executes embedded SQL strings when disk migration directory is missing/inaccessible |

### 3.6 File Library Error Handling & Security Invariants (`fileLibraryErrors.test.ts`)

| Test | Assertion |
|---|---|
| Import non-existent file | Fails gracefully and rejects with descriptive error without creating orphan DB records |
| Import unsupported/executable file | Rejects extensions outside whitelist (e.g., `.exe`, `.sh`) |
| Path traversal protection | Strips directory traversal sequences (`../../`) and prevents writing outside library root |
| Unlink document safety | Unlinking task document does not delete disk file when referenced by other tasks/subjects |
| Concurrent file imports | Safely imports multiple files concurrently without race conditions or filename collisions |

---

## 4. Integration Tests — IPC Handlers

Integration tests call IPC handler functions directly (bypassing the IPC transport)
with a real SQLite database in a temp directory. They verify the full handler → DB →
file system chain.

| Test | Assertion |
|---|---|
| `handleTaskCreate` + `handleTaskList` | Created task appears in list |
| `handleFileImport` + `handleTaskDelete` | File physically deleted after task delete |
| `handleSubjectDelete` | Tasks for subject have `subject_id = NULL`; docs deleted |
| `handleTaskArchive(true)` then `handleCompletion` | Archived task excluded from ratio |
| `handleTaskUpdate` changes `status` to `completed` | Completion ratio increases |
| `handleSettingsGet` | Returns default settings on first run |
| `handleSettingsSet` | Persisted across re-read |

### 4.2 IPC Validation & Origin Security (`validation.test.ts`)

| Test | Assertion |
|---|---|
| UUID format validation | Validates canonical v4 UUIDs, rejects invalid or malformed strings |
| Date format validation | Validates `YYYY-MM-DD` ISO calendar dates, rejects invalid dates and times |
| Hex color validation | Validates `#RRGGBB` format, rejects invalid hex formats |
| Subject payload validation | Requires valid name, clamps semester range (1-12), trims strings |
| Task payload validation | Requires subject for assignment-like types, enforces status and priority enums |
| Settings payload validation | Enforces theme enums (`light`, `dark`, `system`), rejects unauthorized keys |
| `assertTrustedSender` | Verifies IPC `sender` belongs to a registered `BrowserWindow` WebContents |

---

## 5. Unit Tests — React Components

Use Vitest + `@testing-library/react` + jsdom. These tests mock `window.campusDeckAPI`.

| Component | Test |
|---|---|
| `CompletionBar` | Renders correct percentage; shows "0%" when `total = 0` |
| `TaskCard` | Displays `due_date` in human-readable format |
| `TaskCard` | Shows "Overdue" badge when due_date is in the past |
| `TaskCard` | Shows no "Overdue" badge when `due_date` is null |
| `TaskStatusSelect` | Calls `onStatusChange` with new value on selection |
| `SubjectListItem` | Displays subject name and completion percentage |

---

## 6. E2E Tests — Playwright

These tests launch the full Electron application against a fresh temp userData directory.

### 6.1 Task Lifecycle

```
Scenario: Create and complete a task
  Given the app is open and Tasks view is active
  When I click "New Task"
    And I fill in title "Lab 4 Report", type "lab_manual", subject "CS201",
        due date "2026-11-15", priority "high"
    And I click "Save"
  Then the task "Lab 4 Report" appears in the Tasks list
  When I change status to "Completed"
  Then overall completion increases by 1
```

```
Scenario: Archive a task removes it from completion denominator
  Given one task exists with status "pending"
  When I archive the task
  Then completion = 0% (denominator = 0)
  And the task is visible in the "Archived" filter
```

### 6.2 Subject Workflow

```
Scenario: Delete subject preserves tasks
  Given subject "Physics" has two tasks
  When I delete subject "Physics"
  Then both tasks are still visible in Tasks view
  And their subject column shows "—" (unassigned)
```

### 6.3 File Management

```
Scenario: Import a file preserves the original
  Given a test PDF exists at /tmp/test.pdf
  When I attach it to a task as "assignment"
  Then /tmp/test.pdf still exists
  And the file appears in the task's file list
  And "All Files" view shows the file
```

```
Scenario: Delete task deletes its files from library
  Given a task with one attached PDF
  When I delete the task
  Then the PDF is no longer present in ~/.config/CampusDeck/library/
```

### 6.4 PDF Viewer

```gherkin
Scenario: Open a PDF offline in-app
  Given a task with an attached assignment PDF
  And the system has no network connection (connect-src 'none' enforced)
  When I click "View" on the PDF attachment item
  Then the in-app PDF viewer opens within the task detail view
  And the canvas renders the first page using the locally bundled PDF.js worker
  And no network request is made

Scenario: Navigate pages and jump to page
  Given a multi-page PDF document is open in the viewer
  When I click the Next Page button
  Then the viewer advances to Page 2 of N
  When I type "5" into the page input and press Enter
  Then the viewer advances directly to Page 5 of N
  And previous render tasks are cancelled gracefully without UI freeze

Scenario: Zoom and Fit-to-Width
  Given a PDF is displayed in the viewer
  When I click the Zoom In button (+)
  Then the zoom scale increases and canvas re-renders with sharp high-DPI resolution
  When I click the Zoom Out button (-)
  Then the scale decreases accordingly
  When I click "Fit Width"
  Then the PDF page scales dynamically to fit the width of the viewer viewport

Scenario: Switch between Assignment and Solution Variants
  Given a task with an assignment PDF and two solution variant PDFs ("Variant A", "Variant B")
  When I open the viewer from the assignment file
  Then the attached selector displays all 3 files with their variant tags
  When I select "Variant A" from the Attached dropdown
  Then the viewer switches to Variant A, resetting to Page 1 without reloading the page

Scenario: Non-PDF files open with default application
  Given a non-PDF file attached to a task (e.g. .docx or .txt)
  When viewing the attachment item in the task detail
  Then a clearly labelled "Open with default app" button is visible
  When clicked, the main process launches the system default application via shell.openPath

Scenario: Missing file handling
  Given a PDF file record exists in the database but its physical file was removed
  When I click to view the PDF
  Then an error banner informs the user that the file is missing from vault storage
  And a "Back to Task" button returns the user safely to the task detail
```

### 6.5 Completion

```
Scenario: Zero tasks shows 0%
  Given no tasks exist
  Then Dashboard shows "0%"
  And no NaN or division error appears in the renderer console
```

### 6.6 Due Date / Overdue

```
Scenario: Overdue detection uses local date
  Given a task with due_date = yesterday (local date)
  Then the task shows an "Overdue" indicator
  Given a task with due_date = today (local date)
  Then the task does NOT show "Overdue"
```

### 6.7 Settings & Appearance

```
Scenario: Switch theme preference
  Given the application is open on the Settings page
  When I select the "Dark" theme option
  Then the 'dark' CSS class is immediately applied to documentElement
  And the setting is persisted in the database
  When I reload or restart the application
  Then the dark theme is restored automatically
```

### 6.8 Storage Usage & Data Folder

```
Scenario: Storage metrics display and Open Data Folder
  Given the application has tasks and imported documents
  When I open the Settings page
  Then the Storage Utilization section shows accurate sizes for DB, Library, and File count
  When I click "Open Data Folder"
  Then the operating system launches the native file manager showing campusdeck_storage
```

### 6.9 Full Manual Backup & Safe Atomic Restore

```
Scenario: Export full backup ZIP
  Given an active database with subjects, tasks, and files
  When I click "Export Backup (.zip)" in Settings
  And choose a save destination in the native file dialog
  Then a valid ZIP file is created
  And the ZIP contains campusdeck.db, library/*, and manifest.json with SHA-256 hashes

Scenario: Restore from backup with confirmation warning
  Given an existing backup ZIP file
  When I click "Restore from Backup"
  And select the ZIP file
  Then a prominent Warning Modal opens warning that current data will be replaced
  And the Restore button remains disabled until I check the confirmation checkbox
  When I check the box and confirm Restore
  Then the backup is staged, hashes and schema verified, files swapped, and app refreshed
  And all subjects, tasks, and attachments match the restored backup
```

---

## 7. Acceptance Criteria Tests (mapped from PROJECT_SPEC)

| Acceptance Criterion | Covered by |
|---|---|
| AC-1: Task Unification | E2E 6.1; Integration §4 row 1 |
| AC-2: Completion Calculation | Unit §3.1 completion tests; E2E 6.5 |
| AC-3: File Management | Unit §3.3; Integration §4 rows 2, 4; E2E 6.3 |
| AC-4: PDF Viewing | E2E 6.4 |
| AC-5: Due Date Evaluation | Unit §3.1 overdue tests; E2E 6.6 |
| AC-6: Settings | Integration §4 last 2 rows; E2E (settings view — Prompt 3+) |

---

## 8. Security Test Checklist

These checks are verified for every release:

- [x] Renderer DevTools: `window.require` is undefined (`nodeIntegration: false`, `sandbox: true`).
- [x] Renderer DevTools: `window.campusDeckAPI` exposes only the named methods via `contextBridge`; no raw Node APIs or filesystem objects.
- [x] Opening a PDF: Zero external network requests made; 100% offline local PDF worker; `connect-src 'none'` enforced.
- [x] Navigation & Window Open Denial: `setWindowOpenHandler` denies all popups; `will-navigate` blocks all external navigations.
- [x] Storage Boundary: All writes strictly sandboxed inside `<userData>/campusdeck_storage/`; path traversal attacks rejected.
- [x] CSP header enforced on `BrowserWindow`: `default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none';`.

---

## 9. Verification Commands

```bash
# Code Quality & Static Analysis
npm run lint               # eslint --max-warnings 0
npm run typecheck          # tsc --noEmit

# Unit & Integration Test Suites
npm test                   # vitest run (14 suites, 103 tests)

# Production Packaging (Linux x86_64)
npm run build              # electron-vite build & copy migrations
npm run package            # electron-builder --linux (AppImage & deb)
```
