import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import type { PermissionConfig } from '@/types/permissions'

const CONFIG_PATH = path.join(process.cwd(), 'src/config/permissions.json')

export async function GET() {
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
    await fs.writeFile(CONFIG_PATH, JSON.stringify(body.permissions, null, 2), 'utf8')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 })
  }
}
