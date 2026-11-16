import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  unlinkSync
} from 'fs'
import { createHash } from 'crypto'
import AdmZip from 'adm-zip'
import { runMigrationsFromDir } from '../../db/connection'
import { createDocumentRepo, DocumentRepo } from '../../db/repositories/documents'
import { createTaskRepo, TaskRepo } from '../../db/repositories/tasks'
import { createSubjectRepo, SubjectRepo } from '../../db/repositories/subjects'
import { createTaskDocRepo, TaskDocRepo } from '../../db/repositories/taskDocs'
import { createFileLibraryService, FileLibraryService } from '../fileLibrary'
import { createBackupService, BackupService } from '../backupService'
import { getAppPaths } from '../../utils/paths'

describe('Full Manual Backup, Safe Staging, & Atomic Restore', () => {
  process.env.TEST_USER_DATA_DIR = join(process.cwd(), 'scratch', 'test_backup_userdata')

  let db: Database.Database
  let documentRepo: DocumentRepo
  let taskRepo: TaskRepo
  let subjectRepo: SubjectRepo
  let taskDocRepo: TaskDocRepo
  let fileLibrary: FileLibraryService
  let backupService: BackupService

  const testTempDir = join(process.cwd(), 'scratch', 'test_backup_restore')
  const { libraryRoot, appDataDir, dbPath } = getAppPaths()

  beforeEach(() => {
    mkdirSync(testTempDir, { recursive: true })
    if (existsSync(libraryRoot)) {
      rmSync(libraryRoot, { recursive: true, force: true })
    }
    mkdirSync(libraryRoot, { recursive: true })
    mkdirSync(appDataDir, { recursive: true })

    // Open disk-backed test DB at dbPath for realistic SQLite backup API testing
    if (existsSync(dbPath)) unlinkSync(dbPath)
    if (existsSync(dbPath + '-wal')) unlinkSync(dbPath + '-wal')
    if (existsSync(dbPath + '-shm')) unlinkSync(dbPath + '-shm')

    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrationsFromDir(db, join(process.cwd(), 'src/main/db/migrations'))

    documentRepo = createDocumentRepo(db)
    taskRepo = createTaskRepo(db)
    subjectRepo = createSubjectRepo(db)
    taskDocRepo = createTaskDocRepo(db)
    fileLibrary = createFileLibraryService(documentRepo, undefined, taskDocRepo)

    backupService = createBackupService(
      () => db,
      '0.1.0',
      (newDb) => {
        db = newDb
        documentRepo = createDocumentRepo(db)
        taskRepo = createTaskRepo(db)
        subjectRepo = createSubjectRepo(db)
        taskDocRepo = createTaskDocRepo(db)
        fileLibrary = createFileLibraryService(documentRepo, undefined, taskDocRepo)
      }
    )
  })

  afterEach(() => {
    try {
      db.close()
    } catch {}

    if (existsSync(testTempDir)) {
      rmSync(testTempDir, { recursive: true, force: true })
    }
    if (existsSync(appDataDir)) {
      rmSync(appDataDir, { recursive: true, force: true })
    }
  })

  it('performs full backup and restore round trip with file integrity verification', async () => {
    // 1. Setup sample academic dataset: subject, task, and physical attachments
    const subject = subjectRepo.create({
      name: 'Advanced Operating Systems',
      code: 'CS-401',
      color: '#4F46E5',
      semester: 'Fall 2026'
    })

    const task = taskRepo.create({
      subject_id: subject.id,
      type: 'assignment',
      title: 'Lab 1: Kernel Synchronization',
      priority: 'high',
      due_date: '2026-11-20'
    })

    const samplePdfContent = Buffer.from('%PDF-1.4\n%Kernel Synchronization Spec\n%%EOF')
    const sourceFilePath = join(testTempDir, 'kernel_spec.pdf')
    writeFileSync(sourceFilePath, samplePdfContent)

    const imported = fileLibrary.importTaskDocument(task.id, sourceFilePath, 'assignment_file', {
      displayName: 'Assignment Spec.pdf'
    })

    const attachedDoc = documentRepo.getDocumentById(imported.document.id)
    expect(attachedDoc).toBeDefined()
    expect(existsSync(fileLibrary.toAbsolutePath(attachedDoc!.relative_path))).toBe(true)

    // 2. Export Backup to ZIP
    const targetZip = join(testTempDir, 'full_academic_backup.zip')
    const exportResult = await backupService.exportBackup(targetZip)

    expect(exportResult.canceled).toBe(false)
    expect(exportResult.totalFiles).toBe(1)
    expect(existsSync(targetZip)).toBe(true)

    // Verify ZIP contents directly
    const zip = new AdmZip(targetZip)
    expect(zip.getEntry('campusdeck.db')).toBeDefined()
    expect(zip.getEntry('manifest.json')).toBeDefined()
    expect(zip.getEntry(`library/${attachedDoc!.relative_path}`)).toBeDefined()

    const manifest = JSON.parse(zip.getEntry('manifest.json')!.getData().toString('utf-8'))
    expect(manifest.version).toBe(1)
    expect(manifest.schema_version).toBe(3)
    expect(manifest.files).toHaveLength(1)
    expect(manifest.files[0].relative_path).toBe(attachedDoc!.relative_path)
    expect(manifest.files[0].sha256).toBe(
      createHash('sha256').update(samplePdfContent).digest('hex')
    )

    // 3. Simulate catastrophic data loss or migration: modify/wipe database and delete physical file
    subjectRepo.create({ name: 'Distraction Course' })
    unlinkSync(fileLibrary.toAbsolutePath(attachedDoc!.relative_path))
    expect(existsSync(fileLibrary.toAbsolutePath(attachedDoc!.relative_path))).toBe(false)

    // 4. Restore from Backup
    const restoreResult = await backupService.restoreBackup(targetZip)
    expect(restoreResult.success).toBe(true)
    expect(restoreResult.restoredFiles).toBe(1)
    expect(restoreResult.schemaVersion).toBe(3)

    // 5. Verify restored state
    const restoredSubjects = subjectRepo.list()
    expect(restoredSubjects).toHaveLength(1)
    expect(restoredSubjects[0]!.name).toBe('Advanced Operating Systems')

    const restoredTasks = taskRepo.list()
    expect(restoredTasks).toHaveLength(1)
    expect(restoredTasks[0]!.title).toBe('Lab 1: Kernel Synchronization')

    const restoredDocs = taskDocRepo.listByTask(task.id)
    expect(restoredDocs).toHaveLength(1)
    expect(restoredDocs[0]!.display_name).toBe('Assignment Spec.pdf')

    // Physical file must be fully restored and match exact SHA-256
    const restoredFileFullPath = fileLibrary.toAbsolutePath(attachedDoc!.relative_path)
    expect(existsSync(restoredFileFullPath)).toBe(true)
    const restoredBytes = readFileSync(restoredFileFullPath)
    expect(createHash('sha256').update(restoredBytes).digest('hex')).toBe(
      createHash('sha256').update(samplePdfContent).digest('hex')
    )
  })

  it('rejects corrupt or malformed archive files', async () => {
    const corruptZipPath = join(testTempDir, 'corrupt.zip')
    writeFileSync(corruptZipPath, Buffer.from('NOT A VALID ZIP ARCHIVE CONTENT'))

    await expect(backupService.restoreBackup(corruptZipPath)).rejects.toThrow(
      /Corrupt or invalid ZIP archive/
    )
  })

  it('rejects archives missing manifest.json or campusdeck.db', async () => {
    const invalidZipPath = join(testTempDir, 'missing_manifest.zip')
    const zip = new AdmZip()
    zip.addFile('dummy.txt', Buffer.from('hello'))
    zip.writeZip(invalidZipPath)

    await expect(backupService.restoreBackup(invalidZipPath)).rejects.toThrow(
      /missing required manifest\.json/
    )
  })

  it('strictly rejects archives with path traversal entries', async () => {
    const maliciousZipPath = join(testTempDir, 'malicious_traversal.zip')
    const zip = new AdmZip()
    zip.addFile('campusdeck.db', Buffer.from('SQLite format 3\0'))
    zip.addFile(
      'manifest.json',
      Buffer.from(
        JSON.stringify({
          version: 1,
          app_version: '0.1.0',
          created_at: new Date().toISOString(),
          schema_version: 3,
          database_file: 'campusdeck.db',
          files: []
        })
      )
    )
    // Add path traversal entry directly
    zip.addFile('evil.txt', Buffer.from('exploit payload'))
    const entry = zip.getEntries().find((e) => e.entryName === 'evil.txt')
    if (entry) {
      entry.entryName = '../../etc/evil.txt'
    }
    zip.writeZip(maliciousZipPath)

    await expect(backupService.restoreBackup(maliciousZipPath)).rejects.toThrow(
      /Path traversal or absolute entry detected/
    )
  })

  it('rejects archives with incompatible future schema versions', async () => {
    const futureSchemaZip = join(testTempDir, 'future_schema.zip')
    const zip = new AdmZip()
    zip.addFile('campusdeck.db', Buffer.from('SQLite format 3\0'))
    zip.addFile(
      'manifest.json',
      Buffer.from(
        JSON.stringify({
          version: 1,
          app_version: '2.0.0',
          created_at: new Date().toISOString(),
          schema_version: 999, // Future unsupported schema version
          database_file: 'campusdeck.db',
          files: []
        })
      )
    )
    zip.writeZip(futureSchemaZip)

    await expect(backupService.restoreBackup(futureSchemaZip)).rejects.toThrow(
      /newer than this application supports/
    )
  })

  it('detects missing files or checksum mismatches declared in manifest', async () => {
    const tamperedZipPath = join(testTempDir, 'tampered.zip')
    const zip = new AdmZip()
    zip.addFile('campusdeck.db', Buffer.from('SQLite format 3\0'))
    zip.addFile(
      'manifest.json',
      Buffer.from(
        JSON.stringify({
          version: 1,
          app_version: '0.1.0',
          created_at: new Date().toISOString(),
          schema_version: 3,
          database_file: 'campusdeck.db',
          files: [
            {
              relative_path: 'doc1.pdf',
              size_bytes: 100,
              sha256: 'deadbeef00000000000000000000000000000000000000000000000000000000'
            }
          ]
        })
      )
    )
    // Add doc1.pdf with mismatched content
    zip.addFile('library/doc1.pdf', Buffer.from('completely different content'))
    zip.writeZip(tamperedZipPath)

    await expect(backupService.restoreBackup(tamperedZipPath)).rejects.toThrow(
      /Integrity check failed: SHA-256 hash mismatch/
    )
  })

  it('calculates storage usage correctly across database and files', () => {
    const usageBefore = backupService.getStorageUsage()
    expect(usageBefore.dbSizeBytes).toBeGreaterThan(0)
    expect(usageBefore.fileCount).toBe(0)

    // Add a file
    writeFileSync(join(libraryRoot, 'test_file.pdf'), Buffer.alloc(5000, 1))

    const usageAfter = backupService.getStorageUsage()
    expect(usageAfter.librarySizeBytes).toBe(5000)
    expect(usageAfter.fileCount).toBe(1)
    expect(usageAfter.totalSizeBytes).toBe(usageAfter.dbSizeBytes + 5000)
  })
})
