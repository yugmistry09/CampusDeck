import React, { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import type { SubjectRow } from '@shared/types'

export const SubjectsPage: React.FC = () => {
  const [subjects, setSubjects] = useState<SubjectRow[]>([])

  useEffect(() => {
    if (window.campusDeskAPI?.subjects?.list) {
      window.campusDeskAPI.subjects.list().then(setSubjects).catch(console.error)
    }
  }, [])

  return (
    <div className="space-y-4">
      {subjects.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            No academic subjects created yet
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            Organize coursework by semester, module, or subject. Subject documents (syllabuses,
            notices) attach here without cluttering your to-do list.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {subjects.map((sub) => (
            <div
              key={sub.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
            >
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{sub.name}</h4>
              {sub.code && <p className="text-xs text-slate-500">{sub.code}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
