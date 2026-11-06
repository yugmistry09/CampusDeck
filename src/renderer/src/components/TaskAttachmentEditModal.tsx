import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle } from 'lucide-react'
import type { TaskDocumentRecord, TaskDocumentRole } from '@shared/types'

interface TaskAttachmentEditModalProps {
  isOpen: boolean
  attachment: TaskDocumentRecord | null
  onClose: () => void
  onSaved: (updated: TaskDocumentRecord) => void
}

const ROLES: Array<{ value: TaskDocumentRole; label: string }> = [
  { value: 'assignment_file', label: 'Assignment / Prompt' },
  { value: 'solution', label: 'Solution Variant' },
  { value: 'reference', label: 'Reference Document' },
  { value: 'other', label: 'Other Document' }
]

export const TaskAttachmentEditModal: React.FC<TaskAttachmentEditModalProps> = ({
  isOpen,
  attachment,
  onClose,
  onSaved
}) => {
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<TaskDocumentRole>('assignment_file')
  const [variantLabel, setVariantLabel] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (attachment) {
      setDisplayName(attachment.display_name)
      // Normalize 'assignment' to 'assignment_file'
      const normalizedRole = attachment.role === 'assignment' ? 'assignment_file' : attachment.role
      setRole(normalizedRole)
      setVariantLabel(attachment.variant_label || '')
      setError(null)
    }
  }, [attachment])

  if (!isOpen || !attachment) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      setError('Display name cannot be empty.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const updated = await window.campusDeskAPI.taskDocs.update({
        id: attachment.id,
        display_name: displayName.trim(),
        role,
        variant_label: role === 'solution' && variantLabel.trim() ? variantLabel.trim() : null
      })

      if (!updated) {
        throw new Error('Could not update attachment record.')
      }

      onSaved(updated)
      onClose()
    } catch (err) {
      console.error('Failed to update attachment:', err)
      setError(err instanceof Error ? err.message : 'Failed to update attachment.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Edit Attachment Details
          </h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave}>
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Display Name */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Display Name / Title
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Role */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Attachment Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as TaskDocumentRole)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Variant Label (especially for solutions) */}
            {role === 'solution' && (
              <div className="space-y-1 animate-fade-in">
                <label className="block text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  Solution Variant Label
                </label>
                <input
                  type="text"
                  value={variantLabel}
                  onChange={(e) => setVariantLabel(e.target.value)}
                  placeholder="e.g. Variant A, Teacher's solution, Draft 1"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            )}
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
              type="submit"
              disabled={isLoading}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
