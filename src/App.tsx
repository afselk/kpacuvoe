import clsx from 'clsx'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from 'react'
import {
  fileToDataUrl,
  processScreenshot,
  type FrameMode,
  type ProcessResult,
} from './lib/processImage'
import { rgbToCss } from './lib/palette'

const DEFAULTS = {
  radius: 20,
  padding: 20,
  mode: 'gradient' as FrameMode,
  borderWidth: 1.5,
  shadowBlur: 28,
  shadowOffsetY: 14,
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function ControlRow({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-[var(--fog)]/90">{label}</span>
        <span className="font-mono text-xs text-[var(--mist)]">{value}</span>
      </div>
      {children}
    </label>
  )
}

export default function App() {
  const inputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState('screenshot')
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  const [radius, setRadius] = useState(DEFAULTS.radius)
  const [padding, setPadding] = useState(DEFAULTS.padding)
  const [mode, setMode] = useState<FrameMode>(DEFAULTS.mode)
  const [borderWidth, setBorderWidth] = useState(DEFAULTS.borderWidth)
  const [shadowBlur, setShadowBlur] = useState(DEFAULTS.shadowBlur)
  const [transparentBg, setTransparentBg] = useState(true)

  const ingestFile = useCallback(async (file: File | Blob, name?: string) => {
    if (!file.type.startsWith('image/')) {
      setError('Нужен файл изображения (PNG, JPEG, WebP…)')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const url = await fileToDataUrl(file)
      setSourceUrl(url)
      setSourceName((name ?? (file instanceof File ? file.name : 'screenshot')).replace(/\.[^.]+$/, '') || 'screenshot')
    } catch (e) {
      setBusy(false)
      setError(e instanceof Error ? e.message : 'Ошибка чтения файла')
    }
  }, [])

  useEffect(() => {
    if (!sourceUrl) return

    let cancelled = false

    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const next = await processScreenshot(sourceUrl, {
            radius,
            padding,
            mode,
            borderWidth,
            shadowBlur,
            shadowOffsetY: DEFAULTS.shadowOffsetY,
            background: mode === 'shadow' && transparentBg ? 'transparent' : 'auto',
          })
          if (!cancelled) {
            setResult(next)
            setError(null)
          }
        } catch (e: unknown) {
          if (!cancelled) {
            setResult(null)
            setError(e instanceof Error ? e.message : 'Не удалось обработать скриншот')
          }
        } finally {
          if (!cancelled) setBusy(false)
        }
      })()
    }, 80)

    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [sourceUrl, radius, padding, mode, borderWidth, shadowBlur, transparentBg])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            event.preventDefault()
            void ingestFile(file, 'clipboard-shot')
          }
          break
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [ingestFile])

  useEffect(() => {
    const api = window.softshotDesktop
    if (!api) return
    return api.onImageDataUrl((dataUrl) => {
      setError(null)
      setSourceName('desktop-shot')
      setSourceUrl(dataUrl)
    })
  }, [])

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void ingestFile(file)
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void ingestFile(file)
    event.target.value = ''
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 pb-10 pt-8 sm:px-8 sm:pt-12">
      <header className="rise-in mb-8 max-w-2xl sm:mb-10">
        <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-[var(--mint)] uppercase">
          для Mac · скриншоты
        </p>
        <h1 className="font-[family-name:var(--font-brand)] text-5xl leading-none tracking-tight sm:text-6xl md:text-7xl">
          <span className="brand-sheen font-[family-name:'Bricolage_Grotesque',sans-serif] font-bold">
            SoftShot
          </span>
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--mist)] sm:text-lg">
          Скругляет углы, дорисовывает паддинг градиентом из палитры кадра или
          добавляет обводку с тенью — чтобы скрин выглядел объёмно.
        </p>
      </header>

      <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
        <section
          className={clsx(
            'rise-in relative flex min-h-[420px] flex-col overflow-hidden rounded-[28px] border border-[var(--line)] bg-[rgba(12,18,16,0.55)] backdrop-blur-md',
            dragging && 'pulse-ring border-[var(--mint)]/50',
          )}
          style={{ animationDelay: '80ms' }}
          onDragEnter={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onFileChange}
          />

          {!result ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl px-4 py-6 transition hover:bg-white/[0.02]"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--mint)]/30 bg-[var(--glow)] text-2xl text-[var(--mint)]">
                  ⌘V
                </div>
                <div>
                  <p className="text-lg font-semibold text-[var(--fog)]">
                    Брось скриншот сюда или вставь из буфера
                  </p>
                  <p className="mt-2 max-w-md text-sm text-[var(--mist)]">
                    На Mac:{' '}
                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">⌘⌃⇧4</kbd>
                    {' '}→ буфер, затем вставь. Или перетащи файл с рабочего стола.
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    try {
                      setBusy(true)
                      setError(null)
                      const res = await fetch(`${import.meta.env.BASE_URL}sample-shot.png`)
                      if (!res.ok) throw new Error('Пример не найден')
                      const blob = await res.blob()
                      await ingestFile(blob, 'sample-shot')
                    } catch (e) {
                      setBusy(false)
                      setError(e instanceof Error ? e.message : 'Не удалось загрузить пример')
                    }
                  })()
                }}
                className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm text-[var(--fog)] transition hover:border-[var(--mint)]/40 hover:bg-white/[0.04]"
              >
                Попробовать на примере
              </button>
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--fog)]">
                    {sourceName}.png
                  </p>
                  <p className="text-xs text-[var(--mist)]">
                    {result.width}×{result.height}
                    {busy ? ' · обновляю…' : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm text-[var(--fog)] transition hover:border-[var(--mint)]/40 hover:bg-white/[0.04]"
                  >
                    Другой
                  </button>
                  <button
                    type="button"
                    onClick={() => result && downloadBlob(result.blob, `${sourceName}-softshot.png`)}
                    className="rounded-xl bg-[var(--mint)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--spark)]"
                  >
                    Скачать PNG
                  </button>
                </div>
              </div>

              <div className="checker relative flex flex-1 items-center justify-center overflow-auto p-6 sm:p-10">
                <img
                  src={result.dataUrl}
                  alt="Обработанный скриншот"
                  className="rise-in max-h-[min(62vh,720px)] max-w-full object-contain shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
                  style={{ animationDelay: '40ms' }}
                />
              </div>

              {result.palette && (
                <div className="flex items-center gap-2 border-t border-[var(--line)] px-4 py-3 sm:px-5">
                  <span className="text-xs text-[var(--mist)]">Палитра</span>
                  {[result.palette.start, result.palette.mid, result.palette.end].map((c, i) => (
                    <span
                      key={i}
                      className="h-5 w-5 rounded-full border border-white/15"
                      style={{ background: rgbToCss(c) }}
                      title={rgbToCss(c)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <aside
          className="rise-in space-y-6 rounded-[28px] border border-[var(--line)] bg-[rgba(12,18,16,0.55)] p-5 backdrop-blur-md sm:p-6"
          style={{ animationDelay: '140ms' }}
        >
          <div>
            <h2 className="font-[family-name:'Bricolage_Grotesque',sans-serif] text-lg font-semibold text-[var(--fog)]">
              Режим
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(
                [
                  ['gradient', 'Градиент'],
                  ['shadow', 'Тень'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={clsx(
                    'rounded-xl px-3 py-2.5 text-sm font-medium transition',
                    mode === value
                      ? 'bg-[var(--mint)] text-[var(--ink)]'
                      : 'border border-[var(--line)] text-[var(--fog)] hover:bg-white/[0.04]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--mist)]">
              {mode === 'gradient'
                ? 'Паддинг заливается градиентом из цветов краёв скриншота.'
                : 'Обводка и мягкая тень — скрин «лежит» на фоне объёмно.'}
            </p>
          </div>

          <div className="space-y-5">
            <ControlRow label="Скругление" value={`${radius}px`}>
              <input
                className="slider"
                type="range"
                min={0}
                max={48}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
              />
            </ControlRow>

            <ControlRow label="Паддинг" value={`${padding}px`}>
              <input
                className="slider"
                type="range"
                min={0}
                max={80}
                value={padding}
                onChange={(e) => setPadding(Number(e.target.value))}
              />
            </ControlRow>

            <ControlRow label="Обводка" value={`${borderWidth.toFixed(1)}px`}>
              <input
                className="slider"
                type="range"
                min={0}
                max={8}
                step={0.5}
                value={borderWidth}
                onChange={(e) => setBorderWidth(Number(e.target.value))}
              />
            </ControlRow>

            {mode === 'shadow' && (
              <>
                <ControlRow label="Размытие тени" value={`${shadowBlur}px`}>
                  <input
                    className="slider"
                    type="range"
                    min={0}
                    max={60}
                    value={shadowBlur}
                    onChange={(e) => setShadowBlur(Number(e.target.value))}
                  />
                </ControlRow>

                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-[var(--fog)]">
                  <span>Прозрачный фон</span>
                  <input
                    type="checkbox"
                    checked={transparentBg}
                    onChange={(e) => setTransparentBg(e.target.checked)}
                    className="h-4 w-4 accent-[var(--mint)]"
                  />
                </label>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-black/20 p-4 text-xs leading-relaxed text-[var(--mist)]">
            <p className="font-medium text-[var(--fog)]">Быстрый флоу на Mac</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>
                Сними область в буфер: <span className="text-[var(--fog)]">⌘⌃⇧4</span>
              </li>
              <li>
                Вставь сюда: <span className="text-[var(--fog)]">⌘V</span>
              </li>
              <li>Скачай PNG и кидай в Notion / Slack / Figma</li>
            </ol>
          </div>

          {error && (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
