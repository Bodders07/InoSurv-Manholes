'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { flushQueue, getQueue } from '@/lib/mutationQueue'

export default function SyncStatus() {
  const [queued, setQueued] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')

  const refreshCount = async () => {
    const q = await getQueue()
    setQueued(q.length)
  }

  useEffect(() => {
    refreshCount()
    const id = setInterval(refreshCount, 5000)
    return () => clearInterval(id)
  }, [])

  const syncNow = async () => {
    setSyncing(true)
    setMessage('')
    const { success, failed } = await flushQueue(supabase, (msg) => setMessage(msg))
    setSyncing(false)
    setMessage(failed ? `Synced ${success}, failed ${failed}` : `Synced ${success}`)
    refreshCount()
  }

  if (queued === 0 && !message) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
      <div className="flex items-center gap-2">
        <span className="font-semibold">Offline queue</span>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 text-xs">{queued}</span>
        <button
          type="button"
          onClick={syncNow}
          disabled={syncing}
          className="ml-auto rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-60"
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
      {message && <p className="mt-1 text-xs text-gray-600">{message}</p>}
    </div>
  )
}
