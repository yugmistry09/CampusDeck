# CampusDeck — Current State (CURRENT_STATE.md)

> This file is updated at the start and completion of each development stage to reflect what exists,
> what is complete, what was verified, and what comes next.

---

## Snapshot Date: 2026-11-03

---

## What Exists Right Now

| Component | State | Details |
|---|---|---|
| Repository & Environment | ✅ Complete | Node v22.23.4 (via fnm), npm v10.9.9, Git repository initialized on `main` branch |
| Desktop Runtime | ✅ Complete | Electron v33.2.0, electron-vite v2.3.0, TypeScript v5.6.3 (strict mode) |
| UI Framework & Styling | ✅ Complete | React 18, Tailwind CSS 3.4 (dark mode `class` strategy), Lucide Icons, responsive shell |
| Security Boundary | ✅ Complete | `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, restrictive CSP, `assertTrustedSender` window verification |
| Preload API | ✅ Complete | Narrow, typed `contextBridge` exposing `window.campusDeskAPI` (no raw `ipcRenderer` or SQL exposed) |
| Storage Location | ✅ Complete | Dedicated directory beneath `userData`: `<userData>/campusdesk_storage/` (db, library, backups) |
| Database Engine | ✅ Complete | SQLite via `better-sqlite3` in WAL mode, `foreign_keys = ON`, `synchronous = NORMAL` |
| Migrations | ✅ Complete | Explicit, versioned, ordered migration runner with `schema_migrations` tracking (`001_initial.sql`) |
| Relational Schema | ✅ Complete | `subjects`, `tasks`, `documents`, `task_documents`, `subject_documents`, `settings` (key-value) |
| Subject Management | ✅ Complete | Full CRUD with validation, code, semester, color picker, notes, stats, and delete confirmation |
| Subject Drill-down View | ✅ Complete | Detail view with Overview, Files tab with category filtering, and Tasks tab placeholder |
| Document Import Flow | ✅ Complete | Native main-process dialog, format & metadata validation, UUID-safe storage, transactional linking |
| Document Opening | ✅ Complete | Secure `shell.openPath` via verified document ID only (never raw path from renderer) |
| Non-Task Files Library | ✅ Complete | Subject Files tab and global All Files page with category tags, search, and delete |
| Deletion Safeguards | ✅ Complete | Subject deletion sets `tasks.subject_id = NULL` (preserves tasks per D-006) and safely cleans unreferenced files |
| Automated Tests | ✅ Complete | Vitest unit and service test suite (7 test suites, 39 tests passing) |

---

## Exact Test Results (Prompt 3 Verification)

Command run:
```bash
npm test
```

Vitest output:
```
 ✓ src/main/db/__tests__/tasks.test.ts (8 tests)
 ✓ src/main/db/__tests__/documents.test.ts (6 tests)
 ✓ src/main/db/__tests__/subjects.test.ts (7 tests)
 ✓ src/main/db/__tests__/subjectDocs.test.ts (4 tests)
 ✓ src/main/db/__tests__/migrations.test.ts (4 tests)
 ✓ src/main/services/__tests__/fileLibrary.test.ts (6 tests)
 ✓ src/main/db/__tests__/settings.test.ts (4 tests)

 Test Files  7 passed (7)
      Tests  39 passed (39)
   Duration  3.25s
```

Exact test breakdown:
1. `migrations.test.ts` (4 tests):
   - Migrations 001 and 002 run sequentially, creating all tables and views.
   - Indexes and constraints verified.
   - Idempotency verified: re-running migrations does not fail.
   - Default settings seeded.
2. `subjects.test.ts` (7 tests):
   - Subject creation, retrieval, listing, and updates (including code, semester, color, notes).
   - Validation checks on non-empty name.
   - Foreign key behavior: deleting a subject sets `tasks.subject_id = NULL` (preserving tasks per D-006).
   - Foreign key behavior: deleting a subject cascades to `subject_documents` and cleans unreferenced files.
3. `tasks.test.ts` (8 tests):
   - Creation across all 7 types (`general`, `assignment`, `lab_manual`, `practical`, `project`, `exam_prep`, `other`).
   - Priority and status transitions.
   - Due date validation (`YYYY-MM-DD` or NULL).
   - Task archiving and isolation from active lists.
   - Completion calculations and local date-evaluated overdue queries.
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
7. `settings.test.ts` (4 tests):
   - Key-value get, set, getAll, and partial preferences upserts.

Typecheck verification:
```bash
npm run typecheck
```
Result: Clean exit (code 0) across `tsconfig.json` and `tsconfig.web.json`.

Build verification:
```bash
npm run build
```
Result: Clean production bundle created for main process (`out/main/index.js`), preload bridge (`out/preload/index.js`), and renderer assets (`out/renderer/`).

---

## Files Created & Modified in Prompt 3

### Database & Shared Contracts
- `src/main/db/migrations/002_subject_fields_and_categories.sql`: Migration adding `semester`, `notes` to `subjects` and updating `subject_documents` type constraints and view.
- `src/shared/types.ts`: Centralized TypeScript contracts for subjects, tasks, documents, subject docs, settings, and IPC communication.
- `src/main/db/repositories/subjects.ts`: Updated repository methods supporting `semester`, `notes`, `listWithStats`, `getByIdWithStats`, and safe transactional deletion with document cleanup.
- `src/main/db/repositories/subjectDocs.ts`: Enriched queries with full document and subject metadata joins, `listAll()`, and document cleanup.
- `src/main/services/fileLibrary.ts`: File import service with native dialog support, file type whitelist, traversal guards, and secure ID-based application launch.

### IPC & Preload
- `src/main/ipc/validation.ts`: Zod schemas for subject mutation, document imports, and document ID validation.
- `src/main/ipc/subjects.ts`: IPC handlers for subject CRUD and stats queries.
- `src/main/ipc/subjectDocs.ts`: IPC handlers for subject document listing, addition, and removal.
- `src/main/ipc/files.ts`: Native dialog trigger and document opening handlers.
- `src/preload/index.ts`: Exposing typed API methods (`subjects.*`, `subjectDocs.*`, `files.*`) on `window.campusDeskAPI`.

### Renderer & UI Layer
- `src/renderer/src/components/ConfirmModal.tsx`: Accessible modal for destructive action confirmations.
- `src/renderer/src/components/SubjectModal.tsx`: Subject create/edit modal with color picker, semester, code, and notes.
- `src/renderer/src/components/DocumentUploadModal.tsx`: Native upload trigger modal with category tags, title, and description.
- `src/renderer/src/routes/SubjectDetailPage.tsx`: Subject detail view with Overview, Files tab, and Tasks tab placeholder.
- `src/renderer/src/routes/SubjectsPage.tsx`: Grid/list of subjects with search, metrics, and create/edit/delete actions.
- `src/renderer/src/routes/AllFilesPage.tsx`: Global non-task files view with category filter pills, subject filter, and quick open actions.
- `src/renderer/src/routes/DashboardPage.tsx`: Wired to real subject count and quick action navigation.

---

## Next Stage: Prompt 4

**Goal**: Implement complete Task CRUD, unified to-do list, task attachments, and dashboard metrics.

**Pre-conditions**:
- Subject CRUD, drill-down, and non-task document storage fully operational and tested.
- File library service and path resolution verified.
- 39 automated unit and service tests passing.

**Tasks for Prompt 4**:
1. Implement Task Create/Edit modal with validation (type, title, description, priority, subject selection, due date).
2. Wire Tasks tab inside Subject Detail view to filter tasks specifically for that subject.
3. Build the unified Tasks page with status toggle (`todo`, `in_progress`, `completed`), priority badges, due date display with overdue warnings, and filter bar (by status, priority, subject, type).
4. Implement Task attachments for assignments and solutions via `task_documents` and `fileLibrary.ts`.
5. Implement Task deletion confirmation with physical file cleanup.
6. Connect Dashboard metrics (active tasks, overdue count, completion rate) dynamically to the database.
7. Run tests, verify build, and update `CURRENT_STATE.md`.
