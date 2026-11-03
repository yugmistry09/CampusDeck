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
| Subject Drill-down View | ✅ Complete | Detail view with Overview, Files tab with category filtering, and integrated Tasks tab |
| Task Model & CRUD | ✅ Complete | Single source of truth across all 7 types (`general`, `assignment`, `lab_manual`, `practical`, `project`, `exam_prep`, `other`), 3 statuses (`todo`, `in_progress`, `completed`), 3 priorities (`low`, `medium`, `high`), due date (`YYYY-MM-DD`), and archive state |
| Unified To-Do List | ✅ Complete | Unified tasks view with status tabs, subject & type dropdowns, due-date condition filters, search bar, and multi-criteria sorting |
| Local Overdue Calculation | ✅ Complete | Evaluated against local calendar date (`DATE('now', 'localtime')`); completed and archived tasks excluded |
| Real Dashboard Metrics | ✅ Complete | Open tasks, due soon (≤7d), overdue, completed, overall progress bar (D-008 formula), upcoming deadlines, and per-subject progress |
| Document Import Flow | ✅ Complete | Native main-process dialog, format & metadata validation, UUID-safe storage, transactional linking |
| Document Opening | ✅ Complete | Secure `shell.openPath` via verified document ID only (never raw path from renderer) |
| Non-Task Files Library | ✅ Complete | Subject Files tab and global All Files page with category tags, search, and delete |
| Deletion Safeguards | ✅ Complete | Subject deletion sets `tasks.subject_id = NULL` (preserves tasks per D-006) and safely cleans unreferenced files |
| Automated Tests | ✅ Complete | Vitest unit and service test suite (7 test suites, 43 tests passing) |

---

## Exact Test Results (Prompt 4 Verification)

Command run:
```bash
npm test
```

Vitest output:
```
 ✓ src/main/db/__tests__/tasks.test.ts (12 tests)
 ✓ src/main/db/__tests__/documents.test.ts (6 tests)
 ✓ src/main/db/__tests__/subjects.test.ts (7 tests)
 ✓ src/main/db/__tests__/subjectDocs.test.ts (4 tests)
 ✓ src/main/db/__tests__/migrations.test.ts (4 tests)
 ✓ src/main/services/__tests__/fileLibrary.test.ts (6 tests)
 ✓ src/main/db/__tests__/settings.test.ts (4 tests)

 Test Files  7 passed (7)
      Tests  43 passed (43)
   Duration  4.62s
```

Exact test breakdown:
1. `tasks.test.ts` (12 tests):
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
2. `subjects.test.ts` (7 tests):
   - Subject creation, retrieval, listing, and updates (including code, semester, color, notes).
   - Validation checks on non-empty name.
   - Foreign key behavior: deleting a subject sets `tasks.subject_id = NULL` (preserving tasks per D-006).
   - Foreign key behavior: deleting a subject cascades to `subject_documents` and cleans unreferenced files.
3. `documents.test.ts` (6 tests):
   - Document creation and unique path constraints.
   - Task document links and cascade behaviors.
   - View compatibility (`task_files`).
4. `subjectDocs.test.ts` (4 tests):
   - Document attachment with categories (`syllabus`, `marks`, `notice`, `reference`, `timetable`, `notes`, `other`).
   - Listing by subject and global listing across all subjects.
   - Unreferenced document cleanup upon deletion.
5. `fileLibrary.test.ts` (6 tests):
   - Supported academic formats validation (PDF, images, DOCX, PPTX, XLSX, TXT, MD, CSV).
   - Unsupported file rejection (EXE, script, binary).
   - Accurate MIME type resolution.
   - Preserving original files upon import and assigning UUID-prefixed relative paths.
   - Transactional import and document link creation.
   - Safe document opening error handling for non-existent document IDs.
6. `migrations.test.ts` (4 tests):
   - Migrations 001 and 002 run sequentially, creating all tables and views.
   - Indexes and constraints verified.
   - Idempotency verified: re-running migrations does not fail.
   - Default settings seeded.
7. `settings.test.ts` (4 tests):
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

## Files Created & Modified in Prompt 4

### Shared Contracts & Database
- `src/shared/types.ts`: Added `TaskWithSubject`, `DashboardStats`, and `type` option to `TaskListOptions`.
- `src/main/db/repositories/tasks.ts`: Added `getByIdWithSubject`, `getUpcomingDueSoon`, `getDashboardStats`, and `type` filtering in `list()`.
- `src/main/ipc/validation.ts`: Added `taskDueSoonSchema` and expanded `taskListSchema`.
- `src/main/ipc/tasks.ts`: Registered handlers for `task:get-with-subject`, `task:due-soon`, and `task:dashboard-stats`.
- `src/preload/index.ts`: Exposed `tasks.getWithSubject`, `tasks.dueSoon`, and `tasks.dashboardStats` on `window.campusDeskAPI`.
- `src/main/db/__tests__/tasks.test.ts`: Added 4 new tests for type filtering, due soon bounds, dashboard stats, and subject joins.

### Renderer & UI Layer
- `src/renderer/src/components/TaskModal.tsx`: Complete create/edit task modal supporting all 7 types, subject selector with academic type advisory notice, due date picker, priority selector, status, and description.
- `src/renderer/src/components/TaskCard.tsx`: Reusable task card with one-click status cycling (`todo` -> `in_progress` -> `completed` -> `todo`), priority badges, type badges, local overdue indicators, and quick action buttons.
- `src/renderer/src/routes/TaskDetailPage.tsx`: Comprehensive task view with full description, status transition buttons, timestamps, edit modal, archive confirmation, and delete confirmation.
- `src/renderer/src/routes/TasksPage.tsx`: Unified to-do list with status tabs (All, To Do, In Progress, Completed, Archived), dropdown filters for subject, type, and due-date condition, search input, and multi-field sorting.
- `src/renderer/src/routes/SubjectDetailPage.tsx`: Integrated Tasks tab for course-scoped task management with in-context task creation and live stats sync.
- `src/renderer/src/routes/DashboardPage.tsx`: Live dashboard with overall completion (D-008 formula), open coursework, due-soon tasks (≤7 days), overdue tasks, interactive upcoming deadlines list, and per-subject progress bars.
- `src/renderer/src/App.tsx`: Wired quick navigation callbacks from dashboard to tasks and subjects.

---

## Next Stage: Prompt 5

**Goal**: Implement Task file attachments (assignments & solutions) via `task_documents` and the bundled offline PDF viewer.

**Pre-conditions**:
- Task CRUD, unified to-do list, and Dashboard fully functional and verified.
- 43 automated unit and service tests passing.
- Production build clean.

**Tasks for Prompt 5**:
1. Implement task document attachments (`task_documents`): attach assignment reference PDFs and solution PDFs with optional variant labels (e.g., "Draft 1", "Final").
2. Integrate file import flow for tasks via `fileLibrary.ts` (copying to app-managed library with UUID prefixes, relative paths).
3. Bundle PDF.js offline viewer in `resources/pdfjs/` without external CDN dependencies.
4. Add protocol handler and window manager for secure offline PDF viewing.
5. Wire attachment display and launch inside `TaskDetailPage` and `TaskCard`.
6. Add unit and integration tests for task attachments and file lifecycle.
7. Update `CURRENT_STATE.md`.
