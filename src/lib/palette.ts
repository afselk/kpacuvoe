export type RGB = { r: number; g: number; b: number }

export function rgbToCss({ r, g, b }: RGB, alpha = 1): string {
  return alpha === 1
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function clamp(n: number, min = 0, max = 255): number {
  return Math.min(max, Math.max(min, n))
}

function luminance({ r, g, b }: RGB): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  }
}

function adjust(color: RGB, lightness: number, saturation = 1): RGB {
  const gray = luminance(color)
  const saturated = {
    r: clamp(gray + (color.r - gray) * saturation),
    g: clamp(gray + (color.g - gray) * saturation),
    b: clamp(gray + (color.b - gray) * saturation),
  }
  if (lightness >= 0) {
    return mix(saturated, { r: 255, g: 255, b: 255 }, lightness)
  }
  return mix(saturated, { r: 0, g: 0, b: 0 }, -lightness)
}

function sampleRegion(
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): RGB {
  let r = 0
  let g = 0
  let b = 0
  let count = 0

  const left = Math.max(0, Math.floor(x0))
  const top = Math.max(0, Math.floor(y0))
  const right = Math.min(width - 1, Math.floor(x1))
  const bottom = Math.min(Math.floor(data.length / (width * 4)) - 1, Math.floor(y1))

  for (let y = top; y <= bottom; y += 2) {
    for (let x = left; x <= right; x += 2) {
      const i = (y * width + x) * 4
      const alpha = data[i + 3]
      if (alpha < 16) continue
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      count += 1
    }
  }

  if (count === 0) return { r: 32, g: 36, b: 40 }
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  }
}

/** Pull a soft two-stop palette from image edges/corners. */
export function extractEdgePalette(
  image: CanvasImageSource,
  width: number,
  height: number,
): { start: RGB; end: RGB; mid: RGB } {
  const canvas = document.createElement('canvas')
  const maxSide = 160
  const scale = Math.min(1, maxSide / Math.max(width, height))
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    const fallback = { r: 40, g: 48, b: 56 }
    return { start: fallback, end: fallback, mid: fallback }
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const w = canvas.width
  const h = canvas.height
  const band = Math.max(4, Math.round(Math.min(w, h) * 0.12))

  const samples = [
    sampleRegion(data, w, 0, 0, band, band),
    sampleRegion(data, w, w - band, 0, w, band),
    sampleRegion(data, w, 0, h - band, band, h),
    sampleRegion(data, w, w - band, h - band, w, h),
    sampleRegion(data, w, w / 2 - band / 2, 0, w / 2 + band / 2, band),
    sampleRegion(data, w, w / 2 - band / 2, h - band, w / 2 + band / 2, h),
    sampleRegion(data, w, 0, h / 2 - band / 2, band, h / 2 + band / 2),
    sampleRegion(data, w, w - band, h / 2 - band / 2, w, h / 2 + band / 2),
  ].sort((a, b) => luminance(a) - luminance(b))

  const dark = samples[0]
  const light = samples[samples.length - 1]
  const mid = samples[Math.floor(samples.length / 2)]

  return {
    start: adjust(dark, -0.08, 1.15),
    end: adjust(light, 0.12, 1.1),
    mid: adjust(mid, 0.02, 1.05),
  }
}
