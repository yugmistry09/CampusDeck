import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { SubjectDocumentRow, SubjectDocumentType } from '../schema'

// ---------------------------------------------------------------------------
// Subject Document repository
// Non-task reference materials: syllabuses, notices, timetables, etc.
// These do NOT create Task records (D-spec §4.3).
// ---------------------------------------------------------------------------

export interface SubjectDocumentCreateInput {
  subject_id: string
  document_id?: string | null
  type: SubjectDocumentType
  title: string
  description?: string
}

export interface SubjectDocumentUpdateInput {
  id: string
  document_id?: string | null
  type?: SubjectDocumentType
  title?: string
  description?: string
}

export function createSubjectDocRepo(db: Database.Database) {
  const stmtInsert = db.prepare<
    [string, string, string | null, string, string, string, string, string]
  >(`
    INSERT INTO subject_documents(id, subject_id, document_id, type, title, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const stmtSelectById = db.prepare<[string]>(`
    SELECT * FROM subject_documents WHERE id = ?
  `)

  const stmtSelectBySubject = db.prepare<[string]>(`
    SELECT * FROM subject_documents
    WHERE subject_id = ?
    ORDER BY created_at DESC
  `)

  const stmtDelete = db.prepare<[string]>(`
    DELETE FROM subject_documents WHERE id = ?
  `)

  return {
    create(input: SubjectDocumentCreateInput): SubjectDocumentRow {
      return db.transaction(() => {
        const now = new Date().toISOString()
        const id = uuidv4()
        stmtInsert.run(
          id,
          input.subject_id,
          input.document_id ?? null,
          input.type,
          input.title.trim(),
          input.description ?? '',
          now,
          now
        )
        return stmtSelectById.get(id) as SubjectDocumentRow
      })()
    },

    listBySubject(subjectId: string): SubjectDocumentRow[] {
      return stmtSelectBySubject.all(subjectId) as SubjectDocumentRow[]
    },

    getById(id: string): SubjectDocumentRow | null {
      return (stmtSelectById.get(id) as SubjectDocumentRow | undefined) ?? null
    },

    update(input: SubjectDocumentUpdateInput): SubjectDocumentRow | null {
      return db.transaction(() => {
        const existing = stmtSelectById.get(input.id) as SubjectDocumentRow | undefined
        if (!existing) return null

        const now = new Date().toISOString()
        const fields: string[] = []
        const params: (string | null)[] = []

        if ('document_id' in input) {
          fields.push('document_id = ?')
          params.push(input.document_id ?? null)
        }
        if (input.type !== undefined) {
          fields.push('type = ?')
          params.push(input.type)
        }
        if (input.title !== undefined) {
          fields.push('title = ?')
          params.push(input.title.trim())
        }
        if (input.description !== undefined) {
          fields.push('description = ?')
          params.push(input.description)
        }

        if (fields.length === 0) return existing as SubjectDocumentRow

        fields.push('updated_at = ?')
        params.push(now)
        params.push(input.id)

        db.prepare(`UPDATE subject_documents SET ${fields.join(', ')} WHERE id = ?`).run(...params)
        return stmtSelectById.get(input.id) as SubjectDocumentRow
      })()
    },

    delete(id: string): void {
      db.transaction(() => {
        stmtDelete.run(id)
      })()
    }
  }
}

export type SubjectDocRepo = ReturnType<typeof createSubjectDocRepo>
