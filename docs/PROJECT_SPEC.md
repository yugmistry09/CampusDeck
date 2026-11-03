# CampusDeck — Project Specification (v0.1)

> **Stage**: Prompt 1 — Specification only. No product code exists.
> **Date**: 2026-10-29

---

## 1. Purpose

CampusDeck is a **local-first desktop application** for students to manage academic
tasks, subject documents, and files entirely on their own machine — with no server,
no cloud account, no analytics, and no network dependency of any kind.

---

## 2. Fixed Technology Stack

These choices are locked for all future stages and may not be changed without a formal
decision log entry (see DECISIONS.md).

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | **Electron** (latest stable) | Cross-platform desktop; ships its own Chromium + Node |
| Bundler / dev-server | **electron-vite** | HMR for renderer; fast main-process rebuild; TS-first |
| UI framework | **React 18+** | Component model; large ecosystem |
| Language | **TypeScript** (strict mode) | Type safety across all three Electron processes |
| Database | **SQLite** via `better-sqlite3` | Embedded, no server, single-file, ACID |
| File storage | Local filesystem (app userData) | Files copied into managed library; originals untouched |
| PDF viewing | **PDF.js** (bundled offline) | No external CDN; viewer served from `resources/` |
| IPC boundary | Electron `contextBridge` + typed channels | Security isolation between main and renderer |

---

## 3. Core UI Views

| View | Purpose |
|---|---|
| **Dashboard** | Overview: completion stats, upcoming due dates, recent activity |
| **Tasks** | Unified to-do list of all non-archived task records across all subjects |
| **Subjects** | Subject list; drill-down shows subject-level task list and documents |
| **All Files** | Flat list / search of every file stored in the managed library |
| **Settings** | App preferences: theme, backup schedule, library location display |

---

## 4. Functional Requirements

### 4.1 Unified Task Model

Every academic work item — **assignment, lab manual, practical, project, or general
item** — is represented by exactly one `Task` record. This guarantees:

- A task created inside a subject view appears automatically in the global Tasks view.
- There is no duplication between subject-level lists and the unified to-do list.
- Completion progress is computed from the same record set everywhere.

### 4.2 Task Fields

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (TEXT) | Stable, never reused |
| `subject_id` | FK → Subject (nullable) | NULL means no subject |
| `type` | ENUM TEXT | `assignment` `lab_manual` `practical` `project` `general` |
| `title` | TEXT NOT NULL | Short display name |
| `description` | TEXT | Markdown-friendly free text |
| `due_date` | TEXT (YYYY-MM-DD, nullable) | Evaluated against local calendar date |
| `priority` | ENUM TEXT | `low` `medium` `high` |
| `status` | ENUM TEXT | `pending` `in_progress` `submitted` `completed` |
| `is_archived` | INTEGER (0/1) | Archived tasks excluded from all progress calculations |
| `created_at` | TEXT (ISO 8601) | Set once at creation |
| `updated_at` | TEXT (ISO 8601) | Updated on every write |

### 4.3 Subject Documents

Subject-level documents (syllabuses, marks schemes, notices, timetables) are stored as
`SubjectDocument` records. They do **not** create Task records and do **not** appear in
the Tasks view. They appear only within the Subject drill-down view.

### 4.4 Task Files

A Task may have multiple associated files split into two roles:

| Role | Description |
|---|---|
| `assignment` | Assignment PDF, lab sheet, problem statement, reference material |
| `solution` | Solution, answer sheet, report, submission — with an optional variant label |

**File handling rules:**
1. When a file is added, it is **copied** into the managed library. The original is never
   moved or deleted.
2. The stored filename inside the library is a unique internal name (UUID-prefixed).
3. The value stored in the database is the **path relative to the library root**, not an
   absolute path.
4. The user-visible display name is stored separately as `display_name`.

### 4.5 Completion Metrics

```
overall_completion  = completed_non_archived_tasks / all_non_archived_tasks
subject_completion  = completed_non_archived_tasks_for_subject / all_non_archived_tasks_for_subject
```

- A task is "completed" when `status = 'completed'`.
- "Non-archived" means `is_archived = 0`.
- When the denominator is zero, completion = **0%** (never NaN or division-by-zero error).
- Due-date evaluation uses `DATE('now', 'localtime')` in SQLite queries.

### 4.6 Backup Strategy

- An automatic SQLite backup copy is written to `<userData>/backups/` on each app launch
  and on a configurable schedule (default: daily).
- Backup filenames include an ISO 8601 timestamp: `campusdesk_backup_2026-10-29T18-00-00.db`.
- The managed library files are **not** automatically backed up in V1 (this is documented
  as a known limitation and future feature).
- Restore is manual: user replaces `campusdesk.db` with a backup copy.

---

## 5. Acceptance Criteria

### AC-1: Task Unification
- [ ] Creating a task under any subject causes it to appear in the global Tasks view.
- [ ] Deleting a task from Tasks view deletes it from its subject view too.
- [ ] Archiving a task removes it from all completion calculations but keeps it visible in
      a filtered "archived" view.

### AC-2: Completion Calculation
- [ ] Overall completion reflects the correct ratio at all times.
- [ ] Subject completion is independent per subject.
- [ ] Completion is 0% when no non-archived tasks exist.
- [ ] Completion re-computes immediately after any status, archive, or delete change.

### AC-3: File Management
- [ ] Adding a file copies it; the original file is unchanged.
- [ ] The library stores files with UUID-prefixed unique names.
- [ ] The database stores relative paths, not absolute paths.
- [ ] Removing a file record from the database also deletes the copy from the library.
- [ ] A solution file may carry an optional variant label (e.g., "Draft 1", "Final").

### AC-4: PDF Viewing
- [ ] PDFs open in the bundled offline PDF.js viewer.
- [ ] No network request is made when opening a PDF.

### AC-5: Due Date Evaluation
- [ ] "Overdue" status is determined by comparing `due_date` to the **local calendar date**,
      not UTC.
- [ ] A task with no `due_date` is never shown as overdue.

### AC-6: Settings
- [ ] User can change theme (light/dark/system).
- [ ] User can view the current library path (read-only display in V1).
- [ ] Backup schedule is configurable (daily, weekly, on-launch-only).

---

## 6. Security Requirements

### 6.1 IPC Isolation (Required)
- The renderer process runs with `nodeIntegration: false` and `contextIsolation: true`.
- All Node.js / SQLite operations run in the main process.
- The preload script exposes only a typed, named API surface via `contextBridge`.
- No renderer code may access `require`, `fs`, `path`, or any Node built-in directly.

### 6.2 No Login / No Fake Security (V1)
- V1 is single-profile with no password prompt.
- **Documentation note**: A real password-protected vault requires encrypting both the
  SQLite database (e.g., SQLCipher) and the files in the library. A login screen that
  does not encrypt data provides no real security and is explicitly out of scope for V1.

### 6.3 Local Only
- The app must never open any network connection for core functionality.
- Update checking (if ever added) must be optional and explicitly user-initiated.

### 6.4 Content Security Policy
- The renderer's `webSecurity` stays enabled.
- A strict CSP is set in the BrowserWindow webPreferences.

---

## 7. Out-of-Scope Features (V1)

The following are explicitly **not** part of V1:

| Feature | Note |
|---|---|
| Server or backend | Local-only; no Express, no REST, no WebSocket |
| Cloud storage | No Dropbox, Google Drive, OneDrive, S3, or similar |
| Online account / login | No OAuth, no JWT, no user accounts |
| Analytics / telemetry | No tracking of any kind |
| Password-protected vault | Requires full encryption; documented as future work |
| Multi-profile support | Single profile in V1 |
| Sync between machines | Not supported in V1 |
| Mobile / web version | Desktop Electron only |
| Library file backup | Documented limitation; future feature |
| Auto-update | Not in V1 |

---

## 8. Data Locations (Summary)

| What | Where | Committed to Git? |
|---|---|---|
| Source code | `/home/yug/Files/CODES/CampusDeck/` | Yes |
| `node_modules` | `/home/yug/Files/CODES/CampusDeck/node_modules/` | No (gitignored) |
| SQLite database | `~/.config/CampusDeck/campusdesk.db` | No |
| File library | `~/.config/CampusDeck/library/` | No |
| Backups | `~/.config/CampusDeck/backups/` | No |
| Planning docs | `/home/yug/Files/CODES/CampusDeck/docs/` | Yes |
