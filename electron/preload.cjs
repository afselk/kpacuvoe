const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('softshotDesktop', {
  onImageDataUrl: (handler) => {
    const listener = (_event, dataUrl) => handler(dataUrl)
    ipcRenderer.on('softshot:image-data-url', listener)
    return () => ipcRenderer.removeListener('softshot:image-data-url', listener)
  },
})
