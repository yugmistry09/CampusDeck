import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  AlertTriangle,
  Edit3,
  Archive,
  ArchiveRestore,
  Trash2,
  Paperclip,
  Plus,
  ExternalLink,
  Unlink,
  FileQuestion,
  Tag
} from 'lucide-react'
import type {
  TaskWithSubject,
  TaskStatus,
  TaskType,
  TaskDocumentRecord,
  DocumentRefCount
} from '@shared/types'
import { TaskModal } from '../components/TaskModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { TaskAttachmentModal } from '../components/TaskAttachmentModal'
import { TaskAttachmentEditModal } from '../components/TaskAttachmentEditModal'

interface TaskDetailPageProps {
  taskId: string
  onBack: () => void
  onTaskDeleted: () => void
  onTaskUpdated?: () => void
}

const TYPE_LABELS: Record<TaskType, string> = {
  assignment: 'Assignment',
  lab_manual: 'Lab Manual',
  practical: 'Practical',
  project: 'Project',
  exam_prep: 'Exam Preparation',
  general: 'General Task',
  other: 'Other'
}

const ROLE_BADGE_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  assignment_file: {
    label: 'Assignment',
    badgeClass: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
  },
  assignment: {
    label: 'Assignment',
    badgeClass: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
  },
  solution: {
    label: 'Solution',
    badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
  },
  reference: {
    label: 'Reference',
    badgeClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
  },
  other: {
    label: 'Other',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
  }
}

function getLocalToday(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return dateStr
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx > 0 ? filename.slice(idx + 1).toUpperCase() : 'FILE'
}

type AttachmentFilterTab = 'all' | 'assignment' | 'solution' | 'reference'

export const TaskDetailPage: React.FC<TaskDetailPageProps> = ({
  taskId,
  onBack,
  onTaskDeleted,
  onTaskUpdated
}) => {
  const [task, setTask] = useState<TaskWithSubject | null>(null)
  const [attachments, setAttachments] = useState<TaskDocumentRecord[]>([])
  const [attachmentFilter, setAttachmentFilter] = useState<AttachmentFilterTab>('all')

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false)
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false)
  const [editingAttachment, setEditingAttachment] = useState<TaskDocumentRecord | null>(null)
  const [attachmentToUnlink, setAttachmentToUnlink] = useState<TaskDocumentRecord | null>(null)
  const [attachmentToDelete, setAttachmentToDelete] = useState<TaskDocumentRecord | null>(null)
  const [deleteRefInfo, setDeleteRefInfo] = useState<DocumentRefCount | null>(null)

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadTask = useCallback(async () => {
    try {
      const data = await window.campusDeskAPI.tasks.getWithSubject(taskId)
      setTask(data)
    } catch (err) {
      console.error('Failed to load task:', err)
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to load task details.'
      })
    }
  }, [taskId])

  const loadAttachments = useCallback(async () => {
    try {
      const docs = await window.campusDeskAPI.taskDocs.list(taskId)
      setAttachments(docs)
    } catch (err) {
      console.error('Failed to load task attachments:', err)
    }
  }, [taskId])

  useEffect(() => {
    loadTask()
    loadAttachments()
  }, [loadTask, loadAttachments])

  if (!task) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-3" />
        <p className="text-xs text-slate-500">Loading task details...</p>
      </div>
    )
  }

  const isCompleted = task.status === 'completed'
  const isArchived = task.is_archived === 1
  const localToday = getLocalToday()

  const isOverdue = Boolean(
    task.due_date &&
      !isCompleted &&
      !isArchived &&
      task.due_date < localToday
  )
  const isDueToday = Boolean(
    task.due_date &&
      !isCompleted &&
      task.due_date === localToday
  )

  const handleStatusChange = async (newStatus: TaskStatus) => {
    try {
      const updated = await window.campusDeskAPI.tasks.update({ id: task.id, status: newStatus })
      if (updated) {
        loadTask()
        onTaskUpdated?.()
        setNotification({
          type: 'success',
          message: `Task marked as ${newStatus.replace('_', ' ')}.`
        })
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update task status.'
      })
    }
  }

  const handleToggleArchive = async () => {
    try {
      await window.campusDeskAPI.tasks.archive(task.id, !isArchived)
      setIsArchiveModalOpen(false)
      loadTask()
      onTaskUpdated?.()
      setNotification({
        type: 'success',
        message: isArchived ? 'Task restored to active list.' : 'Task archived.'
      })
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to change archive state.'
      })
    }
  }

  const handleDeleteTask = async () => {
    try {
      await window.campusDeskAPI.tasks.delete(task.id)
      setIsDeleteModalOpen(false)
      onTaskDeleted()
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete task.'
      })
    }
  }

  // Open file in OS default application
  const handleOpenDocument = async (doc: TaskDocumentRecord) => {
    try {
      await window.campusDeskAPI.files.openDocument(doc.document_id)
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not open file.'
      })
    }
  }

  // Unlink attachment (removes task link, leaves vault copy intact)
  const handleUnlinkConfirm = async () => {
    if (!attachmentToUnlink) return
    try {
      await window.campusDeskAPI.taskDocs.unlink(attachmentToUnlink.id)
      setAttachmentToUnlink(null)
      loadAttachments()
      setNotification({
        type: 'success',
        message: `Attachment "${attachmentToUnlink.display_name}" unlinked from task.`
      })
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to unlink attachment.'
      })
    }
  }

  // Delete attachment (checks reference count for safety)
  const handleInitiateDelete = async (doc: TaskDocumentRecord) => {
    try {
      const refCount = await window.campusDeskAPI.taskDocs.getRefCount(doc.document_id)
      setDeleteRefInfo(refCount)
      setAttachmentToDelete(doc)
    } catch (err) {
      console.error('Failed to get reference count:', err)
      // Fallback
      setDeleteRefInfo(null)
      setAttachmentToDelete(doc)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!attachmentToDelete) return
    try {
      const result = await window.campusDeskAPI.taskDocs.delete(attachmentToDelete.id)
      setAttachmentToDelete(null)
      setDeleteRefInfo(null)
      loadAttachments()

      if (result.fileDeleted) {
        setNotification({
          type: 'success',
          message: `Attachment "${attachmentToDelete.display_name}" unreferenced elsewhere and removed from vault.`
        })
      } else {
        setNotification({
          type: 'success',
          message: `Attachment unlinked from task. Shared copy preserved in vault (${result.remainingRefs} other reference(s) exist).`
        })
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete attachment.'
      })
    }
  }

  // Filter attachments
  const filteredAttachments = useMemo(() => {
    return attachments.filter((att) => {
      if (attachmentFilter === 'all') return true
      if (attachmentFilter === 'assignment') {
        return att.role === 'assignment_file' || att.role === 'assignment'
      }
      if (attachmentFilter === 'solution') return att.role === 'solution'
      if (attachmentFilter === 'reference') {
        return att.role === 'reference' || att.role === 'other'
      }
      return true
    })
  }, [attachments, attachmentFilter])

  const counts = useMemo(() => {
    let assignments = 0
    let solutions = 0
    let references = 0
    for (const a of attachments) {
      if (a.role === 'assignment_file' || a.role === 'assignment') assignments++
      else if (a.role === 'solution') solutions++
      else references++
    }
    return { all: attachments.length, assignments, solutions, references }
  }, [attachments])

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tasks</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit</span>
          </button>
          <button
            onClick={() => setIsArchiveModalOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors flex items-center gap-1.5"
          >
            {isArchived ? (
              <>
                <ArchiveRestore className="w-3.5 h-3.5 text-amber-500" />
                <span>Restore</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5 text-slate-500" />
                <span>Archive</span>
              </>
            )}
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
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
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

      {/* Main Task Card */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
        {/* Title and Badges */}
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {TYPE_LABELS[task.type] || task.type}
            </span>

            {task.subject_name && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: task.subject_color || '#4F46E5' }}
                />
                <span>{task.subject_name}</span>
              </span>
            )}

            <span
              className={`px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider ${
                task.priority === 'high'
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                  : task.priority === 'medium'
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {task.priority} priority
            </span>

            {isArchived && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                Archived
              </span>
            )}
          </div>

          <h2
            className={`text-2xl font-bold tracking-tight ${
              isCompleted
                ? 'line-through text-slate-400 dark:text-slate-500'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {task.title}
          </h2>
        </div>

        {/* Status Transition Control */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Current Status: <span className="capitalize">{task.status.replace('_', ' ')}</span>
            </span>
            <span className="text-[11px] text-slate-400">
              Click a state below to transition this task
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleStatusChange('todo')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                task.status === 'todo'
                  ? 'border-indigo-600 bg-white dark:bg-slate-800 text-indigo-600 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Circle className="w-3.5 h-3.5" />
              <span>To Do</span>
            </button>
            <button
              onClick={() => handleStatusChange('in_progress')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                task.status === 'in_progress'
                  ? 'border-amber-500 bg-white dark:bg-slate-800 text-amber-600 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>In Progress</span>
            </button>
            <button
              onClick={() => handleStatusChange('completed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                task.status === 'completed'
                  ? 'border-emerald-500 bg-white dark:bg-slate-800 text-emerald-600 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Completed</span>
            </button>
          </div>
        </div>

        {/* Due Date Alert Banner if applicable */}
        {task.due_date && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              isOverdue
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200'
                : isDueToday
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              {isOverdue ? (
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              ) : (
                <Calendar className="w-5 h-5 text-indigo-500 shrink-0" />
              )}
              <div>
                <p className="text-xs font-semibold">
                  {isOverdue
                    ? 'This task is overdue!'
                    : isDueToday
                    ? 'Due today!'
                    : 'Target Completion Date'}
                </p>
                <p className="text-xs opacity-90">{formatDate(task.due_date)}</p>
              </div>
            </div>
            {isOverdue && !isCompleted && (
              <button
                onClick={() => handleStatusChange('completed')}
                className="px-3 py-1 rounded-lg text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm"
              >
                Mark Done Now
              </button>
            )}
          </div>
        )}

        {/* Description / Instructions */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Description & Notes
          </h4>
          {task.description ? (
            <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
              {task.description}
            </p>
          ) : (
            <p className="text-xs text-slate-400 italic">No description provided for this task.</p>
          )}
        </div>

        {/* Timestamps and Metadata footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px] text-slate-400">
          <div>
            <span className="block text-slate-500 font-medium">Created</span>
            <span>{new Date(task.created_at).toLocaleString()}</span>
          </div>
          <div>
            <span className="block text-slate-500 font-medium">Last Modified</span>
            <span>{new Date(task.updated_at).toLocaleString()}</span>
          </div>
          {task.archived_at && (
            <div>
              <span className="block text-slate-500 font-medium">Archived At</span>
              <span>{new Date(task.archived_at).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Coursework Documents & Solution Variants Section */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-5">
        {/* Header & Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Attachments & Solutions
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {attachments.length}
            </span>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Filter Pills */}
            {attachments.length > 0 && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setAttachmentFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    attachmentFilter === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  All ({counts.all})
                </button>
                <button
                  onClick={() => setAttachmentFilter('assignment')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    attachmentFilter === 'assignment'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-medium shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Assignments ({counts.assignments})
                </button>
                <button
                  onClick={() => setAttachmentFilter('solution')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    attachmentFilter === 'solution'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-medium shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Solutions ({counts.solutions})
                </button>
                <button
                  onClick={() => setAttachmentFilter('reference')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    attachmentFilter === 'reference'
                      ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 font-medium shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Ref ({counts.references})
                </button>
              </div>
            )}

            <button
              onClick={() => setIsAttachmentModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Attach File</span>
            </button>
          </div>
        </div>

        {/* Attachments List or Empty State */}
        {attachments.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
              <FileQuestion className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              No files attached to this task yet
            </h4>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 max-w-sm">
              Attach assignment question sheets, reference PDFs, or multiple solution variants
              (e.g., Draft 1, Variant B, Teacher's solution).
            </p>
            <button
              onClick={() => setIsAttachmentModalOpen(true)}
              className="mt-3.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Attach First Document</span>
            </button>
          </div>
        ) : filteredAttachments.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6">
            No attachments match the selected filter.
          </p>
        ) : (
          <div className="space-y-2.5">
            {filteredAttachments.map((doc) => {
              const roleMeta = ROLE_BADGE_CONFIG[doc.role] ?? ROLE_BADGE_CONFIG['other']!
              const ext = getFileExtension(doc.display_name)
              const isMissing = doc.file_exists === false

              return (
                <div
                  key={doc.id}
                  className={`p-3.5 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3 ${
                    isMissing
                      ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Left: Icon & Title & Badges */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-[10px] uppercase shrink-0 border border-slate-200 dark:border-slate-700">
                      {ext}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {/* Role Badge */}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${roleMeta.badgeClass}`}>
                          {roleMeta.label}
                        </span>

                        {/* Solution Variant Label if present */}
                        {doc.variant_label && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <Tag className="w-2.5 h-2.5 text-emerald-500" />
                            <span>{doc.variant_label}</span>
                          </span>
                        )}

                        {/* File Missing Badge */}
                        {isMissing && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300">
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                            <span>Missing from vault</span>
                          </span>
                        )}
                      </div>

                      <h4
                        onClick={() => handleOpenDocument(doc)}
                        className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                        title={doc.display_name}
                      >
                        {doc.display_name}
                      </h4>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span>{formatBytes(doc.size_bytes)}</span>
                        <span>•</span>
                        <span>Attached {new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenDocument(doc)}
                      title="Open file in default app"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingAttachment(doc)}
                      title="Edit attachment details"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setAttachmentToUnlink(doc)}
                      title="Unlink from task (preserves file in vault)"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleInitiateDelete(doc)}
                      title="Delete attachment from library"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Task Edit Modal */}
      <TaskModal
        isOpen={isEditModalOpen}
        task={task}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={(updated) => {
          loadTask()
          onTaskUpdated?.()
          setNotification({ type: 'success', message: `Task "${updated.title}" updated.` })
        }}
      />

      {/* Task Attachment Modal (Upload / Select) */}
      <TaskAttachmentModal
        isOpen={isAttachmentModalOpen}
        taskId={task.id}
        taskTitle={task.title}
        onClose={() => setIsAttachmentModalOpen(false)}
        onAttached={(docs) => {
          loadAttachments()
          setNotification({
            type: 'success',
            message: `Attached ${docs.length} document(s) to "${task.title}".`
          })
        }}
      />

      {/* Task Attachment Edit Modal */}
      <TaskAttachmentEditModal
        isOpen={Boolean(editingAttachment)}
        attachment={editingAttachment}
        onClose={() => setEditingAttachment(null)}
        onSaved={(updated) => {
          loadAttachments()
          setNotification({
            type: 'success',
            message: `Attachment "${updated.display_name}" updated.`
          })
        }}
      />

      {/* Unlink Attachment Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(attachmentToUnlink)}
        title="Unlink Attachment"
        message={`Are you sure you want to remove "${attachmentToUnlink?.display_name}" from this task?`}
        warningNote="The physical document and vault library record will remain preserved. Only the link to this task will be removed."
        confirmText="Unlink Attachment"
        isDestructive={false}
        onConfirm={handleUnlinkConfirm}
        onCancel={() => setAttachmentToUnlink(null)}
      />

      {/* Delete Attachment Confirm Modal with Shared Protection Alert */}
      <ConfirmModal
        isOpen={Boolean(attachmentToDelete)}
        title={
          deleteRefInfo?.isShared
            ? 'Unlink Shared Attachment'
            : 'Delete Attachment & File'
        }
        message={`Are you sure you want to remove "${attachmentToDelete?.display_name}"?`}
        warningNote={
          deleteRefInfo?.isShared
            ? `Safety Notice: This document is also linked to ${deleteRefInfo.totalRefs - 1} other task(s) or subject(s). It will only be unlinked from this task, and its shared managed copy will be preserved in your vault.`
            : 'This document is unreferenced anywhere else. Removing it will permanently delete the managed copy from your local library vault.'
        }
        confirmText={deleteRefInfo?.isShared ? 'Unlink Attachment' : 'Permanently Delete'}
        isDestructive={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setAttachmentToDelete(null)
          setDeleteRefInfo(null)
        }}
      />

      {/* Archive Task Confirm Modal */}
      <ConfirmModal
        isOpen={isArchiveModalOpen}
        title={isArchived ? 'Restore Task' : 'Archive Task'}
        message={
          isArchived
            ? `Do you want to restore "${task.title}" to your active to-do list?`
            : `Do you want to archive "${task.title}"?`
        }
        warningNote={
          isArchived
            ? 'This task will re-enter your active to-do list and completion statistics.'
            : 'Archived tasks are excluded from your completion metrics and default to-do list, but remain preserved in your vault.'
        }
        confirmText={isArchived ? 'Restore Task' : 'Archive Task'}
        isDestructive={false}
        onConfirm={handleToggleArchive}
        onCancel={() => setIsArchiveModalOpen(false)}
      />

      {/* Delete Task Confirm Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Task"
        message={`Are you sure you want to permanently delete "${task.title}"?`}
        warningNote="This academic task record and all task-attachment links will be permanently removed from your SQLite database."
        confirmText="Yes, Delete Task"
        isDestructive={true}
        onConfirm={handleDeleteTask}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  )
}
