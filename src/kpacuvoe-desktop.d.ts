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

export type KpacuvoeDesktop = {
  getSettings: () => Promise<KpacuvoeSettings>
  setSettings: (patch: Partial<KpacuvoeSettings>) => Promise<boolean>
  chooseFolder: () => Promise<string | null>
  processFolderNow: () => Promise<{ processed: number; failed: number }>
  onSettings: (handler: (settings: KpacuvoeSettings) => void) => () => void
}

declare global {
  interface Window {
    kpacuvoeDesktop?: KpacuvoeDesktop
  }
}

export {}
