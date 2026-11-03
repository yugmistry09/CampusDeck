import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { runMigrationsFromDir } from '../connection'
import { createSettingsRepo, SettingsRepo } from '../repositories/settings'

describe('Settings Repository', () => {
  let db: Database.Database
  let settingsRepo: SettingsRepo

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrationsFromDir(db, join(process.cwd(), 'src/main/db/migrations'))
    settingsRepo = createSettingsRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  it('gets seeded default settings from the key-value store', () => {
    expect(settingsRepo.get('theme')).toBe('system')
    expect(settingsRepo.get('backup_schedule')).toBe('daily')
    expect(settingsRepo.get('backup_retain')).toBe('30')
  })

  it('sets and updates arbitrary key-value pairs', () => {
    settingsRepo.set('custom_key', 'custom_value')
    expect(settingsRepo.get('custom_key')).toBe('custom_value')

    // Update existing key
    settingsRepo.set('custom_key', 'updated_value')
    expect(settingsRepo.get('custom_key')).toBe('updated_value')
  })

  it('returns all settings via getAll()', () => {
    settingsRepo.set('sidebar_collapsed', 'false')
    const all = settingsRepo.getAll()

    expect(all['theme']).toBe('system')
    expect(all['backup_schedule']).toBe('daily')
    expect(all['sidebar_collapsed']).toBe('false')
  })

  it('provides structured AppSettings with type-safety', () => {
    const appSettings = settingsRepo.getAppSettings()
    expect(appSettings.theme).toBe('system')
    expect(appSettings.backup_schedule).toBe('daily')
    expect(appSettings.backup_retain).toBe(30)

    // Update partial preferences
    const updated = settingsRepo.updateAppSettings({
      theme: 'dark',
      backup_retain: 60
    })

    expect(updated.theme).toBe('dark')
    expect(updated.backup_schedule).toBe('daily')
    expect(updated.backup_retain).toBe(60)

    // Confirm underlying key-value rows were updated
    expect(settingsRepo.get('theme')).toBe('dark')
    expect(settingsRepo.get('backup_retain')).toBe('60')
  })
})
