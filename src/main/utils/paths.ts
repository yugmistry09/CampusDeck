import { app } from 'electron'
import { join } from 'path'

/**
 * Resolves all persistent data paths beneath a dedicated directory inside Electron's userData.
 * All paths are absolute at runtime, but database records store RELATIVE paths
 * (relative to libraryRoot) to preserve machine portability (D-005).
 *
 * Dedicated directory layout:
 *   <userData>/campusdeck_storage/
 *     ├── campusdeck.db          (SQLite database)
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
  let userData: string
  try {
    if (process.env.TEST_USER_DATA_DIR) {
      userData = process.env.TEST_USER_DATA_DIR
    } else if (typeof app === 'object' && app !== null && typeof app.getPath === 'function') {
      userData = app.getPath('userData')
    } else {
      userData = join(process.cwd(), 'scratch', 'test_userdata')
    }
  } catch {
    userData = process.env.TEST_USER_DATA_DIR || join(process.cwd(), 'scratch', 'test_userdata')
  }
  const appDataDir = join(userData, 'campusdeck_storage')
  return {
    userData,
    appDataDir,
    dbPath: join(appDataDir, 'campusdeck.db'),
    libraryRoot: join(appDataDir, 'library'),
    backupsRoot: join(appDataDir, 'backups')
  }
}
