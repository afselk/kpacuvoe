/** Shared defaults for kpacuvoe (renderer + main). */
export const DEFAULTS = {
  radius: 30,
  padding: 30,
  mode: /** @type {'gradient' | 'shadow'} */ ('shadow'),
  borderWidth: 1.5,
  shadowBlur: 30,
  shadowOffsetY: 14,
  transparentBg: false,
}

export const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.tif',
  '.tiff',
  '.bmp',
])

export function isImageFile(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  return IMAGE_EXTENSIONS.has(ext)
}
