import { app, net } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const REPO = 'afselk/kpacuvoe'

function parseVersion(tag) {
  return String(tag || '')
    .trim()
    .replace(/^v/i, '')
}

function cmpSemver(a, b) {
  const pa = parseVersion(a).split('.').map((n) => parseInt(n, 10) || 0)
  const pb = parseVersion(b).split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] || 0
    const db = pb[i] || 0
    if (da > db) return 1
    if (da < db) return -1
  }
  return 0
}

function appBundlePath() {
  return path.resolve(path.dirname(process.execPath), '../..')
}

function pickAsset(assets) {
  if (process.arch === 'arm64') {
    const hit =
      assets.find((a) => /arm64.*\.zip$/i.test(a.name)) ||
      assets.find((a) => /aarch64.*\.zip$/i.test(a.name))
    if (hit) return hit
  } else {
    const hit = assets.find(
      (a) => /\.zip$/i.test(a.name) && !/arm64|aarch64/i.test(a.name),
    )
    if (hit) return hit
  }
  return assets.find((a) => /\.zip$/i.test(a.name)) || null
}

async function githubJson(urlPath) {
  const res = await net.fetch(`https://api.github.com/repos/${REPO}${urlPath}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'kpacuvoe-updater',
    },
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  return res.json()
}

export async function checkForUpdate() {
  const current = app.getVersion()
  const release = await githubJson('/releases/latest')
  const latest = parseVersion(release.tag_name)
  const available = cmpSemver(latest, current) > 0
  const asset = available ? pickAsset(release.assets || []) : null
  return {
    current,
    latest,
    available,
    releaseUrl: release.html_url,
    assetName: asset?.name || null,
    downloadUrl: asset?.browser_download_url || null,
    notes: release.body || '',
  }
}

async function downloadFile(url, dest, onProgress) {
  const res = await net.fetch(url, {
    headers: { 'User-Agent': 'kpacuvoe-updater' },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`Не удалось скачать обновление (${res.status})`)
  onProgress?.(0.05)
  const buffer = Buffer.from(await res.arrayBuffer())
  onProgress?.(0.9)
  fs.writeFileSync(dest, buffer)
  onProgress?.(1)
}

async function unzip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true })
  if (process.platform === 'darwin') {
    await execFileAsync('ditto', ['-x', '-k', zipPath, destDir])
    return
  }
  await execFileAsync('unzip', ['-o', zipPath, '-d', destDir])
}

function findAppInDir(dir) {
  const entries = fs.readdirSync(dir)
  for (const name of entries) {
    const full = path.join(dir, name)
    if (name.endsWith('.app') && fs.statSync(full).isDirectory()) return full
    if (fs.statSync(full).isDirectory() && !name.startsWith('.')) {
      const nested = findAppInDir(full)
      if (nested) return nested
    }
  }
  return null
}

export async function downloadAndInstall({ downloadUrl, onProgress }) {
  if (!app.isPackaged) {
    throw new Error('Обновление доступно только в собранном приложении')
  }
  if (process.platform !== 'darwin') {
    throw new Error('Автообновление сейчас только для macOS')
  }
  if (!downloadUrl) throw new Error('Нет файла обновления')

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kpacuvoe-update-'))
  const zipPath = path.join(tmpRoot, 'update.zip')
  const extractDir = path.join(tmpRoot, 'extract')

  try {
    await downloadFile(downloadUrl, zipPath, onProgress)
    await unzip(zipPath, extractDir)
    const newApp = findAppInDir(extractDir)
    if (!newApp) throw new Error('В архиве нет kpacuvoe.app')

    const target = appBundlePath()
    if (!target.endsWith('.app')) {
      throw new Error(`Неожиданный путь приложения: ${target}`)
    }

    const backup = `${target}.bak-${Date.now()}`
    if (fs.existsSync(target)) fs.renameSync(target, backup)
    try {
      await execFileAsync('ditto', [newApp, target])
    } catch (error) {
      if (fs.existsSync(backup)) fs.renameSync(backup, target)
      throw error
    }
    try {
      fs.rmSync(backup, { recursive: true, force: true })
    } catch {
      // ignore
    }
    try {
      await execFileAsync('xattr', ['-cr', target])
    } catch {
      // ignore
    }

    app.relaunch()
    setTimeout(() => app.exit(0), 300)
    return { ok: true }
  } finally {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
}
