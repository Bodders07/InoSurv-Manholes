import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Ensure server-only env access (service role) and no edge runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ADMIN_ROLES = ['admin', 'owner', 'superadmin', 'root'] as const
const ROLE_SET = ['superadmin', 'admin', 'editor', 'viewer'] as const
type Role = typeof ROLE_SET[number]

function normalizeRole(input: string): Role | null {
  const v = (input || '').toString().trim().toLowerCase().replace(/\s+/g, '')
  if (v === 'superadmin' || v === 'super' || v === 'superadministrator') return 'superadmin'
  if (v === 'admin' || v === 'administrator') return 'admin'
  if (v === 'editor') return 'editor'
  if (v === 'viewer' || v === 'read' || v === 'readonly') return 'viewer'
  return null
}

async function getClients(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  if (!supabaseUrl || !anonKey || !serviceKey) {
    const details = {
      missing_NEXT_PUBLIC_SUPABASE_URL: !supabaseUrl,
      missing_NEXT_PUBLIC_SUPABASE_ANON_KEY: !anonKey,
      missing_SUPABASE_SERVICE_ROLE_KEY: !serviceKey,
    }
    return { error: `Server not configured: ${JSON.stringify(details)}` , requester: null as any, admin: null as any }
  }
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  if (!token) return { error: 'Missing auth token', requester: null as any, admin: null as any }

  const requester = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { requester, admin, error: null }
}

async function getRequesterRole(req: NextRequest) {
  const { requester, admin, error } = await getClients(req)
  if (error) return { error, isAdmin: false, isSuperAdmin: false, requester: null as any, admin: null as any, user: null as any }
  const { data: userData, error: userErr } = await requester.auth.getUser()
  if (userErr || !userData?.user) return { error: 'Invalid user', isAdmin: false, isSuperAdmin: false, requester, admin, user: null as any }
  const user: any = userData.user
  const meta = user?.app_metadata || {}
  const role = (meta.role || '').toString().toLowerCase()
  const roles = Array.isArray(meta.roles) ? meta.roles.map((r: any) => String(r).toLowerCase()) : []
  const isFlag = !!meta.is_admin
  const isAdmin =
    isFlag || ADMIN_ROLES.includes(role as any) || roles.some((r: string) => ADMIN_ROLES.includes(r as any) || r.includes('admin')) || role.includes('admin')
  const isSuperAdmin = role === 'superadmin' || roles.includes('superadmin')
  return { error: null, isAdmin, isSuperAdmin, requester, admin, user }
}

export async function POST(req: NextRequest) {
  try {
    const { error, isAdmin, admin } = await getRequesterRole(req)
    if (error) return NextResponse.json({ error }, { status: 500 })
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const email = String(body?.email || '').trim().toLowerCase()
    const desiredRole = normalizeRole(String(body?.role || 'viewer')) || 'viewer'
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
    if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    // Determine the redirect URL for the invite link
    // Build redirect URL and tag the flow as an invite so the UI can tailor copy
    let inviteRedirectTo =
      process.env.INVITE_REDIRECT_URL ||
      process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL ||
      undefined

    try {
      if (inviteRedirectTo) {
        const u = new URL(inviteRedirectTo)
        u.searchParams.set('from', 'invite')
        inviteRedirectTo = u.toString()
      }
    } catch (_) {
      // ignore malformed URL; fall back to provided value
    }

    // Invite the user by email (sends email if SMTP configured)
    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: inviteRedirectTo,
    })
    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 400 })
    }

    const invited = inviteData.user
    if (invited?.id) {
      // Set app_metadata.role so UI + RLS can pick it up
      await admin.auth.admin.updateUserById(invited.id, {
        app_metadata: { role: desiredRole, roles: [desiredRole] },
      })
    }

    return NextResponse.json({ ok: true, userId: invited?.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { error, isAdmin, admin } = await getRequesterRole(req)
    if (error) return NextResponse.json({ error }, { status: 500 })
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    const { data, error: listErr } = await admin.auth.admin.listUsers()
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 400 })
    const users = (data?.users || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      role: u.app_metadata?.role || null,
      roles: u.app_metadata?.roles || [],
    }))
    return NextResponse.json({ users })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { error, isSuperAdmin, admin } = await getRequesterRole(req)
    if (error) return NextResponse.json({ error }, { status: 500 })
    if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

    const body = await req.json()
    const userId = String(body?.userId || '')
    const desired = normalizeRole(String(body?.role || ''))
    if (!userId || !desired) return NextResponse.json({ error: 'userId and valid role required' }, { status: 400 })

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { role: desired, roles: [desired] },
    })
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { error, isSuperAdmin, admin, user } = await getRequesterRole(req)
    if (error) return NextResponse.json({ error }, { status: 500 })
    if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

    const body = await req.json().catch(() => ({}))
    const userId = String(body?.userId || '')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    // Safety: disallow deleting yourself
    if (userId === user?.id) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
