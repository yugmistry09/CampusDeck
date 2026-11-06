import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import type {
  TaskDocumentRecord,
  TaskDocumentRole,
  TaskDocumentUpdateInput,
  TaskDocumentDeleteResult,
  DocumentRefCount
} from '@shared/types'
import { getAppPaths } from '../../utils/paths'

// ---------------------------------------------------------------------------
// Task Document repository
// Manages attachments to tasks (assignment files, solution variants, references, etc.)
// Integrates physical file integrity checks and referential safety logic (D-004, D-007).
// ---------------------------------------------------------------------------

export interface TaskDocumentLinkInput {
  taskId: string
  documentId: string
  role: TaskDocumentRole
  variantLabel?: string | null
}

export function createTaskDocRepo(db: Database.Database) {
  const stmtInsert = db.prepare<[string, string, string, string, string | null, string]>(`
    INSERT INTO task_documents(id, task_id, document_id, role, variant_label, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const stmtSelectById = db.prepare<[string]>(`
    SELECT
      td.id,
      td.task_id,
      td.document_id,
      td.role,
      td.variant_label,
      td.created_at,
      d.display_name,
      d.relative_path,
      d.mime_type,
      d.size_bytes,
      d.created_at AS document_created_at
    FROM task_documents td
    JOIN documents d ON td.document_id = d.id
    WHERE td.id = ?
  `)

  const stmtSelectByTask = db.prepare<[string]>(`
    SELECT
      td.id,
      td.task_id,
      td.document_id,
      td.role,
      td.variant_label,
      td.created_at,
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

  const stmtSelectBySubject = db.prepare<[string]>(`
    SELECT
      td.id,
      td.task_id,
      td.document_id,
      td.role,
      td.variant_label,
      td.created_at,
      d.display_name,
      d.relative_path,
      d.mime_type,
      d.size_bytes,
      d.created_at AS document_created_at
    FROM task_documents td
    JOIN documents d ON td.document_id = d.id
    JOIN tasks t ON td.task_id = t.id
    WHERE t.subject_id = ? AND t.is_archived = 0
    ORDER BY td.created_at DESC
  `)

  const stmtSelectAll = db.prepare<[]>(`
    SELECT
      td.id,
      td.task_id,
      td.document_id,
      td.role,
      td.variant_label,
      td.created_at,
      d.display_name,
      d.relative_path,
      d.mime_type,
      d.size_bytes,
      d.created_at AS document_created_at
    FROM task_documents td
    JOIN documents d ON td.document_id = d.id
    ORDER BY td.created_at DESC
  `)

  const stmtDeleteTaskDoc = db.prepare<[string]>(`
    DELETE FROM task_documents WHERE id = ?
  `)

  const stmtCountTaskDocRefs = db.prepare<[string]>(`
    SELECT COUNT(*) as count FROM task_documents WHERE document_id = ?
  `)

  const stmtCountSubjectDocRefs = db.prepare<[string]>(`
    SELECT COUNT(*) as count FROM subject_documents WHERE document_id = ?
  `)

  const stmtDeleteDocument = db.prepare<[string]>(`
    DELETE FROM documents WHERE id = ?
  `)

  function checkFileExists(relativePath: string): boolean {
    try {
      const { libraryRoot } = getAppPaths()
      const absPath = join(libraryRoot, relativePath)
      return existsSync(absPath)
    } catch {
      return false
    }
  }

  function enrichWithFileStatus(record: TaskDocumentRecord): TaskDocumentRecord {
    return {
      ...record,
      file_exists: checkFileExists(record.relative_path)
    }
  }

  return {
    link(input: TaskDocumentLinkInput): TaskDocumentRecord {
      return db.transaction(() => {
        const id = uuidv4()
        const now = new Date().toISOString()
        stmtInsert.run(
          id,
          input.taskId,
          input.documentId,
          input.role,
          input.variantLabel ?? null,
          now
        )
        const created = stmtSelectById.get(id) as TaskDocumentRecord | undefined
        if (!created) throw new Error('Failed to retrieve newly linked task document')
        return enrichWithFileStatus(created)
      })()
    },

    getById(id: string): TaskDocumentRecord | null {
      const row = stmtSelectById.get(id) as TaskDocumentRecord | undefined
      return row ? enrichWithFileStatus(row) : null
    },

    listByTask(taskId: string): TaskDocumentRecord[] {
      const rows = stmtSelectByTask.all(taskId) as TaskDocumentRecord[]
      return rows.map(enrichWithFileStatus)
    },

    listBySubject(subjectId: string): TaskDocumentRecord[] {
      const rows = stmtSelectBySubject.all(subjectId) as TaskDocumentRecord[]
      return rows.map(enrichWithFileStatus)
    },

    listAll(): TaskDocumentRecord[] {
      const rows = stmtSelectAll.all() as TaskDocumentRecord[]
      return rows.map(enrichWithFileStatus)
    },

    update(input: TaskDocumentUpdateInput): TaskDocumentRecord | null {
      return db.transaction(() => {
        const existing = stmtSelectById.get(input.id) as TaskDocumentRecord | undefined
        if (!existing) return null

        // 1. Update task_documents fields (role, variant_label)
        const tdFields: string[] = []
        const tdParams: (string | null)[] = []

        if (input.role !== undefined) {
          tdFields.push('role = ?')
          tdParams.push(input.role)
        }

        if ('variant_label' in input) {
          tdFields.push('variant_label = ?')
          tdParams.push(input.variant_label?.trim() || null)
        }

        if (tdFields.length > 0) {
          tdParams.push(input.id)
          db.prepare(`UPDATE task_documents SET ${tdFields.join(', ')} WHERE id = ?`).run(...tdParams)
        }

        // 2. Update display_name on documents table if provided
        if (input.display_name !== undefined) {
          const trimmedName = input.display_name.trim()
          if (trimmedName.length > 0) {
            const now = new Date().toISOString()
            db.prepare('UPDATE documents SET display_name = ?, updated_at = ? WHERE id = ?')
              .run(trimmedName, now, existing.document_id)
          }
        }

        const updated = stmtSelectById.get(input.id) as TaskDocumentRecord | undefined
        return updated ? enrichWithFileStatus(updated) : null
      })()
    },

    unlink(id: string): void {
      db.transaction(() => {
        stmtDeleteTaskDoc.run(id)
      })()
    },

    deleteWithFileCheck(id: string): TaskDocumentDeleteResult {
      return db.transaction(() => {
        const docRecord = stmtSelectById.get(id) as TaskDocumentRecord | undefined
        if (!docRecord) {
          return { unlinked: false, fileDeleted: false, remainingRefs: 0 }
        }

        const docId = docRecord.document_id
        const relPath = docRecord.relative_path

        // Remove the task_documents link
        stmtDeleteTaskDoc.run(id)

        // Count remaining references across both task_documents and subject_documents
        const taskRefs = (stmtCountTaskDocRefs.get(docId) as { count: number }).count
        const subjectRefs = (stmtCountSubjectDocRefs.get(docId) as { count: number }).count
        const remaining = taskRefs + subjectRefs

        let fileDeleted = false

        if (remaining === 0) {
          // No other links exist anywhere in the app — safely remove document row and disk file
          stmtDeleteDocument.run(docId)

          try {
            const { libraryRoot } = getAppPaths()
            const fullPath = join(libraryRoot, relPath)
            if (existsSync(fullPath)) {
              unlinkSync(fullPath)
              fileDeleted = true
            }
          } catch (err) {
            console.warn(`[TaskDocRepo] Failed to delete physical file: ${relPath}`, err)
          }
        }

        return {
          unlinked: true,
          fileDeleted,
          remainingRefs: remaining
        }
      })()
    },

    getRefCount(documentId: string): DocumentRefCount {
      const taskDocRefs = (stmtCountTaskDocRefs.get(documentId) as { count: number }).count
      const subjectDocRefs = (stmtCountSubjectDocRefs.get(documentId) as { count: number }).count
      const totalRefs = taskDocRefs + subjectDocRefs
      return {
        totalRefs,
        taskDocRefs,
        subjectDocRefs,
        isShared: totalRefs > 1
      }
    }
  }
}

export type TaskDocRepo = ReturnType<typeof createTaskDocRepo>
