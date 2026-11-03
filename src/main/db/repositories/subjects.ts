import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { SubjectRow } from '../schema'

// ---------------------------------------------------------------------------
// Subject repository
// Parameterized queries prevent SQL injection.
// Transactional operations ensure consistency.
// Delete behaviour: tasks.subject_id -> SET NULL via foreign key (D-006).
//                   subject_documents -> CASCADE via foreign key.
// ---------------------------------------------------------------------------

export interface SubjectCreateInput {
  name: string
  code?: string | null
  color?: string | null
}

export interface SubjectUpdateInput {
  id: string
  name?: string
  code?: string | null
  color?: string | null
}

export function createSubjectRepo(db: Database.Database) {
  const stmtInsert = db.prepare<[string, string, string | null, string | null, string, string]>(`
    INSERT INTO subjects(id, name, code, color, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const stmtSelectAll = db.prepare<[]>(`
    SELECT * FROM subjects ORDER BY name COLLATE NOCASE ASC
  `)

  const stmtSelectById = db.prepare<[string]>(`
    SELECT * FROM subjects WHERE id = ?
  `)

  const stmtUpdate = db.prepare<[string, string | null, string | null, string, string]>(`
    UPDATE subjects
    SET name = ?,
        code = ?,
        color = ?,
        updated_at = ?
    WHERE id = ?
  `)

  const stmtDelete = db.prepare<[string]>(`
    DELETE FROM subjects WHERE id = ?
  `)

  return {
    create(input: SubjectCreateInput): SubjectRow {
      return db.transaction(() => {
        const now = new Date().toISOString()
        const id = uuidv4()
        stmtInsert.run(id, input.name.trim(), input.code ?? null, input.color ?? null, now, now)
        return stmtSelectById.get(id) as SubjectRow
      })()
    },

    list(): SubjectRow[] {
      return stmtSelectAll.all() as SubjectRow[]
    },

    getById(id: string): SubjectRow | null {
      return (stmtSelectById.get(id) as SubjectRow | undefined) ?? null
    },

    update(input: SubjectUpdateInput): SubjectRow | null {
      return db.transaction(() => {
        const existing = stmtSelectById.get(input.id) as SubjectRow | undefined
        if (!existing) return null

        const now = new Date().toISOString()
        const updatedName = input.name !== undefined ? input.name.trim() : existing.name
        const updatedCode = 'code' in input ? input.code ?? null : existing.code
        const updatedColor = 'color' in input ? input.color ?? null : existing.color

        stmtUpdate.run(updatedName, updatedCode, updatedColor, now, input.id)
        return stmtSelectById.get(input.id) as SubjectRow
      })()
    },

    delete(id: string): void {
      db.transaction(() => {
        stmtDelete.run(id)
      })()
    }
  }
}

export type SubjectRepo = ReturnType<typeof createSubjectRepo>
