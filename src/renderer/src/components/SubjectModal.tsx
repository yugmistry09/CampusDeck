import React, { useState, useEffect } from 'react'
import { X, BookOpen, Check } from 'lucide-react'
import type { SubjectRow, SubjectCreateInput, SubjectUpdateInput } from '@shared/types'

interface SubjectModalProps {
  isOpen: boolean
  subject?: SubjectRow | null
  onClose: () => void
  onSaved: (subject: SubjectRow) => void
}

const PRESET_COLORS = [
  '#4F46E5', // Indigo
  '#2563EB', // Blue
  '#0D9488', // Teal
  '#059669', // Emerald
  '#D97706', // Amber
  '#DC2626', // Red
  '#DB2777', // Pink
  '#7C3AED', // Violet
  '#475569'  // Slate
]

export const SubjectModal: React.FC<SubjectModalProps> = ({
  isOpen,
  subject,
  onClose,
  onSaved
}) => {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [semester, setSemester] = useState('')
  const [color, setColor] = useState('#4F46E5')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = Boolean(subject)

  useEffect(() => {
    if (subject) {
      setName(subject.name || '')
      setCode(subject.code || '')
      setSemester(subject.semester || '')
      setColor(subject.color || '#4F46E5')
      setNotes(subject.notes || '')
    } else {
      setName('')
      setCode('')
      setSemester('')
      setColor('#4F46E5')
      setNotes('')
    }
    setError(null)
  }, [subject, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Subject name is required.')
      return
    }

    try {
      setIsSubmitting(true)
      if (isEditing && subject) {
        const updatePayload: SubjectUpdateInput = {
          id: subject.id,
          name: trimmedName,
          code: code.trim() || null,
          semester: semester.trim() || null,
          color: color.trim() || null,
          notes: notes.trim()
        }
        const updated = await window.campusDeckAPI.subjects.update(updatePayload)
        if (updated) {
          onSaved(updated)
          onClose()
        }
      } else {
        const createPayload: SubjectCreateInput = {
          name: trimmedName,
          code: code.trim() || null,
          semester: semester.trim() || null,
          color: color.trim() || null,
          notes: notes.trim()
        }
        const created = await window.campusDeckAPI.subjects.create(createPayload)
        onSaved(created)
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save subject.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: color }}
            >
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {isEditing ? 'Edit Subject' : 'Add New Subject'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing ? 'Update course details and notes' : 'Register a course, module, or academic subject'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Subject Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Subject Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Data Structures and Algorithms"
              className="w-full px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>

          {/* Subject Code & Semester Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Course Code <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. CS201"
                className="w-full px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Semester / Term <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="e.g. Fall 2026, Sem 3"
                className="w-full px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Color Picker Swatches */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Accent Color
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform hover:scale-110 relative"
                  style={{ backgroundColor: c }}
                  title={c}
                >
                  {color.toLowerCase() === c.toLowerCase() && (
                    <Check className="w-4 h-4 text-white drop-shadow-sm" />
                  )}
                </button>
              ))}
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#4F46E5"
                maxLength={7}
                className="w-24 px-2 py-1 text-xs font-mono rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 uppercase ml-2 focus:outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Course Notes & Syllabus Details <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instructor office hours, grading policy, classroom location, or general notes..."
              className="w-full px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Subject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
