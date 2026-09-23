export type SoftShotDesktop = {
  onImageDataUrl: (handler: (dataUrl: string) => void) => () => void
}

declare global {
  interface Window {
    softshotDesktop?: SoftShotDesktop
  }
}

export {}
