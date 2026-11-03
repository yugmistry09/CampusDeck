// ---------------------------------------------------------------------------
// Shared Domain & IPC Contract Types
// Used across main, preload, and renderer processes.
// ---------------------------------------------------------------------------

export type TaskType =
  | 'general'
  | 'assignment'
  | 'lab_manual'
  | 'practical'
  | 'project'
  | 'exam_prep'
  | 'other'

export type TaskStatus = 'todo' | 'in_progress' | 'completed'

export type TaskPriority = 'low' | 'medium' | 'high'

export type TaskDocumentRole = 'assignment' | 'solution'
export type TaskFileRole = TaskDocumentRole

export type SubjectDocumentType =
  | 'syllabus'
  | 'marks'
  | 'marks_scheme'
  | 'notice'
  | 'reference'
  | 'timetable'
  | 'notes'
  | 'other'

export type Theme = 'light' | 'dark' | 'system'

export type BackupSchedule = 'launch_only' | 'daily' | 'weekly'

// ---------------------------------------------------------------------------
// Entity Rows
// ---------------------------------------------------------------------------

export interface SubjectRow {
  id: string
  name: string
  code: string | null
  color: string | null
  semester: string | null
  notes: string
  created_at: string
  updated_at: string
}

export interface SubjectWithStats extends SubjectRow {
  totalTasks: number
  completedTasks: number
  completionPercent: number
  totalFiles: number
}

export interface TaskRow {
  id: string
  subject_id: string | null
  type: TaskType
  title: string
  description: string
  due_date: string | null // YYYY-MM-DD or null
  priority: TaskPriority
  status: TaskStatus
  is_archived: 0 | 1
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface DocumentRow {
  id: string
  display_name: string
  relative_path: string
  mime_type: string
  size_bytes: number | null
  created_at: string
  updated_at: string
}

export interface TaskDocumentRow {
  id: string
  task_id: string
  document_id: string
  role: TaskDocumentRole
  variant_label: string | null
  created_at: string
}

export interface SubjectDocumentRow {
  id: string
  subject_id: string
  document_id: string | null
  type: SubjectDocumentType
  title: string
  description: string
  created_at: string
  updated_at: string
}

export interface SubjectDocumentRecord {
  id: string
  subject_id: string
  document_id: string | null
  type: SubjectDocumentType
  title: string
  description: string
  created_at: string
  updated_at: string
  // Attached document metadata (if present)
  display_name?: string | null
  relative_path?: string | null
  mime_type?: string | null
  size_bytes?: number | null
  // Associated subject metadata
  subject_name?: string | null
  subject_code?: string | null
  subject_color?: string | null
}

export interface SettingRow {
  key: string
  value: string
  updated_at: string
}

export interface TaskFileRow {
  id: string
  task_id: string
  role: TaskDocumentRole
  display_name: string
  relative_path: string
  variant_label: string | null
  mime_type: string
  size_bytes: number | null
  added_at: string
}

export interface SubjectDocumentFileRow {
  id: string
  subject_document_id: string
  display_name: string
  relative_path: string
  mime_type: string
  size_bytes: number | null
  added_at: string
}

export interface AppSettings {
  theme: Theme
  backup_schedule: BackupSchedule
  backup_retain: number
}

export interface CompletionResult {
  total: number
  completed: number
  percent: number
}

// ---------------------------------------------------------------------------
// Input Types
// ---------------------------------------------------------------------------

export interface SubjectCreateInput {
  name: string
  code?: string | null
  color?: string | null
  semester?: string | null
  notes?: string
}

export interface SubjectUpdateInput {
  id: string
  name?: string
  code?: string | null
  color?: string | null
  semester?: string | null
  notes?: string
}

export interface TaskCreateInput {
  subject_id?: string | null
  type: TaskType
  title: string
  description?: string
  due_date?: string | null
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
}

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

export interface ImportSubjectDocInput {
  subjectId: string
  title: string
  type: SubjectDocumentType
  description?: string
}
