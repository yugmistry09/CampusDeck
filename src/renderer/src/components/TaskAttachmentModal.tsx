import React, { useState } from 'react'
import { X, FileText, CheckCircle2, AlertCircle, Paperclip, Plus, Trash2, Tag } from 'lucide-react'
import type { TaskDocumentRole, TaskDocumentRecord } from '@shared/types'
import { FileDropzone, type DroppedFileInfo } from './FileDropzone'

interface TaskAttachmentModalProps {
  isOpen: boolean
  taskId: string
  taskTitle: string
  onClose: () => void
  onAttached: (documents: TaskDocumentRecord[]) => void
}

interface StagedFile {
  id: string
  filePath: string
  fileName: string
  fileSize?: number
  role: TaskDocumentRole
  variantLabel?: string
  // For drag-and-dropped files that don't have a native file path
  file?: File
  arrayBuffer?: ArrayBuffer
}

const ROLE_OPTIONS: Array<{
  value: TaskDocumentRole
  label: string
  description: string
}> = [
  {
    value: 'assignment_file',
    label: 'Assignment / Prompt',
    description: 'Assignment PDF, problem sheet, lab manual prompt, or questions sheet.'
  },
  {
    value: 'solution',
    label: 'Solution Variant',
    description: 'Answer sheet, completed work, draft, or teacher solution.'
  },
  {
    value: 'reference',
    label: 'Reference Material',
    description: 'Lecture slides, formula sheet, rubric, dataset, or notes.'
  },
  {
    value: 'other',
    label: 'Other Document',
    description: 'Any other relevant coursework attachment.'
  }
]

export const TaskAttachmentModal: React.FC<TaskAttachmentModalProps> = ({
  isOpen,
  taskId,
  taskTitle,
  onClose,
  onAttached
}) => {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleFilesAdded = (files: DroppedFileInfo[]) => {
    const newStaged: StagedFile[] = files
      .filter((f) => f.path || f.file || f.arrayBuffer)
      .map((f) => ({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        filePath: f.path || '',
        fileName: f.name,
        fileSize: f.size,
        role: 'assignment_file' as TaskDocumentRole,
        variantLabel: '',
        file: f.file,
        arrayBuffer: f.arrayBuffer
      }))

    if (newStaged.length > 0) {
      setStagedFiles((prev) => [...prev, ...newStaged])
      setError(null)
    } else {
      setError('Could not process dropped files. Please ensure they are local files.')
    }
  }

  const handlePickFilesToStage = async () => {
    try {
      const res = await window.campusDeckAPI.files.pickFiles({
        allowMultiple: true,
        title: 'Select File(s) to Attach to Task'
      })

      if (!res.canceled && res.files) {
        handleFilesAdded(
          res.files.map((f) => ({
            path: f.filePath,
            name: f.fileName,
            size: f.fileSize
          }))
        )
      }
    } catch (err) {
      console.error('Failed to pick files:', err)
      setError(err instanceof Error ? err.message : 'Failed to select files.')
    }
  }

  const handleRemoveStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleUpdateStagedRole = (id: string, newRole: TaskDocumentRole) => {
    setStagedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, role: newRole } : f))
    )
  }

  const handleUpdateStagedVariant = (id: string, variant: string) => {
    setStagedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, variantLabel: variant } : f))
    )
  }

  const importStagedFile = async (file: StagedFile): Promise<TaskDocumentRecord[]> => {
    const variantLabel =
      file.role === 'solution' && file.variantLabel?.trim()
        ? file.variantLabel.trim()
        : null

    // Drag-and-dropped files have no native path; import them via blob.
    if (file.arrayBuffer) {
      const result = await window.campusDeckAPI.taskDocs.importFromBlob({
        taskId,
        role: file.role,
        variantLabel,
        customDisplayName: file.fileName,
        files: [{
          name: file.fileName,
          mimeType: file.file?.type || '',
          arrayBuffer: file.arrayBuffer
        }]
      })

      if (result.canceled || !result.documents) {
        return []
      }

      return result.documents
    }

    // Files selected through the native picker have a path.
    if (file.filePath) {
      const result = await window.campusDeckAPI.taskDocs.selectAndImport({
        taskId,
        filePaths: [file.filePath],
        role: file.role,
        variantLabel,
        customDisplayName: file.fileName
      })

      if (result.canceled || !result.documents) {
        return []
      }

      return result.documents
    }

    throw new Error(`Cannot import "${file.fileName}": no file path or data available.`)
  }

  const handleSubmit = async () => {
    setError(null)

    if (stagedFiles.length === 0) {
      setError('Please add at least one file before attaching.')
      return
    }

    setIsSubmitting(true)

    try {
      const attachedDocuments: TaskDocumentRecord[] = []

      for (const file of stagedFiles) {
        const documents = await importStagedFile(file)
        attachedDocuments.push(...documents)
      }

      if (attachedDocuments.length === 0) {
        throw new Error('No files were attached. Please try adding the files again.')
      }

      onAttached(attachedDocuments)
      setStagedFiles([])
      onClose()
    } catch (err) {
      console.error('Failed to attach task files:', err)
      setError(err instanceof Error ? err.message : 'Failed to attach document files.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Attach Documents to Task
            </h3>
            <p className="text-xs text-slate-500 truncate max-w-sm mt-0.5">
              Task: {taskTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Attachments & Coursework Files */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                <span>Coursework Files & Attachments</span>
                {stagedFiles.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                    {stagedFiles.length}
                  </span>
                )}
              </label>

              <button
                type="button"
                onClick={handlePickFilesToStage}
                disabled={isSubmitting}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-1 border border-indigo-200 dark:border-indigo-800/60 disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
                <span>Attach File</span>
              </button>
            </div>

            {/* Staged files list */}
            {stagedFiles.length > 0 && (
              <div className="space-y-2">
                {stagedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span
                          className="font-medium text-slate-800 dark:text-slate-200 truncate"
                          title={file.fileName}
                        >
                          {file.fileName}
                        </span>
                        {file.fileSize ? (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            ({(file.fileSize / 1024).toFixed(0)} KB)
                          </span>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveStagedFile(file.id)}
                        disabled={isSubmitting}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors disabled:opacity-50"
                        title="Remove file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-[10px] text-slate-500 font-medium">Role:</span>

                      <select
                        value={file.role}
                        onChange={(e) =>
                          handleUpdateStagedRole(file.id, e.target.value as TaskDocumentRole)
                        }
                        disabled={isSubmitting}
                        className="px-2 py-0.5 rounded text-[11px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      {file.role === 'solution' && (
                        <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                          <Tag className="w-3 h-3 text-emerald-500 shrink-0" />
                          <input
                            type="text"
                            value={file.variantLabel || ''}
                            onChange={(e) =>
                              handleUpdateStagedVariant(file.id, e.target.value)
                            }
                            disabled={isSubmitting}
                            placeholder="Variant label (e.g. Draft 1)"
                            className="w-full px-2 py-0.5 rounded text-[11px] border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Dropzone area */}
            <FileDropzone
              title="Drag & drop coursework files here, or click to attach"
              subtitle="Assignments, question sheets, lab guides, or solutions"
              allowMultiple={true}
              disabled={isSubmitting}
              onClickBrowse={handlePickFilesToStage}
              onFilesSelected={handleFilesAdded}
              className="py-4"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || stagedFiles.length === 0}
            className="px-5 py-2 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition-colors"
          >
            {isSubmitting ? 'Attaching...' : 'Attach File(s)'}
          </button>
        </div>
      </div>
    </div>
  )
}
