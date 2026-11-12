import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { writeFileSync, existsSync, mkdirSync, rmSync } from 'fs'
import { runMigrationsFromDir } from '../../db/connection'
import { createDocumentRepo, DocumentRepo } from '../../db/repositories/documents'
import { createSubjectDocRepo, SubjectDocRepo } from '../../db/repositories/subjectDocs'
import { createTaskDocRepo, TaskDocRepo } from '../../db/repositories/taskDocs'
import { createTaskRepo, TaskRepo } from '../../db/repositories/tasks'
import { createFileLibraryService, FileLibraryService } from '../fileLibrary'
import { getAppPaths } from '../../utils/paths'

describe('File Library Safety, Boundary & Failure Modes', () => {
  let db: Database.Database
  let documentRepo: DocumentRepo
  let subjectDocRepo: SubjectDocRepo
  let taskDocRepo: TaskDocRepo
  let taskRepo: TaskRepo
  let fileLibrary: FileLibraryService

  const testTempDir = join(process.cwd(), 'scratch', 'test_file_lib_errors')
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
    taskRepo = createTaskRepo(db)
    fileLibrary = createFileLibraryService(documentRepo, subjectDocRepo, taskDocRepo)
  })

  afterEach(() => {
    try {
      db?.close()
    } catch {}
    if (existsSync(testTempDir)) {
      rmSync(testTempDir, { recursive: true, force: true })
    }
  })

  it('throws descriptive error when attempting to import non-existent source file', () => {
    const nonExistentPath = join(testTempDir, 'does_not_exist_file.pdf')
    expect(() => {
      fileLibrary.importFile(nonExistentPath)
    }).toThrow(/Source file does not exist/)
  })

  it('rejects unsupported executable and script file types', () => {
    const dangerousFiles = ['trojan.exe', 'script.sh', 'binary.bin', 'package.deb', 'installer.msi']

    for (const name of dangerousFiles) {
      const f = join(testTempDir, name)
      writeFileSync(f, 'content')
      expect(() => {
        fileLibrary.importFile(f)
      }).toThrow(/Unsupported file type/)
    }
  })

  it('prevents path traversal attempts in toAbsolutePath', () => {
    expect(() => {
      fileLibrary.toAbsolutePath('../../../etc/passwd')
    }).toThrow(/Path traversal attempt/)

    expect(() => {
      fileLibrary.toAbsolutePath('/etc/shadow')
    }).toThrow(/Path traversal attempt/)
  })

  it('preserves physical file when attachment is unlinked from task', () => {
    const task = taskRepo.create({ type: 'assignment', title: 'Calculus Assignment' })
    const pdfFile = join(testTempDir, 'calculus_worksheet.pdf')
    writeFileSync(pdfFile, 'Calculus content')

    const imported = fileLibrary.importTaskDocument(task.id, pdfFile, 'assignment_file')
    const fullVaultPath = fileLibrary.toAbsolutePath(imported.document.relative_path)
    expect(existsSync(fullVaultPath)).toBe(true)

    // Unlink
    taskDocRepo.unlink(imported.taskDocument.id)

    // Task has 0 attachments
    expect(taskDocRepo.listByTask(task.id)).toHaveLength(0)

    // Vault file and document row are preserved
    expect(existsSync(fullVaultPath)).toBe(true)
    expect(documentRepo.getDocumentById(imported.document.id)).not.toBeNull()
  })

  it('handles multiple concurrent attachments to a single task gracefully', () => {
    const task = taskRepo.create({ type: 'project', title: 'Robotics Project' })
    const files = ['spec.pdf', 'schematic.png', 'notes.txt']

    const fileInfos = files.map((name) => {
      const path = join(testTempDir, name)
      writeFileSync(path, `Content of ${name}`)
      return { filePath: path, displayName: name }
    })

    const results = fileLibrary.importMultipleTaskDocuments(task.id, fileInfos, 'reference')
    expect(results).toHaveLength(3)

    const attachments = taskDocRepo.listByTask(task.id)
    expect(attachments).toHaveLength(3)
    expect(attachments.every((a) => a.file_exists === true)).toBe(true)
  })
})
