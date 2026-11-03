import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { SubjectDocumentFileRow } from '../schema'

// ---------------------------------------------------------------------------
// Subject Document File repository
// Files attached to subject documents (syllabus PDFs, notice PDFs, etc.)
// ---------------------------------------------------------------------------

export interface SubjectDocumentFileCreateInput {
  subject_document_id: string
  display_name: string
  relative_path: string  // relative to <userData>/library/
  mime_type?: string
  size_bytes?: number
}

export function createSubjectDocFileRepo(db: Database.Database) {
  const stmtInsert = db.prepare<[string, string, string, string, string, number | null, string]>(`
    INSERT INTO subject_document_files(
      id, subject_document_id, display_name, relative_path, mime_type, size_bytes, added_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const stmtSelectById = db.prepare<[string]>(`
    SELECT * FROM subject_document_files WHERE id = ?
  `)

  const stmtSelectByDoc = db.prepare<[string]>(`
    SELECT * FROM subject_document_files
    WHERE subject_document_id = ?
    ORDER BY added_at ASC
  `)

  const stmtDelete = db.prepare<[string]>(`
    DELETE FROM subject_document_files WHERE id = ?
  `)

  const stmtPathsByDoc = db.prepare<[string]>(`
    SELECT relative_path FROM subject_document_files WHERE subject_document_id = ?
  `)

  return {
    create(input: SubjectDocumentFileCreateInput): SubjectDocumentFileRow {
      const id = uuidv4()
      const now = new Date().toISOString()
      stmtInsert.run(
        id,
        input.subject_document_id,
        input.display_name,
        input.relative_path,
        input.mime_type ?? 'application/pdf',
        input.size_bytes ?? null,
        now
      )
      return stmtSelectById.get(id) as SubjectDocumentFileRow
    },

    listByDoc(subjectDocumentId: string): SubjectDocumentFileRow[] {
      return stmtSelectByDoc.all(subjectDocumentId) as SubjectDocumentFileRow[]
    },

    getById(id: string): SubjectDocumentFileRow | null {
      return (stmtSelectById.get(id) as SubjectDocumentFileRow | undefined) ?? null
    },

    getRelativePathsForDoc(subjectDocumentId: string): string[] {
      return (stmtPathsByDoc.all(subjectDocumentId) as { relative_path: string }[]).map(
        (r) => r.relative_path
      )
    },

    delete(id: string): void {
      stmtDelete.run(id)
    }
  }
}

export type SubjectDocFileRepo = ReturnType<typeof createSubjectDocFileRepo>
