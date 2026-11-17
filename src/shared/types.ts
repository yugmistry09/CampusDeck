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

export type TaskDocumentRole =
  | 'assignment_file'
  | 'solution'
  | 'reference'
  | 'other'
  | 'assignment'
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

/** TaskRow enriched with joined subject metadata for display purposes. */
export interface TaskWithSubject extends TaskRow {
  subject_name: string | null
  subject_color: string | null
}

/** Aggregate statistics for the dashboard, computed in a single IPC call. */
export interface DashboardStats {
  open: number      // non-archived, status = todo | in_progress
  dueSoon: number   // non-archived, non-completed, due_date within next 7 days
  overdue: number   // non-archived, non-completed, due_date < today
  completed: number // non-archived, status = completed
  total: number     // all non-archived
  percent: number   // D-008 completion percent
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

export interface TaskDocumentRecord {
  id: string
  task_id: string
  document_id: string
  role: TaskDocumentRole
  variant_label: string | null
  created_at: string
  // Attached document metadata
  display_name: string
  relative_path: string
  mime_type: string
  size_bytes: number | null
  document_created_at?: string
  // Physical storage integrity status
  file_exists?: boolean
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
  type?: TaskType
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

export interface TaskDocumentUpdateInput {
  id: string
  role?: TaskDocumentRole
  variant_label?: string | null
  display_name?: string
}

export interface TaskDocumentDeleteResult {
  unlinked: boolean
  fileDeleted: boolean
  remainingRefs: number
}

export interface ImportTaskDocInput {
  taskId: string
  role: TaskDocumentRole
  variantLabel?: string | null
  customDisplayName?: string
}

export interface DocumentRefCount {
  totalRefs: number
  taskDocRefs: number
  subjectDocRefs: number
  isShared: boolean
}

export interface PdfDocumentMetadata {
  id: string
  display_name: string
  size_bytes: number | null
  mime_type: string
  created_at: string
}

export interface StorageUsageInfo {
  dbSizeBytes: number
  librarySizeBytes: number
  totalSizeBytes: number
  fileCount: number
}

export interface BackupManifestFileEntry {
  relative_path: string
  display_name?: string
  size_bytes: number
  sha256: string
}

export interface BackupManifest {
  version: number
  app_version: string
  created_at: string
  schema_version: number
  database_file: string
  files: BackupManifestFileEntry[]
}

export interface BackupExportResult {
  canceled: boolean
  backupPath?: string
  totalFiles?: number
  totalSizeBytes?: number
}

export interface BackupRestoreResult {
  canceled: boolean
  success?: boolean
  restoredFiles?: number
  schemaVersion?: number
  error?: string
}

export interface BackupValidationResult {
  valid: boolean
  manifest?: BackupManifest
  error?: string
}


