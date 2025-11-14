import type { User } from '@supabase/supabase-js'

export type RoleInfo = {
  email: string
  role: string
  roles: string[]
  isAdmin: boolean
  isSuperAdmin: boolean
}

const ADMIN_SET = new Set(['admin', 'owner', 'superadmin', 'root'])

export function deriveRoleInfo(user: User | null | undefined): RoleInfo {
  const email = String(user?.email || '').toLowerCase()
  const meta = (user?.app_metadata as Record<string, unknown>) || {}
  const role = String(meta.role ?? '').toLowerCase()
  const roles = Array.isArray(meta.roles)
    ? meta.roles.map((value) => String(value).toLowerCase())
    : []
  const isFlag = Boolean(meta.is_admin)

  // Admin detection: any admin-like role or explicit flag
  const roleIsAdmin = ADMIN_SET.has(role) || role.includes('admin')
  const rolesHasAdmin = roles.some((r) => ADMIN_SET.has(r) || r.includes('admin'))
  const isAdmin = isFlag || roleIsAdmin || rolesHasAdmin

  // Superadmin detection: exact membership in roles or role
  const isSuperAdmin = role === 'superadmin' || roles.includes('superadmin')

  return { email, role, roles, isAdmin, isSuperAdmin }
}

export function canManageEverything(info: RoleInfo): boolean {
  return info.isSuperAdmin
}

export function canAdminister(info: RoleInfo): boolean {
  return info.isAdmin || info.isSuperAdmin
}
