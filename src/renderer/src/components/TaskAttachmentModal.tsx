import React, { useState } from 'react'
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import type { TaskDocumentRole, TaskDocumentRecord } from '@shared/types'

interface TaskAttachmentModalProps {
  isOpen: boolean
  taskId: string
  taskTitle: string
  onClose: () => void
  onAttached: (documents: TaskDocumentRecord[]) => void
}

const ROLE_OPTIONS: Array<{
  value: TaskDocumentRole
  label: string
  description: string
  badgeClass: string
}> = [
  {
    value: 'assignment_file',
    label: 'Assignment / Prompt',
    description: 'Assignment PDF, problem sheet, lab manual prompt, or questions sheet.',
    badgeClass: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
  },
  {
    value: 'solution',
    label: 'Solution Variant',
    description: 'Answer sheet, completed work, draft, or teacher solution with variant label.',
    badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
  },
  {
    value: 'reference',
    label: 'Reference Material',
    description: 'Lecture slides, formula sheet, rubric, dataset, or notes.',
    badgeClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
  },
  {
    value: 'other',
    label: 'Other Document',
    description: 'Any other relevant coursework attachment.',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
  }
]

const QUICK_VARIANT_SUGGESTIONS = [
  'Variant A',
  'Variant B',
  'Draft 1',
  'Teacher Solution',
  'Final Submission',
  'Alternative Approach'
]

export const TaskAttachmentModal: React.FC<TaskAttachmentModalProps> = ({
  isOpen,
  taskId,
  taskTitle,
  onClose,
  onAttached
}) => {
  const [role, setRole] = useState<TaskDocumentRole>('assignment_file')
  const [variantLabel, setVariantLabel] = useState('')
  const [customDisplayName, setCustomDisplayName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSelectAndImport = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.campusDeckAPI.taskDocs.selectAndImport({
        taskId,
        role,
        variantLabel: role === 'solution' && variantLabel.trim() ? variantLabel.trim() : null,
        customDisplayName: customDisplayName.trim() || undefined
      })

      if (result.canceled || !result.documents || result.documents.length === 0) {
        setIsLoading(false)
        return
      }

      onAttached(result.documents)
      onClose()
    } catch (err) {
      console.error('Failed to import task attachment:', err)
      setError(err instanceof Error ? err.message : 'Failed to import document file.')
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
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
            disabled={isLoading}
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

          {/* Role Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Attachment Role & Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ROLE_OPTIONS.map((opt) => {
                const isSelected = role === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-600'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {opt.label}
                      </span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      {opt.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Solution Variant Label if role is solution */}
          {role === 'solution' && (
            <div className="p-3.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                  Solution Variant Label (Optional)
                </label>
                <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400">
                  Multiple variants supported
                </span>
              </div>
              <input
                type="text"
                value={variantLabel}
                onChange={(e) => setVariantLabel(e.target.value)}
                placeholder="e.g. Variant A, Teacher's solution, Draft 1"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-slate-500">Quick suggestions:</span>
                {QUICK_VARIANT_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setVariantLabel(sug)}
                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200/80 transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Display Name (Optional) */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Display Label / Title (Optional)
            </label>
            <input
              type="text"
              value={customDisplayName}
              onChange={(e) => setCustomDisplayName(e.target.value)}
              placeholder="Defaults to original filename if left blank"
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-400">
              Applies if a single file is selected. If multiple files are chosen, each preserves its original filename.
            </p>
          </div>

          {/* Vault Storage Notice */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
            <UploadCloud className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Files are safely copied into your local app library with unique UUID-safe storage names.
              Your original files on disk remain untouched.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSelectAndImport}
            disabled={isLoading}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Importing File(s)...</span>
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5" />
                <span>Select & Attach File(s)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
