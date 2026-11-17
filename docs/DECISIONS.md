# CampusDeck — Decision Log (DECISIONS.md)

> This file records every significant architectural or product decision made during the
> project. Each entry is append-only. Existing entries must not be edited retroactively —
> add an amendment entry instead.
>
> **Format**: `D-NNN | Date | Status | Decision | Rationale | Alternatives considered`

---

## D-001 | 2026-10-29 | STABLE
**Decision**: Use Electron as the desktop runtime.

**Rationale**: Electron bundles its own Chromium and Node.js, giving full cross-platform
desktop capability (Linux, macOS, Windows) without system dependencies. It allows using
standard web tooling (React, TypeScript, Vite) while having full filesystem and native
OS access in the main process.

**Alternatives considered**:
- Tauri: Smaller binary, but requires Rust toolchain and uses the system WebView, which
  varies across OS versions and Linux distributions. Higher setup complexity.
- NW.js: Less active ecosystem; poorer tooling integration.
- Native Qt/GTK app: Far higher implementation cost; no team familiarity.

---

## D-002 | 2026-10-29 | STABLE
**Decision**: Use `electron-vite` as the build system.

**Rationale**: `electron-vite` provides native HMR for the renderer, fast TypeScript
compilation for main and preload processes, and opinionated defaults that match the
Electron security model (separate tsconfigs per process). It is the de-facto standard
scaffolding for new Electron + Vite projects.

**Alternatives considered**:
- Webpack + `electron-webpack`: Older, slower, more configuration.
- Manual Vite config for each process: More flexibility but more boilerplate.

---

## D-003 | 2026-10-29 | STABLE
**Decision**: Use SQLite (via `better-sqlite3`) as the embedded database.

**Rationale**: SQLite is a single-file, serverless, ACID-compliant relational database.
`better-sqlite3` provides a synchronous Node.js binding that is safe to call from the
Electron main process without event-loop complexity. It is actively maintained and used
in production by many Electron apps.

**Alternatives considered**:
- LowDB / NeDB / localStorage: Document stores; lack relational integrity, foreign-key
  constraints, and SQL queries — critical for the normalized task/file model.
- `node-sqlite3` (async): Callback-based API adds complexity for no benefit in the
  main process, which is already event-loop-safe.
- IndexedDB (renderer-side): Violates the security model (renderer should not own data).

---

## D-004 | 2026-10-29 | STABLE
**Decision**: Files are copied into an app-managed library; originals are never modified.

**Rationale**: Users expect their original files to be untouched. A managed library
with UUID-prefixed unique names avoids filename collisions, makes backups predictable,
and decouples the app from the user's filesystem layout.

**Alternatives considered**:
- Store absolute paths to original files: Breaks when files are moved or drives
  unmounted. Fragile for any file-management feature.
- Move originals into the library: Destructive; unacceptable risk of data loss.

---

## D-005 | 2026-10-29 | STABLE
**Decision**: Database stores file paths relative to the library root, not absolute paths.

**Rationale**: Absolute paths break portability. If `userData` moves (e.g., OS reinstall,
home directory relocation), only the library root constant needs updating — not every
file record. Relative paths also make backup/restore simpler.

**Alternatives considered**:
- Store absolute paths: Simple to implement; unportable.
- Store only UUIDs and reconstruct the path entirely: Requires knowing the extension,
  which must be stored anyway; no clear advantage.

---

## D-006 | 2026-10-29 | STABLE
**Decision**: Subject deletion sets `tasks.subject_id = NULL` rather than cascade-deleting tasks.

**Rationale**: Tasks (assignments, practicals, etc.) represent real academic work.
Deleting a subject (e.g., dropping a course) should not silently destroy all the student's
task records. The tasks become "unsubject" (subject_id = NULL) and remain visible and
actionable in the global Tasks view.

**Alternatives considered**:
- Cascade delete all tasks: Simpler schema; catastrophic data loss if user accidentally
  deletes a subject.
- Prevent subject deletion if tasks exist: User-hostile; no clear path to cleanup.

---

## D-007 | 2026-10-29 | STABLE
**Decision**: SubjectDocument deletion cascade-deletes its file records and physical files.

**Rationale**: Unlike tasks, subject documents (syllabuses, notices) are purely reference
material. If the document record is deleted, its files have no further use. Cascade is
appropriate here.

**Alternatives considered**:
- SET NULL on files: Files would become orphaned with no parent.
- Leave files and let user clean up: Creates orphaned library entries.

---

## D-008 | 2026-10-29 | STABLE
**Decision**: Completion is defined as `completed_non_archived / all_non_archived`, returning 0% when denominator is zero.

**Rationale**: Archived tasks are excluded so that archiving old work does not inflate
completion percentage. A denominator of zero (no active tasks) returns 0% rather than
100% to avoid a misleading "fully done" state when there is nothing to do yet.

**Alternatives considered**:
- Include archived: Archiving would change completion; confusing.
- Return 100% when denominator is zero: "No tasks = perfect" is semantically wrong.
- Return N/A: Requires UI special-casing; simpler to just show 0%.

---

## D-009 | 2026-10-29 | STABLE
**Decision**: Due dates stored as `YYYY-MM-DD` text; overdue comparison uses `DATE('now', 'localtime')`.

**Rationale**: ISO 8601 date strings sort and compare correctly as plain text in SQLite.
Using `'localtime'` modifier ensures overdue detection respects the user's actual
calendar day, not UTC — important for users in non-UTC timezones (e.g., IST = UTC+5:30).

**Alternatives considered**:
- Unix timestamps: Timezone conversion complexity at every read/write.
- JavaScript Date comparison: Requires pulling all records into memory for filtering.

---

## D-010 | 2026-10-29 | STABLE
**Decision**: V1 has no login screen or password protection.

**Rationale**: A login screen without encryption is security theater. CampusDeck V1 is a
single-profile, local-only app. Adding a fake password would give users a false sense of
security. The documentation explicitly states that a real vault requires both database
encryption (SQLCipher) and file encryption.

**Alternatives considered**:
- Simple PIN/password (no encryption): Rejected — provides no real security.
- Full SQLCipher encryption from day one: Significantly increases implementation scope,
  key management complexity, and recovery risk. Deferred to future version.

---

## D-011 | 2026-10-29 | STABLE
**Decision**: PDF viewer is bundled offline via PDF.js; no CDN or network fetch.

**Rationale**: CampusDeck is explicitly local-only. Depending on a CDN for the viewer
would add a network requirement that breaks offline use and violates the product
philosophy.

**Alternatives considered**:
- OS-default PDF viewer (shell.openPath): Loses in-app experience; no control over
  viewer appearance; cannot enforce the no-network constraint.
- Electron's built-in PDF plugin: Deprecated and unreliable across platforms.

---

## D-012 | 2026-10-29 | STABLE
**Decision**: `contextBridge` + typed IPC channels are the sole renderer↔main communication mechanism.

**Rationale**: `nodeIntegration: false` and `contextIsolation: true` are the current
Electron security best practices. `contextBridge` enforces a strict, auditable API
surface — any capability exposed to the renderer is explicitly listed in one file
(`preload/index.ts`).

**Alternatives considered**:
- `nodeIntegration: true`: Gives renderer full Node access; fundamentally insecure.
- Remote module: Deprecated since Electron 14; not available.

---

## D-013 | 2026-10-29 | STABLE
**Decision**: Node.js is installed user-locally via `fnm` (no system packages, no sudo).

**Rationale**: The target machine (Linux Mint 22.3) has no Node.js. System package
managers require sudo and install globally. `fnm` installs to `~/.local/share/fnm/`,
requires only `curl`, and supports `.node-version` for project-pinned versions.

**Alternatives considered**:
- `apt install nodejs`: Requires sudo; installs outdated version from distro repos.
- `nvm`: Also user-local; valid alternative. `fnm` is faster and Rust-based.
- Dev Container (Docker): Docker not present; would require additional install.

---

## D-014 | 2026-11-17 | STABLE
**Decision**: Use a tripartite scheduling model (`calendar_events`, `task_reminders`, `work_sessions`) separate from `tasks.due_date`.

**Rationale**: A task due date is an academic deadline milestone (`YYYY-MM-DD`). A calendar event represents a scheduled occurrence on a calendar (such as a lecture, exam, or deadline reminder, with optional task association). A task reminder represents an alert trigger timestamp (`remind_at`). A work session represents a focused block of time spent working on a task (`start_at` to `end_at`). Conflating these into the `tasks` table would limit each task to a single scheduled block or reminder, violate normalization, and prevent independent calendar entries that do not represent coursework tasks.

**Alternatives considered**:
- Store scheduling arrays or JSON columns in `tasks`: Violates relational normalization and impairs index performance.
- Use a single generic "events" table for everything: Conflates fundamentally different lifecycle rules (reminders need dismissal, sessions need status, calendar events can exist without a task).

---

## D-015 | 2026-11-17 | STABLE
**Decision**: Calendar events survive task deletion (`ON DELETE SET NULL`), while task reminders and work sessions cascade-delete (`ON DELETE CASCADE`).

**Rationale**: Calendar events represent real-world scheduled occurrences or calendar blocks that the user may want to retain on their schedule even if an academic task item is removed. Conversely, a task reminder or work session has no semantic meaning without its parent task; leaving them orphaned would pollute notification and session lists.

**Alternatives considered**:
- CASCADE delete calendar events: Destructive; removes calendar records unexpectedly.
- Prevent task deletion if calendar events or sessions exist: User-hostile.

---

## D-016 | 2026-11-17 | STABLE
**Decision**: Maintain dual native module ABI targets for `better-sqlite3` (Node ABI 127 for Vitest, Electron ABI 130 for packaged app/dev).

**Rationale**: Electron 33 uses Node ABI 130 whereas the host Node.js LTS (v22.23.4) uses Node ABI 127. Vitest executes in a pure Node environment for fast, isolated test execution, which requires `better-sqlite3` compiled for ABI 127. Electron packaging uses `npm run rebuild-electron` (`electron-rebuild -f -w better-sqlite3`) to compile for ABI 130. Distinguishing these runtime ABIs prevents destabilizing application architecture to bypass native module constraints.

**Alternatives considered**:
- Run all tests inside Electron runner: Drastically slows down test execution; complicates CI.
- Switch to pure JavaScript SQLite (e.g. sql.js / wasm): Significant performance regression and lack of native `.backup()` API.

---

## Decisions That Must Remain Stable Across All Future Stages

The following decisions are **load-bearing** — changing them would require rewriting
significant portions of the app or documentation:

| Decision | Why it must be stable |
|---|---|
| D-001 Electron runtime | Entire main/preload/renderer structure depends on it |
| D-003 SQLite + better-sqlite3 | All queries, migrations, schema depend on it |
| D-004 Copy-into-library file model | File naming, relative paths, backup all depend on it |
| D-005 Relative paths in DB | Every file open and delete depends on this convention |
| D-006 Subject → Task: SET NULL on delete | Data preservation guarantee to users |
| D-008 Completion formula | Dashboard, Subject view, reports all use this formula |
| D-009 YYYY-MM-DD + localtime | Due date display and overdue detection everywhere |
| D-010 No fake login | User-trust promise; must not be reversed without real encryption |
| D-012 contextBridge IPC | Security model; determines what renderer can ever access |
| D-014 Tripartite scheduling | Distinguishes task due date, calendar occurrences, reminders, and work blocks |
| D-015 Scheduling deletion semantics | Preserves calendar events on task deletion while cascading reminders/sessions |
| D-016 Dual ABI strategy | Keeps Vitest tests fast in Node ABI 127 and Electron runtime stable in ABI 130 |
