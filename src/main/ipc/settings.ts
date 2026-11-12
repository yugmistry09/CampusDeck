import { ipcMain, app, shell, BrowserWindow, dialog } from 'electron'
import { assertTrustedSender, parseOrThrow, settingsUpdateSchema } from './validation'
import type { SettingsRepo } from '../db/repositories/settings'
import { getAppPaths } from '../utils/paths'
import type { BackupService } from '../services/backupService'

// ---------------------------------------------------------------------------
// Settings & Backup IPC Handlers
// Channels:
//   settings:get, settings:set, settings:get-paths,
//   settings:get-storage-usage, settings:open-data-folder,
//   backup:export, backup:restore
// ---------------------------------------------------------------------------

export function registerSettingsHandlers(
  repo: SettingsRepo,
  backupService: BackupService
): void {
  ipcMain.handle('settings:get', (event) => {
    assertTrustedSender(event.sender)
    return repo.getAppSettings()
  })

  ipcMain.handle('settings:set', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const partial = parseOrThrow(settingsUpdateSchema, payload)
    return repo.updateAppSettings(partial)
  })

  ipcMain.handle('settings:get-paths', (event) => {
    assertTrustedSender(event.sender)
    const paths = getAppPaths()
    let version = '0.1.0'
    try {
      version = app.getVersion()
    } catch {}

    return {
      userData: paths.userData,
      appDataDir: paths.appDataDir,
      library: paths.libraryRoot,
      backups: paths.backupsRoot,
      version
    }
  })

  ipcMain.handle('settings:get-storage-usage', (event) => {
    assertTrustedSender(event.sender)
    return backupService.getStorageUsage()
  })

  ipcMain.handle('settings:open-data-folder', async (event) => {
    assertTrustedSender(event.sender)
    const paths = getAppPaths()
    const error = await shell.openPath(paths.appDataDir)
    if (error) {
      throw new Error(`Failed to open data directory: ${error}`)
    }
    return { success: true }
  })

  ipcMain.handle('backup:export', async (event) => {
    assertTrustedSender(event.sender)
    const window = BrowserWindow.fromWebContents(event.sender)
    const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const defaultFilename = `campusdesk_backup_${now}.zip`

    const { canceled, filePath } = await dialog.showSaveDialog(window!, {
      title: 'Export CampusDesk Backup Archive',
      defaultPath: defaultFilename,
      filters: [{ name: 'CampusDesk Backup Archive', extensions: ['zip'] }]
    })

    if (canceled || !filePath) {
      return { canceled: true }
    }

    const result = await backupService.exportBackup(filePath)
    return result
  })

  ipcMain.handle('backup:restore', async (event) => {
    assertTrustedSender(event.sender)
    const window = BrowserWindow.fromWebContents(event.sender)

    const { canceled, filePaths } = await dialog.showOpenDialog(window!, {
      title: 'Select CampusDesk Backup Archive (.zip) to Restore',
      properties: ['openFile'],
      filters: [{ name: 'CampusDesk Backup Archive', extensions: ['zip'] }]
    })

    if (canceled || !filePaths || filePaths.length === 0 || !filePaths[0]) {
      return { canceled: true }
    }

    const selectedZip = filePaths[0]
    const result = await backupService.restoreBackup(selectedZip)
    return result
  })
}
