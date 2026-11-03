import React from 'react'
import { Files, ShieldCheck } from 'lucide-react'

export const AllFilesPage: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Local Storage Boundary</p>
          <p className="mt-0.5 text-indigo-700/80 dark:text-indigo-300/80">
            All files are copied into the app-managed library. Originals remain untouched on your machine.
            Paths in the database are stored relative to the managed storage root for portability.
          </p>
        </div>
      </div>

      <div className="p-12 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
          <Files className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Managed File Library is Empty
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
          Attached assignment PDFs, question banks, and solution documents will be listed here with
          offline PDF viewer support.
        </p>
      </div>
    </div>
  )
}
