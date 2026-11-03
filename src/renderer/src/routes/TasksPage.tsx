import React, { useEffect, useState } from 'react'
import { CheckSquare, Filter } from 'lucide-react'
import type { TaskRow } from '@shared/types'

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [filter, setFilter] = useState<'all' | 'todo' | 'completed'>('all')

  useEffect(() => {
    if (window.campusDeskAPI?.tasks?.list) {
      window.campusDeskAPI.tasks
        .list(filter === 'all' ? {} : { status: filter })
        .then(setTasks)
        .catch(console.error)
    }
  }, [filter])

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-500">Filter:</span>
          {(['all', 'todo', 'completed'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === mode
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400">{tasks.length} total tasks</span>
      </div>

      {/* Empty State */}
      {tasks.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-500 mb-3">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Unified To-Do List is Clear
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            Every assignment, lab manual, practical, project, and general task is unified in this
            list without duplication.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {task.title}
                </span>
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                  {task.type}
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">{task.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
