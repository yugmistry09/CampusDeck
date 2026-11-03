import { ipcMain, BrowserWindow } from 'electron'
import {
  assertTrustedSender,
  parseOrThrow,
  importSubjectDocSchema,
  documentIdSchema
} from './validation'
import type { FileLibraryService } from '../services/fileLibrary'

// ---------------------------------------------------------------------------
// File Library IPC Handlers
// Channels: file:select-and-import-subject-doc, file:open-document
// ---------------------------------------------------------------------------

export function registerFileHandlers(fileLibrary: FileLibraryService): void {
  ipcMain.handle('file:select-and-import-subject-doc', async (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const input = parseOrThrow(importSubjectDocSchema, payload)

    const window = BrowserWindow.fromWebContents(event.sender)
    const selectResult = await fileLibrary.showNativeFileDialog(window)

    if (selectResult.canceled || !selectResult.filePath) {
      return { canceled: true }
    }

    const created = fileLibrary.importSubjectDocument(input.subjectId, selectResult.filePath, {
      title: input.title.trim() || selectResult.fileName || 'Untitled Document',
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
}
