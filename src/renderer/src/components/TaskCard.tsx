import React from 'react'
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  AlertTriangle,
  Edit3,
  Archive,
  ArchiveRestore,
  Trash2
} from 'lucide-react'
import type { TaskWithSubject, TaskType, TaskPriority } from '@shared/types'

interface TaskCardProps {
  task: TaskWithSubject
  onSelect?: (task: TaskWithSubject) => void
  onToggleStatus: (task: TaskWithSubject) => void
  onEdit: (task: TaskWithSubject) => void
  onArchive: (task: TaskWithSubject) => void
  onDelete: (task: TaskWithSubject) => void
}

const TYPE_CONFIG: Record<TaskType, { label: string; badgeClass: string }> = {
  assignment: {
    label: 'Assignment',
    badgeClass: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
  },
  lab_manual: {
    label: 'Lab Manual',
    badgeClass: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
  },
  practical: {
    label: 'Practical',
    badgeClass: 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800'
  },
  project: {
    label: 'Project',
    badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
  },
  exam_prep: {
    label: 'Exam Prep',
    badgeClass: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
  },
  general: {
    label: 'General',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
  },
  other: {
    label: 'Other',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
  }
}

const PRIORITY_BADGES: Record<TaskPriority, { label: string; class: string }> = {
  high: { label: 'High', class: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50' },
  medium: { label: 'Med', class: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50' },
  low: { label: 'Low', class: 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' }
}

function getLocalToday(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return dateStr
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onSelect,
  onToggleStatus,
  onEdit,
  onArchive,
  onDelete
}) => {
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

  const typeMeta = TYPE_CONFIG[task.type] || TYPE_CONFIG.general
  const priorityMeta = PRIORITY_BADGES[task.priority]

  return (
    <div
      className={`group p-4 rounded-xl border transition-all duration-200 bg-white dark:bg-slate-900 shadow-sm hover:shadow relative overflow-hidden flex flex-col justify-between gap-3 ${
        isCompleted
          ? 'border-slate-200/70 dark:border-slate-800/60 opacity-80'
          : isOverdue
          ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/20'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      {/* Left accent strip for subject or priority */}
      <div
        className="absolute top-0 bottom-0 left-0 w-1"
        style={{
          backgroundColor: task.subject_color || (task.priority === 'high' ? '#EF4444' : task.priority === 'medium' ? '#F59E0B' : '#94A3B8')
        }}
      />

      <div className="flex items-start gap-3 pl-1">
        {/* Status Toggle Button */}
        <button
          onClick={() => onToggleStatus(task)}
          title={
            isCompleted
              ? 'Mark as incomplete'
              : task.status === 'in_progress'
              ? 'Mark as completed'
              : 'Start task (mark in progress)'
          }
          className="mt-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shrink-0"
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-50 dark:fill-emerald-950/40" />
          ) : task.status === 'in_progress' ? (
            <Clock className="w-5 h-5 text-amber-500 fill-amber-50 dark:fill-amber-950/40 animate-pulse" />
          ) : (
            <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 hover:text-slate-400" />
          )}
        </button>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {/* Type badge */}
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${typeMeta.badgeClass}`}>
              {typeMeta.label}
            </span>

            {/* Subject badge if linked */}
            {task.subject_name ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: task.subject_color || '#4F46E5' }}
                />
                <span className="truncate max-w-[120px]">{task.subject_name}</span>
              </span>
            ) : (
              <span className="text-[10px] text-slate-400">Unassigned</span>
            )}

            {/* Priority */}
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${priorityMeta.class}`}>
              {priorityMeta.label}
            </span>

            {/* Archived tag if applicable */}
            {isArchived && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                Archived
              </span>
            )}
          </div>

          {/* Title */}
          <h4
            onClick={() => onSelect?.(task)}
            className={`text-sm font-semibold transition-colors cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 ${
              isCompleted
                ? 'line-through text-slate-400 dark:text-slate-500'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {task.title}
          </h4>

          {/* Description preview */}
          {task.description && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}
        </div>
      </div>

      {/* Footer / Meta & Actions */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between pl-1">
        {/* Due date status */}
        <div className="text-xs">
          {task.due_date ? (
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${
                isOverdue
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                  : isDueToday
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {isOverdue ? (
                <>
                  <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                  <span>Overdue ({formatDate(task.due_date)})</span>
                </>
              ) : isDueToday ? (
                <>
                  <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>Due Today</span>
                </>
              ) : (
                <>
                  <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>Due {formatDate(task.due_date)}</span>
                </>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 italic">No due date</span>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(task)}
            title="Edit task"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onArchive(task)}
            title={isArchived ? 'Restore to active list' : 'Archive task'}
            className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
          >
            {isArchived ? (
              <ArchiveRestore className="w-3.5 h-3.5" />
            ) : (
              <Archive className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => onDelete(task)}
            title="Delete task"
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
