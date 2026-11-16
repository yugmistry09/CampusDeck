import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Tag,
  AlertCircle,
  ExternalLink,
  Loader2
} from 'lucide-react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { loadPdfDocumentFromVault } from '../services/pdfService'

export interface PdfViewerAttachmentItem {
  id: string
  document_id: string
  display_name: string
  role: string
  variant_label: string | null
}

interface PdfViewerProps {
  document: PdfViewerAttachmentItem
  taskAttachments: PdfViewerAttachmentItem[]
  taskTitle: string
  onClose: () => void
  onSelectDocument: (doc: PdfViewerAttachmentItem) => void
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  assignment_file: 'Assignment',
  assignment: 'Assignment',
  solution: 'Solution',
  reference: 'Reference',
  other: 'Attachment'
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  document: activeDoc,
  taskAttachments,
  taskTitle,
  onClose,
  onSelectDocument
}) => {
  const [docProxy, setDocProxy] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageInput, setPageInput] = useState<string>('1')
  const [scale, setScale] = useState<number>(1.0)
  const [isFitWidth, setIsFitWidth] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [rendering, setRendering] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const currentRenderTaskRef = useRef<RenderTask | null>(null)

  // Only filter task attachments that are PDFs
  const pdfAttachments = taskAttachments.filter(
    (att) =>
      att.display_name.toLowerCase().endsWith('.pdf') ||
      att.role === 'assignment_file' ||
      att.role === 'solution'
  )

  // Load the PDF Document from Vault
  useEffect(() => {
    let isCancelled = false
    setLoading(true)
    setErrorMessage(null)
    setCurrentPage(1)
    setPageInput('1')

    if (currentRenderTaskRef.current) {
      currentRenderTaskRef.current.cancel()
      currentRenderTaskRef.current = null
    }

    loadPdfDocumentFromVault(activeDoc.document_id)
      .then((proxy) => {
        if (!isCancelled) {
          setDocProxy(proxy)
          setNumPages(proxy.numPages)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Failed to load PDF document:', err)
          setErrorMessage(err instanceof Error ? err.message : 'Could not load PDF document.')
          setLoading(false)
        }
      })

    return () => {
      isCancelled = true
      if (currentRenderTaskRef.current) {
        currentRenderTaskRef.current.cancel()
        currentRenderTaskRef.current = null
      }
    }
  }, [activeDoc.document_id])

  // Render current page onto HTML canvas
  const renderCurrentPage = useCallback(async () => {
    if (!docProxy || !canvasRef.current || currentPage < 1 || currentPage > numPages) {
      return
    }

    // Cancel any ongoing rendering task to prevent canvas collision
    if (currentRenderTaskRef.current) {
      currentRenderTaskRef.current.cancel()
      currentRenderTaskRef.current = null
    }

    setRendering(true)

    try {
      const page = await docProxy.getPage(currentPage)
      const canvas = canvasRef.current
      if (!canvas) return

      const context = canvas.getContext('2d')
      if (!context) return

      // Determine effective scale
      let effectiveScale = scale
      if (isFitWidth && containerRef.current) {
        const unscaledViewport = page.getViewport({ scale: 1.0 })
        // Subtract container margins/padding (e.g. 48px)
        const availableWidth = Math.max(300, containerRef.current.clientWidth - 48)
        effectiveScale = availableWidth / unscaledViewport.width
      }

      const dpr = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: effectiveScale })

      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`

      context.setTransform(dpr, 0, 0, dpr, 0, 0)

      const renderContext = {
        canvasContext: context,
        viewport,
        canvas
      }

      const renderTask = page.render(renderContext)
      currentRenderTaskRef.current = renderTask

      await renderTask.promise
      setRendering(false)
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Error rendering PDF page:', err)
      }
      setRendering(false)
    }
  }, [docProxy, currentPage, numPages, scale, isFitWidth])

  // Trigger page render when page, scale, or fit width changes
  useEffect(() => {
    if (!loading && docProxy) {
      renderCurrentPage()
    }
  }, [loading, docProxy, renderCurrentPage])

  // Page Navigation Handlers
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      const target = currentPage - 1
      setCurrentPage(target)
      setPageInput(String(target))
    }
  }

  const goToNextPage = () => {
    if (currentPage < numPages) {
      const target = currentPage + 1
      setCurrentPage(target)
      setPageInput(String(target))
    }
  }

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value)
  }

  const handlePageInputCommit = () => {
    const parsed = parseInt(pageInput, 10)
    if (!isNaN(parsed) && parsed >= 1 && parsed <= numPages) {
      setCurrentPage(parsed)
      setPageInput(String(parsed))
    } else {
      setPageInput(String(currentPage))
    }
  }

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePageInputCommit()
    }
  }

  // Zoom Handlers
  const handleZoomIn = () => {
    setIsFitWidth(false)
    setScale((prev) => Math.min(prev + 0.2, 3.0))
  }

  const handleZoomOut = () => {
    setIsFitWidth(false)
    setScale((prev) => Math.max(prev - 0.2, 0.4))
  }

  const handleFitToWidth = () => {
    setIsFitWidth(true)
  }

  const handleResetZoom = () => {
    setIsFitWidth(false)
    setScale(1.0)
  }

  const handleOpenInDefaultApp = async () => {
    try {
      await window.campusDeckAPI.files.openDocument(activeDoc.document_id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not open file in default application')
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shadow-sm overflow-hidden animate-fade-in">
      {/* Viewer Header */}
      <div className="px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors shrink-0"
            title="Return to Task Details"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Task</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-400 font-medium truncate max-w-[200px]">
                {taskTitle}
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {ROLE_DISPLAY_NAMES[activeDoc.role] || activeDoc.role}
              </span>

              {activeDoc.variant_label && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <Tag className="w-2.5 h-2.5 text-emerald-500" />
                  <span>{activeDoc.variant_label}</span>
                </span>
              )}
            </div>

            <h3
              className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5"
              title={activeDoc.display_name}
            >
              {activeDoc.display_name}
            </h3>
          </div>
        </div>

        {/* Attached PDFs Switcher (Switch between Assignment & Solution Variants) */}
        <div className="flex items-center gap-2 shrink-0">
          {pdfAttachments.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-400">Attached:</span>
              <select
                value={activeDoc.document_id}
                onChange={(e) => {
                  const target = pdfAttachments.find((a) => a.document_id === e.target.value)
                  if (target) onSelectDocument(target)
                }}
                className="text-xs py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium shadow-sm max-w-[220px] truncate"
              >
                {pdfAttachments.map((att) => (
                  <option key={att.id} value={att.document_id}>
                    {att.variant_label ? `[${att.variant_label}] ` : ''}
                    {att.display_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleOpenInDefaultApp}
            title="Open in OS default application"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 text-xs font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open Externally</span>
          </button>
        </div>
      </div>

      {/* Viewer Toolbar */}
      <div className="px-4 py-2 bg-slate-100/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-4 text-xs shrink-0 flex-wrap">
        {/* Page Navigation Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={goToPreviousPage}
            disabled={currentPage <= 1 || loading}
            title="Previous Page"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm">
            <span className="text-[11px] text-slate-400 font-medium">Page</span>
            <input
              type="text"
              value={pageInput}
              onChange={handlePageInputChange}
              onBlur={handlePageInputCommit}
              onKeyDown={handlePageInputKeyDown}
              disabled={loading || numPages === 0}
              className="w-10 text-center text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded py-0.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-slate-400">of</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {numPages || '–'}
            </span>
          </div>

          <button
            onClick={goToNextPage}
            disabled={currentPage >= numPages || loading}
            title="Next Page"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleZoomOut}
            disabled={loading || scale <= 0.4}
            title="Zoom Out"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs min-w-[54px] text-center shadow-sm">
            {isFitWidth ? 'Fit' : `${Math.round(scale * 100)}%`}
          </span>

          <button
            onClick={handleZoomIn}
            disabled={loading || scale >= 3.0}
            title="Zoom In"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

          <button
            onClick={handleFitToWidth}
            disabled={loading}
            title="Fit to Width"
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
              isFitWidth
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Fit Width</span>
          </button>

          <button
            onClick={handleResetZoom}
            disabled={loading || (!isFitWidth && scale === 1.0)}
            title="Reset Zoom to 100%"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Viewer Main Viewport */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 flex items-center justify-center relative bg-slate-100/60 dark:bg-slate-950/60"
      >
        {loading && (
          <div className="flex flex-col items-center justify-center text-center p-8 space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Loading offline document...
            </p>
          </div>
        )}

        {errorMessage && !loading && (
          <div className="p-6 max-w-md rounded-xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 shadow-sm text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/80 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Unable to Display Document
            </h4>
            <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed">
              {errorMessage}
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              >
                Back to Task
              </button>
              <button
                onClick={handleOpenInDefaultApp}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Default App</span>
              </button>
            </div>
          </div>
        )}

        {/* Canvas Display */}
        <div
          className={`flex flex-col items-center justify-center ${
            loading || errorMessage ? 'hidden' : 'block'
          }`}
        >
          <div className="relative shadow-md rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white">
            {rendering && (
              <div className="absolute inset-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center z-10 transition-opacity">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
            )}
            <canvas ref={canvasRef} className="block transition-all duration-75" />
          </div>
        </div>
      </div>
    </div>
  )
}
