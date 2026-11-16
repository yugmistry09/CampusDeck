import React, { useState } from 'react'
import { X, UploadCloud, FileText, CheckCircle2 } from 'lucide-react'
import type { SubjectDocumentType, SubjectDocumentRecord } from '@shared/types'

interface DocumentUploadModalProps {
  isOpen: boolean
  subjectId: string
  subjectName: string
  onClose: () => void
  onUploaded: (doc: SubjectDocumentRecord) => void
}

const CATEGORIES: { id: SubjectDocumentType; label: string; description: string }[] = [
  { id: 'syllabus', label: 'Syllabus', description: 'Course outline, grading breakdown & textbook lists' },
  { id: 'marks', label: 'Marks & Grades', description: 'Grading schemes, score sheets & rubrics' },
  { id: 'notice', label: 'Notice / Circular', description: 'Department announcements and exam schedules' },
  { id: 'reference', label: 'Reference Material', description: 'Reference PDFs, cheat sheets & lecture handouts' },
  { id: 'timetable', label: 'Timetable', description: 'Class routine and laboratory schedule' },
  { id: 'notes', label: 'Lecture Notes', description: 'Subject notes and handwritten scans' },
  { id: 'other', label: 'Other Document', description: 'General academic materials' }
]

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  subjectId,
  subjectName,
  onClose,
  onUploaded
}) => {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<SubjectDocumentType>('syllabus')
  const [description, setDescription] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSelectAndImport = async () => {
    setError(null)
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Please provide a document title before selecting the file.')
      return
    }

    try {
      setIsImporting(true)
      const res = await window.campusDeckAPI.files.selectAndImportSubjectDoc({
        subjectId,
        title: trimmedTitle,
        type: category,
        description: description.trim()
      })

      if (res.canceled) {
        setIsImporting(false)
        return
      }

      if (res.document) {
        onUploaded(res.document)
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Import Subject Document
              </h3>
              <p className="text-xs text-slate-500">
                Adding to <span className="font-medium text-slate-700 dark:text-slate-300">{subjectName}</span>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Document Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Course Syllabus 2026 / Midterm Score Rubric"
              className="w-full px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Document Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-medium ${
                          isSelected
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {cat.label}
                      </span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5">
                      {cat.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes on this document, version info, or professor instructions..."
              className="w-full px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Supported Formats Info */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2.5">
            <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300">Accepted Formats</p>
              <p className="mt-0.5 leading-relaxed">
                PDFs, Images (PNG, JPG, WebP), Office documents (Word, Excel, PowerPoint), and plain text.
                Original files remain untouched; an internal copy is stored in the local vault.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSelectAndImport}
            disabled={isImporting || !title.trim()}
            className="px-5 py-2 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{isImporting ? 'Selecting & Importing...' : 'Select File & Import'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
