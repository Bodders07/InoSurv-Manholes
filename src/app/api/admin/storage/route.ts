'use server'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type StorageEntry = {
  name: string
  updated_at: string
  id?: string
  created_at?: string
  last_accessed_at?: string | null
  metadata: { size?: number | string | null } | null
}

type StorageFile = StorageEntry & { fullName: string }

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const supa = createClient(url, serviceKey, { auth: { persistSession: false } })
  const bucket = 'manhole-photos'

  // Recursively list all files in the bucket using the Storage API
  async function listAll(prefix: string): Promise<StorageFile[]> {
    const out: StorageFile[] = []
    const limit = 1000
    let offset = 0
    while (true) {
      const res = await supa.storage.from(bucket).list(prefix, {
        limit,
        offset,
        sortBy: { column: 'updated_at', order: 'desc' },
      })
      if (res.error) throw res.error
      const items = (res.data || []) as StorageEntry[]
      for (const it of items) {
        // Folders typically have null metadata; files include size in metadata
        const size = it.metadata?.size
        const numericSize =
          typeof size === 'number' ? size : size ? parseInt(String(size), 10) : null
        const isFile = typeof numericSize === 'number' && Number.isFinite(numericSize)
        const fullName = prefix ? `${prefix}/${it.name}` : it.name
        if (isFile) out.push({ ...it, fullName })
        else {
          // Recurse into subfolder
          const sub = await listAll(fullName)
          out.push(...sub)
        }
      }
      if (items.length < limit) break
      offset += limit
    }
    return out
  }

  let files: StorageFile[] = []
  try {
    files = await listAll('')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list storage'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const usedBytes = files.reduce((sum, file) => {
    const size = file.metadata?.size
    const numeric =
      typeof size === 'number' ? size : size ? parseInt(String(size), 10) : 0
    return sum + (Number.isFinite(numeric) ? numeric : 0)
  }, 0)
  const objectCount = files.length

  const topSorted = files
    .map((o) => ({
      name: o.fullName || o.name,
      bytes:
        typeof o.metadata?.size === 'number'
          ? o.metadata.size
          : o.metadata?.size
            ? parseInt(String(o.metadata.size), 10) || 0
            : 0,
      updated_at: o.updated_at,
    }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 20)

  function pretty(n: number) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let i = 0
    let v = n
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
    return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
  }

  return NextResponse.json({
    bucket,
    used_bytes: usedBytes,
    used_pretty: pretty(usedBytes),
    object_count: objectCount,
    top: topSorted.map((t) => ({ ...t, size_pretty: pretty(t.bytes) })),
  })
}
