import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { SubjectRow, SubjectWithStats, SubjectCreateInput, SubjectUpdateInput } from '@shared/types'
import { getAppPaths } from '../../utils/paths'

// ---------------------------------------------------------------------------
// Subject repository
// Parameterized queries prevent SQL injection.
// Transactional operations ensure consistency.
// Delete behaviour (D-006 & DATA_MODEL.md):
//   - tasks.subject_id -> SET NULL via foreign key (preserves tasks as unassigned).
//   - subject_documents -> CASCADE via foreign key.
//   - unreferenced documents & physical files in library are safely cleaned up.
// ---------------------------------------------------------------------------

export function createSubjectRepo(db: Database.Database) {
  const stmtInsert = db.prepare<
    [string, string, string | null, string | null, string | null, string, string, string]
  >(`
    INSERT INTO subjects(id, name, code, color, semester, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const stmtSelectAll = db.prepare<[]>(`
    SELECT * FROM subjects ORDER BY name COLLATE NOCASE ASC
  `)

  const stmtSelectById = db.prepare<[string]>(`
    SELECT * FROM subjects WHERE id = ?
  `)

  const stmtUpdate = db.prepare<
    [string, string | null, string | null, string | null, string, string, string]
  >(`
    UPDATE subjects
    SET name = ?,
        code = ?,
        color = ?,
        semester = ?,
        notes = ?,
        updated_at = ?
    WHERE id = ?
  `)

  const stmtDelete = db.prepare<[string]>(`
    DELETE FROM subjects WHERE id = ?
  `)

  // Query docs associated with subject to identify attached physical files
  const stmtSelectDocsBySubject = db.prepare<[string]>(`
    SELECT sd.document_id, d.relative_path
    FROM subject_documents sd
    JOIN documents d ON sd.document_id = d.id
    WHERE sd.subject_id = ? AND sd.document_id IS NOT NULL
  `)

  // Check references to document_id in task_documents
  const stmtCountTaskDocRefs = db.prepare<[string]>(`
    SELECT COUNT(*) as count FROM task_documents WHERE document_id = ?
  `)

  // Check references to document_id in OTHER subject_documents
  const stmtCountOtherSubjectDocRefs = db.prepare<[string, string]>(`
    SELECT COUNT(*) as count FROM subject_documents WHERE document_id = ? AND subject_id != ?
  `)

  const stmtDeleteDocById = db.prepare<[string]>(`
    DELETE FROM documents WHERE id = ?
  `)

  // Aggregated query for stats per subject
  const stmtStatsAll = db.prepare<[]>(`
    SELECT
      s.*,
      COUNT(DISTINCT t.id) AS total_tasks,
      COUNT(DISTINCT CASE WHEN t.status = 'completed' AND t.is_archived = 0 THEN t.id END) AS completed_tasks,
      COUNT(DISTINCT sd.id) AS total_files
    FROM subjects s
    LEFT JOIN tasks t ON t.subject_id = s.id AND t.is_archived = 0
    LEFT JOIN subject_documents sd ON sd.subject_id = s.id
    GROUP BY s.id
    ORDER BY s.name COLLATE NOCASE ASC
  `)

  const stmtStatsById = db.prepare<[string]>(`
    SELECT
      s.*,
      COUNT(DISTINCT t.id) AS total_tasks,
      COUNT(DISTINCT CASE WHEN t.status = 'completed' AND t.is_archived = 0 THEN t.id END) AS completed_tasks,
      COUNT(DISTINCT sd.id) AS total_files
    FROM subjects s
    LEFT JOIN tasks t ON t.subject_id = s.id AND t.is_archived = 0
    LEFT JOIN subject_documents sd ON sd.subject_id = s.id
    WHERE s.id = ?
    GROUP BY s.id
  `)

  return {
    create(input: SubjectCreateInput): SubjectRow {
      return db.transaction(() => {
        const now = new Date().toISOString()
        const id = uuidv4()
        stmtInsert.run(
          id,
          input.name.trim(),
          input.code?.trim() || null,
          input.color?.trim() || null,
          input.semester?.trim() || null,
          input.notes || '',
          now,
          now
        )
        return stmtSelectById.get(id) as SubjectRow
      })()
    },

    list(): SubjectRow[] {
      return stmtSelectAll.all() as SubjectRow[]
    },

    listWithStats(): SubjectWithStats[] {
      const rows = stmtStatsAll.all() as (SubjectRow & {
        total_tasks: number
        completed_tasks: number
        total_files: number
      })[]

      return rows.map((r) => {
        const total = r.total_tasks || 0
        const completed = r.completed_tasks || 0
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
        return {
          id: r.id,
          name: r.name,
          code: r.code,
          color: r.color,
          semester: r.semester,
          notes: r.notes || '',
          created_at: r.created_at,
          updated_at: r.updated_at,
          totalTasks: total,
          completedTasks: completed,
          completionPercent: percent,
          totalFiles: r.total_files || 0
        }
      })
    },

    getById(id: string): SubjectRow | null {
      return (stmtSelectById.get(id) as SubjectRow | undefined) ?? null
    },

    getByIdWithStats(id: string): SubjectWithStats | null {
      const row = stmtStatsById.get(id) as
        | (SubjectRow & {
            total_tasks: number
            completed_tasks: number
            total_files: number
          })
        | undefined

      if (!row) return null

      const total = row.total_tasks || 0
      const completed = row.completed_tasks || 0
      const percent = total === 0 ? 0 : Math.round((completed / total) * 100)

      return {
        id: row.id,
        name: row.name,
        code: row.code,
        color: row.color,
        semester: row.semester,
        notes: row.notes || '',
        created_at: row.created_at,
        updated_at: row.updated_at,
        totalTasks: total,
        completedTasks: completed,
        completionPercent: percent,
        totalFiles: row.total_files || 0
      }
    },

    update(input: SubjectUpdateInput): SubjectRow | null {
      return db.transaction(() => {
        const existing = stmtSelectById.get(input.id) as SubjectRow | undefined
        if (!existing) return null

        const now = new Date().toISOString()
        const updatedName = input.name !== undefined ? input.name.trim() : existing.name
        const updatedCode = 'code' in input ? (input.code?.trim() || null) : existing.code
        const updatedColor = 'color' in input ? (input.color?.trim() || null) : existing.color
        const updatedSemester =
          'semester' in input ? (input.semester?.trim() || null) : existing.semester
        const updatedNotes = input.notes !== undefined ? input.notes : (existing.notes || '')

        stmtUpdate.run(
          updatedName,
          updatedCode,
          updatedColor,
          updatedSemester,
          updatedNotes,
          now,
          input.id
        )
        return stmtSelectById.get(input.id) as SubjectRow
      })()
    },

    delete(id: string): void {
      db.transaction(() => {
        // 1. Identify all documents linked to subject_documents for this subject
        const attachedDocs = stmtSelectDocsBySubject.all(id) as {
          document_id: string
          relative_path: string
        }[]

        const { libraryRoot } = getAppPaths()

        // 2. For each document, check if it's referenced anywhere else
        for (const item of attachedDocs) {
          const taskRefs = (
            stmtCountTaskDocRefs.get(item.document_id) as { count: number }
          ).count
          const otherSubjectRefs = (
            stmtCountOtherSubjectDocRefs.get(item.document_id, id) as { count: number }
          ).count

          // If safely unreferenced, remove the physical file and document record
          if (taskRefs === 0 && otherSubjectRefs === 0) {
            const absPath = join(libraryRoot, item.relative_path)
            if (existsSync(absPath)) {
              try {
                unlinkSync(absPath)
              } catch (err) {
                console.warn(`[SubjectRepo] Could not remove physical file: ${absPath}`, err)
              }
            }
            stmtDeleteDocById.run(item.document_id)
          }
        }

        // 3. Delete subject (SQLite FK will CASCADE subject_documents, and SET NULL tasks.subject_id)
        stmtDelete.run(id)
      })()
    }
  }
}

export type SubjectRepo = ReturnType<typeof createSubjectRepo>
