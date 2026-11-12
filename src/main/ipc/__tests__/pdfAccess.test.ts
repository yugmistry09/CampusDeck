import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { writeFileSync, existsSync, mkdirSync, rmSync, unlinkSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { runMigrationsFromDir } from '../../db/connection'
import { createDocumentRepo, DocumentRepo } from '../../db/repositories/documents'
import { createSubjectDocRepo, SubjectDocRepo } from '../../db/repositories/subjectDocs'
import { createTaskDocRepo, TaskDocRepo } from '../../db/repositories/taskDocs'
import { createFileLibraryService, FileLibraryService } from '../../services/fileLibrary'
import { getAppPaths } from '../../utils/paths'

// Mock Electron IPC & BrowserWindow
const handlers: Record<string, (event: any, payload: any) => Promise<any>> = {}
const fakeWebContents = { id: 1 }

vi.mock('electron', () => {
  return {
    ipcMain: {
      handle: (channel: string, fn: (event: any, payload: any) => Promise<any>) => {
        handlers[channel] = fn
      }
    },
    BrowserWindow: {
      getAllWindows: () => [{ webContents: fakeWebContents }]
    }
  }
})

// Import registerPdfHandlers after mocking electron
import { registerPdfHandlers } from '../pdf'

describe('PDF Access IPC & Security Controls', () => {
  let db: Database.Database
  let documentRepo: DocumentRepo
  let subjectDocRepo: SubjectDocRepo
  let taskDocRepo: TaskDocRepo
  let fileLibrary: FileLibraryService

  const testTempDir = join(process.cwd(), 'scratch', 'test_pdf_ipc')
  const { libraryRoot } = getAppPaths()

  beforeEach(() => {
    mkdirSync(testTempDir, { recursive: true })
    mkdirSync(libraryRoot, { recursive: true })

    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrationsFromDir(db, join(process.cwd(), 'src/main/db/migrations'))

    documentRepo = createDocumentRepo(db)
    subjectDocRepo = createSubjectDocRepo(db)
    taskDocRepo = createTaskDocRepo(db)
    fileLibrary = createFileLibraryService(documentRepo, subjectDocRepo, taskDocRepo)

    registerPdfHandlers(documentRepo, fileLibrary)
  })

  afterEach(() => {
    db.close()
    if (existsSync(testTempDir)) {
      rmSync(testTempDir, { recursive: true, force: true })
    }
  })

  function invokeHandler(channel: string, event: any, payload: any) {
    const fn = handlers[channel]
    if (!fn) throw new Error(`Handler for "${channel}" is not registered`)
    return fn(event, payload)
  }

  it('retrieves valid PDF document bytes matching vault disk content', async () => {
    const dummyPdfContent = Buffer.from('%PDF-1.4\n%CampusDeck Test PDF Content\n%%EOF')
    const sourcePdf = join(testTempDir, 'sample_assignment.pdf')
    writeFileSync(sourcePdf, dummyPdfContent)

    const importedDoc = fileLibrary.importFile(sourcePdf, { displayName: 'Assignment 1.pdf' })

    const resultBytes = await invokeHandler(
      'pdf:get-document-bytes',
      { sender: fakeWebContents },
      { documentId: importedDoc.id }
    )

    expect(resultBytes).toBeInstanceOf(Uint8Array)
    expect(Buffer.from(resultBytes).toString('utf-8')).toBe(dummyPdfContent.toString('utf-8'))
  })

  it('retrieves accurate PDF metadata for valid document ID', async () => {
    const dummyPdfContent = Buffer.from('%PDF-1.4\n%CampusDeck Metadata Test\n%%EOF')
    const sourcePdf = join(testTempDir, 'exam_solution.pdf')
    writeFileSync(sourcePdf, dummyPdfContent)

    const importedDoc = fileLibrary.importFile(sourcePdf, { displayName: 'Exam Solution.pdf' })

    const meta = await invokeHandler(
      'pdf:get-document-metadata',
      { sender: fakeWebContents },
      { documentId: importedDoc.id }
    )

    expect(meta.id).toBe(importedDoc.id)
    expect(meta.display_name).toBe('Exam Solution.pdf')
    expect(meta.mime_type).toBe('application/pdf')
    expect(meta.size_bytes).toBe(dummyPdfContent.length)
    expect(meta.created_at).toBeDefined()
  })

  it('rejects non-existent document ID with not-found error', async () => {
    const nonExistentId = uuidv4()

    await expect(
      invokeHandler(
        'pdf:get-document-bytes',
        { sender: fakeWebContents },
        { documentId: nonExistentId }
      )
    ).rejects.toThrow(/PDF document not found/)
  })

  it('rejects invalid UUID formats', async () => {
    await expect(
      invokeHandler(
        'pdf:get-document-bytes',
        { sender: fakeWebContents },
        { documentId: 'not-a-uuid' }
      )
    ).rejects.toThrow(/Validation error/)
  })

  it('rejects non-PDF files when requesting PDF bytes', async () => {
    const textContent = 'This is plain notes, not a PDF document.'
    const sourceTxt = join(testTempDir, 'lecture_notes.txt')
    writeFileSync(sourceTxt, textContent)

    const importedDoc = fileLibrary.importFile(sourceTxt, { displayName: 'lecture_notes.txt' })

    await expect(
      invokeHandler(
        'pdf:get-document-bytes',
        { sender: fakeWebContents },
        { documentId: importedDoc.id }
      )
    ).rejects.toThrow(/not a PDF file/)
  })

  it('safely handles missing disk files with descriptive error', async () => {
    const dummyPdfContent = Buffer.from('%PDF-1.4\n%Missing File Test\n%%EOF')
    const sourcePdf = join(testTempDir, 'temp_to_delete.pdf')
    writeFileSync(sourcePdf, dummyPdfContent)

    const importedDoc = fileLibrary.importFile(sourcePdf, { displayName: 'Temp Assignment.pdf' })

    // Simulate external deletion of physical file from vault
    const fullPath = fileLibrary.toAbsolutePath(importedDoc.relative_path)
    unlinkSync(fullPath)

    await expect(
      invokeHandler(
        'pdf:get-document-bytes',
        { sender: fakeWebContents },
        { documentId: importedDoc.id }
      )
    ).rejects.toThrow(/missing from vault storage/)
  })

  it('guards against path traversal in relative paths', async () => {
    const maliciousDoc = documentRepo.createDocument({
      display_name: 'evil.pdf',
      relative_path: '../../../etc/passwd',
      mime_type: 'application/pdf'
    })

    await expect(
      invokeHandler(
        'pdf:get-document-bytes',
        { sender: fakeWebContents },
        { documentId: maliciousDoc.id }
      )
    ).rejects.toThrow(/Path traversal attempt detected/)
  })

  it('rejects untrusted sender webContents', async () => {
    const rogueSender = { id: 999 }

    await expect(
      invokeHandler(
        'pdf:get-document-bytes',
        { sender: rogueSender },
        { documentId: uuidv4() }
      )
    ).rejects.toThrow(/IPC call rejected: sender is not a trusted application window/)
  })
})
