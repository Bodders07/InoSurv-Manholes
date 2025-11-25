"use client"

import { useEffect, useState } from "react"
import type { PermissionConfig, RoleKey, CategoryKey } from "@/types/permissions"
import { supabase } from "@/lib/supabaseClient"
import { usePermissions } from "@/app/components/PermissionsContext"

const ROLE_TABS: { id: RoleKey; label: string; description: string }[] = [
  { id: 'viewer', label: 'Viewer', description: 'Read-only access to records' },
  { id: 'editor', label: 'Editor', description: 'Create and edit day-to-day records' },
  { id: 'editorPlus', label: 'Editor+', description: 'Editor capabilities with enhanced options' },
  { id: 'admin', label: 'Admin', description: 'Manage projects & manholes plus admin pages' },
  { id: 'superadmin', label: 'Super Admin', description: 'Full platform access' },
]

const CATEGORY_ORDER: { id: CategoryKey; title: string }[] = [
  { id: 'general', title: 'General Experience' },
  { id: 'manholes', title: 'Manholes' },
  { id: 'projects', title: 'Projects' },
  { id: 'media', title: 'Photos & Sketches' },
  { id: 'exports', title: 'Exports & Documents' },
  { id: 'map', title: 'Map Tools' },
  { id: 'adminTools', title: 'Admin Controls' },
]

export default function PrivilegesContent() {
  const [activeRole, setActiveRole] = useState<RoleKey>('viewer')
  const [permissions, setPermissions] = useState<PermissionConfig | null>(null)
  const [draft, setDraft] = useState<PermissionConfig | null>(null)
  const [editable, setEditable] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { has } = usePermissions()
  const canModify = has('manage-permissions')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/permissions', { cache: 'no-store' })
        const data = (await res.json()) as PermissionConfig
        setPermissions(data)
        setDraft(data)
      } catch {
        setStatus('Failed to load permissions. Please refresh.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const currentRolePermissions = (editable ? draft : permissions)?.[activeRole]

  const togglePermission = (category: CategoryKey, key: string) => {
    if (!editable || !draft) return
    setDraft((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      const target = next[activeRole][category]?.find((perm) => perm.key === key)
      if (target) target.allowed = !target.allowed
      return next
    })
  }

  const startEdit = () => {
    if (!canModify) {
      setStatus('You do not have permission to edit privileges.')
      return
    }
    if (!permissions) return
    setDraft(structuredClone(permissions))
    setEditable(true)
    setStatus('')
  }

  const cancelEdit = () => {
    setDraft(permissions)
    setEditable(false)
    setStatus('')
  }

  const saveChanges = async () => {
    if (!draft) return
    if (!canModify) {
      setStatus('You do not have permission to edit privileges.')
      return
    }
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      setStatus('Missing auth session. Please sign in again.')
      return
    }
    setSaving(true)
    setStatus('')
    try {
      const res = await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ permissions: draft }),
      })
      if (!res.ok) throw new Error('Failed to save permissions')
      setPermissions(draft)
      setEditable(false)
      setStatus('Permissions updated successfully.')
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('permissions-updated'))
        }
      } catch {}
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save permissions.')
    } finally {
      setSaving(false)
    }
  }

  const activeDescription = ROLE_TABS.find((r) => r.id === activeRole)?.description

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-500">Privilege Overview</p>
            <h1 className="text-2xl font-bold text-gray-900">Edit permissions for each role</h1>
            <p className="text-sm text-gray-600 mt-1">Select a role to see what actions it can take inside the workspace.</p>
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
        {activeDescription && <p className="mt-4 text-sm text-gray-600">{activeDescription}</p>}
        <div className="mt-4 flex gap-2">
          {canModify && editable ? (
            <>
              <button
                className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                onClick={saveChanges}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          ) : canModify ? (
            <button
              className="px-3 py-1.5 rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60"
              onClick={startEdit}
              disabled={loading || !permissions}
            >
              Edit Permissions
            </button>
          ) : null}
          {!canModify && (
            <p className="text-sm text-red-600 mt-2">
              You do not have permission to modify roles. Contact a super admin if changes are required.
            </p>
          )}
        </div>
      </div>

      {status && <p className="text-sm text-gray-600">{status}</p>}

      {loading || !currentRolePermissions ? (
        <div className="text-gray-500">Loading permissions…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {CATEGORY_ORDER.map((category) => (
            <section key={category.id} className="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{category.title}</h3>
              </div>
              <ul className="divide-y divide-gray-100">
                {(currentRolePermissions[category.id] || []).map((item) => (
                  <li key={item.key} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-gray-700">{item.label}</span>
                    {editable ? (
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={item.allowed}
                          onChange={() => togglePermission(category.id, item.key)}
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
      )}

      <p className="text-sm text-gray-600">
        Changes here are stored in <code>src/config/permissions.json</code>. Effective permissions also depend on Supabase Row Level Security (RLS) policies.
      </p>
    </div>
  )
}
