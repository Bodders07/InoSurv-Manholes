'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { clearQueue, flushQueue, getQueue, type QueuedMutation } from '@/lib/mutationQueue'

export default function SyncQueueCard() {
  const [queued, setQueued] = useState<QueuedMutation[]>([])
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)

  const refreshQueue = async () => {
    const q = await getQueue()
    setQueued(q)
  }

  useEffect(() => {
    refreshQueue()
    const id = setInterval(refreshQueue, 4000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
    }
    function handleOffline() {
      setIsOnline(false)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
    return undefined
  }, [])

  const syncNow = async () => {
    setSyncing(true)
    setMessage('')
    const { success, failed } = await flushQueue(supabase, (msg) => setMessage(msg))
    setSyncing(false)
    setMessage(failed ? `Synced ${success}, failed ${failed}` : `Synced ${success}`)
    refreshQueue()
  }

  const clearAll = async () => {
    await clearQueue()
    setMessage('Cleared queue.')
    refreshQueue()
  }

  const queuedCount = queued.length
  const sampleItems = queued.slice(0, 4)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sync & queue status</h2>
          <p className="text-sm text-gray-500">Offline actions waiting to upload</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-gray-500">Queued items</dt>
          <dd className="text-2xl font-semibold">{queuedCount}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Last message</dt>
          <dd className="text-sm text-gray-700 min-h-[1.5rem]">{message || '—'}</dd>
        </div>
      </dl>
      {sampleItems.length > 0 && (
        <div className="mt-3 rounded border border-gray-100 bg-gray-50 p-2 text-xs text-gray-600 space-y-1">
          {sampleItems.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span className="font-semibold">{item.type}</span>
              <span>{String((item.payload as any)?.identifier || (item.payload as any)?.name || '')}</span>
            </div>
          ))}
          {queuedCount > sampleItems.length && (
            <p className="text-gray-500">+{queuedCount - sampleItems.length} more…</p>
          )}
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={syncNow}
          disabled={syncing || queuedCount === 0}
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={queuedCount === 0}
          className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
