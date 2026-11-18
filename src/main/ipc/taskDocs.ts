import { ipcMain, BrowserWindow } from 'electron'
import { basename } from 'path'
import { writeFileSync, unlinkSync, existsSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { z } from 'zod'
import {
  assertTrustedSender,
  parseOrThrow,
  taskDocIdSchema,
  taskIdParamSchema,
  subjectIdParamSchema,
  taskDocUpdateSchema,
  importTaskDocSchema,
  importTaskDocBlobSchema,
  documentRefCountSchema
} from './validation'
import type { TaskDocRepo } from '../db/repositories/taskDocs'
import type { FileLibraryService } from '../services/fileLibrary'

// ---------------------------------------------------------------------------
// Task Document IPC Handlers
// Channels:
//   task-doc:list, task-doc:list-by-subject, task-doc:list-all,
//   task-doc:select-and-import, task-doc:update,
//   task-doc:unlink, task-doc:delete, task-doc:ref-count
// ---------------------------------------------------------------------------

export function registerTaskDocHandlers(
  taskDocRepo: TaskDocRepo,
  fileLibrary: FileLibraryService
): void {
  ipcMain.handle('task-doc:list', async (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { taskId } = parseOrThrow(taskIdParamSchema, payload)
    return taskDocRepo.listByTask(taskId)
  })

  ipcMain.handle('task-doc:list-by-subject', async (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { subjectId } = parseOrThrow(subjectIdParamSchema, payload)
    return taskDocRepo.listBySubject(subjectId)
  })

  ipcMain.handle('task-doc:list-all', async (event) => {
    assertTrustedSender(event.sender)
    return taskDocRepo.listAll()
  })

  ipcMain.handle('task-doc:select-and-import', async (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const input = parseOrThrow(importTaskDocSchema, payload)

    let filesToImport: Array<{ filePath: string; displayName: string }> = []

    if (input.filePaths && input.filePaths.length > 0) {
      filesToImport = input.filePaths.map((fp) => {
        const fileName = basename(fp)
        return {
          filePath: fp,
          displayName:
            input.filePaths!.length === 1 && input.customDisplayName?.trim()
              ? input.customDisplayName.trim()
              : fileName
        }
      })
    } else {
      const window = BrowserWindow.fromWebContents(event.sender)
      const selectResult = await fileLibrary.showNativeFileDialog(window, {
        allowMultiple: true,
        title: `Select ${input.role === 'solution' ? 'Solution File(s)' : input.role === 'assignment_file' ? 'Assignment Document(s)' : 'Academic Attachment(s)'}`
      })

      if (selectResult.canceled || !selectResult.files || selectResult.files.length === 0) {
        return { canceled: true }
      }

      filesToImport = selectResult.files.map((f) => ({
        filePath: f.filePath,
        displayName:
          selectResult.files!.length === 1 && input.customDisplayName?.trim()
            ? input.customDisplayName.trim()
            : f.fileName
      }))
    }

    const imported = fileLibrary.importMultipleTaskDocuments(
      input.taskId,
      filesToImport,
      input.role,
      { variantLabel: input.variantLabel }
    )

    return { canceled: false, documents: imported }
  })

  // New handler for drag-and-drop file blobs from sandboxed renderer
  ipcMain.handle('task-doc:import-from-blob', async (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    let input: z.infer<typeof importTaskDocBlobSchema>
    try {
      input = parseOrThrow(importTaskDocBlobSchema, payload)
    } catch (err) {
      console.error('[task-doc:import-from-blob] Validation error:', err)
      throw err
    }

    // Write blobs to temporary files
    const tempDir = mkdtempSync(`${tmpdir()}/campusdeck-import-`)
    const filesToImport: Array<{ filePath: string; displayName: string }> = []

    try {
      const { isSupportedFileType } = await import('../services/fileLibrary')

      for (const file of input.files) {
        const tempPath = `${tempDir}/${file.name}`
        let buffer: Buffer
        try {
          buffer = Buffer.from(file.arrayBuffer)
        } catch (err) {
          throw new Error(`Failed to convert file data for "${file.name}": ${err instanceof Error ? err.message : String(err)}`)
        }

        try {
          writeFileSync(tempPath, buffer)
        } catch (err) {
          throw new Error(`Failed to write temp file for "${file.name}": ${err instanceof Error ? err.message : String(err)}`)
        }

        // Validate file type before importing
        if (!isSupportedFileType(file.name)) {
          throw new Error(`Unsupported file type: ${file.name}`)
        }

        filesToImport.push({
          filePath: tempPath,
          displayName:
            input.files.length === 1 && input.customDisplayName?.trim()
              ? input.customDisplayName.trim()
              : file.name
        })
      }

      const imported = fileLibrary.importMultipleTaskDocuments(
        input.taskId,
        filesToImport,
        input.role,
        { variantLabel: input.variantLabel }
      )

      return { canceled: false, documents: imported }
    } catch (err) {
      console.error('[task-doc:import-from-blob] Import failed:', err)
      throw err
    } finally {
      // Cleanup temp files
      for (const f of filesToImport) {
        if (existsSync(f.filePath)) {
          try { unlinkSync(f.filePath) } catch {}
        }
      }
      // Use rmSync for directory cleanup (Node 14.14+)
      try { 
        const { rmSync } = await import('fs')
        rmSync(tempDir, { recursive: true, force: true })
      } catch {}
    }
  })

  ipcMain.handle('task-doc:update', async (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const input = parseOrThrow(taskDocUpdateSchema, payload)
    return taskDocRepo.update(input)
  })

  ipcMain.handle('task-doc:unlink', async (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { id } = parseOrThrow(taskDocIdSchema, payload)
    taskDocRepo.unlink(id)
    return { success: true }
  })

  ipcMain.handle('task-doc:delete', async (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { id } = parseOrThrow(taskDocIdSchema, payload)
    const result = taskDocRepo.deleteWithFileCheck(id)
    return result
  })

  ipcMain.handle('task-doc:ref-count', async (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { documentId } = parseOrThrow(documentRefCountSchema, payload)
    return taskDocRepo.getRefCount(documentId)
  })
}
