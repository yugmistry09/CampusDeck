import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

export interface TaskReminderCreateInput {
  task_id: string
  remind_at: string
}

export interface TaskReminderUpdateInput {
  id: string
  remind_at?: string
  dismissed_at?: string | null
}

export interface TaskReminderRow {
  id: string
  task_id: string
  remind_at: string
  dismissed_at: string | null
  created_at: string
  updated_at: string
}

export interface TaskReminderRepo {
  create(input: TaskReminderCreateInput): TaskReminderRow
  getById(id: string): TaskReminderRow | null
  listByTask(taskId: string): TaskReminderRow[]
  listPending(limit?: number): TaskReminderRow[]
  dismiss(id: string): TaskReminderRow | null
  update(input: TaskReminderUpdateInput): TaskReminderRow | null
  delete(id: string): boolean
}

export function createTaskReminderRepo(db: Database.Database) {
  const stmtSelectById = db.prepare<[string]>(
    `SELECT * FROM task_reminders WHERE id = ?`
  )

  return {
    create(input: TaskReminderCreateInput): TaskReminderRow {
      return db.transaction(() => {
        const id = uuidv4()
        const now = new Date().toISOString()

        db.prepare(`
          INSERT INTO task_reminders(
            id, task_id, remind_at, dismissed_at, created_at, updated_at
          )
          VALUES (?, ?, ?, NULL, ?, ?)
        `).run(
          id,
          input.task_id,
          input.remind_at,
          now,
          now
        )

        return stmtSelectById.get(id) as TaskReminderRow
      })()
    },

    getById(id: string): TaskReminderRow | null {
      return (stmtSelectById.get(id) as TaskReminderRow | undefined) ?? null
    },

    listByTask(taskId: string): TaskReminderRow[] {
      return db
        .prepare<[string]>(`
          SELECT *
          FROM task_reminders
          WHERE task_id = ?
          ORDER BY remind_at ASC, created_at ASC
        `)
        .all(taskId) as TaskReminderRow[]
    },

    listPending(limit = 100): TaskReminderRow[] {
      return db
        .prepare<[string, number]>(`
          SELECT *
          FROM task_reminders
          WHERE dismissed_at IS NULL
            AND remind_at <= ?
          ORDER BY remind_at ASC
          LIMIT ?
        `)
        .all(new Date().toISOString(), limit) as TaskReminderRow[]
    },

    dismiss(id: string): TaskReminderRow | null {
      return db.transaction(() => {
        const existing = stmtSelectById.get(id) as TaskReminderRow | undefined
        if (!existing) return null

        const now = new Date().toISOString()

        db.prepare(`
          UPDATE task_reminders
          SET dismissed_at = ?, updated_at = ?
          WHERE id = ?
        `).run(now, now, id)

        return stmtSelectById.get(id) as TaskReminderRow
      })()
    },

    update(input: TaskReminderUpdateInput): TaskReminderRow | null {
      return db.transaction(() => {
        const existing = stmtSelectById.get(input.id) as TaskReminderRow | undefined
        if (!existing) return null

        const fields: string[] = []
        const params: (string | null)[] = []

        if (input.remind_at !== undefined) {
          fields.push('remind_at = ?')
          params.push(input.remind_at)
        }

        if ('dismissed_at' in input) {
          fields.push('dismissed_at = ?')
          params.push(input.dismissed_at ?? null)
        }

        if (fields.length === 0) return existing

        fields.push('updated_at = ?')
        params.push(new Date().toISOString())
        params.push(input.id)

        db.prepare(
          `UPDATE task_reminders SET ${fields.join(', ')} WHERE id = ?`
        ).run(...params)

        return stmtSelectById.get(input.id) as TaskReminderRow
      })()
    },

    delete(id: string): boolean {
      return db.transaction(() => {
        const result = db
          .prepare<[string]>(`DELETE FROM task_reminders WHERE id = ?`)
          .run(id)

        return result.changes > 0
      })()
    }
  }
}
