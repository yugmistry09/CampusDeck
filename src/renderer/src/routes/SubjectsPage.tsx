import React, { useEffect, useState, useCallback } from 'react'
import {
  BookOpen,
  Plus,
  Search,
  ChevronRight,
  Edit3,
  Trash2,
  Files
} from 'lucide-react'
import type { SubjectWithStats, SubjectRow } from '@shared/types'
import { SubjectModal } from '../components/SubjectModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { SubjectDetailPage } from './SubjectDetailPage'

export const SubjectsPage: React.FC = () => {
  const [subjects, setSubjects] = useState<SubjectWithStats[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<SubjectRow | null>(null)
  const [subjectToDelete, setSubjectToDelete] = useState<SubjectWithStats | null>(null)

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadSubjects = useCallback(async () => {
    try {
      const list = await window.campusDeckAPI.subjects.listWithStats()
      setSubjects(list)
    } catch (err) {
      console.error('Failed to load subjects:', err)
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to load subjects.'
      })
    }
  }, [])

  useEffect(() => {
    loadSubjects()
  }, [loadSubjects])

  const handleSubjectSaved = () => {
    loadSubjects()
    setEditingSubject(null)
    setIsModalOpen(false)
    setNotification({ type: 'success', message: 'Subject saved successfully.' })
  }

  const handleDeleteSubject = async () => {
    if (!subjectToDelete) return
    try {
      await window.campusDeckAPI.subjects.delete(subjectToDelete.id)
      setSubjectToDelete(null)
      loadSubjects()
      setNotification({ type: 'success', message: `Subject "${subjectToDelete.name}" deleted.` })
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete subject.'
      })
    }
  }

  // If a subject is selected for drill-down detail view:
  if (selectedSubjectId) {
    return (
      <SubjectDetailPage
        subjectId={selectedSubjectId}
        onBack={() => {
          setSelectedSubjectId(null)
          loadSubjects()
        }}
        onSubjectDeleted={() => {
          setSelectedSubjectId(null)
          loadSubjects()
        }}
      />
    )
  }

  const filteredSubjects = subjects.filter((s) => {
    const q = searchQuery.toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      (s.code && s.code.toLowerCase().includes(q)) ||
      (s.semester && s.semester.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Registered Subjects
          </h2>
          <p className="text-xs text-slate-500">
            Organize coursework, syllabuses, lecture notes, and academic documents by course
          </p>
        </div>

        <button
          onClick={() => {
            setEditingSubject(null)
            setIsModalOpen(true)
          }}
          className="px-4 py-2 rounded-xl text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Subject</span>
        </button>
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

      {/* Search & Filter */}
      {subjects.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by subject name, code, or semester..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <span className="text-xs text-slate-400">
            {filteredSubjects.length} of {subjects.length} subjects
          </span>
        </div>
      )}

      {/* Subjects Grid */}
      {subjects.length === 0 ? (
        <div className="p-14 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-500 mb-3">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            No academic subjects created yet
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            Add your subjects to organize syllabus documents, notices, practicals, and assignment
            tasks locally.
          </p>
          <button
            onClick={() => {
              setEditingSubject(null)
              setIsModalOpen(true)
            }}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Subject</span>
          </button>
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="p-10 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
          No subjects matching "{searchQuery}".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubjects.map((sub) => (
            <div
              key={sub.id}
              onClick={() => setSelectedSubjectId(sub.id)}
              className="group p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
            >
              {/* Top Accent Color Bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1.5 transition-all group-hover:h-2"
                style={{ backgroundColor: sub.color || '#4F46E5' }}
              />

              <div className="pt-1">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {sub.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {sub.code && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-medium text-slate-700 dark:text-slate-300">
                          {sub.code}
                        </span>
                      )}
                      {sub.semester && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                          {sub.semester}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0 mt-1" />
                </div>

                {/* Notes Snippet */}
                {sub.notes && (
                  <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {sub.notes}
                  </p>
                )}
              </div>

              {/* Progress & Bottom Actions */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-500">Task Completion</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {sub.completionPercent}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-300"
                      style={{ width: `${sub.completionPercent}%` }}
                    />
                  </div>
                </div>

                {/* Footer Badges & Quick Action Buttons */}
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-2">
                    <span>{sub.totalTasks} Tasks</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Files className="w-3 h-3" />
                      {sub.totalFiles} Files
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()} // Prevent card navigation when clicking buttons
                  >
                    <button
                      onClick={() => {
                        setEditingSubject(sub)
                        setIsModalOpen(true)
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit subject"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setSubjectToDelete(sub)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                      title="Delete subject"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Subject Modal */}
      <SubjectModal
        isOpen={isModalOpen}
        subject={editingSubject}
        onClose={() => {
          setIsModalOpen(false)
          setEditingSubject(null)
        }}
        onSaved={handleSubjectSaved}
      />

      {/* Confirm Subject Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(subjectToDelete)}
        title="Delete Subject"
        message={`Are you sure you want to delete "${subjectToDelete?.name}"?`}
        warningNote="All subject reference files will be removed from disk. However, your academic tasks will NOT be deleted; they will be preserved as unassigned tasks (D-006)."
        confirmText="Yes, Delete Subject"
        onConfirm={handleDeleteSubject}
        onCancel={() => setSubjectToDelete(null)}
      />
    </div>
  )
}
