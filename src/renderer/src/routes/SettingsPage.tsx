import React, { useEffect, useState, useCallback } from 'react'
import {
  HardDrive,
  Shield,
  Database,
  RefreshCw,
  FolderOpen,
  Sun,
  Moon,
  Monitor,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  FileCheck,
  Package
} from 'lucide-react'
import type { AppSettings, StorageUsageInfo } from '@shared/types'
import type { ThemeMode } from '../components/Header'

interface SettingsPageProps {
  currentTheme?: ThemeMode
  onThemeChange?: (theme: ThemeMode) => void
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  currentTheme,
  onThemeChange
}) => {
  const [paths, setPaths] = useState<{
    userData: string
    appDataDir: string
    library: string
    backups: string
    version: string
  } | null>(null)

  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [activeTheme, setActiveTheme] = useState<ThemeMode>(currentTheme || 'system')
  const [storageUsage, setStorageUsage] = useState<StorageUsageInfo | null>(null)
  const [isLoadingUsage, setIsLoadingUsage] = useState<boolean>(false)

  // Backup / Restore states
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [isRestoring, setIsRestoring] = useState<boolean>(false)
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState<boolean>(false)
  const [restoreConfirmed, setRestoreConfirmed] = useState<boolean>(false)

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info'
    title: string
    message: string
  } | null>(null)

  const loadData = useCallback(async () => {
    if (!window.campusDeskAPI?.settings) return

    try {
      const [pathsRes, settingsRes] = await Promise.all([
        window.campusDeskAPI.settings.getPaths(),
        window.campusDeskAPI.settings.get()
      ])
      setPaths(pathsRes)
      setSettings(settingsRes)
      if (settingsRes?.theme) {
        setActiveTheme(settingsRes.theme)
      }
    } catch (err) {
      console.error('Failed to load settings data:', err)
    }
  }, [])

  const loadStorageUsage = useCallback(async () => {
    if (!window.campusDeskAPI?.settings?.getStorageUsage) return
    setIsLoadingUsage(true)
    try {
      const usage = await window.campusDeskAPI.settings.getStorageUsage()
      setStorageUsage(usage)
    } catch (err) {
      console.error('Failed to load storage usage:', err)
    } finally {
      setIsLoadingUsage(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    loadStorageUsage()
  }, [loadData, loadStorageUsage])

  useEffect(() => {
    if (currentTheme) {
      setActiveTheme(currentTheme)
    }
  }, [currentTheme])

  const handleSelectTheme = async (mode: ThemeMode) => {
    setActiveTheme(mode)
    onThemeChange?.(mode)
    try {
      await window.campusDeskAPI.settings.set({ theme: mode })
    } catch (err) {
      console.error('Failed to persist theme setting:', err)
    }
  }

  const handleOpenDataFolder = async () => {
    try {
      await window.campusDeskAPI.settings.openDataFolder()
    } catch (err) {
      setNotification({
        type: 'error',
        title: 'Could Not Open Folder',
        message: err instanceof Error ? err.message : 'Failed to launch system file explorer.'
      })
    }
  }

  const handleExportBackup = async () => {
    setIsExporting(true)
    setNotification(null)

    try {
      const result = await window.campusDeskAPI.backup.export()
      if (result.canceled) {
        setIsExporting(false)
        return
      }

      setNotification({
        type: 'success',
        title: 'Backup Created Successfully',
        message: `Saved full archive (${formatBytes(result.totalSizeBytes)}, ${result.totalFiles} files) to:\n${result.backupPath}`
      })
      loadStorageUsage()
    } catch (err) {
      console.error('Failed to export backup:', err)
      setNotification({
        type: 'error',
        title: 'Backup Export Failed',
        message: err instanceof Error ? err.message : 'An unexpected error occurred during backup creation.'
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleExecuteRestore = async () => {
    if (!restoreConfirmed) return
    setIsRestoring(true)

    try {
      const result = await window.campusDeskAPI.backup.restore()
      if (result.canceled) {
        setIsRestoring(false)
        return
      }

      setIsRestoreModalOpen(false)
      setRestoreConfirmed(false)

      setNotification({
        type: 'success',
        title: 'Restore Completed Successfully',
        message: `Restored ${result.restoredFiles} managed coursework files (Schema version ${result.schemaVersion}). Reloading application...`
      })

      // Give user a moment to see confirmation, then reload the window cleanly
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err) {
      console.error('Restore failed:', err)
      setIsRestoring(false)
      setIsRestoreModalOpen(false)
      setRestoreConfirmed(false)
      setNotification({
        type: 'error',
        title: 'Restore Failed (Automatic Rollback Executed)',
        message: err instanceof Error ? err.message : 'Archive validation or extraction failed. Your previous database and files remain completely intact.'
      })
    }
  }

  return (
    <div className="space-y-6 max-w-4xl pb-10 animate-fade-in">
      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-start justify-between gap-3 ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            )}
            <div className="space-y-0.5">
              <span className="font-semibold block">{notification.title}</span>
              <span className="opacity-90 whitespace-pre-wrap">{notification.message}</span>
            </div>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 opacity-70 hover:opacity-100 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Theme Preferences */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Appearance & Theme</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Choose your preferred interface theme. Setting is saved in local database preferences.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              id: 'light',
              label: 'Light Mode',
              desc: 'Crisp academic clarity',
              icon: Sun,
              color: 'text-amber-500'
            },
            {
              id: 'dark',
              label: 'Dark Mode',
              desc: 'Restrained low-light palette',
              icon: Moon,
              color: 'text-indigo-400'
            },
            {
              id: 'system',
              label: 'System Sync',
              desc: 'Follows OS theme settings',
              icon: Monitor,
              color: 'text-slate-500'
            }
          ].map((item) => {
            const Icon = item.icon
            const isSelected = activeTheme === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTheme(item.id as ThemeMode)}
                className={`p-4 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 dark:border-indigo-500 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                  )}
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                    {item.label}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    {item.desc}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Storage Utilization & Managed Folder */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Storage Locations & Utilization</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              All coursework databases and attachments are stored locally under a dedicated application vault.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadStorageUsage}
              disabled={isLoadingUsage}
              title="Refresh storage size"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsage ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleOpenDataFolder}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />
              <span>Open Data Folder</span>
            </button>
          </div>
        </div>

        {/* Live Disk Usage Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">SQLite Database</span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100">
              {formatBytes(storageUsage?.dbSizeBytes)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">Managed Files</span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100">
              {formatBytes(storageUsage?.librarySizeBytes)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">Stored Documents</span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100">
              {storageUsage?.fileCount ?? 0} files
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20">
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 block mb-1">
              Total Storage
            </span>
            <span className="text-base font-bold text-indigo-700 dark:text-indigo-300">
              {formatBytes(storageUsage?.totalSizeBytes)}
            </span>
          </div>
        </div>

        {/* Managed Paths Details */}
        <div className="space-y-2 text-xs">
          <div>
            <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Dedicated Vault Directory
            </span>
            <code className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-lg font-mono text-slate-800 dark:text-slate-200 block truncate select-all">
              {paths?.appDataDir || 'Resolving...'}
            </code>
          </div>

          <div>
            <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Managed File Library Root
            </span>
            <code className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-lg font-mono text-slate-800 dark:text-slate-200 block truncate select-all">
              {paths?.library || 'Resolving...'}
            </code>
          </div>
        </div>
      </div>

      {/* 3. Manual Backup & Safe Restore */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Full Backup & Safe Restore</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Create portable, verified offline ZIP archives containing a consistent online database snapshot,
            all managed library documents, and cryptographic integrity hashes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export Backup Card */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-xs">
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Export Full Backup</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Generates a single self-contained ZIP archive with a consistent database snapshot and all
                coursework attachments. Safe for USB storage, external drives, or machine migration.
              </p>
            </div>

            <button
              onClick={handleExportBackup}
              disabled={isExporting}
              className="w-full px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Snapshot Archive...</span>
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  <span>Export Backup (.zip)</span>
                </>
              )}
            </button>
          </div>

          {/* Restore Card */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-xs">
                <Upload className="w-4 h-4 text-indigo-600" />
                <span>Restore from Backup</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Restores tasks, subjects, and documents from a verified CampusDeck ZIP backup.
                Includes automated staging, archive validation, and rollback safety.
              </p>
            </div>

            <button
              onClick={() => {
                setRestoreConfirmed(false)
                setIsRestoreModalOpen(true)
              }}
              disabled={isRestoring}
              className="w-full px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <FileCheck className="w-4 h-4 text-indigo-500" />
              <span>Restore from Backup...</span>
            </button>
          </div>
        </div>

        {/* Scheduled Backups Info */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Scheduled launch snapshot: <strong className="text-slate-600 dark:text-slate-300">{settings?.backup_schedule || 'daily'}</strong></span>
          <span>Retention policy: <strong className="text-slate-600 dark:text-slate-300">{settings?.backup_retain ?? 30} snapshots</strong></span>
        </div>
      </div>

      {/* 4. Security & Offline Architecture */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-xs text-slate-600 dark:text-slate-400 space-y-2">
        <div className="flex items-center gap-2 text-slate-900 dark:text-slate-200 font-bold">
          <Shield className="w-4 h-4 text-indigo-500" />
          <span>Application Details & Privacy Guarantee</span>
        </div>
        <p className="leading-relaxed">
          CampusDeck <strong className="text-slate-800 dark:text-slate-200">v{paths?.version || '0.1.0'}</strong> is strictly local-first.
          Zero network requests or telemetry are transmitted (<code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px]">connect-src &apos;none&apos;</code>).
          All data operations, backups, and PDF parsing remain completely offline on your physical device.
        </p>
      </div>

      {/* Restore Confirmation Modal */}
      {isRestoreModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-scale-in">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Confirm Application Restore
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    This action will replace your active database and files
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsRestoreModalOpen(false)}
                disabled={isRestoring}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 text-xs text-rose-800 dark:text-rose-300 space-y-2">
              <span className="font-bold block">Important Notice:</span>
              <p className="leading-relaxed">
                Restoring from a backup will <strong>completely overwrite</strong> your current tasks, subjects,
                and coursework files with the contents of the chosen archive.
              </p>
              <p className="font-semibold text-rose-900 dark:text-rose-200">
                We strongly recommend exporting a fresh backup before proceeding.
              </p>
            </div>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={restoreConfirmed}
                onChange={(e) => setRestoreConfirmed(e.target.checked)}
                disabled={isRestoring}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                I understand that my current application data will be replaced by the contents of the selected backup archive.
              </span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsRestoreModalOpen(false)}
                disabled={isRestoring}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={!restoreConfirmed || isRestoring}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying & Restoring...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Select Backup & Restore</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
