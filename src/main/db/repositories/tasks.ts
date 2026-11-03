import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type {
  TaskRow,
  TaskWithSubject,
  TaskType,
  TaskStatus,
  TaskPriority,
  CompletionResult,
  DashboardStats
} from '../schema'

// ---------------------------------------------------------------------------
// Task repository — the single source of truth for the to-do list.
// Every academic work item (assignment, lab, practical, project, etc.) is a
// single row here, regardless of which subject it belongs to.
// ---------------------------------------------------------------------------

export interface TaskCreateInput {
  subject_id?: string | null
  type: TaskType
  title: string
  description?: string
  due_date?: string | null // YYYY-MM-DD
  priority?: TaskPriority
  status?: TaskStatus
}

export interface TaskUpdateInput {
  id: string
  subject_id?: string | null
  type?: TaskType
  title?: string
  description?: string
  due_date?: string | null
  priority?: TaskPriority
  status?: TaskStatus
}

export interface TaskListOptions {
  subjectId?: string | null
  includeArchived?: boolean
  status?: TaskStatus
  priority?: TaskPriority
  type?: TaskType
}

export function createTaskRepo(db: Database.Database) {
  const stmtInsert = db.prepare<
    [string, string | null, string, string, string, string | null, string, string, number, string | null, string, string]
  >(`
    INSERT INTO tasks(
      id, subject_id, type, title, description, due_date,
      priority, status, is_archived, archived_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const stmtSelectById = db.prepare<[string]>(`SELECT * FROM tasks WHERE id = ?`)

  const stmtDelete = db.prepare<[string]>(`DELETE FROM tasks WHERE id = ?`)

  const stmtSetArchived = db.prepare<[number, string | null, string, string]>(`
    UPDATE tasks SET is_archived = ?, archived_at = ?, updated_at = ? WHERE id = ?
  `)

  // Completion query — D-008 formula
  const stmtCompletion = db.prepare<[]>(`
    SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed
    FROM tasks
    WHERE is_archived = 0
  `)

  const stmtCompletionForSubject = db.prepare<[string]>(`
    SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed
    FROM tasks
    WHERE is_archived = 0 AND subject_id = ?
  `)

  // Overdue query — evaluated using local calendar date (D-009)
  const stmtOverdue = db.prepare<[]>(`
    SELECT * FROM tasks
    WHERE is_archived = 0
      AND status != 'completed'
      AND due_date IS NOT NULL
      AND due_date < DATE('now', 'localtime')
    ORDER BY due_date ASC
  `)

  // Due soon query — tasks due within next N days (non-completed, non-archived, enriched with subject)
  const stmtDueSoon = db.prepare<[number]>(`
    SELECT t.*, s.name AS subject_name, s.color AS subject_color
    FROM tasks t
    LEFT JOIN subjects s ON t.subject_id = s.id
    WHERE t.is_archived = 0
      AND t.status != 'completed'
      AND t.due_date IS NOT NULL
      AND t.due_date >= DATE('now', 'localtime')
      AND t.due_date <= DATE('now', '+' || ? || ' days', 'localtime')
    ORDER BY t.due_date ASC,
      CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END
  `)

  // Dashboard aggregate stats — single round-trip for all metrics
  const stmtDashboardStats = db.prepare<[]>(`
    SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_count,
      COUNT(CASE WHEN status IN ('todo', 'in_progress') THEN 1 END) AS open_count,
      COUNT(CASE WHEN
        status != 'completed'
        AND due_date IS NOT NULL
        AND due_date < DATE('now', 'localtime')
      THEN 1 END) AS overdue_count,
      COUNT(CASE WHEN
        status != 'completed'
        AND due_date IS NOT NULL
        AND due_date >= DATE('now', 'localtime')
        AND due_date <= DATE('now', '+7 days', 'localtime')
      THEN 1 END) AS due_soon_count
    FROM tasks
    WHERE is_archived = 0
  `)

  return {
    create(input: TaskCreateInput): TaskRow {
      return db.transaction(() => {
        const now = new Date().toISOString()
        const id = uuidv4()
        stmtInsert.run(
          id,
          input.subject_id ?? null,
          input.type,
          input.title.trim(),
          input.description ?? '',
          input.due_date ?? null,
          input.priority ?? 'medium',
          input.status ?? 'todo',
          0,
          null,
          now,
          now
        )
        return stmtSelectById.get(id) as TaskRow
      })()
    },

    getById(id: string): TaskRow | null {
      return (stmtSelectById.get(id) as TaskRow | undefined) ?? null
    },

    getByIdWithSubject(id: string): TaskWithSubject | null {
      const row = db
        .prepare(
          `SELECT t.*, s.name AS subject_name, s.color AS subject_color
           FROM tasks t LEFT JOIN subjects s ON t.subject_id = s.id
           WHERE t.id = ?`
        )
        .get(id) as TaskWithSubject | undefined
      return row ?? null
    },

    list(opts: TaskListOptions = {}): TaskWithSubject[] {
      const conditions: string[] = []
      const params: (string | number)[] = []

      if (!opts.includeArchived) {
        conditions.push('t.is_archived = 0')
      }
      if (opts.subjectId !== undefined) {
        if (opts.subjectId === null) {
          conditions.push('t.subject_id IS NULL')
        } else {
          conditions.push('t.subject_id = ?')
          params.push(opts.subjectId)
        }
      }
      if (opts.status) {
        conditions.push('t.status = ?')
        params.push(opts.status)
      }
      if (opts.priority) {
        conditions.push('t.priority = ?')
        params.push(opts.priority)
      }
      if (opts.type) {
        conditions.push('t.type = ?')
        params.push(opts.type)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const sql = `
        SELECT t.*, s.name AS subject_name, s.color AS subject_color
        FROM tasks t
        LEFT JOIN subjects s ON t.subject_id = s.id
        ${where}
        ORDER BY
          CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
          t.due_date ASC,
          CASE t.priority
            WHEN 'high'   THEN 0
            WHEN 'medium' THEN 1
            WHEN 'low'    THEN 2
          END,
          t.created_at DESC
      `
      return db.prepare(sql).all(...params) as TaskWithSubject[]
    },

    update(input: TaskUpdateInput): TaskRow | null {
      return db.transaction(() => {
        const existing = stmtSelectById.get(input.id) as TaskRow | undefined
        if (!existing) return null

        const now = new Date().toISOString()
        const fields: string[] = []
        const params: (string | number | null)[] = []

        if ('subject_id' in input) {
          fields.push('subject_id = ?')
          params.push(input.subject_id ?? null)
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
        if ('due_date' in input) {
          fields.push('due_date = ?')
          params.push(input.due_date ?? null)
        }
        if (input.priority !== undefined) {
          fields.push('priority = ?')
          params.push(input.priority)
        }
        if (input.status !== undefined) {
          fields.push('status = ?')
          params.push(input.status)
        }

        if (fields.length === 0) return existing as TaskRow

        fields.push('updated_at = ?')
        params.push(now)
        params.push(input.id)

        db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...params)
        return stmtSelectById.get(input.id) as TaskRow
      })()
    },

    setArchived(id: string, archived: boolean): TaskRow | null {
      return db.transaction(() => {
        const existing = stmtSelectById.get(id) as TaskRow | undefined
        if (!existing) return null
        const now = new Date().toISOString()
        stmtSetArchived.run(archived ? 1 : 0, archived ? now : null, now, id)
        return stmtSelectById.get(id) as TaskRow
      })()
    },

    delete(id: string): void {
      db.transaction(() => {
        stmtDelete.run(id)
      })()
    },

    getCompletion(subjectId?: string): CompletionResult {
      let row: { total: number; completed: number }
      if (subjectId) {
        row = stmtCompletionForSubject.get(subjectId) as { total: number; completed: number }
      } else {
        row = stmtCompletion.get() as { total: number; completed: number }
      }
      const total = row.total ?? 0
      const completed = row.completed ?? 0
      return {
        total,
        completed,
        percent: total === 0 ? 0 : Math.round((completed / total) * 100)
      }
    },

    getOverdue(): TaskRow[] {
      return stmtOverdue.all() as TaskRow[]
    },

    getUpcomingDueSoon(days: number = 7): TaskWithSubject[] {
      return stmtDueSoon.all(days) as TaskWithSubject[]
    },

    getDashboardStats(): DashboardStats {
      const row = stmtDashboardStats.get() as {
        total: number
        completed_count: number
        open_count: number
        overdue_count: number
        due_soon_count: number
      }
      const total = row.total ?? 0
      const completed = row.completed_count ?? 0
      return {
        total,
        completed,
        open: row.open_count ?? 0,
        overdue: row.overdue_count ?? 0,
        dueSoon: row.due_soon_count ?? 0,
        percent: total === 0 ? 0 : Math.round((completed / total) * 100)
      }
    }
  }
}

export type TaskRepo = ReturnType<typeof createTaskRepo>
