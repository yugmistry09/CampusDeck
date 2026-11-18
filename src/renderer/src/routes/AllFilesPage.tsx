import React, { useEffect, useState, useCallback, useMemo } from 'react'
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
  Presentation,
  FolderOpen
} from 'lucide-react'
import type {
  SubjectDocumentRecord,
  SubjectDocumentType,
  TaskDocumentRecord
} from '@shared/types'
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
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-emerald-300'
  },
  reference: {
    label: 'Reference',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-emerald-300'
  },
  timetable: {
    label: 'Timetable',
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-emerald-300'
  },
  notes: {
    label: 'Lecture Notes',
    badgeClass: 'bg-teal-100 text-teal-700 dark:bg-teal-950/70 dark:text-emerald-300'
  },
  other: {
    label: 'Other',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  }
}

const TASK_ROLE_LABELS: Record<string, { label: string; badgeClass: string }> = {
  assignment_file: {
    label: 'Assignment',
    badgeClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300'
  },
  assignment: {
    label: 'Assignment',
    badgeClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300'
  },
  solution: {
    label: 'Solution',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
  },
  reference: {
    label: 'Reference',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-emerald-300'
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

interface UnifiedFileRecord {
  id: string
  source: 'subject' | 'task'
  title: string
  description?: string | null
  typeBadge: { label: string; badgeClass: string }
  displayName: string
  mimeType: string | null
  sizeBytes: number | null
  createdAt: string
  subjectName?: string | null
  subjectCode?: string | null
  subjectColor?: string | null
  taskId?: string | null
  variantLabel?: string | null
  documentId?: string | null
}

export const AllFilesPage: React.FC = () => {
  const [documents, setDocuments] = useState<SubjectDocumentRecord[]>([])
  const [taskDocuments, setTaskDocuments] = useState<TaskDocumentRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')

  const [docToDelete, setDocToDelete] = useState<UnifiedFileRecord | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadDocuments = useCallback(async () => {
    try {
      const [allSubjectDocs, allTaskDocs] = await Promise.all([
        window.campusDeckAPI.subjectDocs.listAll(),
        window.campusDeckAPI.taskDocs.listAll()
      ])
      setDocuments(allSubjectDocs)
      setTaskDocuments(allTaskDocs)
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

  // Normalize subject documents and task documents into a unified display shape
  const unifiedFiles: UnifiedFileRecord[] = useMemo(() => {
    const subjectFiles: UnifiedFileRecord[] = documents.map((doc) => ({
      id: doc.id,
      source: 'subject' as const,
      title: doc.title,
      description: doc.description || undefined,
      typeBadge: (CATEGORY_LABELS[doc.type] ?? CATEGORY_LABELS.other)!,
      displayName: doc.display_name || '',
      mimeType: doc.mime_type || null,
      sizeBytes: doc.size_bytes || null,
      createdAt: doc.created_at,
      subjectName: doc.subject_name || null,
      subjectCode: doc.subject_code || null,
      subjectColor: doc.subject_color || null,
      documentId: doc.document_id || undefined
    }))

    const taskFiles: UnifiedFileRecord[] = taskDocuments.map((doc) => ({
      id: doc.id,
      source: 'task' as const,
      title: doc.display_name,
      description: doc.variant_label ? `Variant: ${doc.variant_label}` : undefined,
      typeBadge: (TASK_ROLE_LABELS[doc.role] ?? TASK_ROLE_LABELS.other)!,
      displayName: doc.display_name,
      mimeType: doc.mime_type || null,
      sizeBytes: doc.size_bytes || null,
      createdAt: doc.created_at,
      taskId: doc.task_id || undefined,
      variantLabel: doc.variant_label || undefined,
      documentId: doc.document_id || undefined
    }))

    return [...subjectFiles, ...taskFiles].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [documents, taskDocuments])

  const handleOpenDocument = async (doc: UnifiedFileRecord) => {
    if (!doc.documentId) return
    try {
      await window.campusDeckAPI.files.openDocument(doc.documentId)
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not open file in default application.'
      })
    }
  }

  const handleRevealDocument = async (doc: UnifiedFileRecord) => {
    if (!doc.documentId) return
    try {
      await window.campusDeckAPI.files.revealInFolder(doc.documentId)
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not locate file in local vault.'
      })
    }
  }

  const handleDeleteDocument = async () => {
    if (!docToDelete) return
    try {
      if (docToDelete.source === 'subject') {
        // Find the original subject document to delete by its DB id
        const original = documents.find((d) => d.id === docToDelete.id)
        if (original?.id) {
          await window.campusDeckAPI.subjectDocs.delete(original.id)
        }
      } else {
        // For task documents, we unlink from the task (preserves vault copy)
        // Find by document_id using ref count to determine if safe
        await window.campusDeckAPI.taskDocs.delete(docToDelete.id)
      }
      setDocToDelete(null)
      loadDocuments()
      setNotification({ type: 'success', message: `File "${docToDelete.title}" removed.` })
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete file.'
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

  const filteredDocs = unifiedFiles.filter((doc) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      doc.title.toLowerCase().includes(q) ||
      (doc.description && doc.description.toLowerCase().includes(q)) ||
      (doc.displayName && doc.displayName.toLowerCase().includes(q)) ||
      (doc.subjectName && doc.subjectName.toLowerCase().includes(q))

    const badgeLabel = doc.typeBadge.label
    const matchesCategorySimple = categoryFilter === 'all' || badgeLabel === categoryFilter

    const matchesSource = sourceFilter === 'all' || doc.source === sourceFilter
    const matchesSubject = subjectFilter === 'all' || doc.source !== 'subject' || (doc.subjectName ?? '').includes(subjectFilter)

    return matchesSearch && matchesCategorySimple && matchesSource && matchesSubject
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
            All Vault Files
          </h2>
          <p className="text-xs text-slate-500">
            Subject documents and task attachments stored in your local vault
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

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          >
            <option value="all">All Types</option>
            {Object.values(CATEGORY_LABELS).map((cat) => (
              <option key={cat.label} value={cat.label}>
                {cat.label}
              </option>
            ))}
            {Object.values(TASK_ROLE_LABELS).map((role) => (
              <option key={role.label} value={role.label}>
                {role.label}
              </option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          >
            <option value="all">All Sources</option>
            <option value="subject">Subject Documents</option>
            <option value="task">Task Attachments</option>
          </select>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          >
            <option value="all">All Subjects</option>
            {uniqueSubjects.map((sub) => (
              <option key={sub.id} value={sub.name}>
                {sub.code ? `${sub.code} - ${sub.name}` : sub.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents Table / List */}
      {unifiedFiles.length === 0 ? (
        <div className="p-14 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <Files className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            No vault files yet
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            Import subject documents (syllabuses, timetables, notes) or attach files to tasks
            and assignments. Everything will appear here in your unified vault directory.
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
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Type / Role</th>
                  <th className="py-3 px-4">Subject / Task</th>
                  <th className="py-3 px-4">Original File</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDocs.map((doc) => {
                  const isSubject = doc.source === 'subject'
                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Title & Description */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(doc.mimeType, doc.displayName)}
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

                      {/* Source Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          isSubject
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        }`}>
                          {isSubject ? 'Subject' : 'Task'}
                        </span>
                      </td>

                      {/* Type / Role Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${doc.typeBadge.badgeClass}`}>
                          {doc.typeBadge.label}
                        </span>
                        {doc.variantLabel && (
                          <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {doc.variantLabel}
                          </span>
                        )}
                      </td>

                      {/* Subject / Task */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isSubject ? (
                          doc.subjectName ? (
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: doc.subjectColor || '#4F46E5' }}
                              />
                              <span className="text-slate-700 dark:text-slate-300 font-medium">
                                {doc.subjectCode ? `${doc.subjectCode} • ${doc.subjectName}` : doc.subjectName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )
                        ) : (
                          <span className="text-slate-500 font-mono text-[11px] truncate" title={doc.taskId || ''}>
                            Task: {(doc.taskId || '').slice(0, 8)}…
                          </span>
                        )}
                      </td>

                      {/* Filename */}
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] max-w-[180px] truncate" title={doc.displayName || ''}>
                        {doc.displayName || '—'}
                      </td>

                      {/* File Size */}
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {formatBytes(doc.sizeBytes)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {doc.documentId && (
                            <>
                              <button
                                onClick={() => handleOpenDocument(doc)}
                                className="px-2.5 py-1 rounded-md text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors flex items-center gap-1"
                                title="Open in default application"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Open</span>
                              </button>
                              <button
                                onClick={() => handleRevealDocument(doc)}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Reveal in file explorer (selection highlighted)"
                              >
                                <FolderOpen className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setDocToDelete(doc)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                            title="Delete file"
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
        title="Delete File"
        message={`Are you sure you want to remove "${docToDelete?.title}"?`}
        warningNote={
          docToDelete?.source === 'task'
            ? 'This will unlink the attachment from the task. The physical file in your vault will be preserved if it is referenced elsewhere.'
            : 'The internal copy stored in your local library will be permanently removed.'
        }
        confirmText="Delete File"
        isDestructive={true}
        onConfirm={handleDeleteDocument}
        onCancel={() => setDocToDelete(null)}
      />
    </div>
  )
}
