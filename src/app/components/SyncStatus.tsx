'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { clearQueue, flushQueue, getQueue, type QueuedMutation } from '@/lib/mutationQueue'

export default function SyncStatus() {
  const [queued, setQueued] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [showList, setShowList] = useState(false)
  const [items, setItems] = useState<QueuedMutation[]>([])

  const refreshCount = async () => {
    const q = await getQueue()
    setQueued(q.length)
    setItems(q)
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

  const clearAll = async () => {
    await clearQueue()
    setMessage('Cleared offline queue.')
    refreshCount()
  }

  if (queued === 0 && !message && !showList) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
      <div className="flex items-center gap-2">
        <span className="font-semibold">Offline queue</span>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 text-xs">{queued}</span>
        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
        >
          {showList ? 'Hide' : 'View'}
        </button>
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
      {showList && (
        <div className="mt-2 max-h-48 overflow-auto border-t border-gray-200 pt-2 space-y-1">
          {items.length === 0 && <p className="text-xs text-gray-500">No queued items.</p>}
          {items.map((item) => (
            <div key={item.id} className="rounded border border-gray-200 px-2 py-1">
              <p className="text-xs font-semibold">{item.type}</p>
              {'project-insert' in item.payload && null}
              {item.type.includes('project') && (
                <p className="text-xs text-gray-600">
                  {String((item.payload as any).name || (item.payload as any).project_number || 'Project')}
                </p>
              )}
              {item.type.includes('chamber') && (
                <p className="text-xs text-gray-600">
                  {String((item.payload as any).identifier || 'Chamber')}
                </p>
              )}
            </div>
          ))}
          {items.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
            >
              Clear queue
            </button>
          )}
        </div>
      )}
    </div>
  )
}
