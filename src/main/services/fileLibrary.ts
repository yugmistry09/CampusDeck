import { copyFileSync, existsSync, mkdirSync, unlinkSync, statSync } from 'fs'
import { basename, extname, resolve } from 'path'
import { dialog, shell, BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import type { DocumentRepo, DocumentCreateInput } from '../db/repositories/documents'
import type { SubjectDocRepo } from '../db/repositories/subjectDocs'
import type { TaskDocRepo } from '../db/repositories/taskDocs'
import type {
  DocumentRow,
  TaskDocumentRole,
  TaskDocumentRecord,
  SubjectDocumentType,
  SubjectDocumentRecord
} from '../../shared/types'
import { getAppPaths } from '../utils/paths'

// ---------------------------------------------------------------------------
// Supported File Types Configuration
// Supports PDFs, images, Office formats, and plain text files.
// ---------------------------------------------------------------------------

export const SUPPORTED_EXTENSIONS_MAP: Record<string, string> = {
  // PDF
  '.pdf': 'application/pdf',

  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',

  // Office Documents
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',

  // Text
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.rtf': 'application/rtf'
}

export function isSupportedFileType(filename: string): boolean {
  const ext = extname(filename).toLowerCase()
  return ext in SUPPORTED_EXTENSIONS_MAP
}

export function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  return SUPPORTED_EXTENSIONS_MAP[ext] || 'application/octet-stream'
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

// ---------------------------------------------------------------------------
// File Library Service
// Keeps file-storage code strictly behind main-process services.
// Copies files into an app-managed local library, preserves originals,
// assigns unique internal storage names, and stores database paths
// relative to the library root (D-004, D-005).
// ---------------------------------------------------------------------------

export function createFileLibraryService(
  documentRepo: DocumentRepo,
  subjectDocRepo?: SubjectDocRepo,
  taskDocRepo?: TaskDocRepo
) {
  const { libraryRoot } = getAppPaths()

  function ensureLibraryExists(): void {
    if (!existsSync(libraryRoot)) {
      mkdirSync(libraryRoot, { recursive: true })
    }
  }

  function assertSafeRelativePath(relativePath: string): string {
    const fullPath = resolve(libraryRoot, relativePath)
    const normalizedRoot = resolve(libraryRoot)
    if (!fullPath.startsWith(normalizedRoot)) {
      throw new Error(`Path traversal attempt detected: ${relativePath}`)
    }
    return fullPath
  }

  return {
    /**
     * Displays native open file dialog for user selection.
     */
    async showNativeFileDialog(
      parentWindow?: BrowserWindow | null,
      options?: { allowMultiple?: boolean; title?: string }
    ): Promise<{
      canceled: boolean
      filePath?: string
      fileName?: string
      fileSize?: number
      mimeType?: string
      files?: Array<{
        filePath: string
        fileName: string
        fileSize: number
        mimeType: string
      }>
    }> {
      const allowedExtensions = Object.keys(SUPPORTED_EXTENSIONS_MAP).map((ext) =>
        ext.replace('.', '')
      )

      const win = parentWindow || BrowserWindow.getFocusedWindow() || undefined
      const properties: Array<'openFile' | 'multiSelections'> = ['openFile']
      if (options?.allowMultiple) {
        properties.push('multiSelections')
      }

      const result = await dialog.showOpenDialog(win!, {
        title: options?.title || 'Select Academic Document',
        properties,
        filters: [
          {
            name: 'All Supported Academic Documents',
            extensions: allowedExtensions
          },
          { name: 'PDF Documents (*.pdf)', extensions: ['pdf'] },
          { name: 'Images (*.png, *.jpg, *.jpeg, *.webp)', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] },
          { name: 'Office Documents (*.docx, *.pptx, *.xlsx)', extensions: ['docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'odt'] },
          { name: 'Text Documents (*.txt, *.md, *.csv)', extensions: ['txt', 'md', 'csv', 'rtf'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true }
      }

      const selectedFiles = result.filePaths.map((filePath) => {
        const fileName = basename(filePath)
        if (!isSupportedFileType(fileName)) {
          throw new Error(
            `Unsupported file format "${extname(fileName)}" for file "${fileName}". Supported formats: PDF, Images, Word, PowerPoint, Excel, and Text.`
          )
        }
        const stats = statSync(filePath)
        return {
          filePath,
          fileName,
          fileSize: stats.size,
          mimeType: getMimeType(fileName)
        }
      })

      const primary = selectedFiles[0]!
      return {
        canceled: false,
        filePath: primary.filePath,
        fileName: primary.fileName,
        fileSize: primary.fileSize,
        mimeType: primary.mimeType,
        files: selectedFiles
      }
    },

    /**
     * Imports an external file into the managed local library.
     * The original file is preserved; a copy is created with a unique UUID-prefixed name.
     * The database record stores the path relative to libraryRoot.
     */
    importFile(
      sourcePath: string,
      options?: {
        displayName?: string
        mimeType?: string
      }
    ): DocumentRow {
      if (!existsSync(sourcePath)) {
        throw new Error(`Source file does not exist: ${sourcePath}`)
      }

      ensureLibraryExists()

      const originalName = options?.displayName || basename(sourcePath)

      if (!isSupportedFileType(originalName)) {
        throw new Error(
          `Unsupported file type for "${originalName}". Only PDFs, Images, Office documents, and Text files are accepted.`
        )
      }

      const sanitized = sanitizeFilename(originalName)
      const uniqueFileName = `${uuidv4()}_${sanitized}`
      const destinationPath = assertSafeRelativePath(uniqueFileName)

      // Copy into managed library
      try {
        copyFileSync(sourcePath, destinationPath)
      } catch (err) {
        throw new Error(`Failed to copy file into managed library: ${err instanceof Error ? err.message : String(err)}`)
      }

      let stats: { size: number }
      try {
        stats = statSync(destinationPath)
      } catch (err) {
        if (existsSync(destinationPath)) unlinkSync(destinationPath)
        throw new Error(`Failed to read imported file metadata: ${err instanceof Error ? err.message : String(err)}`)
      }

      try {
        const docInput: DocumentCreateInput = {
          display_name: originalName,
          relative_path: uniqueFileName,
          mime_type: options?.mimeType || getMimeType(originalName),
          size_bytes: stats.size
        }
        return documentRepo.createDocument(docInput)
      } catch (dbErr) {
        // Rollback disk copy on DB failure to avoid orphaned files
        if (existsSync(destinationPath)) {
          try {
            unlinkSync(destinationPath)
          } catch {
            // ignore cleanup error
          }
        }
        throw dbErr
      }
    },

    /**
     * Atomically imports a file and creates a subject document record.
     */
    importSubjectDocument(
      subjectId: string,
      sourcePath: string,
      metadata: {
        title: string
        type: SubjectDocumentType
        description?: string
      }
    ): SubjectDocumentRecord {
      if (!subjectDocRepo) {
        throw new Error('subjectDocRepo not configured in FileLibraryService')
      }

      // Import file into library
      const doc = this.importFile(sourcePath)

      try {
        subjectDocRepo.create({
          subject_id: subjectId,
          document_id: doc.id,
          type: metadata.type,
          title: metadata.title.trim() || doc.display_name,
          description: metadata.description?.trim() || ''
        })

        const created = subjectDocRepo.getById(doc.id)
        if (!created) {
          // Fallback query by subject
          const list = subjectDocRepo.listBySubject(subjectId)
          const found = list.find((d) => d.document_id === doc.id)
          if (found) return found
          throw new Error('Failed to retrieve created subject document')
        }
        return created
      } catch (err) {
        // Clean up document and file if subject document creation fails
        this.deleteDocument(doc.id)
        throw err
      }
    },

    /**
     * Imports a file and attaches it to a task with a given role and optional variant label.
     */
    importTaskDocument(
      taskId: string,
      sourcePath: string,
      role: TaskDocumentRole,
      options?: {
        displayName?: string
        variantLabel?: string | null
        mimeType?: string
      }
    ) {
      const doc = this.importFile(sourcePath, options)
      if (taskDocRepo) {
        const link = taskDocRepo.link({
          taskId,
          documentId: doc.id,
          role,
          variantLabel: options?.variantLabel ?? null
        })
        return { document: doc, taskDocument: link }
      }
      const link = documentRepo.linkTaskDocument({
        task_id: taskId,
        document_id: doc.id,
        role: role as any,
        variant_label: options?.variantLabel ?? null
      })
      return { document: doc, taskDocument: link }
    },

    /**
     * Atomically imports multiple files and attaches them to a task.
     */
    importMultipleTaskDocuments(
      taskId: string,
      fileList: Array<{ filePath: string; displayName?: string }>,
      role: TaskDocumentRole,
      options?: {
        variantLabel?: string | null
      }
    ): TaskDocumentRecord[] {
      if (!taskDocRepo) {
        throw new Error('taskDocRepo not configured in FileLibraryService')
      }

      const created: TaskDocumentRecord[] = []
      for (const item of fileList) {
        const doc = this.importFile(item.filePath, { displayName: item.displayName })
        try {
          const record = taskDocRepo.link({
            taskId,
            documentId: doc.id,
            role,
            variantLabel: options?.variantLabel ?? null
          })
          created.push(record)
        } catch (err) {
          this.deleteDocument(doc.id)
          throw err
        }
      }
      return created
    },

    /**
     * Deletes a document from the database and removes its physical copy from libraryRoot.
     */
    deleteDocument(documentId: string): void {
      const doc = documentRepo.getDocumentById(documentId)
      if (!doc) return

      // Remove record from database (cascades task_documents)
      documentRepo.deleteDocument(documentId)

      // Delete physical file from managed library
      const fullPath = assertSafeRelativePath(doc.relative_path)
      if (existsSync(fullPath)) {
        try {
          unlinkSync(fullPath)
        } catch (err) {
          console.warn(`[FileLibrary] Failed to delete file: ${fullPath}`, err)
        }
      }
    },

    /**
     * Opens a document in the OS default application via its validated document ID.
     * React NEVER supplies raw machine paths.
     */
    async openDocumentInDefaultApp(documentId: string): Promise<void> {
      const doc = documentRepo.getDocumentById(documentId)
      if (!doc) {
        throw new Error(`Document with ID "${documentId}" was not found.`)
      }

      const fullPath = assertSafeRelativePath(doc.relative_path)

      if (!existsSync(fullPath)) {
        throw new Error(
          `The file "${doc.display_name}" is missing from the local vault storage. It may have been deleted externally.`
        )
      }

      const error = await shell.openPath(fullPath)
      if (error) {
        throw new Error(`Could not open file in default application: ${error}`)
      }
    },

    /**
     * Opens the OS file explorer at the file's location with the file highlighted/selected.
     */
    revealInFolder(documentId: string): void {
      const doc = documentRepo.getDocumentById(documentId)
      if (!doc) {
        throw new Error(`Document with ID "${documentId}" was not found.`)
      }

      const fullPath = assertSafeRelativePath(doc.relative_path)

      if (!existsSync(fullPath)) {
        throw new Error(
          `The file "${doc.display_name}" is missing from the local vault storage. It may have been deleted externally.`
        )
      }

      shell.showItemInFolder(fullPath)
    },

    /**
     * Resolves the absolute path for a relative path strictly within libraryRoot.
     * Only used by main process.
     */
    toAbsolutePath(relativePath: string): string {
      return assertSafeRelativePath(relativePath)
    }
  }
}

export type FileLibraryService = ReturnType<typeof createFileLibraryService>
