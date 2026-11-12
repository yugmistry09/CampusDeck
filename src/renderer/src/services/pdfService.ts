import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// ---------------------------------------------------------------------------
// PDF.js Local Configuration (D-011)
// Fully bundled offline worker without any remote CDN dependency.
// ---------------------------------------------------------------------------
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/**
 * Fetches PDF document bytes securely via main-process IPC and loads the PDF document.
 * Neither raw filesystem paths nor remote URLs are ever used.
 */
export async function loadPdfDocumentFromVault(
  documentId: string
): Promise<pdfjsLib.PDFDocumentProxy> {
  const bytes = await window.campusDeskAPI.pdf.getBytes(documentId)

  // Use a detached Uint8Array copy if necessary for transferable worker buffers
  const dataCopy = new Uint8Array(bytes)

  const loadingTask = pdfjsLib.getDocument({
    data: dataCopy,
    useSystemFonts: true
  })

  return await loadingTask.promise
}

export { pdfjsLib }
