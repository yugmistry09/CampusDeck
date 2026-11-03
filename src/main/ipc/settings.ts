import { ipcMain, app } from 'electron'
import { assertTrustedSender, parseOrThrow, settingsUpdateSchema } from './validation'
import type { SettingsRepo } from '../db/repositories/settings'
import { getAppPaths } from '../utils/paths'

// ---------------------------------------------------------------------------
// Settings IPC handlers
// Channels: settings:get, settings:set, settings:get-paths
// ---------------------------------------------------------------------------

export function registerSettingsHandlers(repo: SettingsRepo): void {
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
    return {
      userData: paths.userData,
      appDataDir: paths.appDataDir,
      library: paths.libraryRoot,
      backups: paths.backupsRoot,
      version: app.getVersion()
    }
  })
}
