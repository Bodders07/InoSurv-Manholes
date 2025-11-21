'use client'

import { useEffect, useState } from 'react'

/**
 * Catches Next.js chunk load failures (common in stale PWAs on iOS) and shows a retry banner.
 * When a chunk fails, we ask the user to go online and tap retry, which updates SW and reloads.
 */
export default function ChunkErrorBanner() {
  const [message, setMessage] = useState<string>('')
  const [details, setDetails] = useState<string>('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onScriptError = (event: Event) => {
      const tgt = event.target as HTMLElement | null
      // Detect failed chunk/script load
      if (tgt && 'src' in tgt && typeof (tgt as HTMLScriptElement).src === 'string') {
        const src = (tgt as HTMLScriptElement).src
        if (src.includes('/_next/static/chunks')) {
          setVisible(true)
          setMessage('App assets look stale. Go online, then tap Retry.')
          setDetails(src)
        }
      }
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const text =
        typeof reason === 'string'
          ? reason
          : reason?.message || reason?.toString?.() || ''
      if (/Loading chunk|Failed to fetch dynamically imported module/i.test(text)) {
        setVisible(true)
        setMessage('App assets look stale. Go online, then tap Retry.')
        setDetails(text)
      }
    }

    window.addEventListener('error', onScriptError, true)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onScriptError, true)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  const retry = async () => {
    setBusy(true)
    try {
      if (navigator.onLine && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg?.update) await reg.update()
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
          setTimeout(() => window.location.reload(), 500)
          return
        }
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
      window.location.reload()
    }
  }

  if (!visible) return null

  return (
    <div className="w-full bg-red-50 border-b border-red-200 px-3 py-2 text-sm text-red-800 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="font-semibold">Update required</div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-red-700">{message}</span>
        <button
          type="button"
          onClick={retry}
          className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-sm"
          disabled={busy}
        >
          {busy ? 'Retrying…' : 'Retry'}
        </button>
      </div>
      {details && (
        <div className="text-[11px] text-red-700 break-all mt-1">
          {details}
        </div>
      )}
    </div>
  )
}
