import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  readdirSync,
  unlinkSync,
  copyFileSync,
  cpSync,
  rmSync
} from 'fs'
import { join, resolve, dirname } from 'path'
import { createHash } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import AdmZip from 'adm-zip'
import type Database from 'better-sqlite3'
import { getAppPaths } from '../utils/paths'
import { closeDatabase, openDatabase } from '../db/connection'
import type {
  BackupManifest,
  BackupManifestFileEntry,
  BackupExportResult,
  BackupRestoreResult,
  BackupValidationResult,
  StorageUsageInfo
} from '../../shared/types'

// Current maximum schema version supported by migrations
export const CURRENT_MAX_SCHEMA_VERSION = 4
export const BACKUP_FORMAT_VERSION = 1

/**
 * Creates the backup service handling consistent SQLite snapshot creation,
 * ZIP packaging with manifest integrity verification, staging extraction,
 * and safe atomic swap with rollback.
 */
export function createBackupService(
  getDb: () => Database.Database,
  appVersion = '0.2.0',
  onDatabaseReopened?: (newDb: Database.Database) => void
) {
  const paths = getAppPaths()

  /**
   * Calculates local storage utilization for the database and library.
   */
  function getStorageUsage(): StorageUsageInfo {
    let dbSizeBytes = 0
    for (const f of [paths.dbPath, paths.dbPath + '-wal', paths.dbPath + '-shm']) {
      if (existsSync(f)) {
        try {
          dbSizeBytes += statSync(f).size
        } catch {}
      }
    }

    let librarySizeBytes = 0
    let fileCount = 0
    if (existsSync(paths.libraryRoot)) {
      try {
        const files = readdirSync(paths.libraryRoot)
        for (const file of files) {
          const full = join(paths.libraryRoot, file)
          try {
            const st = statSync(full)
            if (st.isFile()) {
              librarySizeBytes += st.size
              fileCount++
            }
          } catch {}
        }
      } catch {}
    }

    return {
      dbSizeBytes,
      librarySizeBytes,
      totalSizeBytes: dbSizeBytes + librarySizeBytes,
      fileCount
    }
  }

  /**
   * Generates a complete manual backup into a user-selected ZIP file.
   * Uses SQLite's native online backup API for a consistent database snapshot.
   */
  async function exportBackup(targetZipPath: string): Promise<BackupExportResult> {
    if (!targetZipPath.toLowerCase().endsWith('.zip')) {
      targetZipPath += '.zip'
    }

    const parentDir = dirname(targetZipPath)
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true })
    }

    const tempDir = join(paths.appDataDir, `temp_backup_${uuidv4()}`)
    mkdirSync(tempDir, { recursive: true })

    try {
      const db = getDb()

      // Determine current schema version from database migrations
      let schemaVersion = 1
      try {
        const row = db
          .prepare('SELECT MAX(version) as version FROM schema_migrations')
          .get() as { version: string } | undefined
        if (row?.version) {
          const match = String(row.version).match(/^(\d+)/)
          schemaVersion = match && match[1] ? parseInt(match[1], 10) : 1
        }
      } catch {
        schemaVersion = 1
      }

      // 1. Consistent SQLite online snapshot
      const tempDbSnapshot = join(tempDir, 'campusdeck.db')
      await db.backup(tempDbSnapshot)

      // 2. Gather library files & compute integrity hashes
      const manifestFiles: BackupManifestFileEntry[] = []
      if (existsSync(paths.libraryRoot)) {
        const files = readdirSync(paths.libraryRoot)
        for (const file of files) {
          const fullPath = join(paths.libraryRoot, file)
          try {
            const st = statSync(fullPath)
            if (st.isFile()) {
              const fileData = readFileSync(fullPath)
              const sha256 = createHash('sha256').update(fileData).digest('hex')
              manifestFiles.push({
                relative_path: file,
                size_bytes: st.size,
                sha256
              })
            }
          } catch (err) {
            console.warn(`[BackupService] Skipping unreadable file ${file}:`, err)
          }
        }
      }

      // 3. Build manifest
      const manifest: BackupManifest = {
        version: BACKUP_FORMAT_VERSION,
        app_version: appVersion,
        created_at: new Date().toISOString(),
        schema_version: schemaVersion,
        database_file: 'campusdeck.db',
        files: manifestFiles
      }

      const manifestPath = join(tempDir, 'manifest.json')
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

      // 4. Create ZIP archive using adm-zip
      const zip = new AdmZip()
      zip.addLocalFile(tempDbSnapshot, '')
      zip.addLocalFile(manifestPath, '')

      if (existsSync(paths.libraryRoot) && manifestFiles.length > 0) {
        zip.addLocalFolder(paths.libraryRoot, 'library')
      }

      zip.writeZip(targetZipPath)

      return {
        canceled: false,
        backupPath: targetZipPath,
        totalFiles: manifestFiles.length,
        totalSizeBytes: statSync(targetZipPath).size
      }
    } finally {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true })
      }
    }
  }

  /**
   * Inspects and validates a backup ZIP archive without altering application data.
   */
  function validateBackupArchive(zipPath: string): BackupValidationResult {
    if (!existsSync(zipPath)) {
      return { valid: false, error: `Backup archive not found at: ${zipPath}` }
    }

    let zip: AdmZip
    try {
      zip = new AdmZip(zipPath)
    } catch (err) {
      return {
        valid: false,
        error: `Corrupt or invalid ZIP archive: ${err instanceof Error ? err.message : String(err)}`
      }
    }

    const entries = zip.getEntries()
    if (!entries || entries.length === 0) {
      return { valid: false, error: 'Backup archive is empty.' }
    }

    // Security check: reject path traversal or absolute paths in archive entries
    for (const entry of entries) {
      const name = entry.entryName
      if (
        name.includes('..') ||
        name.startsWith('/') ||
        name.startsWith('\\') ||
        /^[a-zA-Z]:/.test(name) ||
        name.includes('\0')
      ) {
        return {
          valid: false,
          error: `Security violation: Path traversal or absolute entry detected ("${name}").`
        }
      }
    }

    // Required files check
    const manifestEntry = entries.find((e) => e.entryName === 'manifest.json')
    const dbEntry = entries.find((e) => e.entryName === 'campusdeck.db')

    if (!manifestEntry) {
      return { valid: false, error: 'Archive is missing required manifest.json.' }
    }

    if (!dbEntry) {
      return { valid: false, error: 'Archive is missing required database file (campusdeck.db).' }
    }

    // Manifest validation
    let manifest: BackupManifest
    try {
      manifest = JSON.parse(manifestEntry.getData().toString('utf-8'))
    } catch {
      return { valid: false, error: 'manifest.json is malformed or corrupted.' }
    }

    if (!manifest.version || typeof manifest.schema_version !== 'number' || !Array.isArray(manifest.files)) {
      return { valid: false, error: 'manifest.json is missing required schema fields.' }
    }

    for (const file of manifest.files) {
      if (
        !file.relative_path ||
        file.relative_path.includes('..') ||
        file.relative_path.startsWith('/') ||
        file.relative_path.startsWith('\\') ||
        /^[a-zA-Z]:/.test(file.relative_path)
      ) {
        return {
          valid: false,
          error: `Security violation: Path traversal or invalid relative path detected in manifest ("${file.relative_path}").`
        }
      }
    }

    if (manifest.version > BACKUP_FORMAT_VERSION) {
      return {
        valid: false,
        error: `Incompatible backup format version (${manifest.version}). Please update CampusDeck.`
      }
    }

    if (manifest.schema_version > CURRENT_MAX_SCHEMA_VERSION) {
      return {
        valid: false,
        error: `Backup database schema version (${manifest.schema_version}) is newer than this application supports (max: ${CURRENT_MAX_SCHEMA_VERSION}). Please update CampusDeck.`
      }
    }

    return { valid: true, manifest }
  }

  /**
   * Safely restores a backup archive into active application storage.
   * Uses a staging directory, full hash verification, and an atomic swap with rollback.
   */
  async function restoreBackup(zipPath: string): Promise<BackupRestoreResult> {
    const validation = validateBackupArchive(zipPath)
    if (!validation.valid || !validation.manifest) {
      throw new Error(validation.error || 'Backup archive validation failed.')
    }

    const manifest = validation.manifest
    const stagingDir = join(paths.appDataDir, `staging_restore_${Date.now()}_${uuidv4()}`)
    const rollbackDir = join(paths.appDataDir, `rollback_${Date.now()}_${uuidv4()}`)
    mkdirSync(stagingDir, { recursive: true })

    const zip = new AdmZip(zipPath)
    const normalizedStaging = resolve(stagingDir)

    // 1. Extract into staging directory with containment assertions
    for (const entry of zip.getEntries()) {
      const targetPath = resolve(stagingDir, entry.entryName)
      if (!targetPath.startsWith(normalizedStaging)) {
        throw new Error(
          `Path traversal violation during extraction: ${entry.entryName} writes outside staging directory.`
        )
      }

      if (entry.isDirectory) {
        mkdirSync(targetPath, { recursive: true })
      } else {
        mkdirSync(dirname(targetPath), { recursive: true })
        writeFileSync(targetPath, entry.getData())
      }
    }

    // 2. Validate file integrity & checksums in staging
    const stagedDb = join(stagingDir, 'campusdeck.db')
    if (!existsSync(stagedDb)) {
      throw new Error('Extracted staging directory is missing campusdeck.db.')
    }

    for (const fileEntry of manifest.files) {
      const stagedFilePath = join(stagingDir, 'library', fileEntry.relative_path)
      if (!existsSync(stagedFilePath)) {
        throw new Error(`Integrity check failed: missing library file "${fileEntry.relative_path}".`)
      }

      const fileData = readFileSync(stagedFilePath)
      const actualHash = createHash('sha256').update(fileData).digest('hex')
      if (actualHash !== fileEntry.sha256) {
        throw new Error(
          `Integrity check failed: SHA-256 hash mismatch for "${fileEntry.relative_path}".`
        )
      }
    }

    // 3. Atomic Swap with Rollback Protection
    mkdirSync(rollbackDir, { recursive: true })

    try {
      // Step A: Close active database handle
      closeDatabase()

      // Step B: Copy active data into rollback directory
      if (existsSync(paths.dbPath)) {
        copyFileSync(paths.dbPath, join(rollbackDir, 'campusdeck.db'))
      }
      if (existsSync(paths.dbPath + '-wal')) {
        copyFileSync(paths.dbPath + '-wal', join(rollbackDir, 'campusdeck.db-wal'))
      }
      if (existsSync(paths.dbPath + '-shm')) {
        copyFileSync(paths.dbPath + '-shm', join(rollbackDir, 'campusdeck.db-shm'))
      }
      if (existsSync(paths.libraryRoot)) {
        const rollbackLib = join(rollbackDir, 'library')
        mkdirSync(rollbackLib, { recursive: true })
        cpSync(paths.libraryRoot, rollbackLib, { recursive: true })
      }

      // Step C: Remove existing database and library files
      if (existsSync(paths.dbPath)) unlinkSync(paths.dbPath)
      if (existsSync(paths.dbPath + '-wal')) unlinkSync(paths.dbPath + '-wal')
      if (existsSync(paths.dbPath + '-shm')) unlinkSync(paths.dbPath + '-shm')

      if (existsSync(paths.libraryRoot)) {
        rmSync(paths.libraryRoot, { recursive: true, force: true })
      }
      mkdirSync(paths.libraryRoot, { recursive: true })

      // Step D: Swap staged files into place
      copyFileSync(stagedDb, paths.dbPath)
      const stagedLibDir = join(stagingDir, 'library')
      if (existsSync(stagedLibDir)) {
        cpSync(stagedLibDir, paths.libraryRoot, { recursive: true })
      }

      // Step E: Reopen database and verify readability
      const restoredDb = openDatabase(paths.dbPath)
      restoredDb.prepare('SELECT COUNT(*) FROM subjects').get()

      // Rebind active repositories if handler provided
      if (onDatabaseReopened) {
        onDatabaseReopened(restoredDb)
      }

      // Clean up staging and rollback
      rmSync(stagingDir, { recursive: true, force: true })
      rmSync(rollbackDir, { recursive: true, force: true })

      return {
        canceled: false,
        success: true,
        restoredFiles: manifest.files.length,
        schemaVersion: manifest.schema_version
      }
    } catch (swapErr) {
      console.error('[BackupService] Restore swap failed, executing automatic rollback:', swapErr)

      try {
        closeDatabase()

        // Roll back database files
        if (existsSync(join(rollbackDir, 'campusdeck.db'))) {
          copyFileSync(join(rollbackDir, 'campusdeck.db'), paths.dbPath)
        }
        if (existsSync(join(rollbackDir, 'campusdeck.db-wal'))) {
          copyFileSync(join(rollbackDir, 'campusdeck.db-wal'), paths.dbPath + '-wal')
        }
        if (existsSync(join(rollbackDir, 'campusdeck.db-shm'))) {
          copyFileSync(join(rollbackDir, 'campusdeck.db-shm'), paths.dbPath + '-shm')
        }

        // Roll back file library
        if (existsSync(join(rollbackDir, 'library'))) {
          if (existsSync(paths.libraryRoot)) {
            rmSync(paths.libraryRoot, { recursive: true, force: true })
          }
          mkdirSync(paths.libraryRoot, { recursive: true })
          cpSync(join(rollbackDir, 'library'), paths.libraryRoot, { recursive: true })
        }

        const rolledBackDb = openDatabase(paths.dbPath)
        if (onDatabaseReopened) {
          onDatabaseReopened(rolledBackDb)
        }
      } catch (rollbackErr) {
        console.error('[BackupService] Critical rollback error:', rollbackErr)
      } finally {
        if (existsSync(stagingDir)) rmSync(stagingDir, { recursive: true, force: true })
        if (existsSync(rollbackDir)) rmSync(rollbackDir, { recursive: true, force: true })
      }

      throw swapErr
    }
  }

  return {
    getStorageUsage,
    exportBackup,
    validateBackupArchive,
    restoreBackup
  }
}

export type BackupService = ReturnType<typeof createBackupService>
