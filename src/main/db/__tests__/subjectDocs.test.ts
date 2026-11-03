import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { runMigrationsFromDir } from '../connection'
import { createSubjectRepo, SubjectRepo } from '../repositories/subjects'
import { createSubjectDocRepo, SubjectDocRepo } from '../repositories/subjectDocs'
import { createDocumentRepo, DocumentRepo } from '../repositories/documents'
import type { SubjectDocumentType } from '@shared/types'

describe('Subject Documents Repository', () => {
  let db: Database.Database
  let subjectRepo: SubjectRepo
  let subjectDocRepo: SubjectDocRepo
  let documentRepo: DocumentRepo

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrationsFromDir(db, join(process.cwd(), 'src/main/db/migrations'))
    subjectRepo = createSubjectRepo(db)
    subjectDocRepo = createSubjectDocRepo(db)
    documentRepo = createDocumentRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  it('creates subject documents across all supported categories', () => {
    const subject = subjectRepo.create({ name: 'Web Engineering', code: 'CS302' })
    const categories: SubjectDocumentType[] = [
      'syllabus',
      'marks',
      'marks_scheme',
      'notice',
      'reference',
      'timetable',
      'notes',
      'other'
    ]

    for (const cat of categories) {
      const doc = subjectDocRepo.create({
        subject_id: subject.id,
        type: cat,
        title: `Doc for ${cat}`,
        description: `Description for ${cat}`
      })

      expect(doc.id).toHaveLength(36)
      expect(doc.type).toBe(cat)
      expect(doc.title).toBe(`Doc for ${cat}`)
      expect(doc.description).toBe(`Description for ${cat}`)
    }

    const list = subjectDocRepo.listBySubject(subject.id)
    expect(list).toHaveLength(categories.length)
  })

  it('rejects creation with empty title or invalid category', () => {
    const subject = subjectRepo.create({ name: 'Computer Architecture' })

    // Empty title
    expect(() => {
      subjectDocRepo.create({
        subject_id: subject.id,
        type: 'syllabus',
        title: '   '
      })
    }).toThrow()

    // Invalid category
    expect(() => {
      subjectDocRepo.create({
        subject_id: subject.id,
        type: 'unknown_cat' as SubjectDocumentType,
        title: 'Invalid'
      })
    }).toThrow()
  })

  it('joins attached document metadata in listBySubject and listAll', () => {
    const subject = subjectRepo.create({
      name: 'Artificial Intelligence',
      code: 'CS401',
      color: '#4F46E5'
    })

    const fileDoc = documentRepo.createDocument({
      display_name: 'AI_Lecture_01.pdf',
      relative_path: 'subjects/ai_lec_01.pdf',
      mime_type: 'application/pdf',
      size_bytes: 2048576
    })

    const subDoc = subjectDocRepo.create({
      subject_id: subject.id,
      document_id: fileDoc.id,
      type: 'notes',
      title: 'Lecture 1: Introduction to Search'
    })

    // Query single by ID
    const single = subjectDocRepo.getById(subDoc.id)
    expect(single?.display_name).toBe('AI_Lecture_01.pdf')
    expect(single?.size_bytes).toBe(2048576)
    expect(single?.subject_name).toBe('Artificial Intelligence')
    expect(single?.subject_code).toBe('CS401')

    // Query global listAll
    const all = subjectDocRepo.listAll()
    const found = all.find((d) => d.id === subDoc.id)
    expect(found).toBeDefined()
    expect(found?.subject_name).toBe('Artificial Intelligence')
    expect(found?.display_name).toBe('AI_Lecture_01.pdf')
  })

  it('cleans up attached unreferenced document on deletion', () => {
    const subject = subjectRepo.create({ name: 'Linear Algebra' })

    const fileDoc = documentRepo.createDocument({
      display_name: 'Vectors.pdf',
      relative_path: 'subjects/vectors.pdf'
    })

    const subDoc = subjectDocRepo.create({
      subject_id: subject.id,
      document_id: fileDoc.id,
      type: 'reference',
      title: 'Vector Spaces Reference Sheet'
    })

    expect(subjectDocRepo.getById(subDoc.id)).not.toBeNull()
    expect(documentRepo.getDocumentById(fileDoc.id)).not.toBeNull()

    // Delete the subject document
    subjectDocRepo.delete(subDoc.id)

    // Verify subject_documents row is removed
    expect(subjectDocRepo.getById(subDoc.id)).toBeNull()

    // Verify unreferenced document record is also cleaned up
    expect(documentRepo.getDocumentById(fileDoc.id)).toBeNull()
  })
})
