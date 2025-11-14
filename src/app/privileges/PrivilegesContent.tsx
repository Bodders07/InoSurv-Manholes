'use client'

import { useState } from 'react'

const ROLE_TABS: { id: RoleKey; label: string; description: string }[] = [
  { id: 'viewer', label: 'Viewer', description: 'Read-only access to records' },
  { id: 'editor', label: 'Editor', description: 'Create and edit day-to-day records' },
  { id: 'admin', label: 'Admin', description: 'Manage projects & manholes plus admin pages' },
  { id: 'superadmin', label: 'Super Admin', description: 'Full platform access' },
]

type RoleKey = 'viewer' | 'editor' | 'admin' | 'superadmin'

type CategoryKey = 'general' | 'manholes' | 'projects' | 'media' | 'exports' | 'adminTools'

const CATEGORY_ORDER: { id: CategoryKey; title: string }[] = [
  { id: 'general', title: 'General Experience' },
  { id: 'manholes', title: 'Manholes' },
  { id: 'projects', title: 'Projects' },
  { id: 'media', title: 'Photos & Sketches' },
  { id: 'exports', title: 'Exports & Documents' },
  { id: 'adminTools', title: 'Admin Controls' },
]

type PermissionEntry = { label: string; key: string; allowed: boolean }

const DEFAULT_PERMISSIONS: Record<RoleKey, Record<CategoryKey, PermissionEntry[]>> = {
  viewer: {
    general: [
      { key: 'view-dashboard', label: 'View dashboard & lists', allowed: true },
      { key: 'search', label: 'Use search & filters', allowed: true },
      { key: 'view-activity', label: 'View activity feed', allowed: true },
      { key: 'edit-settings', label: 'Change site settings', allowed: false },
    ],
    manholes: [
      { key: 'manhole-view', label: 'View manholes', allowed: true },
      { key: 'manhole-create', label: 'Create manholes', allowed: false },
      { key: 'manhole-edit', label: 'Edit manholes', allowed: false },
      { key: 'manhole-delete', label: 'Delete manholes', allowed: false },
    ],
    projects: [
      { key: 'project-view', label: 'View projects', allowed: true },
      { key: 'project-create', label: 'Create projects', allowed: false },
      { key: 'project-edit', label: 'Edit projects', allowed: false },
      { key: 'project-delete', label: 'Archive/Delete projects', allowed: false },
    ],
    media: [
      { key: 'upload-photo', label: 'Upload photos', allowed: false },
      { key: 'edit-sketch', label: 'Edit chamber sketch', allowed: false },
      { key: 'delete-media', label: 'Delete photos/sketches', allowed: false },
    ],
    adminTools: [
      { key: 'view-admin-panels', label: 'View admin panels', allowed: false },
      { key: 'invite-users', label: 'Invite users', allowed: false },
      { key: 'change-roles', label: 'Change user roles', allowed: false },
      { key: 'view-storage', label: 'View storage usage', allowed: false },
    ],
    exports: [
      { key: 'export-pdf', label: 'Generate PDF exports', allowed: false },
      { key: 'export-csv', label: 'Export CSV/Sheets', allowed: false },
      { key: 'download-files', label: 'Download attachments', allowed: true },
    ],
  },
  editor: {
    general: [
      { key: 'view-dashboard', label: 'View dashboard & lists', allowed: true },
      { key: 'search', label: 'Use search & filters', allowed: true },
      { key: 'view-activity', label: 'View activity feed', allowed: true },
      { key: 'edit-settings', label: 'Change site settings', allowed: false },
    ],
    manholes: [
      { key: 'manhole-view', label: 'View manholes', allowed: true },
      { key: 'manhole-create', label: 'Create manholes', allowed: true },
      { key: 'manhole-edit', label: 'Edit manholes', allowed: true },
      { key: 'manhole-delete', label: 'Delete manholes', allowed: false },
    ],
    projects: [
      { key: 'project-view', label: 'View projects', allowed: true },
      { key: 'project-create', label: 'Create projects', allowed: true },
      { key: 'project-edit', label: 'Edit projects', allowed: true },
      { key: 'project-delete', label: 'Archive/Delete projects', allowed: false },
    ],
    media: [
      { key: 'upload-photo', label: 'Upload photos', allowed: true },
      { key: 'edit-sketch', label: 'Edit chamber sketch', allowed: true },
      { key: 'delete-media', label: 'Delete photos/sketches', allowed: false },
    ],
    adminTools: [
      { key: 'view-admin-panels', label: 'View admin panels', allowed: false },
      { key: 'invite-users', label: 'Invite users', allowed: false },
      { key: 'change-roles', label: 'Change user roles', allowed: false },
      { key: 'view-storage', label: 'View storage usage', allowed: false },
    ],
    exports: [
      { key: 'export-pdf', label: 'Generate PDF exports', allowed: true },
      { key: 'export-csv', label: 'Export CSV/Sheets', allowed: true },
      { key: 'download-files', label: 'Download attachments', allowed: true },
    ],
  },
  admin: {
    general: [
      { key: 'view-dashboard', label: 'View dashboard & lists', allowed: true },
      { key: 'search', label: 'Use search & filters', allowed: true },
      { key: 'view-activity', label: 'View activity feed', allowed: true },
      { key: 'edit-settings', label: 'Change site settings', allowed: true },
    ],
    manholes: [
      { key: 'manhole-view', label: 'View manholes', allowed: true },
      { key: 'manhole-create', label: 'Create manholes', allowed: true },
      { key: 'manhole-edit', label: 'Edit manholes', allowed: true },
      { key: 'manhole-delete', label: 'Delete manholes', allowed: true },
    ],
    projects: [
      { key: 'project-view', label: 'View projects', allowed: true },
      { key: 'project-create', label: 'Create projects', allowed: true },
      { key: 'project-edit', label: 'Edit projects', allowed: true },
      { key: 'project-delete', label: 'Archive/Delete projects', allowed: true },
    ],
    media: [
      { key: 'upload-photo', label: 'Upload photos', allowed: true },
      { key: 'edit-sketch', label: 'Edit chamber sketch', allowed: true },
      { key: 'delete-media', label: 'Delete photos/sketches', allowed: true },
    ],
    adminTools: [
      { key: 'view-admin-panels', label: 'View admin panels', allowed: true },
      { key: 'invite-users', label: 'Invite users', allowed: true },
      { key: 'change-roles', label: 'Change user roles', allowed: false },
      { key: 'view-storage', label: 'View storage usage', allowed: true },
    ],
    exports: [
      { key: 'export-pdf', label: 'Generate PDF exports', allowed: true },
      { key: 'export-csv', label: 'Export CSV/Sheets', allowed: true },
      { key: 'download-files', label: 'Download attachments', allowed: true },
    ],
  },
  superadmin: {
    general: [
      { key: 'view-dashboard', label: 'View dashboard & lists', allowed: true },
      { key: 'search', label: 'Use search & filters', allowed: true },
      { key: 'view-activity', label: 'View activity feed', allowed: true },
      { key: 'edit-settings', label: 'Change site settings', allowed: true },
    ],
    manholes: [
      { key: 'manhole-view', label: 'View manholes', allowed: true },
      { key: 'manhole-create', label: 'Create manholes', allowed: true },
      { key: 'manhole-edit', label: 'Edit manholes', allowed: true },
      { key: 'manhole-delete', label: 'Delete manholes', allowed: true },
    ],
    projects: [
      { key: 'project-view', label: 'View projects', allowed: true },
      { key: 'project-create', label: 'Create projects', allowed: true },
      { key: 'project-edit', label: 'Edit projects', allowed: true },
      { key: 'project-delete', label: 'Archive/Delete projects', allowed: true },
    ],
    media: [
      { key: 'upload-photo', label: 'Upload photos', allowed: true },
      { key: 'edit-sketch', label: 'Edit chamber sketch', allowed: true },
      { key: 'delete-media', label: 'Delete photos/sketches', allowed: true },
    ],
    adminTools: [
      { key: 'view-admin-panels', label: 'View admin panels', allowed: true },
      { key: 'invite-users', label: 'Invite users', allowed: true },
      { key: 'change-roles', label: 'Change user roles', allowed: true },
      { key: 'view-storage', label: 'View storage usage', allowed: true },
    ],
    exports: [
      { key: 'export-pdf', label: 'Generate PDF exports', allowed: true },
      { key: 'export-csv', label: 'Export CSV/Sheets', allowed: true },
      { key: 'download-files', label: 'Download attachments', allowed: true },
    ],
  },
}

export default function PrivilegesContent() {
  const [activeRole, setActiveRole] = useState<RoleKey>('viewer')
  const [editable, setEditable] = useState(false)
  const [pendingPermissions, setPendingPermissions] = useState(DEFAULT_PERMISSIONS)
  const canEdit = true // allow toggling for all

  const rolePermissions = pendingPermissions[activeRole]

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-500">Privilege Overview</p>
            <h1 className="text-2xl font-bold text-gray-900">View permissions by role</h1>
            <p className="text-sm text-gray-600 mt-1">Select a role to see exactly what actions it can perform inside the Inspector workspace.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-wrap gap-2">
              {ROLE_TABS.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setActiveRole(role.id)}
                  className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${
                    activeRole === role.id ? 'bg-orange-100 border-orange-300 text-orange-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {role.label}
                </button>
              ))}
            </div>
            {canEdit && (
              <div className="flex gap-2">
                {editable && (
                  <button
                    className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                    onClick={() => {
                      setPendingPermissions(DEFAULT_PERMISSIONS)
                      setEditable(false)
                    }}
                  >
                    Cancel
                  </button>
                )}
                <button
                  className={`px-3 py-1.5 rounded ${
                    editable ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-orange-500 text-white hover:bg-orange-600'
                  }`}
                  onClick={() => setEditable((prev) => !prev)}
                >
                  {editable ? 'Save Changes' : 'Edit Permissions'}
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-600">{ROLE_TABS.find((r) => r.id === activeRole)?.description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {CATEGORY_ORDER.map((category) => (
          <section key={category.id} className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{category.title}</h3>
            </div>
            <ul className="divide-y divide-gray-100">
              {(rolePermissions[category.id] || []).map((item) => (
                <li key={item.key} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-gray-700">{item.label}</span>
                  {editable ? (
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={item.allowed}
                        onChange={() =>
                          setPendingPermissions((prev) => {
                            const next = structuredClone(prev)
                            const target = next[activeRole][category.id]?.find((perm) => perm.key === item.key)
                            if (target) target.allowed = !target.allowed
                            return next
                          })
                        }
                      />
                      <div className="w-10 h-5 bg-gray-300 peer-checked:bg-green-500 rounded-full transition relative">
                        <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition peer-checked:translate-x-5" />
                      </div>
                    </label>
                  ) : (
                    <span className={`font-semibold ${item.allowed ? 'text-emerald-600' : 'text-red-500'}`}>
                      {item.allowed ? '✓' : '✕'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-sm text-gray-600">
        Note: Effective permissions also depend on Supabase Row Level Security (RLS) policies. If an action is blocked,
        ensure the corresponding database policy allows your role to perform it.
      </p>
    </div>
  )
}
