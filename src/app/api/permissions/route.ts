import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import type { PermissionConfig } from '@/types/permissions'

const CONFIG_PATH = path.join(process.cwd(), 'src/config/permissions.json')
const STORAGE_BUCKET = 'system-config'
const STORAGE_OBJECT = 'permissions.json'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

async function ensureBucket() {
  if (!supabaseAdmin) return
  const { data } = await supabaseAdmin.storage.getBucket(STORAGE_BUCKET)
  if (data) return
  await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, { public: false })
}

async function loadFromStorage(): Promise<PermissionConfig | null> {
  if (!supabaseAdmin) return null
  await ensureBucket()
  const { data, error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download(STORAGE_OBJECT)
  if (error || !data) return null
  const text = await data.text()
  return JSON.parse(text) as PermissionConfig
}

async function saveToStorage(json: PermissionConfig) {
  if (!supabaseAdmin) throw new Error('Missing Supabase admin configuration')
  await ensureBucket()
  const buffer = Buffer.from(JSON.stringify(json, null, 2), 'utf8')
  const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(STORAGE_OBJECT, buffer, {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) throw error
}

export async function GET() {
  const stored = await loadFromStorage()
  if (stored) return NextResponse.json(stored)
  const data = await fs.readFile(CONFIG_PATH, 'utf8')
  const json = JSON.parse(data) as PermissionConfig
  return NextResponse.json(json)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { permissions: PermissionConfig }
    if (!body || !body.permissions) {
      return NextResponse.json({ error: 'Missing permissions payload' }, { status: 400 })
    }
    await saveToStorage(body.permissions)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 })
  }
}
