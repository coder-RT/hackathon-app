const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

const isDev = !app.isPackaged

const config = {
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  remoteUrl: process.env.REMOTE_URL || null,
  enableAutoUpdate: process.env.ENABLE_AUTO_UPDATE === 'true'
}

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  loadContent()
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
  isDev
}))

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
