# CampusDeck — Data Model (v0.2.0)

> **Stage**: v0.2.0 Foundation — SQLite Persistence & Scheduling Foundation.
> **Date**: 2026-11-17

---

## 1. Entity Overview

```
subjects (0..1) ────< tasks (1) ────< task_documents >──── (1) documents
   │                     │                 │
   │                     │              role: 'assignment_file' | 'solution' | 'reference' | 'other' | 'assignment'
   │                     │              variant_label: optional
   │                     │
   │                     ├───< calendar_events (0..*)      [task_id nullable, ON DELETE SET NULL]
   │                     ├───< task_reminders (0..*)       [task_id required, ON DELETE CASCADE]
   │                     └───< work_sessions (0..*)        [task_id required, ON DELETE CASCADE]
   │
   └────< subject_documents (0..*) >──── (0..1) documents
             (syllabuses, notices, etc.)

settings (key-value store, app-wide preferences)
```

---

## 2. Table Definitions

### 2.1 `subjects`

Represents an academic course or module.

```sql
CREATE TABLE subjects (
    id         TEXT PRIMARY KEY CHECK(length(id) = 36),  -- UUID v4
    name       TEXT NOT NULL CHECK(trim(name) != ''),
    code       TEXT,                                     -- "CS201" (optional)
    semester   TEXT,                                     -- "Spring 2026" (optional)
    color      TEXT,                                     -- Hex color "#4F46E5" (optional)
    notes      TEXT NOT NULL DEFAULT '',                 -- Subject overview notes / syllabus description
    created_at TEXT NOT NULL,                            -- ISO 8601
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_subjects_name ON subjects(name COLLATE NOCASE);
```

**Delete behavior**: Deleting a subject sets `tasks.subject_id = NULL` for all its tasks
(`ON DELETE SET NULL`, D-006). All `subject_documents` for the subject are cascade-deleted,
and any unreferenced physical documents are safely removed from the library root.

---

### 2.2 `tasks`

Central entity and single source of truth for all coursework and to-do items.

```sql
CREATE TABLE tasks (
    id          TEXT PRIMARY KEY CHECK(length(id) = 36),  -- UUID v4
    subject_id  TEXT REFERENCES subjects(id) ON DELETE SET NULL,
    type        TEXT NOT NULL CHECK(type IN (
                    'general', 'assignment', 'lab_manual', 'practical',
                    'project', 'exam_prep', 'other'
                )),
    title       TEXT NOT NULL CHECK(trim(title) != ''),
    description TEXT NOT NULL DEFAULT '',
    due_date    TEXT CHECK(                               -- YYYY-MM-DD or NULL
                    due_date IS NULL OR
                    (due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
                ),
    priority    TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
    status      TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'completed')),
    is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0, 1)),
    archived_at TEXT,                                     -- ISO 8601 timestamp when archived
    created_at  TEXT NOT NULL,                            -- ISO 8601
    updated_at  TEXT NOT NULL
);

CREATE INDEX idx_tasks_subject_id  ON tasks(subject_id);
CREATE INDEX idx_tasks_status      ON tasks(status);
CREATE INDEX idx_tasks_due_date    ON tasks(due_date);
CREATE INDEX idx_tasks_is_archived ON tasks(is_archived);
CREATE INDEX idx_tasks_priority    ON tasks(priority);
```

**Delete behavior**: Cascade-deletes all `task_documents` rows for this task.

---

### 2.3 `documents`

Physical storage metadata for files copied into the app-managed local library.

```sql
CREATE TABLE documents (
    id            TEXT PRIMARY KEY CHECK(length(id) = 36),  -- UUID v4
    display_name  TEXT NOT NULL CHECK(trim(display_name) != ''),
    relative_path TEXT NOT NULL UNIQUE CHECK(trim(relative_path) != ''),
    mime_type     TEXT NOT NULL DEFAULT 'application/pdf',
    size_bytes    INTEGER,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE INDEX idx_documents_relative_path ON documents(relative_path);
```

**Storage convention**: `relative_path` is strictly relative to the library root (`<appDataDir>/library/`).

---

### 2.4 `task_documents`

Association between tasks and documents. Supports multiple assignment reference sheets
and multiple solution variants (with optional variant labels like "Draft 1", "Final").

```sql
CREATE TABLE task_documents (
    id            TEXT PRIMARY KEY CHECK(length(id) = 36),  -- UUID v4
    task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    document_id   TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    role          TEXT NOT NULL CHECK(role IN ('assignment_file', 'solution', 'reference', 'other', 'assignment')),
    variant_label TEXT,
    created_at    TEXT NOT NULL
);

CREATE INDEX idx_task_documents_task_id     ON task_documents(task_id);
CREATE INDEX idx_task_documents_document_id ON task_documents(document_id);
CREATE INDEX idx_task_documents_role        ON task_documents(role);
```

---

### 2.5 `subject_documents`

Non-task subject reference materials: syllabuses, marks schemes, notices, timetables.
These do **not** create Task records and are not shown in the to-do list.

```sql
CREATE TABLE subject_documents (
    id          TEXT PRIMARY KEY CHECK(length(id) = 36),  -- UUID v4
    subject_id  TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK(type IN (
                    'syllabus', 'marks', 'marks_scheme', 'notice',
                    'reference', 'timetable', 'notes', 'other'
                )),
    title       TEXT NOT NULL CHECK(trim(title) != ''),
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX idx_subject_docs_subject_id  ON subject_documents(subject_id);
CREATE INDEX idx_subject_docs_document_id ON subject_documents(document_id);
```

---

### 2.6 `settings`

Key-value store for application-wide preferences.

```sql
CREATE TABLE settings (
    key        TEXT PRIMARY KEY CHECK(trim(key) != ''),
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Seed default settings on first run:
INSERT OR IGNORE INTO settings(key, value, updated_at) VALUES ('theme', 'system', datetime('now'));
INSERT OR IGNORE INTO settings(key, value, updated_at) VALUES ('backup_schedule', 'daily', datetime('now'));
INSERT OR IGNORE INTO settings(key, value, updated_at) VALUES ('backup_retain', '30', datetime('now'));
```

---

### 2.7 Compatibility Views

For backwards compatibility with any existing queries expecting `task_files` and `subject_document_files`:

```sql
CREATE VIEW IF NOT EXISTS task_files AS
SELECT
    td.id AS id,
    td.task_id AS task_id,
    td.role AS role,
    d.display_name AS display_name,
    d.relative_path AS relative_path,
    td.variant_label AS variant_label,
    d.mime_type AS mime_type,
    d.size_bytes AS size_bytes,
    td.created_at AS added_at
FROM task_documents td
JOIN documents d ON td.document_id = d.id;

CREATE VIEW IF NOT EXISTS subject_document_files AS
SELECT
    sd.id AS id,
    sd.id AS subject_document_id,
    d.display_name AS display_name,
    d.relative_path AS relative_path,
    d.mime_type AS mime_type,
    d.size_bytes AS size_bytes,
    sd.created_at AS added_at
FROM subject_documents sd
JOIN documents d ON sd.document_id = d.id
WHERE sd.document_id IS NOT NULL;
```

---

### 2.8 `calendar_events` (Migration 004)

Scheduled calendar events. Can exist independently or link to an academic task.

```sql
CREATE TABLE IF NOT EXISTS calendar_events (
    id          TEXT PRIMARY KEY CHECK(length(id) = 36),  -- UUID v4
    task_id     TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    title       TEXT NOT NULL CHECK(trim(title) != ''),
    description TEXT NOT NULL DEFAULT '',
    start_at    TEXT NOT NULL,                            -- ISO 8601 UTC
    end_at      TEXT NOT NULL,                            -- ISO 8601 UTC
    all_day     INTEGER NOT NULL DEFAULT 0 CHECK(all_day IN (0, 1)),
    location    TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,                            -- ISO 8601 UTC
    updated_at  TEXT NOT NULL                             -- ISO 8601 UTC
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_task_id
    ON calendar_events(task_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_at
    ON calendar_events(start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_at
    ON calendar_events(end_at);
```

**Delete behavior**: `task_id` is nullable. When a referenced task is deleted, `task_id` is set to NULL (`ON DELETE SET NULL`, D-015). The event remains preserved on the calendar.

---

### 2.9 `task_reminders` (Migration 004)

Notifications or alerts attached to a task.

```sql
CREATE TABLE IF NOT EXISTS task_reminders (
    id           TEXT PRIMARY KEY CHECK(length(id) = 36), -- UUID v4
    task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    remind_at    TEXT NOT NULL,                           -- ISO 8601 UTC
    dismissed_at TEXT,                                    -- ISO 8601 UTC when dismissed or NULL
    created_at   TEXT NOT NULL,                           -- ISO 8601 UTC
    updated_at   TEXT NOT NULL                            -- ISO 8601 UTC
);

CREATE INDEX IF NOT EXISTS idx_task_reminders_task_id
    ON task_reminders(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reminders_remind_at
    ON task_reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_task_reminders_dismissed_at
    ON task_reminders(dismissed_at);
```

**Delete behavior**: Reminders belong strictly to a task. When the task is deleted, all its reminders are cascade-deleted (`ON DELETE CASCADE`, D-015).

---

### 2.10 `work_sessions` (Migration 004)

Planned or recorded study / work blocks for a task.

```sql
CREATE TABLE IF NOT EXISTS work_sessions (
    id         TEXT PRIMARY KEY CHECK(length(id) = 36),   -- UUID v4
    task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title      TEXT NOT NULL CHECK(trim(title) != ''),
    note       TEXT NOT NULL DEFAULT '',
    start_at   TEXT NOT NULL,                             -- ISO 8601 UTC
    end_at     TEXT NOT NULL,                             -- ISO 8601 UTC
    status     TEXT NOT NULL DEFAULT 'planned'
               CHECK(status IN ('planned', 'completed', 'cancelled')),
    created_at TEXT NOT NULL,                             -- ISO 8601 UTC
    updated_at TEXT NOT NULL                              -- ISO 8601 UTC
);

CREATE INDEX IF NOT EXISTS idx_work_sessions_task_id
    ON work_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_start_at
    ON work_sessions(start_at);
CREATE INDEX IF NOT EXISTS idx_work_sessions_end_at
    ON work_sessions(end_at);
CREATE INDEX IF NOT EXISTS idx_work_sessions_status
    ON work_sessions(status);
```

**Delete behavior**: Work sessions belong strictly to a task. When the task is deleted, its work sessions cascade-delete (`ON DELETE CASCADE`, D-015).

---

## 3. Relationship & Delete Behavior Summary

| Parent table | Child table | ON DELETE | Notes |
|---|---|---|---|
| `subjects` | `tasks` | SET NULL | Preserves tasks as unassigned when course is deleted |
| `subjects` | `subject_documents` | CASCADE | Subject reference documents are deleted with the course |
| `tasks` | `task_documents` | CASCADE | Document attachments removed from task; documents table preserved |
| `tasks` | `calendar_events` | SET NULL | Preserves calendar occurrence when academic task is deleted (D-015) |
| `tasks` | `task_reminders` | CASCADE | Task-specific reminders deleted when task is deleted (D-015) |
| `tasks` | `work_sessions` | CASCADE | Task-specific work sessions deleted when task is deleted (D-015) |
| `documents` | `task_documents` | CASCADE | Removing document removes task linkage |
| `documents` | `subject_documents` | CASCADE | Removing document clears subject linkage |

SQLite foreign key enforcement is enabled per connection: `PRAGMA foreign_keys = ON`.

---

## 4. Completion Queries (D-008)

### Overall completion
```sql
SELECT
    COUNT(*) AS total,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed
FROM tasks
WHERE is_archived = 0;
```
Calculation: `total === 0 ? 0 : Math.round((completed / total) * 100)`

### Subject-level completion
```sql
SELECT
    COUNT(*) AS total,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed
FROM tasks
WHERE is_archived = 0 AND subject_id = ?;
```

---

## 5. Due Date Overdue Detection (D-009)

Evaluated against the local calendar date:
```sql
SELECT * FROM tasks
WHERE is_archived = 0
  AND status != 'completed'
  AND due_date IS NOT NULL
  AND due_date < DATE('now', 'localtime')
ORDER BY due_date ASC;
```

---

## 6. Persistent Storage Location

Persistent data is located in a dedicated directory beneath Electron's `userData`:

| Path | Contents |
|---|---|
| `<userData>/campusdeck_storage/` | Dedicated application data root |
| `<userData>/campusdeck_storage/campusdeck.db` | Embedded SQLite database file |
| `<userData>/campusdeck_storage/library/` | Managed local file storage root |
| `<userData>/campusdeck_storage/backups/` | Scheduled database snapshots |
