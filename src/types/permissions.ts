export type RoleKey = 'viewer' | 'editor' | 'admin' | 'superadmin'
export type CategoryKey = 'general' | 'manholes' | 'projects' | 'media' | 'exports' | 'adminTools' | 'map'
export type PermissionEntry = {
  key: string
  label: string
  allowed: boolean
}
export type PermissionCategory = Record<CategoryKey, PermissionEntry[]>
export type PermissionConfig = Record<RoleKey, PermissionCategory>
