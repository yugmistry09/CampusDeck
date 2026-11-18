import { ipcMain, BrowserWindow } from 'electron'
import { basename } from 'path'
import { writeFileSync, unlinkSync, existsSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import {
  assertTrustedSender,
  parseOrThrow,
  importSubjectDocSchema,
  documentIdSchema,
  pickFilesSchema
} from './validation'
import type { FileLibraryService } from '../services/fileLibrary'

// ---------------------------------------------------------------------------
// File Library IPC Handlers
// Channels:
//   file:select-and-import-subject-doc, file:open-document,
//   file:reveal-in-folder, file:pick-files
// ---------------------------------------------------------------------------

export function registerFileHandlers(fileLibrary: FileLibraryService): void {
  ipcMain.handle('file:select-and-import-subject-doc', async (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const input = parseOrThrow(importSubjectDocSchema, payload)

    let filePath = input.filePath
    let fileName = filePath ? basename(filePath) : undefined

    if (!filePath) {
      const window = BrowserWindow.fromWebContents(event.sender)
      const selectResult = await fileLibrary.showNativeFileDialog(window)

      if (selectResult.canceled || !selectResult.filePath) {
        return { canceled: true }
      }
      filePath = selectResult.filePath
      fileName = selectResult.fileName
    }

    const created = fileLibrary.importSubjectDocument(input.subjectId, filePath, {
      title: input.title.trim() || fileName || 'Untitled Document',
      type: input.type,
      description: input.description
    })

    return { canceled: false, document: created }
  })

  ipcMain.handle('file:open-document', async (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { documentId } = parseOrThrow(documentIdSchema, payload)
    await fileLibrary.openDocumentInDefaultApp(documentId)
    return { success: true }
  })

  ipcMain.handle('file:reveal-in-folder', async (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { documentId } = parseOrThrow(documentIdSchema, payload)
    fileLibrary.revealInFolder(documentId)
    return { success: true }
  })

  ipcMain.handle('file:pick-files', async (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const opts = parseOrThrow(pickFilesSchema, payload)
    const window = BrowserWindow.fromWebContents(event.sender)
    const result = await fileLibrary.showNativeFileDialog(window, {
      allowMultiple: opts?.allowMultiple ?? true,
      title: opts?.title || 'Select Files'
    })

    if (result.canceled || !result.files || result.files.length === 0) {
      return { canceled: true }
    }

    return {
      canceled: false,
      files: result.files
    }
  })

  // New handler for drag-and-drop file blobs from sandboxed renderer
  ipcMain.handle('file:import-from-blob', async (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    // Note: We need to add a validation schema for this
    const { subjectId, title, type, description, files } = payload as {
      subjectId: string
      title: string
      type: string
      description?: string
      files: Array<{ name: string; mimeType: string; arrayBuffer: ArrayBuffer }>
    }

    // Write blobs to temporary files
    const tempDir = mkdtempSync(`${tmpdir()}/campusdeck-import-`)
    let filePath: string | undefined
    let fileName: string | undefined

    try {
      for (const file of files) {
        const tempPath = `${tempDir}/${file.name}`
        const buffer = Buffer.from(file.arrayBuffer)
        writeFileSync(tempPath, buffer)

        // Validate file type before importing
        const { isSupportedFileType } = await import('../services/fileLibrary')
        if (!isSupportedFileType(file.name)) {
          throw new Error(`Unsupported file type: ${file.name}`)
        }

        filePath = tempPath
        fileName = file.name
        break // Only import first file for subject documents (single file)
      }

      if (!filePath) {
        throw new Error('No valid files provided')
      }

      const created = fileLibrary.importSubjectDocument(subjectId, filePath, {
        title: title.trim() || fileName || 'Untitled Document',
        type: type as any,
        description
      })

      return { canceled: false, document: created }
    } finally {
      // Cleanup temp files
      if (filePath && existsSync(filePath)) {
        try { unlinkSync(filePath) } catch {}
      }
      try { unlinkSync(tempDir) } catch {}
    }
  })
}
