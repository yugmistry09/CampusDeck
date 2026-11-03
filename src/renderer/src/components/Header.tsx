import React from 'react'
import { Sun, Moon, Laptop } from 'lucide-react'

export type ThemeMode = 'light' | 'dark' | 'system'

interface HeaderProps {
  title: string
  subtitle?: string
  theme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  theme,
  onThemeChange
}) => {
  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur px-6 flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => onThemeChange('light')}
          className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
            theme === 'light'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
          title="Light Theme"
          aria-label="Light Theme"
        >
          <Sun className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onThemeChange('dark')}
          className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
            theme === 'dark'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
          title="Dark Theme"
          aria-label="Dark Theme"
        >
          <Moon className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onThemeChange('system')}
          className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
            theme === 'system'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
          title="System Theme"
          aria-label="System Theme"
        >
          <Laptop className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  )
}
