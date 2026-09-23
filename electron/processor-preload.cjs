const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('kpacuvoeProcessor', {
  onJob: (handler) => {
    ipcRenderer.on('kpacuvoe:job', (_event, job) => {
      void handler(job)
    })
  },
  sendResult: (payload) => {
    ipcRenderer.send('kpacuvoe:job-result', payload)
  },
  ready: () => {
    ipcRenderer.send('kpacuvoe:processor-ready')
  },
})
