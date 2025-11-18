import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase configuration for password reset route.')
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function isValidEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)
}

async function userExists(email: string) {
  const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey as string,
      Authorization: `Bearer ${serviceRoleKey}`,
    } as HeadersInit,
    cache: 'no-store',
  })
  if (!resp.ok) return false
  const data = await resp.json()
  if (Array.isArray(data)) return data.length > 0
  if (data && Array.isArray(data.users)) return data.users.length > 0
  return false
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string }
    const email = (body.email || '').trim().toLowerCase()
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }

    const exists = await userExists(email)
    if (!exists) {
      return NextResponse.json({ error: 'Email not found.' }, { status: 404 })
    }

    const origin = headers().get('origin')
    const redirectTo =
      process.env.NEXT_PUBLIC_AUTH_RESET_URL || (origin ? `${origin}/auth/reset` : undefined)

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unable to process reset request.' },
      { status: 500 },
    )
  }
}
