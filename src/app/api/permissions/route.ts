import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { deriveRoleInfo } from '@/lib/roles'
import type { PermissionConfig, RoleKey, CategoryKey } from '@/types/permissions'

const CONFIG_PATH = path.join(process.cwd(), 'src/config/permissions.json')
const STORAGE_BUCKET = 'system-config'
const STORAGE_OBJECT = 'permissions.json'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
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

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function mergePermissionConfigs(base: PermissionConfig, override: PermissionConfig): PermissionConfig {
  const result = deepClone(base)

  for (const [roleKey, baseCategories] of Object.entries(result) as [RoleKey, PermissionConfig[RoleKey]][]) {
    const overrideCategories = override[roleKey] ?? {}

    for (const [categoryKey, baseEntries] of Object.entries(baseCategories) as [CategoryKey, typeof baseCategories[CategoryKey]][]) {
      const overrideEntries = overrideCategories[categoryKey] ?? []
      const mergedEntries = baseEntries.map((entry) => {
        const overrideEntry = overrideEntries.find((candidate) => candidate.key === entry.key)
        return overrideEntry ? { ...entry, allowed: overrideEntry.allowed } : entry
      })
      const extraEntries = overrideEntries.filter((entry) => !mergedEntries.some((merged) => merged.key === entry.key))
      result[roleKey][categoryKey] = [...mergedEntries, ...extraEntries]
    }

    for (const [categoryKey, entries] of Object.entries(overrideCategories) as [CategoryKey, typeof overrideCategories[CategoryKey]][]) {
      if (!result[roleKey][categoryKey]) {
        result[roleKey][categoryKey] = entries
      }
    }
  }

  for (const [roleKey, categories] of Object.entries(override) as [RoleKey, PermissionConfig[RoleKey]][]) {
    if (!result[roleKey]) {
      result[roleKey] = categories
    }
  }

  return result
}

async function loadBaseline(): Promise<PermissionConfig> {
  const data = await fs.readFile(CONFIG_PATH, 'utf8')
  return JSON.parse(data) as PermissionConfig
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

async function ensureSuperAdmin(request: Request):
  Promise<{ ok: true } | { response: NextResponse }> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { response: NextResponse.json({ error: 'Server not configured' }, { status: 500 }) }
  }
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const requester = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await requester.auth.getUser()
  if (error || !data?.user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const info = deriveRoleInfo(data.user)
  if (info.roleKey !== 'superadmin') {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true }
}

export async function GET() {
  const baseline = await loadBaseline()
  const stored = await loadFromStorage()
  if (stored) {
    const merged = mergePermissionConfigs(baseline, stored)
    return NextResponse.json(merged)
  }
  return NextResponse.json(baseline)
}

export async function POST(request: Request) {
  const authCheck = await ensureSuperAdmin(request)
  if ('response' in authCheck) return authCheck.response
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
