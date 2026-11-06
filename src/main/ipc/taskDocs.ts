import { ipcMain, BrowserWindow } from 'electron'
import {
  assertTrustedSender,
  parseOrThrow,
  taskDocIdSchema,
  taskIdParamSchema,
  subjectIdParamSchema,
  taskDocUpdateSchema,
  importTaskDocSchema,
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

    const window = BrowserWindow.fromWebContents(event.sender)
    const selectResult = await fileLibrary.showNativeFileDialog(window, {
      allowMultiple: true,
      title: `Select ${input.role === 'solution' ? 'Solution File(s)' : input.role === 'assignment_file' ? 'Assignment Document(s)' : 'Academic Attachment(s)'}`
    })

    if (selectResult.canceled || !selectResult.files || selectResult.files.length === 0) {
      return { canceled: true }
    }

    const filesToImport = selectResult.files.map((f) => ({
      filePath: f.filePath,
      displayName:
        selectResult.files!.length === 1 && input.customDisplayName?.trim()
          ? input.customDisplayName.trim()
          : f.fileName
    }))

    const imported = fileLibrary.importMultipleTaskDocuments(
      input.taskId,
      filesToImport,
      input.role,
      { variantLabel: input.variantLabel }
    )

    return { canceled: false, documents: imported }
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
