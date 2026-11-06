import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  ArrowUpDown
} from 'lucide-react'
import type {
  TaskWithSubject,
  TaskStatus,
  TaskPriority,
  SubjectRow,
  TaskDocumentRecord
} from '@shared/types'
import { TaskCard } from '../components/TaskCard'
import { TaskModal } from '../components/TaskModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { TaskDetailPage } from './TaskDetailPage'

type StatusTab = 'all' | 'todo' | 'in_progress' | 'completed' | 'archived'
type DueDateCondition = 'any' | 'overdue' | 'due_soon' | 'has_date' | 'no_date'
type SortOption = 'due_asc' | 'due_desc' | 'priority_high' | 'priority_low' | 'newest' | 'title_asc'

function getLocalToday(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLocalInNDays(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<TaskWithSubject[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [taskAttachments, setTaskAttachments] = useState<Record<string, TaskDocumentRecord[]>>({})
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Filters
  const [statusTab, setStatusTab] = useState<StatusTab>('all')
  const [subjectFilter, setSubjectFilter] = useState<string>('all') // 'all', 'none', or subjectId
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [dueDateCondition, setDueDateCondition] = useState<DueDateCondition>('any')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('due_asc')

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskWithSubject | null>(null)
  const [taskToArchive, setTaskToArchive] = useState<TaskWithSubject | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<TaskWithSubject | null>(null)

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Load all tasks, subjects, and attachments
  const loadData = useCallback(async () => {
    try {
      const [allTasks, allSubjects, allAttachments] = await Promise.all([
        window.campusDeskAPI.tasks.list({ includeArchived: true }),
        window.campusDeskAPI.subjects.list(),
        window.campusDeskAPI.taskDocs.listAll()
      ])
      setTasks(allTasks)
      setSubjects(allSubjects)

      const grouped: Record<string, TaskDocumentRecord[]> = {}
      for (const a of allAttachments) {
        if (!grouped[a.task_id]) grouped[a.task_id] = []
        grouped[a.task_id]!.push(a)
      }
      setTaskAttachments(grouped)
    } catch (err) {
      console.error('Failed to load tasks data:', err)
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to load task records.'
      })
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filtered & Sorted task list computed locally for instant response
  const filteredTasks = useMemo(() => {
    const localToday = getLocalToday()
    const in7Days = getLocalInNDays(7)
    const query = searchQuery.trim().toLowerCase()

    return tasks
      .filter((t) => {
        // Status & Archive tab
        if (statusTab === 'archived') {
          if (t.is_archived !== 1) return false
        } else {
          if (t.is_archived === 1) return false
          if (statusTab === 'todo' && t.status !== 'todo') return false
          if (statusTab === 'in_progress' && t.status !== 'in_progress') return false
          if (statusTab === 'completed' && t.status !== 'completed') return false
        }

        // Subject filter
        if (subjectFilter !== 'all') {
          if (subjectFilter === 'none') {
            if (t.subject_id !== null) return false
          } else {
            if (t.subject_id !== subjectFilter) return false
          }
        }

        // Type filter
        if (typeFilter !== 'all' && t.type !== typeFilter) {
          return false
        }

        // Due date condition
        if (dueDateCondition === 'has_date' && !t.due_date) return false
        if (dueDateCondition === 'no_date' && t.due_date) return false
        if (dueDateCondition === 'overdue') {
          if (!t.due_date || t.status === 'completed' || t.due_date >= localToday) return false
        }
        if (dueDateCondition === 'due_soon') {
          if (
            !t.due_date ||
            t.status === 'completed' ||
            t.due_date < localToday ||
            t.due_date > in7Days
          ) {
            return false
          }
        }

        // Search query
        if (query) {
          const matchTitle = t.title.toLowerCase().includes(query)
          const matchDesc = t.description?.toLowerCase().includes(query)
          const matchSub = t.subject_name?.toLowerCase().includes(query)
          const matchType = t.type.toLowerCase().includes(query)
          if (!matchTitle && !matchDesc && !matchSub && !matchType) return false
        }

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'due_asc') {
          if (!a.due_date && !b.due_date) return 0
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return a.due_date.localeCompare(b.due_date)
        }
        if (sortBy === 'due_desc') {
          if (!a.due_date && !b.due_date) return 0
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return b.due_date.localeCompare(a.due_date)
        }
        if (sortBy === 'priority_high') {
          const order: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }
          return order[a.priority] - order[b.priority]
        }
        if (sortBy === 'priority_low') {
          const order: Record<TaskPriority, number> = { low: 0, medium: 1, high: 2 }
          return order[a.priority] - order[b.priority]
        }
        if (sortBy === 'newest') {
          return b.created_at.localeCompare(a.created_at)
        }
        if (sortBy === 'title_asc') {
          return a.title.localeCompare(b.title)
        }
        return 0
      })
  }, [tasks, statusTab, subjectFilter, typeFilter, dueDateCondition, searchQuery, sortBy])

  // Status cycling: todo -> in_progress -> completed -> todo
  const handleToggleStatus = async (task: TaskWithSubject) => {
    let nextStatus: TaskStatus
    if (task.status === 'todo') nextStatus = 'in_progress'
    else if (task.status === 'in_progress') nextStatus = 'completed'
    else nextStatus = 'todo'

    try {
      await window.campusDeskAPI.tasks.update({ id: task.id, status: nextStatus })
      loadData()
      setNotification({
        type: 'success',
        message: `Task updated to ${nextStatus.replace('_', ' ')}.`
      })
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update status.'
      })
    }
  }

  // Archive / Unarchive
  const handleArchiveConfirm = async () => {
    if (!taskToArchive) return
    const willArchive = taskToArchive.is_archived === 0
    try {
      await window.campusDeskAPI.tasks.archive(taskToArchive.id, willArchive)
      setTaskToArchive(null)
      loadData()
      setNotification({
        type: 'success',
        message: willArchive ? 'Task moved to archive.' : 'Task restored to active list.'
      })
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update archive state.'
      })
    }
  }

  // Delete
  const handleDeleteConfirm = async () => {
    if (!taskToDelete) return
    try {
      await window.campusDeskAPI.tasks.delete(taskToDelete.id)
      setTaskToDelete(null)
      loadData()
      setNotification({ type: 'success', message: 'Task deleted from vault.' })
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete task.'
      })
    }
  }

  // If viewing task details
  if (selectedTaskId) {
    return (
      <TaskDetailPage
        taskId={selectedTaskId}
        onBack={() => {
          setSelectedTaskId(null)
          loadData()
        }}
        onTaskDeleted={() => {
          setSelectedTaskId(null)
          loadData()
          setNotification({ type: 'success', message: 'Task deleted.' })
        }}
        onTaskUpdated={loadData}
      />
    )
  }

  // Counts for tabs
  const openCount = tasks.filter((t) => t.is_archived === 0 && t.status !== 'completed').length
  const completedCount = tasks.filter((t) => t.is_archived === 0 && t.status === 'completed').length
  const archivedCount = tasks.filter((t) => t.is_archived === 1).length

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Unified To-Do List
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Single source of truth for all coursework, assignments, practicals, and general tasks.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingTask(null)
            setIsModalOpen(true)
          }}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
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

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        {/* Top filter row: Status Pills & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl shrink-0 overflow-x-auto">
            {(
              [
                { id: 'all', label: 'All Open', count: openCount },
                { id: 'todo', label: 'To Do', count: tasks.filter((t) => t.is_archived === 0 && t.status === 'todo').length },
                { id: 'in_progress', label: 'In Progress', count: tasks.filter((t) => t.is_archived === 0 && t.status === 'in_progress').length },
                { id: 'completed', label: 'Completed', count: completedCount },
                { id: 'archived', label: 'Archived', count: archivedCount }
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  statusTab === tab.id
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    statusTab === tab.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks by title, subject, notes..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Second filter row: Dropdown selectors & Sorting */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1 text-slate-400 text-xs">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          {/* Subject Filter */}
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Subjects</option>
            <option value="none">Unassigned / General</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.code ? `${sub.code} - ${sub.name}` : sub.name}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Work Types</option>
            <option value="assignment">Assignment</option>
            <option value="lab_manual">Lab Manual</option>
            <option value="practical">Practical</option>
            <option value="project">Project</option>
            <option value="exam_prep">Exam Prep</option>
            <option value="general">General</option>
            <option value="other">Other</option>
          </select>

          {/* Due Date Condition Filter */}
          <select
            value={dueDateCondition}
            onChange={(e) => setDueDateCondition(e.target.value as DueDateCondition)}
            className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="any">Any Due Date</option>
            <option value="overdue">Overdue Only</option>
            <option value="due_soon">Due Soon (≤7 days)</option>
            <option value="has_date">Has Due Date</option>
            <option value="no_date">No Due Date</option>
          </select>

          {/* Sort Dropdown */}
          <div className="ml-auto flex items-center gap-1.5 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="due_asc">Due Date (Earliest)</option>
              <option value="due_desc">Due Date (Latest)</option>
              <option value="priority_high">Priority (Highest)</option>
              <option value="priority_low">Priority (Lowest)</option>
              <option value="newest">Created Date (Newest)</option>
              <option value="title_asc">Title (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Task List or Empty State */}
      {filteredTasks.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-500 mb-3">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {searchQuery || subjectFilter !== 'all' || typeFilter !== 'all' || dueDateCondition !== 'any'
              ? 'No tasks match current filters'
              : statusTab === 'completed'
              ? 'No completed tasks recorded yet'
              : statusTab === 'archived'
              ? 'Archive is clear'
              : 'Unified To-Do List is Clear'}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            {searchQuery || subjectFilter !== 'all' || typeFilter !== 'all' || dueDateCondition !== 'any'
              ? 'Try resetting your filter parameters or search query.'
              : 'Create an assignment, practical, lab manual, project, or general task to track it here.'}
          </p>
          <button
            onClick={() => {
              setEditingTask(null)
              setIsModalOpen(true)
            }}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Create First Task
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              attachments={taskAttachments[task.id]}
              onSelect={(t) => setSelectedTaskId(t.id)}
              onToggleStatus={handleToggleStatus}
              onEdit={(t) => {
                setEditingTask(t)
                setIsModalOpen(true)
              }}
              onArchive={(t) => setTaskToArchive(t)}
              onDelete={(t) => setTaskToDelete(t)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <TaskModal
        isOpen={isModalOpen}
        task={editingTask}
        defaultSubjectId={subjectFilter !== 'all' && subjectFilter !== 'none' ? subjectFilter : null}
        onClose={() => {
          setIsModalOpen(false)
          setEditingTask(null)
        }}
        onSaved={(saved) => {
          loadData()
          setNotification({
            type: 'success',
            message: `Task "${saved.title}" saved successfully.`
          })
        }}
      />

      {/* Archive Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(taskToArchive)}
        title={taskToArchive?.is_archived === 1 ? 'Restore Task' : 'Archive Task'}
        message={
          taskToArchive?.is_archived === 1
            ? `Do you want to restore "${taskToArchive?.title}" to your active tasks?`
            : `Do you want to archive "${taskToArchive?.title}"?`
        }
        warningNote={
          taskToArchive?.is_archived === 1
            ? 'This task will be returned to your active to-do list and completion metrics.'
            : 'Archived tasks are excluded from completion metrics and active lists, but remain safely stored in your vault.'
        }
        confirmText={taskToArchive?.is_archived === 1 ? 'Restore' : 'Archive Task'}
        isDestructive={false}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setTaskToArchive(null)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(taskToDelete)}
        title="Delete Task"
        message={`Are you sure you want to permanently delete "${taskToDelete?.title}"?`}
        warningNote="This academic task record will be removed from your SQLite database."
        confirmText="Yes, Delete Task"
        isDestructive={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setTaskToDelete(null)}
      />
    </div>
  )
}
