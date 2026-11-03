import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { runMigrationsFromDir } from '../connection'
import { createSubjectRepo, SubjectRepo } from '../repositories/subjects'
import { createTaskRepo, TaskRepo } from '../repositories/tasks'
import { createSubjectDocRepo, SubjectDocRepo } from '../repositories/subjectDocs'

describe('Subject Repository', () => {
  let db: Database.Database
  let subjectRepo: SubjectRepo
  let taskRepo: TaskRepo
  let subjectDocRepo: SubjectDocRepo

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrationsFromDir(db, join(process.cwd(), 'src/main/db/migrations'))
    subjectRepo = createSubjectRepo(db)
    taskRepo = createTaskRepo(db)
    subjectDocRepo = createSubjectDocRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  it('creates and retrieves a subject with UUID', () => {
    const subject = subjectRepo.create({
      name: 'Computer Networks',
      code: 'CS301',
      color: '#4F46E5'
    })

    expect(subject.id).toHaveLength(36)
    expect(subject.name).toBe('Computer Networks')
    expect(subject.code).toBe('CS301')
    expect(subject.color).toBe('#4F46E5')

    const fetched = subjectRepo.getById(subject.id)
    expect(fetched).not.toBeNull()
    expect(fetched?.name).toBe('Computer Networks')
  })

  it('fails constraint when creating subject with empty name', () => {
    expect(() => {
      subjectRepo.create({ name: '   ' })
    }).toThrow()
  })

  it('lists subjects ordered by name case-insensitively', () => {
    subjectRepo.create({ name: 'Mathematics' })
    subjectRepo.create({ name: 'algorithms' })
    subjectRepo.create({ name: 'Operating Systems' })

    const list = subjectRepo.list()
    expect(list.map((s) => s.name)).toEqual([
      'algorithms',
      'Mathematics',
      'Operating Systems'
    ])
  })

  it('updates subject details', () => {
    const sub = subjectRepo.create({ name: 'Physics I', code: 'PHY101' })
    const updated = subjectRepo.update({
      id: sub.id,
      name: 'Physics I (Mechanics)',
      code: 'PHY102',
      color: '#10B981'
    })

    expect(updated?.name).toBe('Physics I (Mechanics)')
    expect(updated?.code).toBe('PHY102')
    expect(updated?.color).toBe('#10B981')
  })

  it('sets tasks.subject_id to NULL when subject is deleted (D-006)', () => {
    const subject = subjectRepo.create({ name: 'Operating Systems', code: 'CS304' })

    const task = taskRepo.create({
      subject_id: subject.id,
      type: 'assignment',
      title: 'Process Synchronization Lab'
    })

    expect(task.subject_id).toBe(subject.id)

    // Delete subject
    subjectRepo.delete(subject.id)

    // Verify task is preserved with subject_id = NULL
    const taskAfter = taskRepo.getById(task.id)
    expect(taskAfter).not.toBeNull()
    expect(taskAfter?.subject_id).toBeNull()
    expect(taskAfter?.title).toBe('Process Synchronization Lab')
  })

  it('cascade deletes subject_documents when subject is deleted', () => {
    const subject = subjectRepo.create({ name: 'Database Systems' })

    const doc = subjectDocRepo.create({
      subject_id: subject.id,
      type: 'syllabus',
      title: 'Course Syllabus 2026'
    })

    expect(subjectDocRepo.getById(doc.id)).not.toBeNull()

    // Delete subject
    subjectRepo.delete(subject.id)

    // Verify subject_documents entry was cascade-deleted
    expect(subjectDocRepo.getById(doc.id)).toBeNull()
  })
})
