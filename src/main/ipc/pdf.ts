import { readFileSync, existsSync } from 'fs'
import { ipcMain } from 'electron'
import { assertTrustedSender, parseOrThrow, pdfDocumentBytesSchema } from './validation'
import type { DocumentRepo } from '../db/repositories/documents'
import type { FileLibraryService } from '../services/fileLibrary'
import type { PdfDocumentMetadata } from '../../shared/types'

// ---------------------------------------------------------------------------
// PDF IPC Handlers
// Channels:
//   pdf:get-document-bytes: retrieves raw binary bytes of a verified PDF document
//   pdf:get-document-metadata: retrieves validated metadata of a PDF document
// ---------------------------------------------------------------------------

export function registerPdfHandlers(
  documentRepo: DocumentRepo,
  fileLibrary: FileLibraryService
): void {
  ipcMain.handle('pdf:get-document-bytes', async (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { documentId } = parseOrThrow(pdfDocumentBytesSchema, payload)

    const doc = documentRepo.getDocumentById(documentId)
    if (!doc) {
      throw new Error(`PDF document not found (ID: "${documentId}")`)
    }

    const isPdf =
      doc.mime_type === 'application/pdf' ||
      doc.relative_path.toLowerCase().endsWith('.pdf') ||
      doc.display_name.toLowerCase().endsWith('.pdf')

    if (!isPdf) {
      throw new Error(
        `Document "${doc.display_name}" is not a PDF file (MIME type: ${doc.mime_type}). Use the default application to open non-PDF files.`
      )
    }

    // Resolves and enforces path traversal security (D-004, D-005)
    const fullPath = fileLibrary.toAbsolutePath(doc.relative_path)

    if (!existsSync(fullPath)) {
      throw new Error(
        `The PDF file "${doc.display_name}" is missing from vault storage. It may have been deleted externally.`
      )
    }

    try {
      const buffer = readFileSync(fullPath)
      return new Uint8Array(buffer)
    } catch (err) {
      throw new Error(
        `Failed to read PDF file "${doc.display_name}": ${err instanceof Error ? err.message : String(err)}`
      )
    }
  })

  ipcMain.handle('pdf:get-document-metadata', async (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { documentId } = parseOrThrow(pdfDocumentBytesSchema, payload)

    const doc = documentRepo.getDocumentById(documentId)
    if (!doc) {
      throw new Error(`PDF document not found (ID: "${documentId}")`)
    }

    const metadata: PdfDocumentMetadata = {
      id: doc.id,
      display_name: doc.display_name,
      size_bytes: doc.size_bytes,
      mime_type: doc.mime_type,
      created_at: doc.created_at
    }

    return metadata
  })
}
