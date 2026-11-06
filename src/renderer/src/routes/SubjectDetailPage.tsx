import React, { useEffect, useState, useCallback } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Edit3,
  Trash2,
  UploadCloud,
  FileText,
  ExternalLink,
  CheckCircle2,
  FileCheck,
  Plus
} from 'lucide-react'
import type {
  SubjectWithStats,
  SubjectRow,
  SubjectDocumentRecord,
  SubjectDocumentType,
  TaskWithSubject,
  TaskStatus,
  TaskDocumentRecord
} from '@shared/types'
import { SubjectModal } from '../components/SubjectModal'
import { DocumentUploadModal } from '../components/DocumentUploadModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { TaskCard } from '../components/TaskCard'
import { TaskModal } from '../components/TaskModal'
import { TaskDetailPage } from './TaskDetailPage'

interface SubjectDetailPageProps {
  subjectId: string
  onBack: () => void
  onSubjectDeleted: () => void
}

type TabMode = 'overview' | 'tasks' | 'files'

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

export const SubjectDetailPage: React.FC<SubjectDetailPageProps> = ({
  subjectId,
  onBack,
  onSubjectDeleted
}) => {
  const [subject, setSubject] = useState<SubjectWithStats | null>(null)
  const [documents, setDocuments] = useState<SubjectDocumentRecord[]>([])
  const [tasks, setTasks] = useState<TaskWithSubject[]>([])
  const [taskAttachments, setTaskAttachments] = useState<Record<string, TaskDocumentRecord[]>>({})
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabMode>('overview')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'todo' | 'in_progress' | 'completed'>('all')

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [docToDelete, setDocToDelete] = useState<SubjectDocumentRecord | null>(null)

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskWithSubject | null>(null)
  const [taskToArchive, setTaskToArchive] = useState<TaskWithSubject | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<TaskWithSubject | null>(null)

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadSubjectData = useCallback(async () => {
    try {
      const [stats, docs, subTasks, attachments] = await Promise.all([
        window.campusDeskAPI.subjects.getWithStats(subjectId),
        window.campusDeskAPI.subjectDocs.list(subjectId),
        window.campusDeskAPI.tasks.list({ subjectId, includeArchived: true }),
        window.campusDeskAPI.taskDocs.listBySubject(subjectId)
      ])
      if (stats) setSubject(stats)
      setDocuments(docs)
      setTasks(subTasks)

      const grouped: Record<string, TaskDocumentRecord[]> = {}
      for (const a of attachments) {
        if (!grouped[a.task_id]) grouped[a.task_id] = []
        grouped[a.task_id]!.push(a)
      }
      setTaskAttachments(grouped)
    } catch (err) {
      console.error('Failed to load subject details:', err)
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to load subject details.'
      })
    }
  }, [subjectId])

  useEffect(() => {
    loadSubjectData()
  }, [loadSubjectData])

  const handleSubjectSaved = (updated: SubjectRow) => {
    loadSubjectData()
    setNotification({ type: 'success', message: `Subject "${updated.name}" updated successfully.` })
  }

  const handleDeleteSubject = async () => {
    try {
      await window.campusDeskAPI.subjects.delete(subjectId)
      setIsDeleteModalOpen(false)
      onSubjectDeleted()
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete subject.'
      })
    }
  }

  const handleDeleteDocument = async () => {
    if (!docToDelete) return
    try {
      await window.campusDeskAPI.subjectDocs.delete(docToDelete.id)
      setDocToDelete(null)
      loadSubjectData()
      setNotification({ type: 'success', message: `Document "${docToDelete.title}" deleted.` })
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete document.'
      })
    }
  }

  const handleOpenDocument = async (doc: SubjectDocumentRecord) => {
    if (!doc.document_id) return
    try {
      await window.campusDeskAPI.files.openDocument(doc.document_id)
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not open file.'
      })
    }
  }

  const handleToggleTaskStatus = async (t: TaskWithSubject) => {
    let next: TaskStatus
    if (t.status === 'todo') next = 'in_progress'
    else if (t.status === 'in_progress') next = 'completed'
    else next = 'todo'
    try {
      await window.campusDeskAPI.tasks.update({ id: t.id, status: next })
      loadSubjectData()
      setNotification({ type: 'success', message: 'Task status updated.' })
    } catch (err) {
      setNotification({ type: 'error', message: 'Failed to update task status.' })
    }
  }

  const handleArchiveTaskConfirm = async () => {
    if (!taskToArchive) return
    try {
      await window.campusDeskAPI.tasks.archive(taskToArchive.id, taskToArchive.is_archived === 0)
      setTaskToArchive(null)
      loadSubjectData()
      setNotification({ type: 'success', message: 'Task archive state updated.' })
    } catch (err) {
      setNotification({ type: 'error', message: 'Failed to update archive state.' })
    }
  }

  const handleDeleteTaskConfirm = async () => {
    if (!taskToDelete) return
    try {
      await window.campusDeskAPI.tasks.delete(taskToDelete.id)
      setTaskToDelete(null)
      loadSubjectData()
      setNotification({ type: 'success', message: 'Task deleted.' })
    } catch (err) {
      setNotification({ type: 'error', message: 'Failed to delete task.' })
    }
  }

  const filteredTasks = tasks.filter((t) => {
    if (t.is_archived === 1) return false
    if (taskStatusFilter === 'all') return true
    return t.status === taskStatusFilter
  })

  const filteredDocuments = documents.filter((doc) => {
    if (categoryFilter === 'all') return true
    return doc.type === categoryFilter
  })

  if (selectedTaskId) {
    return (
      <TaskDetailPage
        taskId={selectedTaskId}
        onBack={() => setSelectedTaskId(null)}
        onTaskDeleted={() => {
          setSelectedTaskId(null)
          loadSubjectData()
        }}
        onTaskUpdated={() => loadSubjectData()}
      />
    )
  }

  if (!subject) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-3" />
        <p className="text-xs text-slate-500">Loading subject details...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Subjects</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit Subject</span>
          </button>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/30 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Notification banner */}
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

      {/* Subject Header Card */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden">
        <div
          className="absolute top-0 left-0 right-0 h-2"
          style={{ backgroundColor: subject.color || '#4F46E5' }}
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5"
              style={{ backgroundColor: subject.color || '#4F46E5' }}
            >
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {subject.name}
                </h2>
                {subject.code && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                    {subject.code}
                  </span>
                )}
                {subject.semester && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-medium">
                    {subject.semester}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Added on {new Date(subject.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Quick stats badges */}
          <div className="flex items-center gap-3 text-xs">
            <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center">
              <span className="block font-bold text-sm text-slate-900 dark:text-slate-100">
                {subject.totalTasks}
              </span>
              <span className="text-[10px] text-slate-500">Tasks</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center">
              <span className="block font-bold text-sm text-emerald-600 dark:text-emerald-400">
                {subject.completionPercent}%
              </span>
              <span className="text-[10px] text-slate-500">Completed</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center">
              <span className="block font-bold text-sm text-indigo-600 dark:text-indigo-400">
                {subject.totalFiles}
              </span>
              <span className="text-[10px] text-slate-500">Files</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'tasks'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <span>Tasks</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px]">
            {subject.totalTasks}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'files'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <span>Files & Reference</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px]">
            {documents.length}
          </span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* Notes Section */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Course Notes & Details
                </h4>
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Edit Notes
                </button>
              </div>

              {subject.notes ? (
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {subject.notes}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No notes recorded yet. Use Edit Subject to add syllabus policies, instructor details, or notes.
                </p>
              )}
            </div>

            {/* Recent Reference Files Preview */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Subject Files ({documents.length})
                </h4>
                <button
                  onClick={() => setActiveTab('files')}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  View All Files
                </button>
              </div>

              {documents.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No files attached to this subject yet.</p>
              ) : (
                <div className="space-y-2">
                  {documents.slice(0, 3).map((doc) => (
                    <div
                      key={doc.id}
                      className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                            {doc.title}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {doc.display_name} • {formatBytes(doc.size_bytes)}
                          </span>
                        </div>
                      </div>
                      {doc.document_id && (
                        <button
                          onClick={() => handleOpenDocument(doc)}
                          className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          title="Open file in default app"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Meta & Academic Progress */}
          <div className="space-y-6">
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-800">
                Course Progress
              </h4>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Task Completion</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {subject.completionPercent}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-300"
                    style={{ width: `${subject.completionPercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  {subject.completedTasks} completed out of {subject.totalTasks} non-archived tasks.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Course Code</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {subject.code || 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Semester</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {subject.semester || 'Unassigned'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TASKS */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Tasks Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            {/* Status Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(
                [
                  { id: 'all', label: `All (${tasks.filter((t) => t.is_archived === 0).length})` },
                  { id: 'todo', label: `To Do (${tasks.filter((t) => t.is_archived === 0 && t.status === 'todo').length})` },
                  { id: 'in_progress', label: `In Progress (${tasks.filter((t) => t.is_archived === 0 && t.status === 'in_progress').length})` },
                  { id: 'completed', label: `Completed (${tasks.filter((t) => t.is_archived === 0 && t.status === 'completed').length})` }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTaskStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                    taskStatusFilter === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Create Task for this subject Button */}
            <button
              onClick={() => {
                setEditingTask(null)
                setIsTaskModalOpen(true)
              }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Course Task</span>
            </button>
          </div>

          {/* Tasks List */}
          {filteredTasks.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {taskStatusFilter === 'completed'
                  ? 'No completed tasks yet'
                  : 'No active tasks for this course'}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Add assignments, lab manuals, practicals, projects, or exam prep items for {subject.name}.
              </p>
              <button
                onClick={() => {
                  setEditingTask(null)
                  setIsTaskModalOpen(true)
                }}
                className="mt-4 px-3.5 py-1.5 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 transition-colors"
              >
                Create First Task
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  attachments={taskAttachments[t.id]}
                  onSelect={(item) => setSelectedTaskId(item.id)}
                  onToggleStatus={handleToggleTaskStatus}
                  onEdit={(item) => {
                    setEditingTask(item)
                    setIsTaskModalOpen(true)
                  }}
                  onArchive={(item) => setTaskToArchive(item)}
                  onDelete={(item) => setTaskToDelete(item)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FILES & REFERENCE */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          {/* Files Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                  categoryFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                All Files ({documents.length})
              </button>
              {(Object.keys(CATEGORY_LABELS) as SubjectDocumentType[]).map((cat) => {
                const count = documents.filter((d) => d.type === cat).length
                if (count === 0 && categoryFilter !== cat) return null
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                      categoryFilter === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {CATEGORY_LABELS[cat]?.label} ({count})
                  </button>
                )
              })}
            </div>

            {/* Upload Button */}
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-1.5 self-start sm:self-auto"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Import Document</span>
            </button>
          </div>

          {/* Documents Grid / Table */}
          {filteredDocuments.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                No documents found
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Attach syllabus sheets, lab manuals, notice circulars, lecture notes, or reference PDFs
                for this course.
              </p>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="mt-4 px-3.5 py-1.5 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 transition-colors"
              >
                Upload First Document
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocuments.map((doc) => {
                const catMeta = CATEGORY_LABELS[doc.type] || CATEGORY_LABELS.other
                return (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${catMeta.badgeClass}`}>
                          {catMeta.label}
                        </span>
                        <div className="flex items-center gap-1">
                          {doc.document_id && (
                            <button
                              onClick={() => handleOpenDocument(doc)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Open in default application"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setDocToDelete(doc)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                            title="Delete document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-2">
                        {doc.title}
                      </h4>

                      {doc.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {doc.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate max-w-[200px]" title={doc.display_name || ''}>
                        {doc.display_name || 'No file attached'}
                      </span>
                      <span>{formatBytes(doc.size_bytes)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit Subject Modal */}
      <SubjectModal
        isOpen={isEditModalOpen}
        subject={subject}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={handleSubjectSaved}
      />

      {/* Upload Document Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        subjectId={subjectId}
        subjectName={subject.name}
        onClose={() => setIsUploadModalOpen(false)}
        onUploaded={() => {
          loadSubjectData()
          setNotification({ type: 'success', message: 'Document successfully imported into vault.' })
        }}
      />

      {/* Confirm Subject Delete Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Subject"
        message={`Are you sure you want to delete "${subject.name}"?`}
        warningNote="All subject reference documents will be permanently removed from disk. However, your academic tasks will NOT be deleted; they will be preserved as unassigned coursework (D-006)."
        confirmText="Yes, Delete Subject"
        onConfirm={handleDeleteSubject}
        onCancel={() => setIsDeleteModalOpen(false)}
      />

      {/* Confirm Document Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(docToDelete)}
        title="Delete Document"
        message={`Are you sure you want to delete "${docToDelete?.title}"?`}
        warningNote="The internal copy stored in your local library will be removed."
        confirmText="Delete Document"
        onConfirm={handleDeleteDocument}
        onCancel={() => setDocToDelete(null)}
      />

      {/* Course Task Create / Edit Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        task={editingTask}
        defaultSubjectId={subjectId}
        onClose={() => {
          setIsTaskModalOpen(false)
          setEditingTask(null)
        }}
        onSaved={(t) => {
          loadSubjectData()
          setNotification({ type: 'success', message: `Task "${t.title}" saved.` })
        }}
      />

      {/* Confirm Task Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(taskToDelete)}
        title="Delete Task"
        message={`Are you sure you want to delete "${taskToDelete?.title}"?`}
        warningNote="This academic task record will be permanently deleted from your SQLite vault."
        confirmText="Delete Task"
        isDestructive={true}
        onConfirm={handleDeleteTaskConfirm}
        onCancel={() => setTaskToDelete(null)}
      />

      {/* Confirm Task Archive Modal */}
      <ConfirmModal
        isOpen={Boolean(taskToArchive)}
        title={taskToArchive?.is_archived === 1 ? 'Restore Task' : 'Archive Task'}
        message={
          taskToArchive?.is_archived === 1
            ? `Restore "${taskToArchive?.title}" to active coursework?`
            : `Archive "${taskToArchive?.title}"?`
        }
        warningNote="Archived tasks are preserved in your database, but excluded from completion metrics."
        confirmText={taskToArchive?.is_archived === 1 ? 'Restore' : 'Archive'}
        isDestructive={false}
        onConfirm={handleArchiveTaskConfirm}
        onCancel={() => setTaskToArchive(null)}
      />
    </div>
  )
}
