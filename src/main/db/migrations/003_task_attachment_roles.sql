-- =============================================================================
-- Migration 003: Expand task_documents roles & support variant labels
-- Date: 2026-11-06
-- =============================================================================

-- Create new table with expanded role check constraint
CREATE TABLE IF NOT EXISTS task_documents_new (
    id            TEXT PRIMARY KEY CHECK(length(id) = 36),
    task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    document_id   TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    role          TEXT NOT NULL CHECK(role IN ('assignment_file', 'solution', 'reference', 'other', 'assignment')),
    variant_label TEXT,
    created_at    TEXT NOT NULL
);

-- Copy existing records, mapping legacy 'assignment' to 'assignment_file'
INSERT INTO task_documents_new (id, task_id, document_id, role, variant_label, created_at)
SELECT
    id,
    task_id,
    document_id,
    CASE WHEN role = 'assignment' THEN 'assignment_file' ELSE role END,
    variant_label,
    created_at
FROM task_documents;

-- Drop dependent view before dropping old task_documents table
DROP VIEW IF EXISTS task_files;

DROP TABLE task_documents;
ALTER TABLE task_documents_new RENAME TO task_documents;

CREATE INDEX IF NOT EXISTS idx_task_documents_task_id     ON task_documents(task_id);
CREATE INDEX IF NOT EXISTS idx_task_documents_document_id ON task_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_task_documents_role        ON task_documents(role);

-- Recreate task_files view
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
