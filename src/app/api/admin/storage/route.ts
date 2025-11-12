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

  // Total usage
  const storageDb: any = (supa as any).schema ? (supa as any).schema('storage') : supa
  const total = await storageDb
    .from('objects')
    .select('metadata, id', { count: 'exact' })
    .eq('bucket_id', bucket)
    .eq('is_uploaded', true)

  if (total.error) return NextResponse.json({ error: total.error.message }, { status: 500 })

  const usedBytes = (total.data || []).reduce((sum: number, o: any) => sum + (parseInt(o?.metadata?.size ?? '0', 10) || 0), 0)
  const objectCount = total.count ?? (total.data?.length ?? 0)

  // Top 20 largest
  const top = await storageDb
    .from('objects')
    .select('name, metadata, updated_at')
    .eq('bucket_id', bucket)
    .eq('is_uploaded', true)
    .limit(1000) // fetch many, sort client side; service role ignores RLS

  if (top.error) return NextResponse.json({ error: top.error.message }, { status: 500 })

  const topSorted = (top.data || [])
    .map((o: any) => ({
      name: o.name,
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
    top: topSorted.map(t => ({ ...t, size_pretty: pretty(t.bytes) })),
  })
}
