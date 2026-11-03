import React, { useEffect, useState, useCallback } from 'react'
import {
  CheckCircle2,
  Clock,
  BookOpen,
  AlertTriangle,
  Plus,
  Calendar,
  CheckSquare,
  Circle,
  ArrowRight
} from 'lucide-react'
import type {
  DashboardStats,
  TaskWithSubject,
  SubjectWithStats,
  TaskStatus
} from '@shared/types'
import { TaskModal } from '../components/TaskModal'

interface DashboardPageProps {
  onNavigateToTasks?: () => void
  onNavigateToSubjects?: () => void
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
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToTasks,
  onNavigateToSubjects
}) => {
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    completed: 0,
    open: 0,
    overdue: 0,
    dueSoon: 0,
    percent: 0
  })
  const [subjects, setSubjects] = useState<SubjectWithStats[]>([])
  const [upcomingTasks, setUpcomingTasks] = useState<TaskWithSubject[]>([])
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadDashboardData = useCallback(async () => {
    try {
      const [dashStats, subsWithStats, soonTasks] = await Promise.all([
        window.campusDeskAPI.tasks.dashboardStats(),
        window.campusDeskAPI.subjects.listWithStats(),
        window.campusDeskAPI.tasks.dueSoon(14) // next 14 days
      ])

      setStats(dashStats)
      setSubjects(subsWithStats)
      setUpcomingTasks(soonTasks)
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    }
  }, [])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const handleToggleTask = async (task: TaskWithSubject) => {
    const nextStatus: TaskStatus = task.status === 'completed' ? 'todo' : 'completed'
    try {
      await window.campusDeskAPI.tasks.update({ id: task.id, status: nextStatus })
      loadDashboardData()
      setNotification({
        type: 'success',
        message: nextStatus === 'completed' ? 'Task marked complete!' : 'Task reopened.'
      })
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Failed to update task status.'
      })
    }
  }

  const localToday = getLocalToday()

  return (
    <div className="space-y-6 max-w-6xl animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Academic Overview
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Single-source tracking across coursework, practicals, and deadlines.
          </p>
        </div>

        <button
          onClick={() => setIsTaskModalOpen(true)}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Academic Task</span>
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

      {/* Top 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Overall Progress */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Overall Progress
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {stats.percent}%
              </span>
              <span className="text-xs text-slate-500">
                ({stats.completed} / {stats.total} tasks)
              </span>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2. Open Coursework */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Open Tasks
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600">
                <CheckSquare className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {stats.open}
              </span>
              <span className="text-xs text-slate-500">actionable items</span>
            </div>
          </div>
          <div className="mt-4 text-[11px] text-slate-400">
            <span>To Do or In Progress</span>
          </div>
        </div>

        {/* 3. Due Soon (≤ 7 days) */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Due Soon
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {stats.dueSoon}
              </span>
              <span className="text-xs text-slate-500">in next 7 days</span>
            </div>
          </div>
          <div className="mt-4 text-[11px] text-slate-400">
            <span>Local calendar calculation</span>
          </div>
        </div>

        {/* 4. Overdue */}
        <div
          className={`p-5 rounded-2xl border bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between ${
            stats.overdue > 0
              ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/10'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-semibold ${
                  stats.overdue > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Overdue
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  stats.overdue > 0
                    ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span
                className={`text-3xl font-extrabold tracking-tight ${
                  stats.overdue > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {stats.overdue}
              </span>
              <span className="text-xs text-slate-500">past deadline</span>
            </div>
          </div>
          <div className="mt-4 text-[11px] text-slate-400">
            <span>Completed items excluded</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Upcoming Deadlines & Per-Subject Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Upcoming Deadlines */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Upcoming Deadlines & Work
                </h3>
              </div>
              {onNavigateToTasks && (
                <button
                  onClick={onNavigateToTasks}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 transition-colors"
                >
                  <span>View All Tasks</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {upcomingTasks.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  No upcoming deadlines in the next 14 days
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  You're all caught up on scheduled coursework!
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingTasks.slice(0, 6).map((task) => {
                  const isDueToday = task.due_date === localToday
                  return (
                    <div
                      key={task.id}
                      className="p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          onClick={() => handleToggleTask(task)}
                          title="Mark complete"
                          className="text-slate-400 hover:text-emerald-600 shrink-0"
                        >
                          <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 hover:text-emerald-500 transition-colors" />
                        </button>
                        <div className="truncate">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                            {task.subject_name && (
                              <span className="flex items-center gap-1 font-medium">
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: task.subject_color || '#4F46E5' }}
                                />
                                <span>{task.subject_name}</span>
                              </span>
                            )}
                            <span className="capitalize">{task.type.replace('_', ' ')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {task.due_date && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isDueToday
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300'
                            }`}
                          >
                            {isDueToday ? 'Today' : formatDate(task.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Per-Subject Progress */}
        <div className="space-y-4">
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Course Progress
                </h3>
              </div>
              {onNavigateToSubjects && (
                <button
                  onClick={onNavigateToSubjects}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 transition-colors"
                >
                  <span>All ({subjects.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {subjects.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <p>No subjects registered yet.</p>
                {onNavigateToSubjects && (
                  <button
                    onClick={onNavigateToSubjects}
                    className="mt-2 text-indigo-600 hover:underline"
                  >
                    Add your courses
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {subjects.map((sub) => (
                  <div key={sub.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: sub.color || '#4F46E5' }}
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {sub.code ? `${sub.code} - ${sub.name}` : sub.name}
                        </span>
                      </div>
                      <span className="font-bold text-slate-700 dark:text-slate-300 ml-2">
                        {sub.completionPercent}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${sub.completionPercent}%`,
                          backgroundColor: sub.color || '#4F46E5'
                        }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{sub.completedTasks} of {sub.totalTasks} completed</span>
                      <span>{sub.totalFiles} files</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Creation Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSaved={() => {
          loadDashboardData()
          setNotification({ type: 'success', message: 'Task created successfully!' })
        }}
      />
    </div>
  )
}
