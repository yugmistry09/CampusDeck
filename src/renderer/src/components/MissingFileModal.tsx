import React, { useState } from 'react'
import { AlertTriangle, X, RefreshCw, Trash2, ArrowLeft } from 'lucide-react'
import { FileDropzone, type DroppedFileInfo } from './FileDropzone'
import type { TaskDocumentRole } from '@shared/types'

export interface MissingDocumentTarget {
  id: string              // attachment link id (or subject doc id)
  document_id: string     // document table id
  display_name: string
  task_id?: string
  subject_id?: string
  role?: TaskDocumentRole | string
  variant_label?: string | null
}

interface MissingFileModalProps {
  isOpen: boolean
  target: MissingDocumentTarget | null
  onClose: () => void
  onResolved: (action: 'reimported' | 'removed') => void
}

export const MissingFileModal: React.FC<MissingFileModalProps> = ({
  isOpen,
  target,
  onClose,
  onResolved
}) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDropzone, setShowDropzone] = useState(false)

  if (!isOpen || !target) return null

  const handleReimportFiles = async (files: DroppedFileInfo[]) => {
    if (files.length === 0) return
    setIsProcessing(true)
    setError(null)

    try {
      const primaryFile = files[0]!
      const filePath = primaryFile.path

      if (!filePath) {
        throw new Error('Could not resolve file path from selection.')
      }

      if (target.task_id) {
        // Re-import for task attachment
        await window.campusDeckAPI.taskDocs.selectAndImport({
          taskId: target.task_id,
          filePaths: [filePath],
          role: (target.role as TaskDocumentRole) || 'assignment_file',
          variantLabel: target.variant_label || null,
          customDisplayName: target.display_name
        })

        // Unlink the old missing attachment
        try {
          await window.campusDeckAPI.taskDocs.unlink(target.id)
        } catch (unlinkErr) {
          console.warn('Could not unlink old missing attachment:', unlinkErr)
        }
      } else if (target.subject_id) {
        // Re-import for subject document
        await window.campusDeckAPI.files.selectAndImportSubjectDoc({
          subjectId: target.subject_id,
          title: target.display_name,
          type: 'other',
          filePath
        })

        // Delete old broken subject doc record
        try {
          await window.campusDeckAPI.subjectDocs.delete(target.id)
        } catch (delErr) {
          console.warn('Could not delete old subject document:', delErr)
        }
      }

      onResolved('reimported')
      onClose()
    } catch (err) {
      console.error('Failed to replace missing file:', err)
      setError(err instanceof Error ? err.message : 'Failed to replace missing document.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSelectNativeReplacement = async () => {
    try {
      setIsProcessing(true)
      setError(null)
      const res = await window.campusDeckAPI.files.pickFiles({
        allowMultiple: false,
        title: `Select Replacement for "${target.display_name}"`
      })

      if (res.canceled || !res.files || res.files.length === 0) {
        setIsProcessing(false)
        return
      }

      const picked = res.files[0]!
      await handleReimportFiles([{ path: picked.filePath, name: picked.fileName, size: picked.fileSize }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File selection failed.')
      setIsProcessing(false)
    }
  }

  const handleRemoveBrokenLink = async () => {
    setIsProcessing(true)
    setError(null)

    try {
      if (target.task_id) {
        await window.campusDeckAPI.taskDocs.unlink(target.id)
      } else if (target.subject_id) {
        await window.campusDeckAPI.subjectDocs.delete(target.id)
      }
      onResolved('removed')
      onClose()
    } catch (err) {
      console.error('Failed to remove missing document link:', err)
      setError(err instanceof Error ? err.message : 'Failed to remove link.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-900/60">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                File Missing from Vault
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-[260px]" title={target.display_name}>
                {target.display_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            The physical document associated with <strong className="text-slate-800 dark:text-slate-200">"{target.display_name}"</strong> cannot be located in your local app vault. It may have been deleted, moved, or renamed outside of CampusDeck.
          </p>

          {!showDropzone ? (
            <div className="space-y-2 pt-2">
              {/* Option 1: Re-import / Replace */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setShowDropzone(true)}
                className="w-full p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/50 transition-colors flex items-center justify-between group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200 block">
                      Re-import / Replace File
                    </span>
                    <span className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
                      Select or drop a new copy to restore this document
                    </span>
                  </div>
                </div>
              </button>

              {/* Option 2: Remove / Unlink */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleRemoveBrokenLink}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-900/50 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 transition-colors flex items-center justify-between group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-rose-100 group-hover:text-rose-600 dark:group-hover:bg-rose-950/70 dark:group-hover:text-rose-400 flex items-center justify-center shrink-0 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-rose-700 dark:group-hover:text-rose-300 block">
                      Remove Broken Link
                    </span>
                    <span className="text-[11px] text-slate-400 group-hover:text-rose-600/80">
                      Unlink this unavailable attachment from the task
                    </span>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-1 animate-fade-in">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowDropzone(false)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to options</span>
                </button>
                <span className="text-[11px] text-slate-400">Choose replacement</span>
              </div>

              <FileDropzone
                title="Drop replacement file here, or click to browse"
                subtitle="Preserves original display name and assignment/solution settings"
                allowMultiple={false}
                disabled={isProcessing}
                onClickBrowse={handleSelectNativeReplacement}
                onFilesSelected={handleReimportFiles}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
