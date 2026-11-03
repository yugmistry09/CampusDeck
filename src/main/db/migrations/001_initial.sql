-- =============================================================================
-- Migration 001: Initial schema
-- Applied by: src/main/db/connection.ts migration runner
-- Date: 2026-11-03
-- =============================================================================

-- Migration tracking table (must exist before any schema migration)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,  -- e.g. "001_initial"
    applied_at TEXT NOT NULL      -- ISO 8601 timestamp
);

-- =============================================================================
-- subjects
-- Represents an academic course or module.
-- Delete behaviour: tasks.subject_id -> SET NULL (D-006); subject_documents -> CASCADE.
-- =============================================================================
CREATE TABLE IF NOT EXISTS subjects (
    id         TEXT PRIMARY KEY CHECK(length(id) = 36),  -- UUID v4
    name       TEXT NOT NULL CHECK(trim(name) != ''),
    code       TEXT,             -- e.g. "CS201" (optional)
    color      TEXT,             -- Hex colour "#4F46E5" (optional)
    created_at TEXT NOT NULL,    -- ISO 8601
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects(name COLLATE NOCASE);

-- =============================================================================
-- tasks
-- Single source of truth for the to-do list.
-- Covers types: general, assignment, lab_manual, practical, project, exam_prep, other
-- Statuses: todo, in_progress, completed
-- Priorities: low, medium, high
-- Due date: YYYY-MM-DD or NULL (evaluated locally)
-- Includes timestamps and archived_at
-- =============================================================================
CREATE TABLE IF NOT EXISTS tasks (
    id          TEXT PRIMARY KEY CHECK(length(id) = 36),
    subject_id  TEXT REFERENCES subjects(id) ON DELETE SET NULL,
    type        TEXT NOT NULL CHECK(type IN (
                    'general', 'assignment', 'lab_manual', 'practical',
                    'project', 'exam_prep', 'other'
                )),
    title       TEXT NOT NULL CHECK(trim(title) != ''),
    description TEXT NOT NULL DEFAULT '',
    due_date    TEXT CHECK(
                    due_date IS NULL OR
                    (due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
                ),
    priority    TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
    status      TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'completed')),
    is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0, 1)),
    archived_at TEXT,            -- ISO 8601, set when is_archived=1, NULL otherwise
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_subject_id  ON tasks(subject_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date    ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_is_archived ON tasks(is_archived);
CREATE INDEX IF NOT EXISTS idx_tasks_priority    ON tasks(priority);

-- =============================================================================
-- documents
-- Storage metadata for files copied into the app-managed local library.
-- Stored relative_path is strictly relative to the library root.
-- =============================================================================
CREATE TABLE IF NOT EXISTS documents (
    id            TEXT PRIMARY KEY CHECK(length(id) = 36),
    display_name  TEXT NOT NULL CHECK(trim(display_name) != ''),
    relative_path TEXT NOT NULL UNIQUE CHECK(trim(relative_path) != ''),
    mime_type     TEXT NOT NULL DEFAULT 'application/pdf',
    size_bytes    INTEGER,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_relative_path ON documents(relative_path);

-- =============================================================================
-- task_documents
-- Association between tasks and documents (assignment reference sheets, solutions).
-- Supports multiple assignment PDFs and multiple solution PDFs with variant labels.
-- Cascade delete: removing a task automatically removes task_document relations.
-- =============================================================================
CREATE TABLE IF NOT EXISTS task_documents (
    id            TEXT PRIMARY KEY CHECK(length(id) = 36),
    task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    document_id   TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    role          TEXT NOT NULL CHECK(role IN ('assignment', 'solution')),
    variant_label TEXT,
    created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_documents_task_id     ON task_documents(task_id);
CREATE INDEX IF NOT EXISTS idx_task_documents_document_id ON task_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_task_documents_role        ON task_documents(role);

-- =============================================================================
-- subject_documents
-- Non-task subject materials: syllabuses, marks schemes, notices, timetables, etc.
-- These do NOT create Task records and are excluded from the to-do list.
-- Optional reference to an attached file in the documents table.
-- Cascade delete: removing a subject removes its subject_documents.
-- =============================================================================
CREATE TABLE IF NOT EXISTS subject_documents (
    id          TEXT PRIMARY KEY CHECK(length(id) = 36),
    subject_id  TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK(type IN (
                    'syllabus', 'marks_scheme', 'notice', 'timetable', 'other'
                )),
    title       TEXT NOT NULL CHECK(trim(title) != ''),
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subject_docs_subject_id  ON subject_documents(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_docs_document_id ON subject_documents(document_id);

-- =============================================================================
-- settings
-- Key-value settings table for application-wide preferences.
-- Parameterized upsert support for any key.
-- =============================================================================
CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY CHECK(trim(key) != ''),
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Seed default settings
INSERT OR IGNORE INTO settings(key, value, updated_at)
    VALUES ('theme', 'system', datetime('now'));
INSERT OR IGNORE INTO settings(key, value, updated_at)
    VALUES ('backup_schedule', 'daily', datetime('now'));
INSERT OR IGNORE INTO settings(key, value, updated_at)
    VALUES ('backup_retain', '30', datetime('now'));

-- =============================================================================
-- Backwards-compatibility views for task_files and subject_document_files
-- =============================================================================
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
