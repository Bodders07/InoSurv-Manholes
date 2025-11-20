import type { User } from '@supabase/supabase-js'
import type { RoleKey } from '@/types/permissions'

export type RoleInfo = {
  email: string
  role: string
  roles: string[]
  isAdmin: boolean
  isSuperAdmin: boolean
  roleKey: RoleKey
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

  const matchesEditorPlus = (value: string) =>
    value.includes('editorplus') || value.includes('editor+') || value.includes('editor_plus') || value.includes('editor-plus')

  let roleKey: RoleKey = 'viewer'
  if (isSuperAdmin) roleKey = 'superadmin'
  else if (isAdmin) roleKey = 'admin'
  else if (matchesEditorPlus(role) || roles.some((r) => matchesEditorPlus(r))) roleKey = 'editorPlus'
  else if (role.includes('editor') || roles.includes('editor')) roleKey = 'editor'

  return { email, role, roles, isAdmin, isSuperAdmin, roleKey }
}

export function canManageEverything(info: RoleInfo): boolean {
  return info.isSuperAdmin
}

export function canAdminister(info: RoleInfo): boolean {
  return info.isAdmin || info.isSuperAdmin
}
