import { describe, it, expect, vi } from 'vitest'

const fakeOwnedWebContents = { id: 100 }

vi.mock('electron', () => {
  return {
    BrowserWindow: {
      getAllWindows: () => [{ webContents: fakeOwnedWebContents }]
    }
  }
})

import {
  parseOrThrow,
  assertTrustedSender,
  subjectCreateSchema,
  subjectUpdateSchema,
  taskCreateSchema,
  taskUpdateSchema,
  taskTypeSchema,
  taskStatusSchema,
  taskPrioritySchema,
  taskDocumentRoleSchema,
  taskDocUpdateSchema,
  settingsUpdateSchema,
  importSubjectDocSchema,
  importTaskDocSchema
} from '../validation'

describe('IPC Payload Validation & Schemas', () => {
  describe('parseOrThrow utility', () => {
    it('returns validated data on success', () => {
      const result = parseOrThrow(taskPrioritySchema, 'high')
      expect(result).toBe('high')
    })

    it('throws descriptive error on validation failure', () => {
      expect(() => {
        parseOrThrow(taskPrioritySchema, 'urgent' as any)
      }).toThrow(/Validation error/)
    })
  })

  describe('Subject Schemas', () => {
    it('validates valid subject create input', () => {
      const valid = {
        name: 'Distributed Systems',
        code: 'CS450',
        color: '#4F46E5',
        semester: 'Spring 2026',
        notes: 'Instructor: Dr. Smith'
      }
      const parsed = parseOrThrow(subjectCreateSchema, valid)
      expect(parsed.name).toBe('Distributed Systems')
      expect(parsed.code).toBe('CS450')
      expect(parsed.color).toBe('#4F46E5')
    })

    it('rejects subject creation with empty name', () => {
      expect(() => {
        parseOrThrow(subjectCreateSchema, { name: '   ' })
      }).toThrow(/name is required/)
    })

    it('validates 3-character and 6-character hex colors', () => {
      const p1 = parseOrThrow(subjectCreateSchema, { name: 'Math', color: '#FFF' })
      expect(p1.color).toBe('#FFF')
      const p2 = parseOrThrow(subjectCreateSchema, { name: 'Math', color: '#10B981' })
      expect(p2.color).toBe('#10B981')

      // Invalid colors
      expect(() => {
        parseOrThrow(subjectCreateSchema, { name: 'Math', color: 'blue' })
      }).toThrow(/valid hex code/)

      expect(() => {
        parseOrThrow(subjectCreateSchema, { name: 'Math', color: '#12345' })
      }).toThrow(/valid hex code/)
    })

    it('validates subject update with valid UUID', () => {
      const valid = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Advanced Math'
      }
      const parsed = parseOrThrow(subjectUpdateSchema, valid)
      expect(parsed.id).toBe('123e4567-e89b-12d3-a456-426614174000')
    })

    it('rejects subject update with malformed UUID', () => {
      expect(() => {
        parseOrThrow(subjectUpdateSchema, { id: 'not-a-valid-uuid' })
      }).toThrow(/Invalid uuid/)
    })
  })

  describe('Task Schemas', () => {
    it('accepts all 7 valid academic task types', () => {
      const types = [
        'general',
        'assignment',
        'lab_manual',
        'practical',
        'project',
        'exam_prep',
        'other'
      ]
      for (const t of types) {
        expect(parseOrThrow(taskTypeSchema, t)).toBe(t)
      }
    })

    it('rejects invalid task type', () => {
      expect(() => parseOrThrow(taskTypeSchema, 'homework')).toThrow()
    })

    it('validates all 3 task statuses and priorities', () => {
      expect(parseOrThrow(taskStatusSchema, 'todo')).toBe('todo')
      expect(parseOrThrow(taskStatusSchema, 'in_progress')).toBe('in_progress')
      expect(parseOrThrow(taskStatusSchema, 'completed')).toBe('completed')

      expect(parseOrThrow(taskPrioritySchema, 'low')).toBe('low')
      expect(parseOrThrow(taskPrioritySchema, 'medium')).toBe('medium')
      expect(parseOrThrow(taskPrioritySchema, 'high')).toBe('high')
    })

    it('validates YYYY-MM-DD due date pattern strictly', () => {
      const valid = {
        type: 'assignment' as const,
        title: 'Problem Set 1',
        due_date: '2026-12-31'
      }
      expect(parseOrThrow(taskCreateSchema, valid).due_date).toBe('2026-12-31')

      // Slashes rejected
      expect(() => {
        parseOrThrow(taskCreateSchema, { ...valid, due_date: '2026/12/31' })
      }).toThrow(/due_date must be YYYY-MM-DD/)

      // ISO timestamp rejected
      expect(() => {
        parseOrThrow(taskCreateSchema, { ...valid, due_date: '2026-12-31T00:00:00Z' })
      }).toThrow(/due_date must be YYYY-MM-DD/)

      // DD-MM-YYYY rejected
      expect(() => {
        parseOrThrow(taskCreateSchema, { ...valid, due_date: '31-12-2026' })
      }).toThrow(/due_date must be YYYY-MM-DD/)
    })

    it('allows null or omitted due_date', () => {
      const taskNullDate = parseOrThrow(taskCreateSchema, {
        type: 'general',
        title: 'Open ended task',
        due_date: null
      })
      expect(taskNullDate.due_date).toBeNull()

      const taskNoDate = parseOrThrow(taskCreateSchema, {
        type: 'general',
        title: 'Task without due date'
      })
      expect(taskNoDate.due_date).toBeUndefined()
    })

    it('validates task update schema with partial fields', () => {
      const update = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'completed' as const,
        priority: 'high' as const
      }
      const parsed = parseOrThrow(taskUpdateSchema, update)
      expect(parsed.id).toBe('123e4567-e89b-12d3-a456-426614174000')
      expect(parsed.status).toBe('completed')
    })
  })

  describe('Task Document Schemas', () => {
    it('accepts valid task document roles including assignment_file and solution', () => {
      const roles = ['assignment_file', 'solution', 'reference', 'other', 'assignment']
      for (const r of roles) {
        expect(parseOrThrow(taskDocumentRoleSchema, r)).toBe(r)
      }
    })

    it('validates task document update with variant label', () => {
      const valid = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        role: 'solution' as const,
        variant_label: 'Variant B (Alternative)',
        display_name: 'Solution_v2.pdf'
      }
      const parsed = parseOrThrow(taskDocUpdateSchema, valid)
      expect(parsed.role).toBe('solution')
      expect(parsed.variant_label).toBe('Variant B (Alternative)')
    })

    it('validates importTaskDocSchema and importSubjectDocSchema inputs', () => {
      const importTask = parseOrThrow(importTaskDocSchema, {
        taskId: '123e4567-e89b-12d3-a456-426614174000',
        role: 'solution',
        variantLabel: 'Key'
      })
      expect(importTask.variantLabel).toBe('Key')

      const importSubject = parseOrThrow(importSubjectDocSchema, {
        subjectId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Syllabus 2026',
        type: 'syllabus'
      })
      expect(importSubject.title).toBe('Syllabus 2026')
    })
  })

  describe('Settings Schemas', () => {
    it('validates theme and backup settings', () => {
      const parsed = parseOrThrow(settingsUpdateSchema, {
        theme: 'dark',
        backup_schedule: 'daily',
        backup_retain: 14
      })
      expect(parsed.theme).toBe('dark')
      expect(parsed.backup_retain).toBe(14)
    })

    it('rejects invalid backup retain counts', () => {
      expect(() => {
        parseOrThrow(settingsUpdateSchema, { backup_retain: 0 })
      }).toThrow()

      expect(() => {
        parseOrThrow(settingsUpdateSchema, { backup_retain: 500 })
      }).toThrow()
    })
  })

  describe('Sender Security: assertTrustedSender', () => {
    it('rejects unowned sender webContents', () => {
      const fakeUntrustedSender = { id: 8888 } as any
      expect(() => {
        assertTrustedSender(fakeUntrustedSender)
      }).toThrow(/sender is not a trusted application window/)
    })
  })
})
