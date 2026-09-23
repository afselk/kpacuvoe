import { app, BrowserWindow, Tray, Menu, nativeImage, shell, clipboard, globalShortcut } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged
const DEV_URL = 'http://127.0.0.1:3847'

/** @type {BrowserWindow | null} */
let mainWindow = null
/** @type {Tray | null} */
let tray = null

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
    return mainWindow
  }

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 820,
    minHeight: 600,
    title: 'SoftShot',
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
    void mainWindow.loadURL(DEV_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

function trayIcon() {
  // Tiny mint square — Electron will template it on macOS if needed.
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect x="4" y="5" width="24" height="22" rx="6" fill="#7dffa0"/>
    </svg>`
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
  )
}

function createTray() {
  tray = new Tray(trayIcon())
  tray.setToolTip('SoftShot')
  const menu = Menu.buildFromTemplate([
    {
      label: 'Открыть SoftShot',
      click: () => createWindow(),
    },
    {
      label: 'Вставить из буфера',
      accelerator: 'CommandOrControl+Shift+V',
      click: () => {
        const win = createWindow()
        win.webContents.send('softshot:paste-hint')
        // Focus so the user can Cmd+V; also try to push image if present.
        const img = clipboard.readImage()
        if (!img.isEmpty()) {
          const png = img.toPNG()
          const dataUrl = `data:image/png;base64,${png.toString('base64')}`
          win.webContents.send('softshot:image-data-url', dataUrl)
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Выйти',
      click: () => app.quit(),
    },
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => createWindow())
}

function watchScreenshotFolder() {
  if (process.platform !== 'darwin') return

  const desktop = app.getPath('desktop')
  let timer = null

  const onChange = (filename) => {
    if (!filename) return
    const lower = filename.toLowerCase()
    if (!/\.(png|jpe?g|webp)$/.test(lower)) return
    // Common macOS / CleanShot / localized screenshot names.
    if (
      !/(screenshot|screen shot|снимок|экран|capture|cleanshot|shot)/i.test(
        filename,
      )
    ) {
      return
    }

    const full = path.join(desktop, filename)
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (!fs.existsSync(full)) return
      try {
        const buf = fs.readFileSync(full)
        const ext = path.extname(full).toLowerCase()
        const mime =
          ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : ext === '.webp'
              ? 'image/webp'
              : 'image/png'
        const dataUrl = `data:${mime};base64,${buf.toString('base64')}`
        const win = createWindow()
        win.webContents.send('softshot:image-data-url', dataUrl)
      } catch {
        // Ignore unreadable temp files mid-write.
      }
    }, 400)
  }

  try {
    fs.watch(desktop, { persistent: true }, (_event, filename) => {
      if (typeof filename === 'string') onChange(filename)
    })
  } catch {
    // Desktop watch is best-effort.
  }
}

app.whenReady().then(() => {
  createTray()
  createWindow()
  watchScreenshotFolder()

  globalShortcut.register('CommandOrControl+Shift+S', () => {
    const win = createWindow()
    const img = clipboard.readImage()
    if (!img.isEmpty()) {
      const png = img.toPNG()
      win.webContents.send(
        'softshot:image-data-url',
        `data:image/png;base64,${png.toString('base64')}`,
      )
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // Keep tray app alive on macOS.
  if (process.platform !== 'darwin') app.quit()
})

// Open external links in browser.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
})
