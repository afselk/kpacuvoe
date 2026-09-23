export type KpacuvoeSettings = {
  watchFolder: string | null
  radius: number
  padding: number
  mode: 'gradient' | 'shadow'
  borderWidth: number
  shadowBlur: number
  shadowOffsetY: number
  transparentBg: boolean
}

export type KpacuvoeUpdateInfo = {
  current: string
  latest: string
  available: boolean
  releaseUrl?: string
  assetName?: string | null
  downloadUrl?: string | null
  notes?: string
  error?: string
}

export type KpacuvoeDesktop = {
  getSettings: () => Promise<KpacuvoeSettings>
  setSettings: (patch: Partial<KpacuvoeSettings>) => Promise<boolean>
  chooseFolder: () => Promise<string | null>
  processFolderNow: () => Promise<{ processed: number; failed: number }>
  getVersion: () => Promise<string>
  checkUpdate: () => Promise<KpacuvoeUpdateInfo>
  installUpdate: (
    downloadUrl: string,
  ) => Promise<{ ok: boolean; error?: string }>
  onSettings: (handler: (settings: KpacuvoeSettings) => void) => () => void
  onUpdateProgress: (handler: (progress: number) => void) => () => void
  onRequestUpdateCheck: (handler: () => void) => () => void
}

declare global {
  interface Window {
    kpacuvoeDesktop?: KpacuvoeDesktop
  }
}

export {}
