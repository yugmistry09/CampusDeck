import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import type {
  SubjectDocumentRow,
  SubjectDocumentRecord,
  SubjectDocumentCreateInput,
  SubjectDocumentUpdateInput
} from '@shared/types'
import { getAppPaths } from '../../utils/paths'

// ---------------------------------------------------------------------------
// Subject Document repository
// Non-task reference materials: syllabuses, notices, timetables, etc.
// These do NOT create Task records (D-spec §4.3).
// Delete behaviour: cleans up attached physical files and document records
// when they are safely unreferenced elsewhere.
// ---------------------------------------------------------------------------

export function createSubjectDocRepo(db: Database.Database) {
  const stmtInsert = db.prepare<
    [string, string, string | null, string, string, string, string, string]
  >(`
    INSERT INTO subject_documents(id, subject_id, document_id, type, title, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const stmtSelectById = db.prepare<[string]>(`
    SELECT
      sd.*,
      d.display_name,
      d.relative_path,
      d.mime_type,
      d.size_bytes,
      s.name AS subject_name,
      s.code AS subject_code,
      s.color AS subject_color
    FROM subject_documents sd
    LEFT JOIN documents d ON sd.document_id = d.id
    LEFT JOIN subjects s ON sd.subject_id = s.id
    WHERE sd.id = ?
  `)

  const stmtSelectBySubject = db.prepare<[string]>(`
    SELECT
      sd.*,
      d.display_name,
      d.relative_path,
      d.mime_type,
      d.size_bytes,
      s.name AS subject_name,
      s.code AS subject_code,
      s.color AS subject_color
    FROM subject_documents sd
    LEFT JOIN documents d ON sd.document_id = d.id
    LEFT JOIN subjects s ON sd.subject_id = s.id
    WHERE sd.subject_id = ?
    ORDER BY sd.created_at DESC
  `)

  const stmtSelectAll = db.prepare<[]>(`
    SELECT
      sd.*,
      d.display_name,
      d.relative_path,
      d.mime_type,
      d.size_bytes,
      s.name AS subject_name,
      s.code AS subject_code,
      s.color AS subject_color
    FROM subject_documents sd
    LEFT JOIN documents d ON sd.document_id = d.id
    LEFT JOIN subjects s ON sd.subject_id = s.id
    ORDER BY sd.created_at DESC
  `)

  const stmtDelete = db.prepare<[string]>(`
    DELETE FROM subject_documents WHERE id = ?
  `)

  const stmtCountTaskDocRefs = db.prepare<[string]>(`
    SELECT COUNT(*) as count FROM task_documents WHERE document_id = ?
  `)

  const stmtCountOtherSubjectDocRefs = db.prepare<[string, string]>(`
    SELECT COUNT(*) as count FROM subject_documents WHERE document_id = ? AND id != ?
  `)

  const stmtDeleteDocById = db.prepare<[string]>(`
    DELETE FROM documents WHERE id = ?
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
          input.description?.trim() || '',
          now,
          now
        )
        return this.getById(id) as unknown as SubjectDocumentRow
      })()
    },

    listBySubject(subjectId: string): SubjectDocumentRecord[] {
      return stmtSelectBySubject.all(subjectId) as SubjectDocumentRecord[]
    },

    listAll(): SubjectDocumentRecord[] {
      return stmtSelectAll.all() as SubjectDocumentRecord[]
    },

    getById(id: string): SubjectDocumentRecord | null {
      return (stmtSelectById.get(id) as SubjectDocumentRecord | undefined) ?? null
    },

    update(input: SubjectDocumentUpdateInput): SubjectDocumentRow | null {
      return db.transaction(() => {
        const existing = this.getById(input.id)
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
          params.push(input.description.trim())
        }

        if (fields.length === 0) return existing as unknown as SubjectDocumentRow

        fields.push('updated_at = ?')
        params.push(now)
        params.push(input.id)

        db.prepare(`UPDATE subject_documents SET ${fields.join(', ')} WHERE id = ?`).run(...params)
        return this.getById(input.id) as unknown as SubjectDocumentRow
      })()
    },

    delete(id: string): void {
      db.transaction(() => {
        const docRecord = this.getById(id)
        if (!docRecord) return

        // If there's an attached physical file, check if it's referenced anywhere else
        if (docRecord.document_id && docRecord.relative_path) {
          const taskRefs = (
            stmtCountTaskDocRefs.get(docRecord.document_id) as { count: number }
          ).count
          const otherSubjectRefs = (
            stmtCountOtherSubjectDocRefs.get(docRecord.document_id, id) as { count: number }
          ).count

          if (taskRefs === 0 && otherSubjectRefs === 0) {
            const { libraryRoot } = getAppPaths()
            const absPath = join(libraryRoot, docRecord.relative_path)
            if (existsSync(absPath)) {
              try {
                unlinkSync(absPath)
              } catch (err) {
                console.warn(`[SubjectDocRepo] Could not remove physical file: ${absPath}`, err)
              }
            }
            stmtDeleteDocById.run(docRecord.document_id)
          }
        }

        stmtDelete.run(id)
      })()
    }
  }
}

export type SubjectDocRepo = ReturnType<typeof createSubjectDocRepo>
