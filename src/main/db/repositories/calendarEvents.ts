import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

export interface CalendarEventCreateInput {
  task_id?: string | null
  title: string
  description?: string
  start_at: string
  end_at: string
  all_day?: boolean
  location?: string
}

export interface CalendarEventUpdateInput {
  id: string
  task_id?: string | null
  title?: string
  description?: string
  start_at?: string
  end_at?: string
  all_day?: boolean
  location?: string
}

export interface CalendarEventRow {
  id: string
  task_id: string | null
  title: string
  description: string
  start_at: string
  end_at: string
  all_day: 0 | 1
  location: string
  created_at: string
  updated_at: string
}

export interface CalendarEventRepo {
  create(input: CalendarEventCreateInput): CalendarEventRow
  getById(id: string): CalendarEventRow | null
  listAll(): CalendarEventRow[]
  listByTask(taskId: string): CalendarEventRow[]
  listBetween(startAt: string, endAt: string): CalendarEventRow[]
  update(input: CalendarEventUpdateInput): CalendarEventRow | null
  delete(id: string): boolean
}

export function createCalendarEventRepo(db: Database.Database) {
  const stmtSelectById = db.prepare<[string]>(
    `SELECT * FROM calendar_events WHERE id = ?`
  )

  const stmtDelete = db.prepare<[string]>(
    `DELETE FROM calendar_events WHERE id = ?`
  )

  return {
    create(input: CalendarEventCreateInput): CalendarEventRow {
      return db.transaction(() => {
        const id = uuidv4()
        const now = new Date().toISOString()

        db.prepare(`
          INSERT INTO calendar_events(
            id, task_id, title, description, start_at, end_at,
            all_day, location, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          input.task_id ?? null,
          input.title.trim(),
          input.description ?? '',
          input.start_at,
          input.end_at,
          input.all_day ? 1 : 0,
          input.location ?? '',
          now,
          now
        )

        return stmtSelectById.get(id) as CalendarEventRow
      })()
    },

    getById(id: string): CalendarEventRow | null {
      return (stmtSelectById.get(id) as CalendarEventRow | undefined) ?? null
    },

    listAll(): CalendarEventRow[] {
      return db
        .prepare(`
          SELECT *
          FROM calendar_events
          ORDER BY start_at ASC, created_at ASC
        `)
        .all() as CalendarEventRow[]
    },

    listByTask(taskId: string): CalendarEventRow[] {
      return db
        .prepare<[string]>(`
          SELECT *
          FROM calendar_events
          WHERE task_id = ?
          ORDER BY start_at ASC, created_at ASC
        `)
        .all(taskId) as CalendarEventRow[]
    },

    listBetween(startAt: string, endAt: string): CalendarEventRow[] {
      return db
        .prepare<[string, string]>(`
          SELECT *
          FROM calendar_events
          WHERE start_at < ?
            AND end_at > ?
          ORDER BY start_at ASC, created_at ASC
        `)
        .all(endAt, startAt) as CalendarEventRow[]
    },

    update(input: CalendarEventUpdateInput): CalendarEventRow | null {
      return db.transaction(() => {
        const existing = stmtSelectById.get(input.id) as CalendarEventRow | undefined
        if (!existing) return null

        const fields: string[] = []
        const params: (string | number | null)[] = []

        if ('task_id' in input) {
          fields.push('task_id = ?')
          params.push(input.task_id ?? null)
        }

        if (input.title !== undefined) {
          fields.push('title = ?')
          params.push(input.title.trim())
        }

        if (input.description !== undefined) {
          fields.push('description = ?')
          params.push(input.description)
        }

        if (input.start_at !== undefined) {
          fields.push('start_at = ?')
          params.push(input.start_at)
        }

        if (input.end_at !== undefined) {
          fields.push('end_at = ?')
          params.push(input.end_at)
        }

        if (input.all_day !== undefined) {
          fields.push('all_day = ?')
          params.push(input.all_day ? 1 : 0)
        }

        if (input.location !== undefined) {
          fields.push('location = ?')
          params.push(input.location)
        }

        if (fields.length === 0) return existing

        fields.push('updated_at = ?')
        params.push(new Date().toISOString())
        params.push(input.id)

        db.prepare(
          `UPDATE calendar_events SET ${fields.join(', ')} WHERE id = ?`
        ).run(...params)

        return stmtSelectById.get(input.id) as CalendarEventRow
      })()
    },

    delete(id: string): boolean {
      return db.transaction(() => {
        const result = stmtDelete.run(id)
        return result.changes > 0
      })()
    }
  }
}
