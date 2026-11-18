import { z } from 'zod'
import type { WebContents } from 'electron'
import { BrowserWindow } from 'electron'

// ---------------------------------------------------------------------------
// Zod schemas for all IPC payloads
// These validate inputs BEFORE they reach the repository layer.
// Invalid payloads throw ZodError which IPC handlers catch and convert to
// a structured error response (never a raw exception to the renderer).
// ---------------------------------------------------------------------------

// UUID pattern (v4)
const uuidSchema = z.string().uuid()

// YYYY-MM-DD pattern
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'due_date must be YYYY-MM-DD')
  .nullable()
  .optional()

// Hex color pattern (#RRGGBB or #RGB)
const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'color must be a valid hex code like #4F46E5')
  .nullable()
  .optional()

// ---- Subject schemas -------------------------------------------------------

export const subjectCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  code: z.string().trim().max(20).nullable().optional(),
  color: hexColorSchema,
  semester: z.string().trim().max(50).nullable().optional(),
  notes: z.string().max(50000).optional()
})

export const subjectUpdateSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1).max(200).optional(),
  code: z.string().trim().max(20).nullable().optional(),
  color: hexColorSchema,
  semester: z.string().trim().max(50).nullable().optional(),
  notes: z.string().max(50000).optional()
})

export const subjectIdSchema = z.object({ id: uuidSchema })

// ---- Task schemas ----------------------------------------------------------

export const taskTypeSchema = z.enum([
  'general',
  'assignment',
  'lab_manual',
  'practical',
  'project',
  'exam_prep',
  'other'
])

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'completed'])

export const taskPrioritySchema = z.enum(['low', 'medium', 'high'])

export const taskCreateSchema = z.object({
  subject_id: uuidSchema.nullable().optional(),
  type: taskTypeSchema,
  title: z.string().trim().min(1, 'title is required').max(500),
  description: z.string().max(10000).optional(),
  due_date: dateSchema,
  priority: taskPrioritySchema.optional(),
  status: taskStatusSchema.optional()
})

export const taskUpdateSchema = z.object({
  id: uuidSchema,
  subject_id: uuidSchema.nullable().optional(),
  type: taskTypeSchema.optional(),
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  due_date: dateSchema,
  priority: taskPrioritySchema.optional(),
  status: taskStatusSchema.optional()
})

export const taskArchiveSchema = z.object({
  id: uuidSchema,
  archived: z.boolean()
})

export const taskListSchema = z.object({
  subjectId: uuidSchema.nullable().optional(),
  includeArchived: z.boolean().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  type: taskTypeSchema.optional()
})

export const taskCompletionSchema = z.object({
  subjectId: uuidSchema.optional()
})

export const taskDueSoonSchema = z.object({
  days: z.number().int().min(1).max(365).optional()
})

// ---- Subject Document schemas ----------------------------------------------

export const subjectDocTypeSchema = z.enum([
  'syllabus',
  'marks',
  'marks_scheme',
  'notice',
  'reference',
  'timetable',
  'notes',
  'other'
])

export const subjectDocCreateSchema = z.object({
  subject_id: uuidSchema,
  document_id: uuidSchema.nullable().optional(),
  type: subjectDocTypeSchema,
  title: z.string().trim().min(1, 'title is required').max(500),
  description: z.string().max(10000).optional()
})

export const subjectDocUpdateSchema = z.object({
  id: uuidSchema,
  document_id: uuidSchema.nullable().optional(),
  type: subjectDocTypeSchema.optional(),
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(10000).optional()
})

export const subjectDocListSchema = z.object({ subjectId: uuidSchema })

export const importSubjectDocSchema = z.object({
  subjectId: uuidSchema,
  title: z.string().trim().min(1).max(500),
  type: subjectDocTypeSchema,
  description: z.string().max(10000).optional(),
  filePath: z.string().min(1).optional()
})

export const pickFilesSchema = z
  .object({
    allowMultiple: z.boolean().optional(),
    title: z.string().max(200).optional()
  })
  .optional()

export const documentIdSchema = z.object({ documentId: uuidSchema })

export const pdfDocumentBytesSchema = z.object({
  documentId: uuidSchema
})

// ---- Task Document schemas -------------------------------------------------

export const taskDocumentRoleSchema = z.enum([
  'assignment_file',
  'solution',
  'reference',
  'other',
  'assignment'
])

export const taskDocIdSchema = z.object({ id: uuidSchema })
export const taskIdParamSchema = z.object({ taskId: uuidSchema })
export const subjectIdParamSchema = z.object({ subjectId: uuidSchema })

export const taskDocUpdateSchema = z.object({
  id: uuidSchema,
  role: taskDocumentRoleSchema.optional(),
  variant_label: z.string().trim().max(100).nullable().optional(),
  display_name: z.string().trim().min(1, 'Display name cannot be empty').max(255).optional()
})

export const importTaskDocSchema = z.object({
  taskId: uuidSchema,
  role: taskDocumentRoleSchema,
  variantLabel: z.string().trim().max(100).nullable().optional(),
  customDisplayName: z.string().trim().max(255).optional(),
  filePaths: z.array(z.string().min(1)).optional()
})

export const importTaskDocBlobSchema = z.object({
  taskId: uuidSchema,
  role: taskDocumentRoleSchema,
  variantLabel: z.string().trim().max(100).nullable().optional(),
  customDisplayName: z.string().trim().max(255).optional(),
  files: z.array(
    z.object({
      name: z.string().min(1),
      mimeType: z.string().min(1),
      arrayBuffer: z.instanceof(ArrayBuffer)
    })
  ).min(1)
})

export const documentRefCountSchema = z.object({
  documentId: uuidSchema
})


// ---- Calendar Event schemas -------------------------------------------------

const isoDateTimeSchema = z.string().datetime({ offset: true })

export const calendarEventIdSchema = z.object({
  id: uuidSchema
})

export const calendarEventTaskSchema = z.object({
  taskId: uuidSchema
})

export const calendarEventBetweenSchema = z.object({
  startAt: isoDateTimeSchema,
  endAt: isoDateTimeSchema
})

export const calendarEventCreateSchema = z.object({
  task_id: uuidSchema.nullable().optional(),
  title: z.string().trim().min(1, 'title is required').max(500),
  description: z.string().max(10000).optional(),
  start_at: isoDateTimeSchema,
  end_at: isoDateTimeSchema,
  all_day: z.boolean().optional(),
  location: z.string().max(500).optional()
})

export const calendarEventUpdateSchema = z.object({
  id: uuidSchema,
  task_id: uuidSchema.nullable().optional(),
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  start_at: isoDateTimeSchema.optional(),
  end_at: isoDateTimeSchema.optional(),
  all_day: z.boolean().optional(),
  location: z.string().max(500).optional()
})

// ---- Task Reminder schemas --------------------------------------------------

export const taskReminderIdSchema = z.object({
  id: uuidSchema
})

export const taskReminderTaskSchema = z.object({
  taskId: uuidSchema
})

export const taskReminderPendingSchema = z.object({
  limit: z.number().int().min(1).max(500).optional()
})

export const taskReminderCreateSchema = z.object({
  task_id: uuidSchema,
  remind_at: isoDateTimeSchema
})

export const taskReminderUpdateSchema = z.object({
  id: uuidSchema,
  remind_at: isoDateTimeSchema.optional(),
  dismissed_at: isoDateTimeSchema.nullable().optional()
})

// ---- Work Session schemas ---------------------------------------------------

export const workSessionIdSchema = z.object({
  id: uuidSchema
})

export const workSessionTaskSchema = z.object({
  taskId: uuidSchema
})

export const workSessionBetweenSchema = z.object({
  startAt: isoDateTimeSchema,
  endAt: isoDateTimeSchema
})

export const workSessionStatusSchema = z.enum([
  'planned',
  'completed',
  'cancelled'
])

export const workSessionCreateSchema = z.object({
  task_id: uuidSchema,
  title: z.string().trim().min(1, 'title is required').max(500),
  note: z.string().max(10000).optional(),
  start_at: isoDateTimeSchema,
  end_at: isoDateTimeSchema,
  status: workSessionStatusSchema.optional()
})

export const workSessionUpdateSchema = z.object({
  id: uuidSchema,
  title: z.string().trim().min(1).max(500).optional(),
  note: z.string().max(10000).optional(),
  start_at: isoDateTimeSchema.optional(),
  end_at: isoDateTimeSchema.optional(),
  status: workSessionStatusSchema.optional()
})

// ---- Settings schemas ------------------------------------------------------

export const settingsUpdateSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  backup_schedule: z.enum(['launch_only', 'daily', 'weekly']).optional(),
  backup_retain: z.number().int().min(1).max(365).optional()
})

// ---------------------------------------------------------------------------
// Sender security guard
// Verifies that the IPC call originates from the application's own window,
// not from a rogue iframe, injected script, or external renderer.
// ---------------------------------------------------------------------------

export function assertTrustedSender(senderContents: WebContents): void {
  const ownedWindows = BrowserWindow.getAllWindows()
  const isOwned = ownedWindows.some((w) => w.webContents === senderContents)

  if (!isOwned) {
    throw new Error('IPC call rejected: sender is not a trusted application window')
  }
}

// ---------------------------------------------------------------------------
// Utility: parse + throw with a clean message on validation failure
// ---------------------------------------------------------------------------

export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const msg = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
    throw new Error(`Validation error — ${msg}`)
  }
  return result.data
}
