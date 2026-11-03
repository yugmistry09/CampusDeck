import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { runMigrationsFromDir } from '../connection'
import { createSubjectRepo, SubjectRepo } from '../repositories/subjects'
import { createTaskRepo, TaskRepo } from '../repositories/tasks'
import { createSubjectDocRepo, SubjectDocRepo } from '../repositories/subjectDocs'
import { createDocumentRepo, DocumentRepo } from '../repositories/documents'

describe('Subject Repository', () => {
  let db: Database.Database
  let subjectRepo: SubjectRepo
  let taskRepo: TaskRepo
  let subjectDocRepo: SubjectDocRepo
  let documentRepo: DocumentRepo

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrationsFromDir(db, join(process.cwd(), 'src/main/db/migrations'))
    subjectRepo = createSubjectRepo(db)
    taskRepo = createTaskRepo(db)
    subjectDocRepo = createSubjectDocRepo(db)
    documentRepo = createDocumentRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  it('creates and retrieves a subject with UUID, code, semester, color, and notes', () => {
    const subject = subjectRepo.create({
      name: 'Computer Networks',
      code: 'CS301',
      color: '#4F46E5',
      semester: 'Fall 2026',
      notes: 'Lectures on Tue/Thu. Textbook: Kurose & Ross.'
    })

    expect(subject.id).toHaveLength(36)
    expect(subject.name).toBe('Computer Networks')
    expect(subject.code).toBe('CS301')
    expect(subject.color).toBe('#4F46E5')
    expect(subject.semester).toBe('Fall 2026')
    expect(subject.notes).toBe('Lectures on Tue/Thu. Textbook: Kurose & Ross.')

    const fetched = subjectRepo.getById(subject.id)
    expect(fetched).not.toBeNull()
    expect(fetched?.name).toBe('Computer Networks')
    expect(fetched?.semester).toBe('Fall 2026')
    expect(fetched?.notes).toBe('Lectures on Tue/Thu. Textbook: Kurose & Ross.')
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

  it('updates subject details including code, color, semester, and notes', () => {
    const sub = subjectRepo.create({ name: 'Physics I', code: 'PHY101' })
    const updated = subjectRepo.update({
      id: sub.id,
      name: 'Physics I (Mechanics)',
      code: 'PHY102',
      color: '#10B981',
      semester: 'Semester 1',
      notes: 'Lab every Monday.'
    })

    expect(updated?.name).toBe('Physics I (Mechanics)')
    expect(updated?.code).toBe('PHY102')
    expect(updated?.color).toBe('#10B981')
    expect(updated?.semester).toBe('Semester 1')
    expect(updated?.notes).toBe('Lab every Monday.')
  })

  it('computes subject stats accurately with tasks and attached files', () => {
    const subject = subjectRepo.create({ name: 'Algorithms', code: 'CS204' })

    // Create 2 tasks, 1 completed
    const t1 = taskRepo.create({ subject_id: subject.id, type: 'assignment', title: 'A1' })
    taskRepo.create({ subject_id: subject.id, type: 'assignment', title: 'A2' })
    taskRepo.update({ id: t1.id, status: 'completed' })

    // Attach 1 subject document
    subjectDocRepo.create({
      subject_id: subject.id,
      type: 'syllabus',
      title: 'Course Syllabus'
    })

    const stats = subjectRepo.getByIdWithStats(subject.id)
    expect(stats).not.toBeNull()
    expect(stats?.totalTasks).toBe(2)
    expect(stats?.completedTasks).toBe(1)
    expect(stats?.completionPercent).toBe(50)
    expect(stats?.totalFiles).toBe(1)

    // listWithStats includes it
    const allStats = subjectRepo.listWithStats()
    const found = allStats.find((s) => s.id === subject.id)
    expect(found?.totalTasks).toBe(2)
    expect(found?.totalFiles).toBe(1)
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

  it('cascade deletes subject_documents and removes unreferenced document records when subject is deleted', () => {
    const subject = subjectRepo.create({ name: 'Database Systems' })

    const fileDoc = documentRepo.createDocument({
      display_name: 'DB_Syllabus.pdf',
      relative_path: 'subjects/db_syllabus_test.pdf'
    })

    const doc = subjectDocRepo.create({
      subject_id: subject.id,
      document_id: fileDoc.id,
      type: 'syllabus',
      title: 'Course Syllabus 2026'
    })

    expect(subjectDocRepo.getById(doc.id)).not.toBeNull()
    expect(documentRepo.getDocumentById(fileDoc.id)).not.toBeNull()

    // Delete subject
    subjectRepo.delete(subject.id)

    // Verify subject_documents entry was cascade-deleted
    expect(subjectDocRepo.getById(doc.id)).toBeNull()

    // Verify unreferenced document record in documents table was safely cleaned up
    expect(documentRepo.getDocumentById(fileDoc.id)).toBeNull()
  })
})
