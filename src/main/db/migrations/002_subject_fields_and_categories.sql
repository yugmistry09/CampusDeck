-- =============================================================================
-- Migration 002: Subject fields (semester, notes) & updated document categories
-- Date: 2026-11-03
-- =============================================================================

-- Add semester and notes columns to subjects table
ALTER TABLE subjects ADD COLUMN semester TEXT;
ALTER TABLE subjects ADD COLUMN notes TEXT NOT NULL DEFAULT '';

-- Recreate subject_documents table to support categories:
-- 'syllabus', 'marks', 'marks_scheme', 'notice', 'reference', 'timetable', 'notes', 'other'
CREATE TABLE IF NOT EXISTS subject_documents_new (
    id          TEXT PRIMARY KEY CHECK(length(id) = 36),
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

-- Copy existing records into new table (with fallback mapping if needed)
INSERT INTO subject_documents_new (id, subject_id, document_id, type, title, description, created_at, updated_at)
SELECT id, subject_id, document_id, type, title, description, created_at, updated_at
FROM subject_documents;

-- Drop dependent view before dropping old subject_documents table
DROP VIEW IF EXISTS subject_document_files;

DROP TABLE subject_documents;
ALTER TABLE subject_documents_new RENAME TO subject_documents;

CREATE INDEX IF NOT EXISTS idx_subject_docs_subject_id  ON subject_documents(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_docs_document_id ON subject_documents(document_id);

-- Recreate view subject_document_files
DROP VIEW IF EXISTS subject_document_files;
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
