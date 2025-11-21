'use client'

import { useState } from 'react'

export default function UpdateCheckButton() {
  const [status, setStatus] = useState<string>('')

  const checkForUpdate = async () => {
    if (typeof navigator === 'undefined') return
    if (navigator.onLine === false) {
      setStatus('Offline: using cached version now.')
      return
    }

    setStatus('Checking for update...')
    try {
      let updateFound = false
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg?.update) {
          await reg.update()
        }
        const waiting = reg?.waiting
        if (waiting) {
          updateFound = true
          setStatus('Update found. Refreshing...')
          waiting.addEventListener('statechange', (ev) => {
            const sw = ev.target as ServiceWorker
            if (sw.state === 'activated') {
              window.location.reload()
            }
          })
          waiting.postMessage({ type: 'SKIP_WAITING' })
          setTimeout(() => window.location.reload(), 1200)
          return
        }
      }

      // fall back: force a no-store fetch of the current page
      await fetch(window.location.href, { cache: 'no-store' })
      setStatus(updateFound ? 'Update applied.' : 'No update detected; you are on the latest version.')
    } catch (err) {
      setStatus('Could not check for updates. Pull to refresh when online.')
    }
  }

  return (
    <div className="w-full bg-indigo-50 border-b border-indigo-100 px-3 py-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-sm text-indigo-900">
      <span className="font-medium">Check for latest version</span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={checkForUpdate}
          className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
        >
          Check update
        </button>
        {status && <span className="text-xs text-indigo-800">{status}</span>}
      </div>
    </div>
  )
}
