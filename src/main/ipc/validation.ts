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

// ---- Subject schemas -------------------------------------------------------

export const subjectCreateSchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  code: z.string().max(20).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'color must be a hex colour like #4F46E5')
    .optional()
})

export const subjectUpdateSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(20).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional()
})

export const subjectIdSchema = z.object({ id: uuidSchema })

// ---- Task schemas ----------------------------------------------------------

export const taskTypeSchema = z.enum([
  'assignment',
  'lab_manual',
  'practical',
  'project',
  'exam_prep',
  'general',
  'other'
])

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'completed'])

export const taskPrioritySchema = z.enum(['low', 'medium', 'high'])

export const taskCreateSchema = z.object({
  subject_id: uuidSchema.nullable().optional(),
  type: taskTypeSchema,
  title: z.string().min(1, 'title is required').max(500),
  description: z.string().max(10000).optional(),
  due_date: dateSchema,
  priority: taskPrioritySchema.optional(),
  status: taskStatusSchema.optional()
})

export const taskUpdateSchema = z.object({
  id: uuidSchema,
  subject_id: uuidSchema.nullable().optional(),
  type: taskTypeSchema.optional(),
  title: z.string().min(1).max(500).optional(),
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
  subjectId: uuidSchema.optional(),
  includeArchived: z.boolean().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional()
})

export const taskCompletionSchema = z.object({
  subjectId: uuidSchema.optional()
})

// ---- Subject Document schemas ----------------------------------------------

export const subjectDocTypeSchema = z.enum([
  'syllabus',
  'marks_scheme',
  'notice',
  'timetable',
  'other'
])

export const subjectDocCreateSchema = z.object({
  subject_id: uuidSchema,
  type: subjectDocTypeSchema,
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional()
})

export const subjectDocListSchema = z.object({ subjectId: uuidSchema })

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
  // Get all BrowserWindows that the main process owns
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
