import { app, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { openDatabase, closeDatabase } from './db/connection'
import { registerAllIpcHandlers } from './ipc/index'
import { getAppPaths } from './utils/paths'

// ---------------------------------------------------------------------------
// Content Security Policy
// ---------------------------------------------------------------------------
// Restricts the renderer to only load local resources. No remote scripts,
// no inline eval, no network connections for core functionality.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // Tailwind injects critical styles
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "worker-src 'self' blob:",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'"
].join('; ')

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 760,
    minHeight: 520,
    show: false, // show after ready-to-show to avoid flash
    autoHideMenuBar: true,
    title: 'CampusDeck',
    webPreferences: {
      // -----------------------------------------------------------------------
      // Security: contextIsolation + sandbox (D-012)
      // The renderer has NO access to Node.js APIs. All data operations go
      // through the typed contextBridge surface in preload/index.ts.
      // -----------------------------------------------------------------------
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  // Graceful show: wait until content is rendered before displaying window
  win.once('ready-to-show', () => {
    win.show()
  })

  // Load the renderer
  const isDev = !app.isPackaged && Boolean(process.env['ELECTRON_RENDERER_URL'])
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  // ---- 1. Ensure dedicated data directories exist before opening DB --------
  const paths = getAppPaths()
  mkdirSync(paths.appDataDir, { recursive: true })
  mkdirSync(paths.libraryRoot, { recursive: true })
  mkdirSync(paths.backupsRoot, { recursive: true })

  // ---- 2. Open and migrate the database ------------------------------------
  // openDatabase() sets WAL mode, enables foreign keys, and runs migrations.
  const db = openDatabase(paths.dbPath)

  // ---- 3. Register all typed IPC handlers -----------------------------------
  // Each handler validates its payload via Zod and checks the sender is trusted.
  registerAllIpcHandlers(db)

  // ---- 4. Apply CSP to all sessions ----------------------------------------
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP]
      }
    })
  })

  createWindow()

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked and no windows exist
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Close the database cleanly before quitting
  closeDatabase()
  if (process.platform !== 'darwin') app.quit()
})
