# CampusDeck — Current State (CURRENT_STATE.md)

> This file is updated at the start and completion of each development stage to reflect what exists,
> what is complete, what was verified, and what comes next.

---

## Snapshot Date: 2026-11-06

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
| Migrations | ✅ Complete | 3 versioned migrations (`001_initial.sql`, `002_subject_fields_and_categories.sql`, `003_task_attachment_roles.sql`) with `schema_migrations` tracking |
| Relational Schema | ✅ Complete | `subjects`, `tasks`, `documents`, `task_documents`, `subject_documents`, `settings` (key-value) |
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
| Subject Task Attachment Display | ✅ Complete | Attachment badges on task cards in subject task lists without duplicating task records |
| Document Import Flow | ✅ Complete | Native main-process dialog (with multi-select support), format & metadata validation, UUID-safe storage, transactional linking |
| Document Opening | ✅ Complete | Secure `shell.openPath` via verified document ID only (never raw path from renderer) |
| Non-Task Files Library | ✅ Complete | Subject Files tab and global All Files page with category tags, search, and delete |
| Deletion Safeguards | ✅ Complete | Subject deletion sets `tasks.subject_id = NULL` (preserves tasks per D-006) and safely cleans unreferenced files |
| Automated Tests | ✅ Complete | Vitest unit and service test suite (8 test suites, 51 tests passing) |

---

## Exact Test Results (Prompt 5 Verification)

Command run:
```bash
npm test
```

Vitest output:
```
 ✓ src/main/db/__tests__/tasks.test.ts (12 tests)
 ✓ src/main/db/__tests__/taskDocs.test.ts (8 tests)
 ✓ src/main/db/__tests__/documents.test.ts (6 tests)
 ✓ src/main/db/__tests__/subjects.test.ts (7 tests)
 ✓ src/main/db/__tests__/subjectDocs.test.ts (4 tests)
 ✓ src/main/db/__tests__/migrations.test.ts (4 tests)
 ✓ src/main/services/__tests__/fileLibrary.test.ts (6 tests)
 ✓ src/main/db/__tests__/settings.test.ts (4 tests)

 Test Files  8 passed (8)
      Tests  51 passed (51)
   Duration  5.01s
```

Exact test breakdown:
1. `taskDocs.test.ts` (8 tests):
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
- `src/preload/index.ts`: Exposed `window.campusDeskAPI.taskDocs` methods.

### Renderer & UI Layer
- `src/renderer/src/components/TaskAttachmentModal.tsx`: File upload modal supporting multi-file selection, role picker (`assignment_file`, `solution`, `reference`, `other`), solution variant label with quick suggestion chips, and custom display name.
- `src/renderer/src/components/TaskAttachmentEditModal.tsx`: Edit modal allowing inline renaming, role updates, and solution variant label changes.
- `src/renderer/src/routes/TaskDetailPage.tsx`: Comprehensive Task Attachments & Solutions section with filter tabs, file type badges, role badges, variant labels, missing file indicators, open, edit, unlink, and delete with safety confirmation dialogs.
- `src/renderer/src/components/TaskCard.tsx`: Displays attached file badges and variant labels on task cards without duplicating task records.
- `src/renderer/src/routes/SubjectDetailPage.tsx`: Loads task attachments for course tasks, displays attachment badges on task cards, and wires task click to open task detail view.
- `src/renderer/src/routes/TasksPage.tsx`: Loads task attachments and passes them to task cards.

---

## Next Stage: Prompt 6

**Goal**: Implement the Bundled Offline PDF Rendering Engine using PDF.js.

**Pre-conditions**:
- Task attachments (assignments, solutions, references) fully implemented and verified.
- 51 automated unit and service tests passing.
- Production build clean.

**Tasks for Prompt 6**:
1. Bundle offline PDF.js viewer into `resources/pdfjs/` without external CDN dependencies.
2. Register local secure protocol (`campusdesk://`) in the main process to serve PDF.js and stream document bytes safely.
3. Implement viewer window management with isolation (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`).
4. Wire in-app viewer to open when users click to view PDF attachments in `TaskDetailPage`, `SubjectDetailPage`, and `AllFilesPage`.
5. Add automated and manual verification for offline PDF rendering.
6. Update `CURRENT_STATE.md`.
