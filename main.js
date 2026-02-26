const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const Store = require('electron-store')

const isDev = !app.isPackaged

const store = new Store({
  name: 'user-preferences',
  defaults: {
    window: {
      width: null,
      height: null,
      x: null,
      y: null,
      isMaximized: false
    }
  }
})

function loadConfigFile() {
  try {
    const configPath = path.join(__dirname, 'config.json')
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    }
  } catch (err) {
    console.error('Failed to load config.json:', err.message)
  }
  return {}
}

const fileConfig = loadConfigFile()

const defaults = {
  window: {
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 700
  },
  api: {
    url: 'http://localhost:3000'
  },
  updates: {
    autoUpdate: false
  },
  hackathon: {
    name: 'Hackathon',
    theme: 'AI for Good',
    duration: '48 Hours'
  }
}

function getConfig(key, envKey = null) {
  const keys = key.split('.')
  
  if (envKey && process.env[envKey]) {
    const val = process.env[envKey]
    if (val === 'true') return true
    if (val === 'false') return false
    if (!isNaN(val)) return Number(val)
    return val
  }
  
  let fileVal = fileConfig
  let defaultVal = defaults
  for (const k of keys) {
    fileVal = fileVal?.[k]
    defaultVal = defaultVal?.[k]
  }
  
  return fileVal ?? defaultVal
}

const config = {
  apiUrl: getConfig('api.url', 'API_URL'),
  remoteUrl: process.env.REMOTE_URL || null,
  enableAutoUpdate: getConfig('updates.autoUpdate', 'ENABLE_AUTO_UPDATE'),
  hackathon: {
    name: getConfig('hackathon.name', 'HACKATHON_NAME'),
    theme: getConfig('hackathon.theme', 'HACKATHON_THEME'),
    duration: getConfig('hackathon.duration', 'HACKATHON_DURATION')
  }
}

let mainWindow

function getWindowConfig() {
  const userPrefs = store.get('window')
  
  const width = userPrefs.width 
    || Number(process.env.WINDOW_WIDTH) 
    || getConfig('window.width') 
    || defaults.window.width

  const height = userPrefs.height 
    || Number(process.env.WINDOW_HEIGHT) 
    || getConfig('window.height') 
    || defaults.window.height

  const minWidth = Number(process.env.WINDOW_MIN_WIDTH) 
    || getConfig('window.minWidth') 
    || defaults.window.minWidth

  const minHeight = Number(process.env.WINDOW_MIN_HEIGHT) 
    || getConfig('window.minHeight') 
    || defaults.window.minHeight

  return {
    width,
    height,
    minWidth,
    minHeight,
    x: userPrefs.x || undefined,
    y: userPrefs.y || undefined,
    isMaximized: userPrefs.isMaximized || false
  }
}

function saveWindowState() {
  if (!mainWindow) return
  
  const isMaximized = mainWindow.isMaximized()
  const bounds = mainWindow.getBounds()
  
  store.set('window', {
    width: isMaximized ? store.get('window.width') : bounds.width,
    height: isMaximized ? store.get('window.height') : bounds.height,
    x: isMaximized ? store.get('window.x') : bounds.x,
    y: isMaximized ? store.get('window.y') : bounds.y,
    isMaximized
  })
}

function createWindow() {
  const windowConfig = getWindowConfig()
  
  mainWindow = new BrowserWindow({
    width: windowConfig.width,
    height: windowConfig.height,
    minWidth: windowConfig.minWidth,
    minHeight: windowConfig.minHeight,
    x: windowConfig.x,
    y: windowConfig.y,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 },
    show: false
  })

  if (windowConfig.isMaximized) {
    mainWindow.maximize()
  }

  mainWindow.on('close', saveWindowState)
  mainWindow.on('resize', debounce(saveWindowState, 500))
  mainWindow.on('move', debounce(saveWindowState, 500))

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  loadContent()
}

function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

async function loadContent() {
  if (isDev) {
    mainWindow.loadFile('renderer/index.html')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else if (config.remoteUrl) {
    try {
      await mainWindow.loadURL(config.remoteUrl)
    } catch (err) {
      console.error('Failed to load remote URL, falling back to local:', err.message)
      mainWindow.loadFile('renderer/index.html')
    }
  } else {
    mainWindow.loadFile('renderer/index.html')
  }
}

function setupAutoUpdater() {
  if (isDev || !config.enableAutoUpdate) return

  try {
    const { autoUpdater } = require('electron-updater')

    autoUpdater.logger = require('electron-log')
    autoUpdater.logger.transports.file.level = 'info'

    autoUpdater.on('checking-for-update', () => {
      sendStatusToWindow('Checking for updates...')
    })

    autoUpdater.on('update-available', (info) => {
      sendStatusToWindow(`Update available: v${info.version}`)
    })

    autoUpdater.on('update-not-available', () => {
      sendStatusToWindow('App is up to date')
    })

    autoUpdater.on('download-progress', (progress) => {
      sendStatusToWindow(`Downloading: ${Math.round(progress.percent)}%`)
    })

    autoUpdater.on('update-downloaded', (info) => {
      sendStatusToWindow(`Update ready: v${info.version}. Restart to apply.`)
      mainWindow.webContents.send('update-ready', info.version)
    })

    autoUpdater.on('error', (err) => {
      sendStatusToWindow(`Update error: ${err.message}`)
    })

    autoUpdater.checkForUpdatesAndNotify()
  } catch (err) {
    console.error('Auto-updater not available:', err.message)
  }
}

function sendStatusToWindow(text) {
  if (mainWindow) {
    mainWindow.webContents.send('update-status', text)
  }
}

ipcMain.handle('get-config', () => ({
  apiUrl: config.apiUrl,
  version: app.getVersion(),
  isDev,
  hackathon: config.hackathon
}))

ipcMain.handle('get-preferences', () => store.store)

ipcMain.handle('set-preference', (event, key, value) => {
  store.set(key, value)
  return true
})

ipcMain.handle('reset-preferences', () => {
  store.clear()
  return true
})

ipcMain.handle('restart-app', () => {
  try {
    const { autoUpdater } = require('electron-updater')
    autoUpdater.quitAndInstall()
  } catch (err) {
    app.relaunch()
    app.exit()
  }
})

app.whenReady().then(() => {
  createWindow()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
