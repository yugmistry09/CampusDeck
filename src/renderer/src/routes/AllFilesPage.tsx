import React, { useEffect, useState, useCallback } from 'react'
import {
  Files,
  Search,
  Filter,
  ExternalLink,
  Trash2,
  ShieldCheck,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Presentation
} from 'lucide-react'
import type { SubjectDocumentRecord, SubjectDocumentType } from '@shared/types'
import { ConfirmModal } from '../components/ConfirmModal'

const CATEGORY_LABELS: Record<SubjectDocumentType, { label: string; badgeClass: string }> = {
  syllabus: {
    label: 'Syllabus',
    badgeClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300'
  },
  marks: {
    label: 'Marks & Grades',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
  },
  marks_scheme: {
    label: 'Marks Scheme',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
  },
  notice: {
    label: 'Notice',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
  },
  reference: {
    label: 'Reference',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300'
  },
  timetable: {
    label: 'Timetable',
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300'
  },
  notes: {
    label: 'Lecture Notes',
    badgeClass: 'bg-teal-100 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300'
  },
  other: {
    label: 'Other',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  }
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function getFileIcon(mimeType?: string | null, fileName?: string | null) {
  const mime = mimeType || ''
  const name = (fileName || '').toLowerCase()

  if (mime.startsWith('image/') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    return <ImageIcon className="w-4 h-4 text-emerald-500" />
  }
  if (mime.includes('spreadsheet') || mime.includes('excel') || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
  }
  if (mime.includes('presentation') || mime.includes('powerpoint') || name.endsWith('.pptx') || name.endsWith('.ppt')) {
    return <Presentation className="w-4 h-4 text-amber-500" />
  }
  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    return <FileText className="w-4 h-4 text-rose-500" />
  }
  return <FileText className="w-4 h-4 text-indigo-500" />
}

export const AllFilesPage: React.FC = () => {
  const [documents, setDocuments] = useState<SubjectDocumentRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')

  const [docToDelete, setDocToDelete] = useState<SubjectDocumentRecord | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadDocuments = useCallback(async () => {
    try {
      const all = await window.campusDeskAPI.subjectDocs.listAll()
      setDocuments(all)
    } catch (err) {
      console.error('Failed to load documents:', err)
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to load documents.'
      })
    }
  }, [])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const handleOpenDocument = async (doc: SubjectDocumentRecord) => {
    if (!doc.document_id) return
    try {
      await window.campusDeskAPI.files.openDocument(doc.document_id)
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not open file in default application.'
      })
    }
  }

  const handleDeleteDocument = async () => {
    if (!docToDelete) return
    try {
      await window.campusDeskAPI.subjectDocs.delete(docToDelete.id)
      setDocToDelete(null)
      loadDocuments()
      setNotification({ type: 'success', message: `Document "${docToDelete.title}" removed.` })
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete document.'
      })
    }
  }

  // Extract unique subjects for filter dropdown
  const uniqueSubjects = Array.from(
    new Map(
      documents
        .filter((d) => d.subject_id && d.subject_name)
        .map((d) => [d.subject_id, { id: d.subject_id, name: d.subject_name!, code: d.subject_code }])
    ).values()
  )

  const filteredDocs = documents.filter((doc) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      doc.title.toLowerCase().includes(q) ||
      (doc.description && doc.description.toLowerCase().includes(q)) ||
      (doc.display_name && doc.display_name.toLowerCase().includes(q)) ||
      (doc.subject_name && doc.subject_name.toLowerCase().includes(q))

    const matchesCategory = categoryFilter === 'all' || doc.type === categoryFilter
    const matchesSubject = subjectFilter === 'all' || doc.subject_id === subjectFilter

    return matchesSearch && matchesCategory && matchesSubject
  })

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Vault Info Callout */}
      <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Local-First Vault Library</p>
          <p className="mt-0.5 text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed">
            All documents imported here are preserved in your local app vault under managed relative paths.
            Opening a document launches your system's default native viewer through safe IPC without
            exposing machine paths to the renderer.
          </p>
        </div>
      </div>

      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            All Reference & Subject Files
          </h2>
          <p className="text-xs text-slate-500">
            Search and view syllabus sheets, lecture notes, timetables, and circulars
          </p>
        </div>

        <span className="text-xs font-medium text-slate-500 self-start sm:self-auto">
          {filteredDocs.length} files total
        </span>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="p-1 opacity-70 hover:opacity-100">
            ×
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by title, filename, or course..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          >
            <option value="all">All Categories</option>
            <option value="syllabus">Syllabus</option>
            <option value="marks">Marks & Grades</option>
            <option value="notice">Notices</option>
            <option value="reference">Reference</option>
            <option value="timetable">Timetable</option>
            <option value="notes">Lecture Notes</option>
            <option value="other">Other</option>
          </select>

          {/* Subject Filter */}
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          >
            <option value="all">All Subjects</option>
            {uniqueSubjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.code ? `${sub.code} - ${sub.name}` : sub.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents Table / List */}
      {documents.length === 0 ? (
        <div className="p-14 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <Files className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            No subject documents uploaded yet
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            Documents uploaded inside individual subjects (syllabuses, lab references, timetables)
            will appear here in this unified vault directory.
          </p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="p-10 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
          No documents matching your search and filter criteria.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium">
                  <th className="py-3 px-4">Document Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Original File</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDocs.map((doc) => {
                  const catMeta = CATEGORY_LABELS[doc.type] || CATEGORY_LABELS.other
                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Title & Description */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(doc.mime_type, doc.display_name)}
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {doc.title}
                            </p>
                            {doc.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-1">
                                {doc.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${catMeta.badgeClass}`}>
                          {catMeta.label}
                        </span>
                      </td>

                      {/* Subject Name / Code */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {doc.subject_name ? (
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: doc.subject_color || '#4F46E5' }}
                            />
                            <span className="text-slate-700 dark:text-slate-300 font-medium">
                              {doc.subject_code ? `${doc.subject_code} • ${doc.subject_name}` : doc.subject_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Filename */}
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] max-w-[180px] truncate" title={doc.display_name || ''}>
                        {doc.display_name || '—'}
                      </td>

                      {/* File Size */}
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {formatBytes(doc.size_bytes)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {doc.document_id && (
                            <button
                              onClick={() => handleOpenDocument(doc)}
                              className="px-2.5 py-1 rounded-md text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors flex items-center gap-1"
                              title="Open in default application"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Open</span>
                            </button>
                          )}
                          <button
                            onClick={() => setDocToDelete(doc)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                            title="Delete document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(docToDelete)}
        title="Delete Document"
        message={`Are you sure you want to delete "${docToDelete?.title}"?`}
        warningNote="The internal copy stored in your local library will be permanently removed."
        confirmText="Delete Document"
        onConfirm={handleDeleteDocument}
        onCancel={() => setDocToDelete(null)}
      />
    </div>
  )
}
