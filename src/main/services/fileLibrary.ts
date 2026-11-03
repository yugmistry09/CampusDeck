import { copyFileSync, existsSync, mkdirSync, unlinkSync, statSync } from 'fs'
import { basename, join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { DocumentRepo, DocumentCreateInput } from '../db/repositories/documents'
import type { DocumentRow, TaskDocumentRole } from '../db/schema'
import { getAppPaths } from '../utils/paths'

// ---------------------------------------------------------------------------
// File Library Service
// Keeps file-storage code strictly behind main-process services.
// Copies files into an app-managed local library, preserves originals,
// assigns unique internal storage names, and stores database paths
// relative to the library root (D-004, D-005).
// ---------------------------------------------------------------------------

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function createFileLibraryService(documentRepo: DocumentRepo) {
  const { libraryRoot } = getAppPaths()

  function ensureLibraryExists(): void {
    if (!existsSync(libraryRoot)) {
      mkdirSync(libraryRoot, { recursive: true })
    }
  }

  return {
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
      const sanitized = sanitizeFilename(originalName)
      const uniqueFileName = `${uuidv4()}_${sanitized}`
      const destinationPath = join(libraryRoot, uniqueFileName)

      // Copy into managed library
      copyFileSync(sourcePath, destinationPath)

      // Get size
      const stats = statSync(destinationPath)

      // Record in documents table with relative path
      const docInput: DocumentCreateInput = {
        display_name: originalName,
        relative_path: uniqueFileName, // Relative to libraryRoot
        mime_type: options?.mimeType || 'application/pdf',
        size_bytes: stats.size
      }

      return documentRepo.createDocument(docInput)
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
      const link = documentRepo.linkTaskDocument({
        task_id: taskId,
        document_id: doc.id,
        role,
        variant_label: options?.variantLabel ?? null
      })
      return { document: doc, taskDocument: link }
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
      const absolutePath = join(libraryRoot, doc.relative_path)
      if (existsSync(absolutePath)) {
        try {
          unlinkSync(absolutePath)
        } catch (err) {
          console.warn(`[FileLibrary] Failed to delete file: ${absolutePath}`, err)
        }
      }
    },

    /**
     * Resolves the absolute path for a relative path strictly within libraryRoot.
     * Only used by main process (e.g. streaming to offline PDF viewer).
     */
    toAbsolutePath(relativePath: string): string {
      return join(libraryRoot, relativePath)
    }
  }
}

export type FileLibraryService = ReturnType<typeof createFileLibraryService>
