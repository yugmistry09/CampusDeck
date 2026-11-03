import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { TaskFileRow, TaskFileRole } from '../schema'

// ---------------------------------------------------------------------------
// Task File repository
// Files attached to tasks (assignment sheets, solutions).
// relative_path is stored relative to <userData>/library/ (D-005).
// Physical file deletion is the caller's responsibility (fileLibrary service).
// ---------------------------------------------------------------------------

export interface TaskFileCreateInput {
  task_id: string
  role: TaskFileRole
  display_name: string
  relative_path: string   // MUST be relative to library root
  variant_label?: string
  mime_type?: string
  size_bytes?: number
}

export function createTaskFileRepo(db: Database.Database) {
  const stmtInsert = db.prepare<
    [string, string, string, string, string, string | null, string, number | null, string]
  >(`
    INSERT INTO task_files(
      id, task_id, role, display_name, relative_path,
      variant_label, mime_type, size_bytes, added_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const stmtSelectById = db.prepare<[string]>(`SELECT * FROM task_files WHERE id = ?`)

  const stmtSelectByTask = db.prepare<[string]>(`
    SELECT * FROM task_files WHERE task_id = ? ORDER BY added_at ASC
  `)

  const stmtSelectAll = db.prepare<[]>(`
    SELECT * FROM task_files ORDER BY added_at DESC
  `)

  const stmtDelete = db.prepare<[string]>(`DELETE FROM task_files WHERE id = ?`)

  const stmtSelectByTaskForDelete = db.prepare<[string]>(`
    SELECT relative_path FROM task_files WHERE task_id = ?
  `)

  return {
    create(input: TaskFileCreateInput): TaskFileRow {
      const id = uuidv4()
      const now = new Date().toISOString()
      stmtInsert.run(
        id,
        input.task_id,
        input.role,
        input.display_name,
        input.relative_path,
        input.variant_label ?? null,
        input.mime_type ?? 'application/pdf',
        input.size_bytes ?? null,
        now
      )
      return stmtSelectById.get(id) as TaskFileRow
    },

    getById(id: string): TaskFileRow | null {
      return (stmtSelectById.get(id) as TaskFileRow | undefined) ?? null
    },

    listByTask(taskId: string): TaskFileRow[] {
      return stmtSelectByTask.all(taskId) as TaskFileRow[]
    },

    listAll(): TaskFileRow[] {
      return stmtSelectAll.all() as TaskFileRow[]
    },

    /** Returns relative_paths of all files for a task (for physical cleanup). */
    getRelativePathsForTask(taskId: string): string[] {
      return (stmtSelectByTaskForDelete.all(taskId) as { relative_path: string }[]).map(
        (r) => r.relative_path
      )
    },

    delete(id: string): void {
      stmtDelete.run(id)
    }
  }
}

export type TaskFileRepo = ReturnType<typeof createTaskFileRepo>
