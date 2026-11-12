import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { runMigrationsFromDir } from '../connection'
import { createTaskRepo, TaskRepo } from '../repositories/tasks'
import { createSubjectRepo, SubjectRepo } from '../repositories/subjects'

describe('Domain Calculations & Business Logic Rules', () => {
  let db: Database.Database
  let taskRepo: TaskRepo
  let subjectRepo: SubjectRepo

  function getOffsetDate(days: number): string {
    const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrationsFromDir(db, join(process.cwd(), 'src/main/db/migrations'))
    taskRepo = createTaskRepo(db)
    subjectRepo = createSubjectRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('D-008: Completion Percentage Calculation', () => {
    it('returns 0% when no non-archived tasks exist', () => {
      expect(taskRepo.getCompletion()).toEqual({ total: 0, completed: 0, percent: 0 })
    })

    it('rounds mathematically to nearest integer (e.g. 1/3 -> 33%, 2/3 -> 67%)', () => {
      const t1 = taskRepo.create({ type: 'assignment', title: 'Task 1' })
      taskRepo.create({ type: 'assignment', title: 'Task 2' })
      taskRepo.create({ type: 'assignment', title: 'Task 3' })

      // 1 of 3 completed
      taskRepo.update({ id: t1.id, status: 'completed' })
      expect(taskRepo.getCompletion()).toEqual({ total: 3, completed: 1, percent: 33 })

      // 2 of 3 completed
      const t2 = taskRepo.list().find((t) => t.title === 'Task 2')!
      taskRepo.update({ id: t2.id, status: 'completed' })
      expect(taskRepo.getCompletion()).toEqual({ total: 3, completed: 2, percent: 67 })

      // 3 of 3 completed
      const t3 = taskRepo.list().find((t) => t.title === 'Task 3')!
      taskRepo.update({ id: t3.id, status: 'completed' })
      expect(taskRepo.getCompletion()).toEqual({ total: 3, completed: 3, percent: 100 })
    })

    it('excludes archived tasks completely from completion denominator and numerator', () => {
      const t1 = taskRepo.create({ type: 'assignment', title: 'T1' })
      const t2 = taskRepo.create({ type: 'assignment', title: 'T2' })
      taskRepo.update({ id: t1.id, status: 'completed' })

      // 1/2 = 50%
      expect(taskRepo.getCompletion().percent).toBe(50)

      // Archive completed task -> total becomes 1, completed becomes 0 -> 0%
      taskRepo.setArchived(t1.id, true)
      expect(taskRepo.getCompletion()).toEqual({ total: 1, completed: 0, percent: 0 })

      // Archive remaining task -> total becomes 0 -> 0% (never NaN)
      taskRepo.setArchived(t2.id, true)
      expect(taskRepo.getCompletion()).toEqual({ total: 0, completed: 0, percent: 0 })
    })

    it('scopes completion independently per subject', () => {
      const subA = subjectRepo.create({ name: 'Subject A' })
      const subB = subjectRepo.create({ name: 'Subject B' })

      const a1 = taskRepo.create({ subject_id: subA.id, type: 'assignment', title: 'A1' })
      taskRepo.create({ subject_id: subA.id, type: 'assignment', title: 'A2' })
      taskRepo.update({ id: a1.id, status: 'completed' })

      const b1 = taskRepo.create({ subject_id: subB.id, type: 'project', title: 'B1' })
      taskRepo.update({ id: b1.id, status: 'completed' })

      expect(taskRepo.getCompletion(subA.id)).toEqual({ total: 2, completed: 1, percent: 50 })
      expect(taskRepo.getCompletion(subB.id)).toEqual({ total: 1, completed: 1, percent: 100 })
      expect(taskRepo.getCompletion()).toEqual({ total: 3, completed: 2, percent: 67 })
    })
  })

  describe('D-009: Local Calendar Overdue Rules', () => {
    it('evaluates task with due_date < local today as overdue', () => {
      const yesterday = getOffsetDate(-1)
      const t = taskRepo.create({
        type: 'assignment',
        title: 'Overdue Assignment',
        due_date: yesterday,
        status: 'todo'
      })

      const overdue = taskRepo.getOverdue()
      expect(overdue.some((o) => o.id === t.id)).toBe(true)
    })

    it('does NOT count tasks due today as overdue', () => {
      const today = getOffsetDate(0)
      const t = taskRepo.create({
        type: 'assignment',
        title: 'Due Today Assignment',
        due_date: today,
        status: 'todo'
      })

      const overdue = taskRepo.getOverdue()
      expect(overdue.some((o) => o.id === t.id)).toBe(false)
    })

    it('does NOT count completed tasks as overdue even if due date was in the past', () => {
      const past = getOffsetDate(-5)
      taskRepo.create({
        type: 'assignment',
        title: 'Completed Past Assignment',
        due_date: past,
        status: 'completed'
      })

      const overdue = taskRepo.getOverdue()
      expect(overdue).toHaveLength(0)
    })

    it('does NOT count archived tasks as overdue', () => {
      const past = getOffsetDate(-10)
      const t = taskRepo.create({
        type: 'assignment',
        title: 'Archived Past Task',
        due_date: past,
        status: 'todo'
      })
      taskRepo.setArchived(t.id, true)

      const overdue = taskRepo.getOverdue()
      expect(overdue).toHaveLength(0)
    })

    it('does NOT count tasks with null due date as overdue', () => {
      taskRepo.create({
        type: 'general',
        title: 'No Deadline Task',
        due_date: null,
        status: 'todo'
      })

      const overdue = taskRepo.getOverdue()
      expect(overdue).toHaveLength(0)
    })
  })

  describe('Due Soon & Dashboard Aggregate Metrics', () => {
    it('retrieves tasks due within N calendar days correctly', () => {
      const today = getOffsetDate(0)
      const in3 = getOffsetDate(3)
      const in7 = getOffsetDate(7)
      const in8 = getOffsetDate(8)

      taskRepo.create({ type: 'assignment', title: 'Due Today', due_date: today })
      taskRepo.create({ type: 'assignment', title: 'Due in 3d', due_date: in3 })
      taskRepo.create({ type: 'assignment', title: 'Due in 7d', due_date: in7 })
      taskRepo.create({ type: 'assignment', title: 'Due in 8d', due_date: in8 })
      taskRepo.create({ type: 'assignment', title: 'Done in 3d', due_date: in3, status: 'completed' })

      const soon7 = taskRepo.getUpcomingDueSoon(7)
      const titles = soon7.map((t) => t.title)
      expect(titles).toContain('Due Today')
      expect(titles).toContain('Due in 3d')
      expect(titles).toContain('Due in 7d')
      expect(titles).not.toContain('Due in 8d')
      expect(titles).not.toContain('Done in 3d') // Completed tasks excluded
    })

    it('computes unified dashboard statistics in a single call', () => {
      const yesterday = getOffsetDate(-1)
      const in2 = getOffsetDate(2)

      // 1 overdue (todo)
      taskRepo.create({ type: 'assignment', title: 'Overdue Task', due_date: yesterday, status: 'todo' })
      // 1 in_progress due soon
      taskRepo.create({ type: 'project', title: 'Project In Progress', due_date: in2, status: 'in_progress' })
      // 1 completed
      taskRepo.create({ type: 'general', title: 'General Done', status: 'completed' })
      // 1 archived (should be excluded from all metrics)
      const arch = taskRepo.create({ type: 'other', title: 'Archived Work' })
      taskRepo.setArchived(arch.id, true)

      const stats = taskRepo.getDashboardStats()
      expect(stats.total).toBe(3)
      expect(stats.completed).toBe(1)
      expect(stats.open).toBe(2)
      expect(stats.overdue).toBe(1)
      expect(stats.dueSoon).toBe(1)
      expect(stats.percent).toBe(33)
    })
  })
})
