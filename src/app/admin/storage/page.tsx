'use client'

import { useEffect, useState } from 'react'
import SidebarLayout from '@/app/components/SidebarLayout'
import { supabase } from '@/lib/supabaseClient'

type Usage = {
  bucket: string
  used_bytes: number
  used_pretty: string
  object_count: number
  top: { name: string; bytes: number; size_pretty: string; updated_at: string }[]
}

export default function StoragePage() {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      setMessage('')
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        const res = await fetch('/api/admin/storage', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || 'Failed to load storage usage')
        setUsage(payload)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load'
        setMessage('Error: ' + msg)
      }
    }
    load()
  }, [])

  // Embed mode: omit app chrome
  const embed = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === '1'

  const content = (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Storage Usage</h1>
      {message && <p className="mb-4 text-red-600">{message}</p>}
      {!usage ? (
        <p>Loading…</p>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-sm">Bucket: <span className="font-mono">{usage.bucket}</span></p>
            <p className="text-sm">Objects: {usage.object_count}</p>
            <p className="text-sm">Used: {usage.used_pretty} ({usage.used_bytes} bytes)</p>
          </div>
          <div className="bg-white border rounded shadow-sm overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2 border-b">Name</th>
                  <th className="px-4 py-2 border-b">Size</th>
                  <th className="px-4 py-2 border-b">Updated</th>
                </tr>
              </thead>
              <tbody>
                {usage.top.map((o) => (
                  <tr key={o.name} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-b font-mono truncate max-w-[360px]">{o.name}</td>
                    <td className="px-4 py-2 border-b">{o.size_pretty}</td>
                    <td className="px-4 py-2 border-b">{new Date(o.updated_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )

  if (embed) return content
  return <SidebarLayout>{content}</SidebarLayout>
}
