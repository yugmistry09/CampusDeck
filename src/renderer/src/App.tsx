import React, { useEffect, useState } from 'react'
import { Sidebar, NavTab } from './components/Sidebar'
import {  ThemeMode } from './components/Header'
import { DashboardPage } from './routes/DashboardPage'
import { TasksPage } from './routes/TasksPage'
import { SubjectsPage } from './routes/SubjectsPage'
import { AllFilesPage } from './routes/AllFilesPage'
import { SettingsPage } from './routes/SettingsPage'



export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard')
  const [theme, setTheme] = useState<ThemeMode>('system')

  // Apply theme to html root
  useEffect(() => {
    const root = document.documentElement
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

    if (theme === 'dark' || (theme === 'system' && prefersDark)) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  // Load saved theme on startup
  useEffect(() => {
    if (window.campusDeckAPI?.settings?.get) {
      window.campusDeckAPI.settings
        .get()
        .then((res) => {
          if (res?.theme) setTheme(res.theme)
        })
        .catch(console.error)
    }
  }, [])

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme)
    if (window.campusDeckAPI?.settings?.set) {
      window.campusDeckAPI.settings.set({ theme: newTheme }).catch(console.error)
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        

        <main className="flex-1 overflow-y-auto p-6">
          {currentTab === 'dashboard' && (
            <DashboardPage
              onNavigateToTasks={() => setCurrentTab('tasks')}
              onNavigateToSubjects={() => setCurrentTab('subjects')}
            />
          )}
          {currentTab === 'tasks' && <TasksPage />}
          {currentTab === 'subjects' && <SubjectsPage />}
          {currentTab === 'files' && <AllFilesPage />}
          {currentTab === 'settings' && (
            <SettingsPage currentTheme={theme} onThemeChange={handleThemeChange} />
          )}
        </main>
      </div>
    </div>
  )
}
