import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { runMigrationsFromDir } from '../connection'
import { createDocumentRepo, DocumentRepo } from '../repositories/documents'
import { createTaskRepo, TaskRepo } from '../repositories/tasks'
import { createSubjectRepo, SubjectRepo } from '../repositories/subjects'
import { createSubjectDocRepo, SubjectDocRepo } from '../repositories/subjectDocs'

describe('Document and TaskDocument Repository', () => {
  let db: Database.Database
  let documentRepo: DocumentRepo
  let taskRepo: TaskRepo
  let subjectRepo: SubjectRepo
  let subjectDocRepo: SubjectDocRepo

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrationsFromDir(db, join(process.cwd(), 'src/main/db/migrations'))
    documentRepo = createDocumentRepo(db)
    taskRepo = createTaskRepo(db)
    subjectRepo = createSubjectRepo(db)
    subjectDocRepo = createSubjectDocRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  it('creates and retrieves a document record with relative path', () => {
    const doc = documentRepo.createDocument({
      display_name: 'Assignment 1 Sheet.pdf',
      relative_path: 'tasks/doc_uuid_assignment_1.pdf',
      mime_type: 'application/pdf',
      size_bytes: 102400
    })

    expect(doc.id).toHaveLength(36)
    expect(doc.display_name).toBe('Assignment 1 Sheet.pdf')
    expect(doc.relative_path).toBe('tasks/doc_uuid_assignment_1.pdf')
    expect(doc.size_bytes).toBe(102400)

    const fetched = documentRepo.getDocumentById(doc.id)
    expect(fetched?.relative_path).toBe('tasks/doc_uuid_assignment_1.pdf')

    const byPath = documentRepo.getDocumentByRelativePath('tasks/doc_uuid_assignment_1.pdf')
    expect(byPath?.id).toBe(doc.id)
  })

  it('enforces UNIQUE constraint on relative_path', () => {
    documentRepo.createDocument({
      display_name: 'Doc 1.pdf',
      relative_path: 'files/unique_path.pdf'
    })

    expect(() => {
      documentRepo.createDocument({
        display_name: 'Doc 2.pdf',
        relative_path: 'files/unique_path.pdf'
      })
    }).toThrow()
  })

  it('links documents to tasks with role and variant label', () => {
    const task = taskRepo.create({
      type: 'assignment',
      title: 'Lab 1 Report'
    })

    const assignmentDoc = documentRepo.createDocument({
      display_name: 'Lab 1 Guidelines.pdf',
      relative_path: 'tasks/lab1_guidelines.pdf'
    })

    const solutionDoc1 = documentRepo.createDocument({
      display_name: 'Lab 1 Draft.pdf',
      relative_path: 'tasks/lab1_draft.pdf'
    })

    const solutionDoc2 = documentRepo.createDocument({
      display_name: 'Lab 1 Final.pdf',
      relative_path: 'tasks/lab1_final.pdf'
    })

    // Link reference sheet
    documentRepo.linkTaskDocument({
      task_id: task.id,
      document_id: assignmentDoc.id,
      role: 'assignment'
    })

    // Link solutions with variant labels
    documentRepo.linkTaskDocument({
      task_id: task.id,
      document_id: solutionDoc1.id,
      role: 'solution',
      variant_label: 'Draft 1'
    })

    documentRepo.linkTaskDocument({
      task_id: task.id,
      document_id: solutionDoc2.id,
      role: 'solution',
      variant_label: 'Final Submission'
    })

    const attached = documentRepo.listDocumentsByTask(task.id)
    expect(attached).toHaveLength(3)

    const relativePaths = documentRepo.getRelativePathsByTask(task.id)
    expect(relativePaths).toEqual([
      'tasks/lab1_guidelines.pdf',
      'tasks/lab1_draft.pdf',
      'tasks/lab1_final.pdf'
    ])
  })

  it('cascade deletes task_documents when parent task is deleted', () => {
    const task = taskRepo.create({ type: 'assignment', title: 'Task to Delete' })
    const doc = documentRepo.createDocument({
      display_name: 'File.pdf',
      relative_path: 'tasks/file_to_delete.pdf'
    })

    const link = documentRepo.linkTaskDocument({
      task_id: task.id,
      document_id: doc.id,
      role: 'assignment'
    })

    // Verify link exists
    const before = db
      .prepare('SELECT * FROM task_documents WHERE id = ?')
      .get(link.id)
    expect(before).not.toBeUndefined()

    // Delete task
    taskRepo.delete(task.id)

    // Verify task_documents relation was cascade deleted
    const after = db
      .prepare('SELECT * FROM task_documents WHERE id = ?')
      .get(link.id)
    expect(after).toBeUndefined()

    // But the document record itself still exists in documents table
    expect(documentRepo.getDocumentById(doc.id)).not.toBeNull()
  })

  it('verifies task_files compatibility view returns expected fields', () => {
    const task = taskRepo.create({ type: 'assignment', title: 'View Test Task' })
    const doc = documentRepo.createDocument({
      display_name: 'Spec.pdf',
      relative_path: 'tasks/spec.pdf',
      size_bytes: 4096
    })

    documentRepo.linkTaskDocument({
      task_id: task.id,
      document_id: doc.id,
      role: 'assignment',
      variant_label: 'v1'
    })

    const viewRows = db
      .prepare('SELECT * FROM task_files WHERE task_id = ?')
      .all(task.id) as {
      task_id: string
      display_name: string
      relative_path: string
      role: string
      variant_label: string
      size_bytes: number
    }[]

    expect(viewRows).toHaveLength(1)
    expect(viewRows[0]?.display_name).toBe('Spec.pdf')
    expect(viewRows[0]?.relative_path).toBe('tasks/spec.pdf')
    expect(viewRows[0]?.role).toBe('assignment')
    expect(viewRows[0]?.variant_label).toBe('v1')
    expect(viewRows[0]?.size_bytes).toBe(4096)
  })

  it('supports linking subject_documents to documents table', () => {
    const subject = subjectRepo.create({ name: 'Mathematics II' })
    const doc = documentRepo.createDocument({
      display_name: 'Syllabus.pdf',
      relative_path: 'subjects/math_syllabus.pdf'
    })

    const subjectDoc = subjectDocRepo.create({
      subject_id: subject.id,
      document_id: doc.id,
      type: 'syllabus',
      title: 'Official Syllabus'
    })

    expect(subjectDoc.document_id).toBe(doc.id)

    // Query subject_document_files view
    const viewRows = db
      .prepare('SELECT * FROM subject_document_files WHERE subject_document_id = ?')
      .all(subjectDoc.id) as { display_name: string; relative_path: string }[]

    expect(viewRows).toHaveLength(1)
    expect(viewRows[0]?.display_name).toBe('Syllabus.pdf')
    expect(viewRows[0]?.relative_path).toBe('subjects/math_syllabus.pdf')
  })
})
