import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  dialog,
  ipcMain,
  Notification,
} from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import chokidar from 'chokidar'
import { DEFAULTS, isImageFile } from './defaults.mjs'

const require = createRequire(import.meta.url)
const StoreModule = require('electron-store')
const Store = StoreModule.default ?? StoreModule

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged
const DEV_URL = 'http://127.0.0.1:3847'
const STATE_FILE = '.kpacuvoe.json'
const APP_NAME = 'kpacuvoe'

const store = new Store({
  name: 'kpacuvoe',
  defaults: {
    watchFolder: null,
    radius: DEFAULTS.radius,
    padding: DEFAULTS.padding,
    mode: DEFAULTS.mode,
    borderWidth: DEFAULTS.borderWidth,
    shadowBlur: DEFAULTS.shadowBlur,
    shadowOffsetY: DEFAULTS.shadowOffsetY,
    transparentBg: DEFAULTS.transparentBg,
  },
})

/** @type {BrowserWindow | null} */
let settingsWindow = null
/** @type {BrowserWindow | null} */
let processorWindow = null
/** @type {Tray | null} */
let tray = null
/** @type {import('chokidar').FSWatcher | null} */
let folderWatcher = null

const writingPaths = new Set()
/** @type {Map<string, { resolve: Function, reject: Function }>} */
const pendingJobs = new Map()
let processorReady = false
/** @type {Array<() => void>} */
const processorReadyWaiters = []

function getOptions() {
  return {
    radius: store.get('radius'),
    padding: store.get('padding'),
    mode: store.get('mode'),
    borderWidth: store.get('borderWidth'),
    shadowBlur: store.get('shadowBlur'),
    shadowOffsetY: store.get('shadowOffsetY'),
    background: store.get('transparentBg') ? 'transparent' : 'auto',
  }
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  return 'image/png'
}

function readLedger(folder) {
  const ledgerPath = path.join(folder, STATE_FILE)
  try {
    if (!fs.existsSync(ledgerPath)) return { processed: {} }
    return JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
  } catch {
    return { processed: {} }
  }
}

function writeLedger(folder, ledger) {
  const ledgerPath = path.join(folder, STATE_FILE)
  writingPaths.add(path.resolve(ledgerPath))
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2))
  setTimeout(() => writingPaths.delete(path.resolve(ledgerPath)), 1500)
}

function markWriting(filePath) {
  writingPaths.add(path.resolve(filePath))
  setTimeout(() => writingPaths.delete(path.resolve(filePath)), 2500)
}

function isOurWrite(filePath) {
  const resolved = path.resolve(filePath)
  if (writingPaths.has(resolved)) return true
  if (path.basename(filePath) === STATE_FILE) return true
  if (path.basename(filePath).startsWith('.kpacuvoe-tmp-')) return true
  return false
}

async function ensureProcessor() {
  if (processorWindow && !processorWindow.isDestroyed() && processorReady) {
    return processorWindow
  }

  if (!processorWindow || processorWindow.isDestroyed()) {
    processorReady = false
    processorWindow = new BrowserWindow({
      show: false,
      width: 400,
      height: 300,
      webPreferences: {
        preload: path.join(__dirname, 'processor-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    await processorWindow.loadFile(path.join(__dirname, 'processor.html'))
  }

  if (!processorReady) {
    await new Promise((resolve) => {
      processorReadyWaiters.push(resolve)
      setTimeout(resolve, 8000)
    })
  }

  return processorWindow
}

function processDataUrl(dataUrl, options) {
  return new Promise((resolve, reject) => {
    const id = randomUUID()
    pendingJobs.set(id, { resolve, reject })
    void ensureProcessor()
      .then((win) => {
        win.webContents.send('kpacuvoe:job', { id, dataUrl, options })
      })
      .catch((error) => {
        pendingJobs.delete(id)
        reject(error)
      })
  })
}

async function processImageFile(filePath) {
  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved) || !isImageFile(resolved)) return { skipped: true }
  if (isOurWrite(resolved)) return { skipped: true }

  const folder = path.dirname(resolved)
  const ledger = readLedger(folder)
  const stat = fs.statSync(resolved)
  const prev = ledger.processed?.[resolved]
  if (prev && prev.size === stat.size && prev.mtimeMs === stat.mtimeMs) {
    return { skipped: true }
  }

  const buf = fs.readFileSync(resolved)
  const dataUrl = `data:${mimeFor(resolved)};base64,${buf.toString('base64')}`
  const resultBuffer = await processDataUrl(dataUrl, getOptions())

  const base = path.basename(resolved, path.extname(resolved))
  const outPath = path.join(folder, `${base}.png`)
  const tmpPath = path.join(folder, `.kpacuvoe-tmp-${randomUUID()}.png`)

  markWriting(tmpPath)
  markWriting(outPath)
  markWriting(resolved)
  fs.writeFileSync(tmpPath, Buffer.from(resultBuffer))

  if (path.resolve(resolved) !== path.resolve(outPath) && fs.existsSync(resolved)) {
    fs.unlinkSync(resolved)
  }

  fs.renameSync(tmpPath, outPath)

  const outStat = fs.statSync(outPath)
  ledger.processed = ledger.processed || {}
  // Drop old key if extension changed.
  delete ledger.processed[resolved]
  ledger.processed[outPath] = {
    size: outStat.size,
    mtimeMs: outStat.mtimeMs,
    at: Date.now(),
  }
  writeLedger(folder, ledger)

  return { outPath }
}

async function processFolder(folder) {
  if (!folder || !fs.existsSync(folder)) return { processed: 0, failed: 0 }

  const entries = fs.readdirSync(folder)
  let processed = 0
  let failed = 0

  for (const name of entries) {
    if (name === STATE_FILE || name.startsWith('.kpacuvoe-tmp-')) continue
    const full = path.join(folder, name)
    try {
      if (!fs.statSync(full).isFile() || !isImageFile(full)) continue
      const result = await processImageFile(full)
      if (!result.skipped) processed += 1
    } catch (error) {
      failed += 1
      console.error('kpacuvoe process failed', full, error)
    }
  }

  return { processed, failed }
}

function notify(title, body) {
  if (!Notification.isSupported()) return
  new Notification({ title, body }).show()
}

function stopWatcher() {
  if (folderWatcher) {
    void folderWatcher.close()
    folderWatcher = null
  }
}

function startWatcher(folder) {
  stopWatcher()
  if (!folder) return

  folderWatcher = chokidar.watch(folder, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 600, pollInterval: 100 },
    depth: 0,
  })

  const handle = async (filePath) => {
    if (!isImageFile(filePath) || isOurWrite(filePath)) return
    try {
      const result = await processImageFile(filePath)
      if (!result.skipped) {
        updateTrayMenu()
        notify(APP_NAME, `Готово: ${path.basename(result.outPath)}`)
      }
    } catch (error) {
      console.error(error)
      notify(APP_NAME, `Ошибка: ${path.basename(filePath)}`)
    }
  }

  folderWatcher.on('add', (p) => void handle(p))
  folderWatcher.on('change', (p) => void handle(p))
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    return settingsWindow
  }

  settingsWindow = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 760,
    minHeight: 560,
    title: APP_NAME,
    backgroundColor: '#0c1210',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (isDev) {
    void settingsWindow.loadURL(DEV_URL)
  } else {
    void settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })

  return settingsWindow
}

function trayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
      <rect x="2" y="3" width="14" height="12" rx="3" fill="#ffffff"/>
    </svg>`
  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
  )
  if (process.platform === 'darwin') image.setTemplateImage(true)
  return image
}

function folderLabel() {
  const folder = store.get('watchFolder')
  if (!folder) return 'Папка не выбрана'
  const home = os.homedir()
  return folder.startsWith(home) ? `~${folder.slice(home.length)}` : folder
}

async function chooseFolder() {
  const result = await dialog.showOpenDialog({
    title: 'Папка для kpacuvoe',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || !result.filePaths[0]) return null
  const folder = result.filePaths[0]
  store.set('watchFolder', folder)
  startWatcher(folder)
  updateTrayMenu()
  broadcastSettings()
  const stats = await processFolder(folder)
  notify(
    APP_NAME,
    stats.processed
      ? `Обработано фото: ${stats.processed}`
      : 'В папке пока нет новых фото',
  )
  return folder
}

function updateTrayMenu() {
  if (!tray) return
  const folder = store.get('watchFolder')
  const menu = Menu.buildFromTemplate([
    { label: APP_NAME, enabled: false },
    { type: 'separator' },
    {
      label: 'Выбрать папку…',
      click: () => void chooseFolder(),
    },
    {
      label: folderLabel(),
      enabled: false,
    },
    {
      label: 'Обработать папку сейчас',
      enabled: Boolean(folder),
      click: async () => {
        if (!folder) return
        const stats = await processFolder(folder)
        notify(
          APP_NAME,
          `Готово: ${stats.processed} фото${stats.failed ? `, ошибок: ${stats.failed}` : ''}`,
        )
      },
    },
    { type: 'separator' },
    {
      label: 'Настройки…',
      click: () => createSettingsWindow(),
    },
    { type: 'separator' },
    {
      label: 'Выйти',
      click: () => app.quit(),
    },
  ])
  tray.setContextMenu(menu)
  tray.setToolTip(`${APP_NAME} — ${folderLabel()}`)
}

function createTray() {
  tray = new Tray(trayIcon())
  updateTrayMenu()
  tray.on('click', () => {
    if (process.platform === 'darwin') return
    createSettingsWindow()
  })
}

function broadcastSettings() {
  const payload = {
    watchFolder: store.get('watchFolder'),
    radius: store.get('radius'),
    padding: store.get('padding'),
    mode: store.get('mode'),
    borderWidth: store.get('borderWidth'),
    shadowBlur: store.get('shadowBlur'),
    shadowOffsetY: store.get('shadowOffsetY'),
    transparentBg: store.get('transparentBg'),
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('kpacuvoe:settings', payload)
  }
}

function registerIpc() {
  ipcMain.on('kpacuvoe:processor-ready', () => {
    processorReady = true
    while (processorReadyWaiters.length) processorReadyWaiters.shift()?.()
  })

  ipcMain.on('kpacuvoe:job-result', (_event, payload) => {
    const job = pendingJobs.get(payload.id)
    if (!job) return
    pendingJobs.delete(payload.id)
    if (payload.ok) job.resolve(Buffer.from(new Uint8Array(payload.buffer)))
    else job.reject(new Error(payload.error || 'Ошибка обработки'))
  })

  ipcMain.handle('kpacuvoe:get-settings', () => ({
    watchFolder: store.get('watchFolder'),
    radius: store.get('radius'),
    padding: store.get('padding'),
    mode: store.get('mode'),
    borderWidth: store.get('borderWidth'),
    shadowBlur: store.get('shadowBlur'),
    shadowOffsetY: store.get('shadowOffsetY'),
    transparentBg: store.get('transparentBg'),
  }))

  ipcMain.handle('kpacuvoe:set-settings', (_event, patch) => {
    const allowed = [
      'radius',
      'padding',
      'mode',
      'borderWidth',
      'shadowBlur',
      'shadowOffsetY',
      'transparentBg',
    ]
    for (const key of allowed) {
      if (key in patch) store.set(key, patch[key])
    }
    broadcastSettings()
    updateTrayMenu()
    return true
  })

  ipcMain.handle('kpacuvoe:choose-folder', async () => chooseFolder())

  ipcMain.handle('kpacuvoe:process-folder-now', async () => {
    const folder = store.get('watchFolder')
    if (!folder) return { processed: 0, failed: 0 }
    return processFolder(folder)
  })
}

app.setName(APP_NAME)

app.whenReady().then(async () => {
  registerIpc()
  createTray()

  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide()
  }

  await ensureProcessor()

  const folder = store.get('watchFolder')
  if (folder && fs.existsSync(folder)) {
    startWatcher(folder)
    void processFolder(folder)
  } else {
    // First run: ask for a folder right away.
    void chooseFolder()
  }

  app.on('activate', () => {
    createSettingsWindow()
  })
})

app.on('before-quit', () => {
  stopWatcher()
})

app.on('window-all-closed', () => {
  // Menu-bar app: keep process alive with no windows.
})
