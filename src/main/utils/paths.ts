import { app } from 'electron'
import { join } from 'path'

/**
 * Resolves all persistent data paths beneath a dedicated directory inside Electron's userData.
 * All paths are absolute at runtime, but database records store RELATIVE paths
 * (relative to libraryRoot) to preserve machine portability (D-005).
 *
 * Dedicated directory layout:
 *   <userData>/campusdesk_storage/
 *     ├── campusdesk.db          (SQLite database)
 *     ├── library/               (app-managed files)
 *     └── backups/               (scheduled SQLite snapshots)
 */
export function getAppPaths(): {
  userData: string
  appDataDir: string
  dbPath: string
  libraryRoot: string
  backupsRoot: string
} {
  const userData = app.getPath('userData')
  const appDataDir = join(userData, 'campusdesk_storage')
  return {
    userData,
    appDataDir,
    dbPath: join(appDataDir, 'campusdesk.db'),
    libraryRoot: join(appDataDir, 'library'),
    backupsRoot: join(appDataDir, 'backups')
  }
}
