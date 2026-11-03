import React, { useEffect, useState } from 'react'
import { HardDrive, Shield, Database, RefreshCw } from 'lucide-react'
import type { AppSettings } from '@shared/types'

export const SettingsPage: React.FC = () => {
  const [paths, setPaths] = useState<{
    userData: string
    appDataDir: string
    library: string
    backups: string
    version: string
  } | null>(null)

  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    if (window.campusDeskAPI?.settings) {
      window.campusDeskAPI.settings.getPaths().then(setPaths).catch(console.error)
      window.campusDeskAPI.settings.get().then(setSettings).catch(console.error)
    }
  }, [])

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Storage Paths (Read-Only) */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <HardDrive className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Persistent Storage Locations
          </h3>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <span className="font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
              Dedicated Data Directory
            </span>
            <code className="px-2 py-1 bg-slate-100 dark:bg-slate-800/80 rounded font-mono text-slate-800 dark:text-slate-200 block truncate">
              {paths?.appDataDir || 'Resolving...'}
            </code>
          </div>

          <div>
            <span className="font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
              SQLite Database Path
            </span>
            <code className="px-2 py-1 bg-slate-100 dark:bg-slate-800/80 rounded font-mono text-slate-800 dark:text-slate-200 block truncate">
              {paths?.appDataDir ? `${paths.appDataDir}/campusdesk.db` : 'Resolving...'}
            </code>
          </div>

          <div>
            <span className="font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
              Managed File Library Root
            </span>
            <code className="px-2 py-1 bg-slate-100 dark:bg-slate-800/80 rounded font-mono text-slate-800 dark:text-slate-200 block truncate">
              {paths?.library || 'Resolving...'}
            </code>
          </div>

          <div>
            <span className="font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
              Snapshots & Backups
            </span>
            <code className="px-2 py-1 bg-slate-100 dark:bg-slate-800/80 rounded font-mono text-slate-800 dark:text-slate-200 block truncate">
              {paths?.backups || 'Resolving...'}
            </code>
          </div>
        </div>
      </div>

      {/* Backup Settings */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Database Backup & Retention
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-medium text-slate-600 dark:text-slate-400 block mb-1">
              Backup Schedule
            </label>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-200">
              <RefreshCw className="w-3 h-3 text-slate-400" />
              {settings?.backup_schedule || 'daily'}
            </span>
          </div>
          <div>
            <label className="font-medium text-slate-600 dark:text-slate-400 block mb-1">
              Snapshots Retained
            </label>
            <span className="inline-flex items-center px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-200">
              {settings?.backup_retain ?? 30} snapshots
            </span>
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-600 dark:text-slate-400 space-y-2">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-medium">
          <Shield className="w-4 h-4 text-indigo-500" />
          <span>Security Model & Vault Architecture</span>
        </div>
        <p>
          CampusDesk is entirely local-first. There is no cloud telemetry, tracking, or remote account.
          V1 does not include a decorative password prompt; true security requires full disk or SQLCipher
          database encryption, which is planned for future vault versions.
        </p>
      </div>
    </div>
  )
}
