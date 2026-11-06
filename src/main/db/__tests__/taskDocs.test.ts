import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { writeFileSync, existsSync, mkdirSync, rmSync } from 'fs'
import { runMigrationsFromDir } from '../connection'
import { createTaskDocRepo, TaskDocRepo } from '../repositories/taskDocs'
import { createDocumentRepo, DocumentRepo } from '../repositories/documents'
import { createTaskRepo, TaskRepo } from '../repositories/tasks'
import { createSubjectRepo, SubjectRepo } from '../repositories/subjects'
import { createSubjectDocRepo, SubjectDocRepo } from '../repositories/subjectDocs'
import { createFileLibraryService, FileLibraryService } from '../../services/fileLibrary'
import { getAppPaths } from '../../utils/paths'

describe('Task Document Attachment Repository & Lifecycle', () => {
  let db: Database.Database
  let taskDocRepo: TaskDocRepo
  let documentRepo: DocumentRepo
  let taskRepo: TaskRepo
  let subjectRepo: SubjectRepo
  let subjectDocRepo: SubjectDocRepo
  let fileLibrary: FileLibraryService

  const testTempDir = join(process.cwd(), 'scratch', 'test_task_docs')
  const { libraryRoot } = getAppPaths()

  beforeEach(() => {
    mkdirSync(testTempDir, { recursive: true })
    mkdirSync(libraryRoot, { recursive: true })

    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrationsFromDir(db, join(process.cwd(), 'src/main/db/migrations'))

    taskDocRepo = createTaskDocRepo(db)
    documentRepo = createDocumentRepo(db)
    taskRepo = createTaskRepo(db)
    subjectRepo = createSubjectRepo(db)
    subjectDocRepo = createSubjectDocRepo(db)
    fileLibrary = createFileLibraryService(documentRepo, subjectDocRepo, taskDocRepo)
  })

  afterEach(() => {
    db.close()
    if (existsSync(testTempDir)) {
      rmSync(testTempDir, { recursive: true, force: true })
    }
  })

  it('supports attaching multiple assignment documents to a single task', () => {
    const task = taskRepo.create({
      type: 'assignment',
      title: 'Operating Systems Lab 1'
    })

    const file1 = join(testTempDir, 'Prompt_Instructions.pdf')
    const file2 = join(testTempDir, 'Rubric_Requirements.pdf')
    writeFileSync(file1, 'Prompt PDF content')
    writeFileSync(file2, 'Rubric PDF content')

    const imported = fileLibrary.importMultipleTaskDocuments(
      task.id,
      [
        { filePath: file1, displayName: 'Lab 1 Problem Sheet.pdf' },
        { filePath: file2, displayName: 'Grading Rubric.pdf' }
      ],
      'assignment_file'
    )

    expect(imported).toHaveLength(2)

    const list = taskDocRepo.listByTask(task.id)
    expect(list).toHaveLength(2)
    expect(list[0]?.role).toBe('assignment_file')
    expect(list[1]?.role).toBe('assignment_file')
    expect(list.map((d) => d.display_name)).toEqual([
      'Lab 1 Problem Sheet.pdf',
      'Grading Rubric.pdf'
    ])
    expect(list.every((d) => d.file_exists === true)).toBe(true)
  })

  it('supports multiple solution variants with distinct variant labels', () => {
    const task = taskRepo.create({
      type: 'assignment',
      title: 'Algorithm Homework 3'
    })

    const solA = join(testTempDir, 'Solution_A.pdf')
    const solB = join(testTempDir, 'Solution_B.pdf')
    const solTeacher = join(testTempDir, 'Official_Solution.pdf')
    writeFileSync(solA, 'Solution A data')
    writeFileSync(solB, 'Solution B data')
    writeFileSync(solTeacher, 'Official Solution data')

    fileLibrary.importTaskDocument(task.id, solA, 'solution', {
      displayName: 'HW3_Recursive.pdf',
      variantLabel: 'Variant A'
    })

    fileLibrary.importTaskDocument(task.id, solB, 'solution', {
      displayName: 'HW3_Iterative.pdf',
      variantLabel: 'Variant B'
    })

    fileLibrary.importTaskDocument(task.id, solTeacher, 'solution', {
      displayName: 'HW3_Official_Key.pdf',
      variantLabel: "Teacher's solution"
    })

    const attachments = taskDocRepo.listByTask(task.id)
    expect(attachments).toHaveLength(3)

    const solutions = attachments.filter((a) => a.role === 'solution')
    expect(solutions).toHaveLength(3)

    expect(solutions.map((s) => s.variant_label)).toEqual([
      'Variant A',
      'Variant B',
      "Teacher's solution"
    ])
  })

  it('handles attachment role changes and variant label updates', () => {
    const task = taskRepo.create({
      type: 'project',
      title: 'Compiler Project'
    })

    const file = join(testTempDir, 'Grammar.pdf')
    writeFileSync(file, 'Grammar rules')

    const { taskDocument } = fileLibrary.importTaskDocument(task.id, file, 'reference', {
      displayName: 'BNF_Grammar.pdf'
    })

    expect(taskDocument.role).toBe('reference')
    expect(taskDocument.variant_label).toBeNull()

    // Update role to solution with a variant label
    const updated = taskDocRepo.update({
      id: taskDocument.id,
      role: 'solution',
      variant_label: 'Draft Parser Implementation',
      display_name: 'BNF_Parser_Solution.pdf'
    })

    expect(updated).not.toBeNull()
    expect(updated?.role).toBe('solution')
    expect(updated?.variant_label).toBe('Draft Parser Implementation')
    expect(updated?.display_name).toBe('BNF_Parser_Solution.pdf')

    // Change role to assignment_file and clear variant label
    const updatedAgain = taskDocRepo.update({
      id: taskDocument.id,
      role: 'assignment_file',
      variant_label: null
    })

    expect(updatedAgain?.role).toBe('assignment_file')
    expect(updatedAgain?.variant_label).toBeNull()
  })

  it('unlinks an attachment from a task without deleting the document or physical file', () => {
    const task = taskRepo.create({
      type: 'general',
      title: 'Study Session'
    })

    const file = join(testTempDir, 'Chapter_Summary.pdf')
    writeFileSync(file, 'Summary content')

    const { document, taskDocument } = fileLibrary.importTaskDocument(task.id, file, 'reference')

    const absPath = join(libraryRoot, document.relative_path)
    expect(existsSync(absPath)).toBe(true)

    // Unlink
    taskDocRepo.unlink(taskDocument.id)

    // Verify task no longer has the attachment
    const remaining = taskDocRepo.listByTask(task.id)
    expect(remaining).toHaveLength(0)

    // Verify document record and physical file are preserved
    expect(documentRepo.getDocumentById(document.id)).not.toBeNull()
    expect(existsSync(absPath)).toBe(true)
  })

  it('safely handles shared documents and never deletes a file still referenced elsewhere', () => {
    const task1 = taskRepo.create({ type: 'assignment', title: 'Task 1' })
    const task2 = taskRepo.create({ type: 'assignment', title: 'Task 2' })

    const file = join(testTempDir, 'Shared_Formula_Sheet.pdf')
    writeFileSync(file, 'Equations and formulas')

    // Import document once
    const doc = fileLibrary.importFile(file)
    const absPath = join(libraryRoot, doc.relative_path)
    expect(existsSync(absPath)).toBe(true)

    // Link to Task 1 and Task 2
    const link1 = taskDocRepo.link({
      taskId: task1.id,
      documentId: doc.id,
      role: 'reference'
    })

    const link2 = taskDocRepo.link({
      taskId: task2.id,
      documentId: doc.id,
      role: 'reference'
    })

    // Reference count check
    const refCount = taskDocRepo.getRefCount(doc.id)
    expect(refCount.totalRefs).toBe(2)
    expect(refCount.isShared).toBe(true)

    // Attempt deleteWithFileCheck on Task 1's link
    const delResult1 = taskDocRepo.deleteWithFileCheck(link1.id)
    expect(delResult1.unlinked).toBe(true)
    expect(delResult1.fileDeleted).toBe(false)
    expect(delResult1.remainingRefs).toBe(1)

    // Verify file and document still exist for Task 2
    expect(existsSync(absPath)).toBe(true)
    expect(documentRepo.getDocumentById(doc.id)).not.toBeNull()
    expect(taskDocRepo.listByTask(task2.id)).toHaveLength(1)

    // Now delete on Task 2's link (last reference)
    const delResult2 = taskDocRepo.deleteWithFileCheck(link2.id)
    expect(delResult2.unlinked).toBe(true)
    expect(delResult2.fileDeleted).toBe(true)
    expect(delResult2.remainingRefs).toBe(0)

    // Physical file and document row should now be deleted
    expect(existsSync(absPath)).toBe(false)
    expect(documentRepo.getDocumentById(doc.id)).toBeNull()
  })

  it('preserves shared files linked between a task and a subject document', () => {
    const subject = subjectRepo.create({ name: 'Linear Algebra' })
    const task = taskRepo.create({ subject_id: subject.id, type: 'assignment', title: 'Matrix Quiz' })

    const file = join(testTempDir, 'Linear_Algebra_Syllabus.pdf')
    writeFileSync(file, 'Course Syllabus')

    const doc = fileLibrary.importFile(file)
    const absPath = join(libraryRoot, doc.relative_path)

    // Link to subject document
    subjectDocRepo.create({
      subject_id: subject.id,
      document_id: doc.id,
      type: 'syllabus',
      title: 'Syllabus'
    })

    // Link to task
    const taskLink = taskDocRepo.link({
      taskId: task.id,
      documentId: doc.id,
      role: 'reference'
    })

    // Verify shared status
    const refCount = taskDocRepo.getRefCount(doc.id)
    expect(refCount.totalRefs).toBe(2)
    expect(refCount.subjectDocRefs).toBe(1)
    expect(refCount.taskDocRefs).toBe(1)
    expect(refCount.isShared).toBe(true)

    // Deleting task link preserves document and file because subject still uses it
    const res = taskDocRepo.deleteWithFileCheck(taskLink.id)
    expect(res.unlinked).toBe(true)
    expect(res.fileDeleted).toBe(false)
    expect(res.remainingRefs).toBe(1)
    expect(existsSync(absPath)).toBe(true)
  })

  it('detects missing files gracefully and flags file_exists as false', () => {
    const task = taskRepo.create({ type: 'general', title: 'File Missing Test' })

    const file = join(testTempDir, 'Temporary_Note.txt')
    writeFileSync(file, 'Temporary content')

    const { document } = fileLibrary.importTaskDocument(task.id, file, 'other')
    const absPath = join(libraryRoot, document.relative_path)

    // Verify initial file_exists is true
    const initialList = taskDocRepo.listByTask(task.id)
    expect(initialList[0]?.file_exists).toBe(true)

    // Simulate external deletion of file from storage
    rmSync(absPath, { force: true })
    expect(existsSync(absPath)).toBe(false)

    // Query repository again
    const updatedList = taskDocRepo.listByTask(task.id)
    expect(updatedList).toHaveLength(1)
    expect(updatedList[0]?.file_exists).toBe(false)
  })

  it('lists task documents scoped by subject without record duplication', () => {
    const s1 = subjectRepo.create({ name: 'Subject 1' })
    const s2 = subjectRepo.create({ name: 'Subject 2' })

    const t1 = taskRepo.create({ subject_id: s1.id, type: 'assignment', title: 'Task S1' })
    const t2 = taskRepo.create({ subject_id: s2.id, type: 'assignment', title: 'Task S2' })

    const f1 = join(testTempDir, 'f1.pdf')
    const f2 = join(testTempDir, 'f2.pdf')
    writeFileSync(f1, 'F1')
    writeFileSync(f2, 'F2')

    fileLibrary.importTaskDocument(t1.id, f1, 'assignment_file')
    fileLibrary.importTaskDocument(t2.id, f2, 'solution', { variantLabel: 'Variant 1' })

    const s1Docs = taskDocRepo.listBySubject(s1.id)
    expect(s1Docs).toHaveLength(1)
    expect(s1Docs[0]?.task_id).toBe(t1.id)

    const s2Docs = taskDocRepo.listBySubject(s2.id)
    expect(s2Docs).toHaveLength(1)
    expect(s2Docs[0]?.task_id).toBe(t2.id)
    expect(s2Docs[0]?.variant_label).toBe('Variant 1')
  })
})
