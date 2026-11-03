import Database from 'better-sqlite3'
import type { AppSettings, SettingRow, Theme, BackupSchedule } from '../schema'

// ---------------------------------------------------------------------------
// Key-Value Settings repository
// Backed by the key-value settings table in SQLite.
// ---------------------------------------------------------------------------

export function createSettingsRepo(db: Database.Database) {
  const stmtGet = db.prepare<[string]>(`SELECT * FROM settings WHERE key = ?`)
  const stmtGetAll = db.prepare<[]>(`SELECT * FROM settings`)
  const stmtUpsert = db.prepare<[string, string, string]>(`
    INSERT INTO settings(key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `)

  return {
    get(key: string): string | null {
      const row = stmtGet.get(key) as SettingRow | undefined
      return row ? row.value : null
    },

    set(key: string, value: string): void {
      db.transaction(() => {
        const now = new Date().toISOString()
        stmtUpsert.run(key, value, now)
      })()
    },

    getAll(): Record<string, string> {
      const rows = stmtGetAll.all() as SettingRow[]
      const result: Record<string, string> = {}
      for (const row of rows) {
        result[row.key] = row.value
      }
      return result
    },

    /**
     * Gets structured AppSettings from key-value pairs.
     */
    getAppSettings(): AppSettings {
      const all = this.getAll()
      return {
        theme: (all['theme'] as Theme) || 'system',
        backup_schedule: (all['backup_schedule'] as BackupSchedule) || 'daily',
        backup_retain: all['backup_retain'] ? parseInt(all['backup_retain'], 10) : 30
      }
    },

    /**
     * Updates structured AppSettings in key-value table.
     */
    updateAppSettings(partial: Partial<AppSettings>): AppSettings {
      return db.transaction(() => {
        const now = new Date().toISOString()
        if (partial.theme !== undefined) {
          stmtUpsert.run('theme', partial.theme, now)
        }
        if (partial.backup_schedule !== undefined) {
          stmtUpsert.run('backup_schedule', partial.backup_schedule, now)
        }
        if (partial.backup_retain !== undefined) {
          stmtUpsert.run('backup_retain', String(partial.backup_retain), now)
        }
        return this.getAppSettings()
      })()
    },

    // Aliases for IPC handler compatibility
    getAppPreferences(): AppSettings {
      return this.getAppSettings()
    }
  }
}

export type SettingsRepo = ReturnType<typeof createSettingsRepo>
