'use client'

import { useState } from 'react'

const ROLE_TABS: { id: RoleKey; label: string; description: string }[] = [
  { id: 'viewer', label: 'Viewer', description: 'Read-only access to records' },
  { id: 'editor', label: 'Editor', description: 'Create and edit day-to-day records' },
  { id: 'admin', label: 'Admin', description: 'Manage projects & manholes plus admin pages' },
  { id: 'superadmin', label: 'Super Admin', description: 'Full platform access' },
]

type RoleKey = 'viewer' | 'editor' | 'admin' | 'superadmin'

type CategoryKey = 'general' | 'manholes' | 'projects' | 'adminTools' | 'exports'

const CATEGORY_ORDER: { id: CategoryKey; title: string }[] = [
  { id: 'general', title: 'General Access' },
  { id: 'manholes', title: 'Manholes' },
  { id: 'projects', title: 'Projects' },
  { id: 'adminTools', title: 'Admin Tools' },
  { id: 'exports', title: 'Exports & Files' },
]

type PermissionEntry = { label: string; allowed: boolean }

const PERMISSIONS: Record<RoleKey, Record<CategoryKey, PermissionEntry[]>> = {
  viewer: {
    general: [
      { label: 'Access dashboard and lists', allowed: true },
      { label: 'Use filters & search', allowed: true },
      { label: 'Download existing exports', allowed: true },
    ],
    manholes: [
      { label: 'View manholes', allowed: true },
      { label: 'Create / edit manholes', allowed: false },
      { label: 'Delete manholes', allowed: false },
    ],
    projects: [
      { label: 'View projects', allowed: true },
      { label: 'Create / edit projects', allowed: false },
      { label: 'Archive or delete projects', allowed: false },
    ],
    adminTools: [
      { label: 'Open admin panels', allowed: false },
      { label: 'Invite users', allowed: false },
      { label: 'Change user roles', allowed: false },
    ],
    exports: [
      { label: 'Generate PDF/CSV exports', allowed: false },
      { label: 'Upload photos & sketches', allowed: false },
    ],
  },
  editor: {
    general: [
      { label: 'Access dashboard and lists', allowed: true },
      { label: 'Use filters & search', allowed: true },
      { label: 'Download existing exports', allowed: true },
    ],
    manholes: [
      { label: 'View manholes', allowed: true },
      { label: 'Create / edit manholes', allowed: true },
      { label: 'Delete manholes', allowed: false },
    ],
    projects: [
      { label: 'View projects', allowed: true },
      { label: 'Create / edit projects', allowed: true },
      { label: 'Archive or delete projects', allowed: false },
    ],
    adminTools: [
      { label: 'Open admin panels', allowed: false },
      { label: 'Invite users', allowed: false },
      { label: 'Change user roles', allowed: false },
    ],
    exports: [
      { label: 'Generate PDF/CSV exports', allowed: true },
      { label: 'Upload photos & sketches', allowed: true },
    ],
  },
  admin: {
    general: [
      { label: 'Access dashboard and lists', allowed: true },
      { label: 'Use filters & search', allowed: true },
      { label: 'Download existing exports', allowed: true },
    ],
    manholes: [
      { label: 'View manholes', allowed: true },
      { label: 'Create / edit manholes', allowed: true },
      { label: 'Delete manholes', allowed: true },
    ],
    projects: [
      { label: 'View projects', allowed: true },
      { label: 'Create / edit projects', allowed: true },
      { label: 'Archive or delete projects', allowed: true },
    ],
    adminTools: [
      { label: 'Open admin panels (storage, privileges, etc.)', allowed: true },
      { label: 'Invite users', allowed: true },
      { label: 'Change user roles', allowed: false },
    ],
    exports: [
      { label: 'Generate PDF/CSV exports', allowed: true },
      { label: 'Upload photos & sketches', allowed: true },
    ],
  },
  superadmin: {
    general: [
      { label: 'Access dashboard and lists', allowed: true },
      { label: 'Use filters & search', allowed: true },
      { label: 'Download existing exports', allowed: true },
    ],
    manholes: [
      { label: 'View manholes', allowed: true },
      { label: 'Create / edit manholes', allowed: true },
      { label: 'Delete manholes', allowed: true },
    ],
    projects: [
      { label: 'View projects', allowed: true },
      { label: 'Create / edit projects', allowed: true },
      { label: 'Archive or delete projects', allowed: true },
    ],
    adminTools: [
      { label: 'Open admin panels (storage, privileges, etc.)', allowed: true },
      { label: 'Invite users', allowed: true },
      { label: 'Change user roles', allowed: true },
    ],
    exports: [
      { label: 'Generate PDF/CSV exports', allowed: true },
      { label: 'Upload photos & sketches', allowed: true },
    ],
  },
}

export default function PrivilegesContent() {
  const [activeRole, setActiveRole] = useState<RoleKey>('viewer')
  const activePermissions = PERMISSIONS[activeRole]

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
              {(activePermissions[category.id] || []).map((item) => (
                <li key={item.label} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-gray-700">{item.label}</span>
                  <span className={`font-semibold ${item.allowed ? 'text-emerald-600' : 'text-red-500'}`}>
                    {item.allowed ? '✓' : '✕'}
                  </span>
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
