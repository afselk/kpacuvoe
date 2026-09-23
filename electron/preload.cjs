const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('kpacuvoeDesktop', {
  getSettings: () => ipcRenderer.invoke('kpacuvoe:get-settings'),
  setSettings: (patch) => ipcRenderer.invoke('kpacuvoe:set-settings', patch),
  chooseFolder: () => ipcRenderer.invoke('kpacuvoe:choose-folder'),
  processFolderNow: () => ipcRenderer.invoke('kpacuvoe:process-folder-now'),
  getVersion: () => ipcRenderer.invoke('kpacuvoe:get-version'),
  checkUpdate: () => ipcRenderer.invoke('kpacuvoe:check-update'),
  installUpdate: (downloadUrl) =>
    ipcRenderer.invoke('kpacuvoe:install-update', downloadUrl),
  onSettings: (handler) => {
    const listener = (_event, settings) => handler(settings)
    ipcRenderer.on('kpacuvoe:settings', listener)
    return () => ipcRenderer.removeListener('kpacuvoe:settings', listener)
  },
  onUpdateProgress: (handler) => {
    const listener = (_event, progress) => handler(progress)
    ipcRenderer.on('kpacuvoe:update-progress', listener)
    return () => ipcRenderer.removeListener('kpacuvoe:update-progress', listener)
  },
  onRequestUpdateCheck: (handler) => {
    const listener = () => handler()
    ipcRenderer.on('kpacuvoe:request-update-check', listener)
    return () =>
      ipcRenderer.removeListener('kpacuvoe:request-update-check', listener)
  },
})
