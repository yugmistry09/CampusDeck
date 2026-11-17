import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

export type WorkSessionStatus = 'planned' | 'completed' | 'cancelled'

export interface WorkSessionCreateInput {
  task_id: string
  title: string
  note?: string
  start_at: string
  end_at: string
  status?: WorkSessionStatus
}

export interface WorkSessionUpdateInput {
  id: string
  title?: string
  note?: string
  start_at?: string
  end_at?: string
  status?: WorkSessionStatus
}

export interface WorkSessionRow {
  id: string
  task_id: string
  title: string
  note: string
  start_at: string
  end_at: string
  status: WorkSessionStatus
  created_at: string
  updated_at: string
}

export interface WorkSessionRepo {
  create(input: WorkSessionCreateInput): WorkSessionRow
  getById(id: string): WorkSessionRow | null
  listByTask(taskId: string): WorkSessionRow[]
  listBetween(startAt: string, endAt: string): WorkSessionRow[]
  update(input: WorkSessionUpdateInput): WorkSessionRow | null
  delete(id: string): boolean
}

export function createWorkSessionRepo(db: Database.Database) {
  const stmtSelectById = db.prepare<[string]>(
    `SELECT * FROM work_sessions WHERE id = ?`
  )

  return {
    create(input: WorkSessionCreateInput): WorkSessionRow {
      return db.transaction(() => {
        const id = uuidv4()
        const now = new Date().toISOString()

        db.prepare(`
          INSERT INTO work_sessions(
            id, task_id, title, note, start_at, end_at,
            status, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          input.task_id,
          input.title.trim(),
          input.note ?? '',
          input.start_at,
          input.end_at,
          input.status ?? 'planned',
          now,
          now
        )

        return stmtSelectById.get(id) as WorkSessionRow
      })()
    },

    getById(id: string): WorkSessionRow | null {
      return (stmtSelectById.get(id) as WorkSessionRow | undefined) ?? null
    },

    listByTask(taskId: string): WorkSessionRow[] {
      return db
        .prepare<[string]>(`
          SELECT *
          FROM work_sessions
          WHERE task_id = ?
          ORDER BY start_at ASC, created_at ASC
        `)
        .all(taskId) as WorkSessionRow[]
    },

    listBetween(startAt: string, endAt: string): WorkSessionRow[] {
      return db
        .prepare<[string, string]>(`
          SELECT *
          FROM work_sessions
          WHERE start_at < ?
            AND end_at > ?
          ORDER BY start_at ASC, created_at ASC
        `)
        .all(endAt, startAt) as WorkSessionRow[]
    },

    update(input: WorkSessionUpdateInput): WorkSessionRow | null {
      return db.transaction(() => {
        const existing = stmtSelectById.get(input.id) as WorkSessionRow | undefined
        if (!existing) return null

        const fields: string[] = []
        const params: (string | null)[] = []

        if (input.title !== undefined) {
          fields.push('title = ?')
          params.push(input.title.trim())
        }

        if (input.note !== undefined) {
          fields.push('note = ?')
          params.push(input.note)
        }

        if (input.start_at !== undefined) {
          fields.push('start_at = ?')
          params.push(input.start_at)
        }

        if (input.end_at !== undefined) {
          fields.push('end_at = ?')
          params.push(input.end_at)
        }

        if (input.status !== undefined) {
          fields.push('status = ?')
          params.push(input.status)
        }

        if (fields.length === 0) return existing

        fields.push('updated_at = ?')
        params.push(new Date().toISOString())
        params.push(input.id)

        db.prepare(
          `UPDATE work_sessions SET ${fields.join(', ')} WHERE id = ?`
        ).run(...params)

        return stmtSelectById.get(input.id) as WorkSessionRow
      })()
    },

    delete(id: string): boolean {
      return db.transaction(() => {
        const result = db
          .prepare<[string]>(`DELETE FROM work_sessions WHERE id = ?`)
          .run(id)

        return result.changes > 0
      })()
    }
  }
}
