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
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1,
    email,
  })
  if (error) return false
  const list = data?.users || []
  return list.some((user) => (user.email || '').toLowerCase() === email.toLowerCase())
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

    const originHeader = await headers()
    const origin = originHeader.get('origin')
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
