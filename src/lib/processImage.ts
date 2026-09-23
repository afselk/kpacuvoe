import { extractEdgePalette, rgbToCss, type RGB } from './palette'

export type FrameMode = 'gradient' | 'shadow'

export type ProcessOptions = {
  radius: number
  padding: number
  mode: FrameMode
  borderWidth: number
  shadowBlur: number
  shadowOffsetY: number
  /** Used only in shadow mode as the outer canvas fill. */
  background: 'transparent' | 'auto' | RGB
}

export type ProcessResult = {
  blob: Blob
  dataUrl: string
  width: number
  height: number
  palette: { start: RGB; end: RGB; mid: RGB }
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Не удалось загрузить изображение'))
    img.src = src
  })
}

export async function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsDataURL(file)
  })
}

export async function processScreenshot(
  source: string | Blob,
  options: ProcessOptions,
): Promise<ProcessResult> {
  const dataUrl = typeof source === 'string' ? source : await fileToDataUrl(source)
  const image = await loadImage(dataUrl)
  const width = image.naturalWidth
  const height = image.naturalHeight

  if (!width || !height) {
    throw new Error('Пустое изображение')
  }

  const palette = extractEdgePalette(image, width, height)
  const padding = Math.max(0, Math.round(options.padding))
  const radius = Math.max(0, Math.round(options.radius))
  const borderWidth = Math.max(0, options.borderWidth)
  const shadowBlur = Math.max(0, options.shadowBlur)
  const shadowOffsetY = options.shadowOffsetY

  const shadowPad =
    options.mode === 'shadow'
      ? Math.ceil(shadowBlur * 1.4 + Math.abs(shadowOffsetY) + borderWidth)
      : 0

  const outW = width + padding * 2 + shadowPad * 2
  const outH = height + padding * 2 + shadowPad * 2

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas недоступен')

  const originX = shadowPad + padding
  const originY = shadowPad + padding

  if (options.mode === 'gradient') {
    const gradient = ctx.createLinearGradient(0, 0, outW, outH)
    gradient.addColorStop(0, rgbToCss(palette.start))
    gradient.addColorStop(0.45, rgbToCss(palette.mid))
    gradient.addColorStop(1, rgbToCss(palette.end))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, outW, outH)

    // Soft vignette so the pad feels intentional, not flat.
    const vignette = ctx.createRadialGradient(
      outW / 2,
      outH / 2,
      Math.min(outW, outH) * 0.2,
      outW / 2,
      outH / 2,
      Math.max(outW, outH) * 0.72,
    )
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(0,0,0,0.18)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, outW, outH)
  } else {
    if (options.background === 'transparent') {
      ctx.clearRect(0, 0, outW, outH)
    } else {
      const fill =
        options.background === 'auto' ? palette.mid : options.background
      ctx.fillStyle = rgbToCss(fill)
      ctx.fillRect(0, 0, outW, outH)
    }

    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
    ctx.shadowBlur = shadowBlur
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = shadowOffsetY
    roundRectPath(ctx, originX, originY, width, height, radius)
    ctx.fillStyle = '#000'
    ctx.fill()
    ctx.restore()

    if (borderWidth > 0) {
      ctx.save()
      roundRectPath(ctx, originX, originY, width, height, radius)
      ctx.strokeStyle = rgbToCss(palette.end, 0.9)
      ctx.lineWidth = borderWidth
      ctx.stroke()
      ctx.restore()
    }
  }

  ctx.save()
  roundRectPath(ctx, originX, originY, width, height, radius)
  ctx.clip()
  ctx.drawImage(image, originX, originY, width, height)
  ctx.restore()

  if (options.mode === 'gradient' && borderWidth > 0) {
    ctx.save()
    roundRectPath(ctx, originX, originY, width, height, radius)
    ctx.strokeStyle = rgbToCss(palette.end, 0.55)
    ctx.lineWidth = borderWidth
    ctx.stroke()
    ctx.restore()
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result)
        else reject(new Error('Не удалось сохранить PNG'))
      },
      'image/png',
      1,
    )
  })

  const outUrl = canvas.toDataURL('image/png')

  return {
    blob,
    dataUrl: outUrl,
    width: outW,
    height: outH,
    palette,
  }
}
