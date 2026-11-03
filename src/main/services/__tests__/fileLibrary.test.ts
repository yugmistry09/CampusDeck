import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { writeFileSync, existsSync, mkdirSync, rmSync } from 'fs'
import { runMigrationsFromDir } from '../../db/connection'
import { createDocumentRepo, DocumentRepo } from '../../db/repositories/documents'
import { createSubjectDocRepo, SubjectDocRepo } from '../../db/repositories/subjectDocs'
import { createSubjectRepo, SubjectRepo } from '../../db/repositories/subjects'
import {
  createFileLibraryService,
  isSupportedFileType,
  getMimeType,
  FileLibraryService
} from '../fileLibrary'
import { getAppPaths } from '../../utils/paths'

describe('File Library Service', () => {
  let db: Database.Database
  let documentRepo: DocumentRepo
  let subjectDocRepo: SubjectDocRepo
  let subjectRepo: SubjectRepo
  let fileLibrary: FileLibraryService

  const testTempDir = join(process.cwd(), 'scratch', 'test_files')
  const { libraryRoot } = getAppPaths()

  beforeEach(() => {
    mkdirSync(testTempDir, { recursive: true })
    mkdirSync(libraryRoot, { recursive: true })

    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrationsFromDir(db, join(process.cwd(), 'src/main/db/migrations'))

    documentRepo = createDocumentRepo(db)
    subjectDocRepo = createSubjectDocRepo(db)
    subjectRepo = createSubjectRepo(db)
    fileLibrary = createFileLibraryService(documentRepo, subjectDocRepo)
  })

  afterEach(() => {
    db.close()
    if (existsSync(testTempDir)) {
      rmSync(testTempDir, { recursive: true, force: true })
    }
  })

  it('validates supported academic document formats correctly', () => {
    // Supported
    expect(isSupportedFileType('syllabus.pdf')).toBe(true)
    expect(isSupportedFileType('diagram.png')).toBe(true)
    expect(isSupportedFileType('photo.jpg')).toBe(true)
    expect(isSupportedFileType('paper.docx')).toBe(true)
    expect(isSupportedFileType('slides.pptx')).toBe(true)
    expect(isSupportedFileType('grades.xlsx')).toBe(true)
    expect(isSupportedFileType('notes.txt')).toBe(true)
    expect(isSupportedFileType('readme.md')).toBe(true)
    expect(isSupportedFileType('data.csv')).toBe(true)

    // Unsupported
    expect(isSupportedFileType('malware.exe')).toBe(false)
    expect(isSupportedFileType('script.sh')).toBe(false)
    expect(isSupportedFileType('binary.bin')).toBe(false)
    expect(isSupportedFileType('archive.tar.gz')).toBe(false)
  })

  it('resolves correct MIME types for academic formats', () => {
    expect(getMimeType('document.pdf')).toBe('application/pdf')
    expect(getMimeType('chart.png')).toBe('image/png')
    expect(getMimeType('assignment.docx')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    expect(getMimeType('notes.txt')).toBe('text/plain')
  })

  it('imports file, preserves original, and generates unique UUID-prefixed internal names', () => {
    const sourceFile = join(testTempDir, 'Calculus_Syllabus.pdf')
    writeFileSync(sourceFile, 'Sample PDF binary content for testing')

    const imported1 = fileLibrary.importFile(sourceFile)
    const imported2 = fileLibrary.importFile(sourceFile)

    // Verify original file is preserved untouched
    expect(existsSync(sourceFile)).toBe(true)

    // Verify distinct internal names (no collision)
    expect(imported1.relative_path).not.toBe(imported2.relative_path)
    expect(imported1.display_name).toBe('Calculus_Syllabus.pdf')
    expect(imported2.display_name).toBe('Calculus_Syllabus.pdf')

    // Verify stored copies exist inside libraryRoot
    expect(existsSync(fileLibrary.toAbsolutePath(imported1.relative_path))).toBe(true)
    expect(existsSync(fileLibrary.toAbsolutePath(imported2.relative_path))).toBe(true)

    // Clean up
    fileLibrary.deleteDocument(imported1.id)
    fileLibrary.deleteDocument(imported2.id)
    expect(existsSync(fileLibrary.toAbsolutePath(imported1.relative_path))).toBe(false)
    expect(existsSync(fileLibrary.toAbsolutePath(imported2.relative_path))).toBe(false)
  })

  it('rejects unsupported file formats during import', () => {
    const unsupportedFile = join(testTempDir, 'hack.exe')
    writeFileSync(unsupportedFile, 'malicious script')

    expect(() => {
      fileLibrary.importFile(unsupportedFile)
    }).toThrow(/Unsupported file type/)
  })

  it('atomically imports subject documents and links records', () => {
    const subject = subjectRepo.create({ name: 'Physics II', code: 'PHY102' })
    const sampleFile = join(testTempDir, 'Lab_Manual.pdf')
    writeFileSync(sampleFile, 'Physics lab manual contents')

    const subDoc = fileLibrary.importSubjectDocument(subject.id, sampleFile, {
      title: 'Optics Lab Manual',
      type: 'reference',
      description: 'Experiments 1 through 5'
    })

    expect(subDoc.id).toHaveLength(36)
    expect(subDoc.title).toBe('Optics Lab Manual')
    expect(subDoc.type).toBe('reference')
    expect(subDoc.subject_id).toBe(subject.id)
    expect(subDoc.display_name).toBe('Lab_Manual.pdf')
    expect(subDoc.relative_path).toBeTruthy()

    // Clean up
    if (subDoc.document_id) {
      fileLibrary.deleteDocument(subDoc.document_id)
    }
  })

  it('rejects opening a document with an unknown ID', async () => {
    await expect(
      fileLibrary.openDocumentInDefaultApp('00000000-0000-0000-0000-000000000000')
    ).rejects.toThrow(/Document with ID .* was not found/)
  })
})
