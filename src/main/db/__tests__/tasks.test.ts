import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { runMigrationsFromDir } from '../connection'
import { createTaskRepo, TaskRepo } from '../repositories/tasks'
import { createSubjectRepo } from '../repositories/subjects'
import type { TaskType } from '@shared/types'

describe('Task Repository', () => {
  let db: Database.Database
  let taskRepo: TaskRepo

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrationsFromDir(db, join(process.cwd(), 'src/main/db/migrations'))
    taskRepo = createTaskRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  it('creates tasks across all 7 academic task types', () => {
    const types: TaskType[] = [
      'general',
      'assignment',
      'lab_manual',
      'practical',
      'project',
      'exam_prep',
      'other'
    ]

    for (const type of types) {
      const task = taskRepo.create({
        type,
        title: `Task for ${type}`
      })
      expect(task.id).toHaveLength(36)
      expect(task.type).toBe(type)
      expect(task.status).toBe('todo')
      expect(task.priority).toBe('medium')
      expect(task.is_archived).toBe(0)
      expect(task.archived_at).toBeNull()
    }
  })

  it('fails constraint when creating task with invalid type', () => {
    expect(() => {
      taskRepo.create({
        type: 'invalid_type' as TaskType,
        title: 'Invalid task'
      })
    }).toThrow()
  })

  it('handles status transitions and priority settings', () => {
    const task = taskRepo.create({
      type: 'assignment',
      title: 'Problem Set 1',
      priority: 'high',
      status: 'todo'
    })

    expect(task.status).toBe('todo')
    expect(task.priority).toBe('high')

    // Transition to in_progress
    const inProgress = taskRepo.update({ id: task.id, status: 'in_progress' })
    expect(inProgress?.status).toBe('in_progress')

    // Transition to completed
    const completed = taskRepo.update({ id: task.id, status: 'completed' })
    expect(completed?.status).toBe('completed')
  })

  it('enforces YYYY-MM-DD format for due dates via CHECK constraint', () => {
    // Valid date
    const valid = taskRepo.create({
      type: 'general',
      title: 'Valid Due Date',
      due_date: '2026-11-20'
    })
    expect(valid.due_date).toBe('2026-11-20')

    // Null due date is permitted
    const nullDate = taskRepo.create({
      type: 'general',
      title: 'Null Due Date',
      due_date: null
    })
    expect(nullDate.due_date).toBeNull()

    // Invalid formats should be rejected
    expect(() => {
      taskRepo.create({
        type: 'general',
        title: 'Bad Date',
        due_date: '2026/11/20'
      })
    }).toThrow()

    expect(() => {
      taskRepo.create({
        type: 'general',
        title: 'Bad Date 2',
        due_date: '20-11-2026'
      })
    }).toThrow()
  })

  it('supports archiving tasks and sets archived_at timestamp', () => {
    const task = taskRepo.create({
      type: 'project',
      title: 'Capstone Proposal'
    })

    expect(task.is_archived).toBe(0)
    expect(task.archived_at).toBeNull()

    // Archive
    const archived = taskRepo.setArchived(task.id, true)
    expect(archived?.is_archived).toBe(1)
    expect(archived?.archived_at).toBeTruthy()

    // Active listing excludes archived tasks by default
    const activeTasks = taskRepo.list()
    expect(activeTasks.find((t) => t.id === task.id)).toBeUndefined()

    // Include archived option returns it
    const allTasks = taskRepo.list({ includeArchived: true })
    expect(allTasks.find((t) => t.id === task.id)).toBeDefined()

    // Unarchive
    const unarchived = taskRepo.setArchived(task.id, false)
    expect(unarchived?.is_archived).toBe(0)
    expect(unarchived?.archived_at).toBeNull()
  })

  it('calculates completion correctly with 0% when no non-archived tasks exist (D-008)', () => {
    // 0 tasks -> 0%
    const initial = taskRepo.getCompletion()
    expect(initial).toEqual({ total: 0, completed: 0, percent: 0 })

    // Add 1 pending task -> 0% (0 / 1)
    const task1 = taskRepo.create({ type: 'assignment', title: 'A1' })
    expect(taskRepo.getCompletion()).toEqual({ total: 1, completed: 0, percent: 0 })

    // Mark completed -> 100% (1 / 1)
    taskRepo.update({ id: task1.id, status: 'completed' })
    expect(taskRepo.getCompletion()).toEqual({ total: 1, completed: 1, percent: 100 })

    // Add another task -> 50% (1 / 2)
    const task2 = taskRepo.create({ type: 'assignment', title: 'A2' })
    expect(taskRepo.getCompletion()).toEqual({ total: 2, completed: 1, percent: 50 })

    // Archive completed task -> total becomes 1, completed becomes 0 -> 0%
    taskRepo.setArchived(task1.id, true)
    expect(taskRepo.getCompletion()).toEqual({ total: 1, completed: 0, percent: 0 })

    // Archive second task -> denominator 0 -> returns 0% (never NaN)
    taskRepo.setArchived(task2.id, true)
    expect(taskRepo.getCompletion()).toEqual({ total: 0, completed: 0, percent: 0 })
  })

  it('computes subject-scoped completion independently', () => {
    const subjectRepo = createSubjectRepo(db)
    const s1 = subjectRepo.create({ name: 'Subject 1' })
    const s2 = subjectRepo.create({ name: 'Subject 2' })

    const t1 = taskRepo.create({ subject_id: s1.id, type: 'assignment', title: 'S1 T1' })
    taskRepo.create({ subject_id: s1.id, type: 'assignment', title: 'S1 T2' })
    const t3 = taskRepo.create({ subject_id: s2.id, type: 'assignment', title: 'S2 T1' })

    taskRepo.update({ id: t1.id, status: 'completed' })
    taskRepo.update({ id: t3.id, status: 'completed' })

    // S1 has 1 of 2 completed = 50%
    expect(taskRepo.getCompletion(s1.id)).toEqual({ total: 2, completed: 1, percent: 50 })

    // S2 has 1 of 1 completed = 100%
    expect(taskRepo.getCompletion(s2.id)).toEqual({ total: 1, completed: 1, percent: 100 })

    // Overall has 2 of 3 completed = 67%
    expect(taskRepo.getCompletion().percent).toBe(67)
  })

  it('detects overdue tasks using local calendar date (D-009)', () => {
    // Yesterday task
    taskRepo.create({
      type: 'assignment',
      title: 'Yesterday Task',
      due_date: '2000-01-01',
      status: 'todo'
    })

    // Completed past task (should NOT show as overdue)
    taskRepo.create({
      type: 'assignment',
      title: 'Completed Past Task',
      due_date: '2000-01-01',
      status: 'completed'
    })

    // Future task (should NOT show as overdue)
    taskRepo.create({
      type: 'assignment',
      title: 'Future Task',
      due_date: '2099-12-31',
      status: 'todo'
    })

    const overdue = taskRepo.getOverdue()
    expect(overdue).toHaveLength(1)
    expect(overdue[0]?.title).toBe('Yesterday Task')
  })

  it('filters tasks by type', () => {
    taskRepo.create({ type: 'lab_manual', title: 'Lab 1' })
    taskRepo.create({ type: 'lab_manual', title: 'Lab 2' })
    taskRepo.create({ type: 'assignment', title: 'HW 1' })

    const labTasks = taskRepo.list({ type: 'lab_manual' })
    expect(labTasks).toHaveLength(2)
    expect(labTasks.every((t) => t.type === 'lab_manual')).toBe(true)

    const hwTasks = taskRepo.list({ type: 'assignment' })
    expect(hwTasks).toHaveLength(1)
    expect(hwTasks[0]?.title).toBe('HW 1')
  })

  it('retrieves upcoming tasks due soon within N days', () => {
    // Today
    const today = new Date().toISOString().split('T')[0]
    // 3 days from now
    const d3 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    // 10 days from now
    const d10 = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    taskRepo.create({ type: 'assignment', title: 'Due Today', due_date: today })
    taskRepo.create({ type: 'assignment', title: 'Due in 3 days', due_date: d3 })
    taskRepo.create({ type: 'assignment', title: 'Due in 10 days', due_date: d10 })
    taskRepo.create({ type: 'assignment', title: 'Completed Soon', due_date: d3, status: 'completed' })

    const soon7 = taskRepo.getUpcomingDueSoon(7)
    // Should include Today and in 3 days, but NOT completed and NOT in 10 days
    expect(soon7.map((t) => t.title)).toContain('Due Today')
    expect(soon7.map((t) => t.title)).toContain('Due in 3 days')
    expect(soon7.map((t) => t.title)).not.toContain('Due in 10 days')
    expect(soon7.map((t) => t.title)).not.toContain('Completed Soon')
  })

  it('computes complete dashboard aggregate stats accurately', () => {
    const d2 = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // 1 overdue
    taskRepo.create({ type: 'assignment', title: 'Past', due_date: '2000-01-01', status: 'todo' })
    // 1 open due soon
    taskRepo.create({ type: 'project', title: 'Soon', due_date: d2, status: 'in_progress' })
    // 1 completed
    taskRepo.create({ type: 'general', title: 'Done', status: 'completed' })
    // 1 archived (should be excluded from all dashboard metrics)
    const arch = taskRepo.create({ type: 'general', title: 'Old' })
    taskRepo.setArchived(arch.id, true)

    const stats = taskRepo.getDashboardStats()
    expect(stats.total).toBe(3)
    expect(stats.completed).toBe(1)
    expect(stats.open).toBe(2)
    expect(stats.overdue).toBe(1)
    expect(stats.dueSoon).toBe(1)
    expect(stats.percent).toBe(33) // 1 / 3 = 33%
  })

  it('joins subject information in list and getByIdWithSubject', () => {
    const subjectRepo = createSubjectRepo(db)
    const sub = subjectRepo.create({ name: 'Algorithms', code: 'CS301', color: '#10B981' })

    const task = taskRepo.create({
      subject_id: sub.id,
      type: 'assignment',
      title: 'Dynamic Programming'
    })

    const withSub = taskRepo.getByIdWithSubject(task.id)
    expect(withSub?.subject_name).toBe('Algorithms')
    expect(withSub?.subject_color).toBe('#10B981')

    const listWithSub = taskRepo.list({ subjectId: sub.id })
    expect(listWithSub).toHaveLength(1)
    expect(listWithSub[0]?.subject_name).toBe('Algorithms')
  })
})
