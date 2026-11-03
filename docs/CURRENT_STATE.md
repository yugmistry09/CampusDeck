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
| Task Model | ✅ Complete | Single source of truth; 7 types (`general`, `assignment`, `lab_manual`, `practical`, `project`, `exam_prep`, `other`), 3 statuses (`todo`, `in_progress`, `completed`), 3 priorities (`low`, `medium`, `high`), `due_date` as `YYYY-MM-DD`, `archived_at` timestamp |
| File Storage Service | ✅ Complete | `fileLibrary.ts` service copies into managed library, preserves originals, assigns UUID prefixes, stores relative paths |
| Repositories | ✅ Complete | Transactional repositories with parameterized queries and Zod schema validation |
| Shell UI Views | ✅ Complete | Sidebar navigation, Header with theme toggle, and routable placeholder pages for Dashboard, Tasks, Subjects, All Files, and Settings |
| Automated Tests | ✅ Complete | Vitest unit and repository test suite (5 test suites, 28 tests passing) |

---

## Exact Test Results (Prompt 2 Verification)

Command run:
```bash
npm test
```

Vitest output:
```
 ✓ src/main/db/__tests__/subjects.test.ts (6 tests)
 ✓ src/main/db/__tests__/tasks.test.ts (8 tests)
 ✓ src/main/db/__tests__/documents.test.ts (6 tests)
 ✓ src/main/db/__tests__/migrations.test.ts (4 tests)
 ✓ src/main/db/__tests__/settings.test.ts (4 tests)

 Test Files  5 passed (5)
      Tests  28 passed (28)
```

Exact test breakdown:
1. `migrations.test.ts` (4 tests):
   - Initial migration runs and creates all 6 core tables (`schema_migrations`, `subjects`, `tasks`, `documents`, `task_documents`, `subject_documents`, `settings`) and 2 compatibility views (`task_files`, `subject_document_files`).
   - Indexes verified on subjects, tasks, documents, task_documents, and subject_documents.
   - Idempotency verified: re-running migrations does not fail and applies nothing new.
   - Default settings seeded: `theme: system`, `backup_schedule: daily`, `backup_retain: 30`.
2. `subjects.test.ts` (6 tests):
   - Subject creation and retrieval with UUID primary keys.
   - Non-empty name constraint check.
   - Case-insensitive ordered listing (`COLLATE NOCASE`).
   - Updating name, code, and color.
   - Foreign key behavior: deleting a subject sets `tasks.subject_id = NULL` (D-006 ON DELETE SET NULL).
   - Foreign key behavior: deleting a subject cascade-deletes `subject_documents`.
3. `tasks.test.ts` (8 tests):
   - Tasks creation across all 7 types (`general`, `assignment`, `lab_manual`, `practical`, `project`, `exam_prep`, `other`).
   - Constraint check rejecting invalid task types.
   - Status transitions (`todo` -> `in_progress` -> `completed`) and priority assignments (`low`, `medium`, `high`).
   - Due date validation enforcing `YYYY-MM-DD` or NULL.
   - Task archiving sets `is_archived = 1` and `archived_at` timestamp; excludes archived from default active list.
   - Completion formula calculation (`completed / total`, 0% when total is 0, never NaN).
   - Subject-scoped completion calculations.
   - Local date-evaluated overdue detection (`due_date < DATE('now', 'localtime')`).
4. `documents.test.ts` (6 tests):
   - Document creation with UUID and relative paths.
   - UNIQUE constraint enforcement on `relative_path`.
   - Linking documents to tasks via `task_documents` with role (`assignment` / `solution`) and optional `variant_label`.
   - Cascade deletion: deleting task removes `task_documents` while preserving document records.
   - `task_files` compatibility view returns combined fields.
   - Linking `subject_documents` to `documents` table.
5. `settings.test.ts` (4 tests):
   - Key-value get, set, and getAll.
   - Arbitrary key-value updates.
   - Structured `AppSettings` retrieval.
   - Partial preference updates.

Typecheck verification:
```bash
npm run typecheck
```
Result: Clean exit (code 0) across both Node (`tsconfig.json`) and Web (`tsconfig.web.json`) compilers.

Build verification:
```bash
npm run build
```
Result: Clean production bundle created in `out/main/index.js`, `out/preload/index.js`, and `out/renderer/` assets.

---

## Files Created & Modified in This Stage

### Database & Main Process
- `src/main/db/migrations/001_initial.sql`: Versioned SQLite migration defining all 6 tables and 2 views.
- `src/main/db/connection.ts`: Database connection singleton, WAL mode, foreign key enforcement, migration runner.
- `src/main/db/schema.ts`: Row types and database enums.
- `src/main/db/repositories/subjects.ts`: Subject repository.
- `src/main/db/repositories/tasks.ts`: Task repository with completion and overdue queries.
- `src/main/db/repositories/documents.ts`: Document and task_documents repository.
- `src/main/db/repositories/subjectDocs.ts`: Subject document repository.
- `src/main/db/repositories/settings.ts`: Key-value settings repository.
- `src/main/services/fileLibrary.ts`: File management service.
- `src/main/utils/paths.ts`: Path resolution under dedicated `<userData>/campusdesk_storage/`.
- `src/main/ipc/validation.ts`: Zod schemas and `assertTrustedSender` security check.
- `src/main/ipc/subjects.ts`, `tasks.ts`, `settings.ts`, `subjectDocs.ts`, `index.ts`: IPC handlers.
- `src/main/index.ts`: Electron application lifecycle, CSP session interceptor, BrowserWindow security configuration.
- `src/preload/index.ts`: Typed IPC bridge exposing `window.campusDeskAPI`.
- `src/shared/types.ts`: Shared domain and contract types across processes.

### Tests
- `src/main/db/__tests__/migrations.test.ts`
- `src/main/db/__tests__/subjects.test.ts`
- `src/main/db/__tests__/tasks.test.ts`
- `src/main/db/__tests__/documents.test.ts`
- `src/main/db/__tests__/settings.test.ts`
- `vitest.config.ts`: Vitest Node-environment configuration.

### Renderer & UI Shell
- `src/renderer/src/App.tsx`: Main application shell with theme state and navigation.
- `src/renderer/src/components/Sidebar.tsx`: Sidebar navigation with academic aesthetic and icons.
- `src/renderer/src/components/Header.tsx`: Page header and Light/Dark/System theme switcher.
- `src/renderer/src/routes/DashboardPage.tsx`: Dashboard overview with metric cards.
- `src/renderer/src/routes/TasksPage.tsx`: Unified to-do list placeholder with filter bar.
- `src/renderer/src/routes/SubjectsPage.tsx`: Subject cards overview placeholder.
- `src/renderer/src/routes/AllFilesPage.tsx`: Local file library view placeholder.
- `src/renderer/src/routes/SettingsPage.tsx`: Settings view showing persistent data directories and backup settings.
- `src/renderer/src/main.tsx` & `src/renderer/src/index.css`: React entry and Tailwind CSS layer.

### Documentation & Configuration
- `README.md`: Development instructions, prerequisites, and architecture overview.
- `docs/DATA_MODEL.md`: Updated with full v0.2 normalized schema documentation.
- `docs/CURRENT_STATE.md`: Updated with exact test results and stage milestone.
- `package.json` & `package-lock.json`: Dependencies pinned and lockfile committed.

---

## Next Stage: Prompt 3

**Goal**: Implement Task CRUD and Subject drill-down feature UI.

**Pre-conditions**:
- SQLite persistence layer complete and verified (28 tests passing).
- Preload API typed and operational.
- Shell UI routable.

**Tasks for Prompt 3**:
1. Implement Task Creation & Edit modal with form validation (type, subject, title, description, due date, priority).
2. Wire Task listing, status toggling (`todo` -> `in_progress` -> `completed`), and archiving actions directly to the SQLite IPC backend.
3. Build Subject drill-down view showing subject-specific tasks and non-task documents (syllabuses, notices).
4. Implement Task deletion confirmation ensuring physical file cleanup via `fileLibrary.ts`.
5. Update Dashboard metrics dynamically when tasks change.
6. Run integration tests and update `CURRENT_STATE.md`.
