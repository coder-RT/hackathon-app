const { contextBridge, ipcRenderer } = require('electron')

let apiUrl = 'http://localhost:3000'

async function initConfig() {
  try {
    const config = await ipcRenderer.invoke('get-config')
    apiUrl = config.apiUrl
    return config
  } catch (err) {
    console.error('Failed to get config:', err)
    return { apiUrl, version: '1.0.0', isDev: true }
  }
}

const configPromise = initConfig()

contextBridge.exposeInMainWorld('api', {
  getConfig: () => configPromise,

  getApiUrl: () => apiUrl,

  sendMessage: async (message) => {
    await configPromise
    try {
      const res = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })
      const data = await res.json()
      return data.reply
    } catch (err) {
      return '🤖 (Offline) Unable to connect to the server. Please check your connection.'
    }
  },

  fetchSnippets: async () => {
    await configPromise
    const res = await fetch(`${apiUrl}/snippets`)
    return res.json()
  },

  fetchResources: async () => {
    await configPromise
    const res = await fetch(`${apiUrl}/resources`)
    return res.json()
  },

  fetchFaqs: async () => {
    await configPromise
    const res = await fetch(`${apiUrl}/faqs`)
    return res.json()
  },

  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, message) => callback(message))
  },

  onUpdateReady: (callback) => {
    ipcRenderer.on('update-ready', (event, version) => callback(version))
  },

  restartApp: () => {
    ipcRenderer.invoke('restart-app')
  }
})
