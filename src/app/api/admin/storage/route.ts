'use server'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const supa = createClient(url, serviceKey, { auth: { persistSession: false } })
  const bucket = 'manhole-photos'

  // Recursively list all files in the bucket using the Storage API
  async function listAll(prefix: string): Promise<any[]> {
    const out: any[] = []
    const limit = 1000
    let offset = 0
    while (true) {
      const res = await supa.storage.from(bucket).list(prefix, {
        limit,
        offset,
        sortBy: { column: 'updated_at', order: 'desc' },
      })
      if (res.error) throw res.error
      const items = res.data || []
      for (const it of items) {
        // Folders typically have null metadata; files include size in metadata
        const isFile = !!(it as any)?.metadata?.size
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

  let files: any[] = []
  try {
    files = await listAll('')
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to list storage' }, { status: 500 })
  }

  const usedBytes = files.reduce((sum, f) => sum + (parseInt(f?.metadata?.size ?? '0', 10) || 0), 0)
  const objectCount = files.length

  const topSorted = files
    .map((o: any) => ({
      name: o.fullName || o.name,
      bytes: parseInt(o?.metadata?.size ?? '0', 10) || 0,
      updated_at: o.updated_at,
    }))
    .sort((a: any, b: any) => b.bytes - a.bytes)
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
    top: topSorted.map((t: any) => ({ ...t, size_pretty: pretty(t.bytes) })),
  })
}
