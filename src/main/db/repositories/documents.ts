import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { DocumentRow, TaskDocumentRow, TaskDocumentRole } from '../schema'

// ---------------------------------------------------------------------------
// Document repository — manages the documents and task_documents tables
// Stores relative paths strictly relative to the library root (D-005).
// ---------------------------------------------------------------------------

export interface DocumentCreateInput {
  display_name: string
  relative_path: string // Relative to library root
  mime_type?: string
  size_bytes?: number | null
}

export interface TaskDocumentLinkInput {
  task_id: string
  document_id: string
  role: TaskDocumentRole
  variant_label?: string | null
}

export function createDocumentRepo(db: Database.Database) {
  const stmtInsertDoc = db.prepare<[string, string, string, string, number | null, string, string]>(`
    INSERT INTO documents(id, display_name, relative_path, mime_type, size_bytes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const stmtSelectDocById = db.prepare<[string]>(`SELECT * FROM documents WHERE id = ?`)
  const stmtSelectDocByPath = db.prepare<[string]>(`SELECT * FROM documents WHERE relative_path = ?`)
  const stmtSelectAllDocs = db.prepare<[]>(`SELECT * FROM documents ORDER BY created_at DESC`)
  const stmtDeleteDoc = db.prepare<[string]>(`DELETE FROM documents WHERE id = ?`)

  const stmtInsertTaskDoc = db.prepare<[string, string, string, string, string | null, string]>(`
    INSERT INTO task_documents(id, task_id, document_id, role, variant_label, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const stmtSelectTaskDocById = db.prepare<[string]>(`SELECT * FROM task_documents WHERE id = ?`)
  const stmtDeleteTaskDoc = db.prepare<[string]>(`DELETE FROM task_documents WHERE id = ?`)

  const stmtSelectDocsByTask = db.prepare<[string]>(`
    SELECT
      td.id AS task_document_id,
      td.task_id,
      td.role,
      td.variant_label,
      td.created_at AS linked_at,
      d.id AS document_id,
      d.display_name,
      d.relative_path,
      d.mime_type,
      d.size_bytes,
      d.created_at AS document_created_at
    FROM task_documents td
    JOIN documents d ON td.document_id = d.id
    WHERE td.task_id = ?
    ORDER BY td.created_at ASC
  `)

  const stmtSelectPathsByTask = db.prepare<[string]>(`
    SELECT d.relative_path
    FROM task_documents td
    JOIN documents d ON td.document_id = d.id
    WHERE td.task_id = ?
  `)

  return {
    createDocument(input: DocumentCreateInput): DocumentRow {
      return db.transaction(() => {
        const id = uuidv4()
        const now = new Date().toISOString()
        stmtInsertDoc.run(
          id,
          input.display_name.trim(),
          input.relative_path.trim(),
          input.mime_type ?? 'application/pdf',
          input.size_bytes ?? null,
          now,
          now
        )
        return stmtSelectDocById.get(id) as DocumentRow
      })()
    },

    getDocumentById(id: string): DocumentRow | null {
      return (stmtSelectDocById.get(id) as DocumentRow | undefined) ?? null
    },

    getDocumentByRelativePath(relativePath: string): DocumentRow | null {
      return (stmtSelectDocByPath.get(relativePath) as DocumentRow | undefined) ?? null
    },

    listDocuments(): DocumentRow[] {
      return stmtSelectAllDocs.all() as DocumentRow[]
    },

    deleteDocument(id: string): void {
      db.transaction(() => {
        stmtDeleteDoc.run(id)
      })()
    },

    linkTaskDocument(input: TaskDocumentLinkInput): TaskDocumentRow {
      return db.transaction(() => {
        const id = uuidv4()
        const now = new Date().toISOString()
        stmtInsertTaskDoc.run(
          id,
          input.task_id,
          input.document_id,
          input.role,
          input.variant_label ?? null,
          now
        )
        return stmtSelectTaskDocById.get(id) as TaskDocumentRow
      })()
    },

    unlinkTaskDocument(taskDocumentId: string): void {
      db.transaction(() => {
        stmtDeleteTaskDoc.run(taskDocumentId)
      })()
    },

    listDocumentsByTask(taskId: string) {
      return stmtSelectDocsByTask.all(taskId)
    },

    getRelativePathsByTask(taskId: string): string[] {
      return (stmtSelectPathsByTask.all(taskId) as { relative_path: string }[]).map(
        (r) => r.relative_path
      )
    }
  }
}

export type DocumentRepo = ReturnType<typeof createDocumentRepo>
