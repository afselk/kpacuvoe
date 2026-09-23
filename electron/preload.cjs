const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('kpacuvoeDesktop', {
  getSettings: () => ipcRenderer.invoke('kpacuvoe:get-settings'),
  setSettings: (patch) => ipcRenderer.invoke('kpacuvoe:set-settings', patch),
  chooseFolder: () => ipcRenderer.invoke('kpacuvoe:choose-folder'),
  processFolderNow: () => ipcRenderer.invoke('kpacuvoe:process-folder-now'),
  onSettings: (handler) => {
    const listener = (_event, settings) => handler(settings)
    ipcRenderer.on('kpacuvoe:settings', listener)
    return () => ipcRenderer.removeListener('kpacuvoe:settings', listener)
  },
})
