import React, { useEffect, useState } from 'react'
import { CheckCircle2, Clock, BookOpen, AlertCircle } from 'lucide-react'
import type { CompletionResult } from '@shared/types'

export const DashboardPage: React.FC = () => {
  const [completion, setCompletion] = useState<CompletionResult>({
    total: 0,
    completed: 0,
    percent: 0
  })

  useEffect(() => {
    if (window.campusDeskAPI?.tasks?.completion) {
      window.campusDeskAPI.tasks
        .completion()
        .then(setCompletion)
        .catch(console.error)
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Overall Progress
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {completion.percent}%
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({completion.completed} / {completion.total})
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-300"
              style={{ width: `${completion.percent}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Upcoming Deadlines
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              0
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">due in next 7 days</span>
          </div>
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">Evaluated locally</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Active Courses
            </span>
            <BookOpen className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              0
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">registered subjects</span>
          </div>
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">Local SQLite storage</p>
        </div>
      </div>

      {/* Empty State */}
      <div className="p-10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          No active coursework recorded yet
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
          Academic tasks, practicals, lab manuals, and projects created in subjects will
          automatically appear in this unified dashboard.
        </p>
      </div>
    </div>
  )
}
