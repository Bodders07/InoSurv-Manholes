'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { deriveRoleInfo } from '@/lib/roles'
import { usePermissions } from '@/app/components/PermissionsContext'

const ROLES = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
]

type UserRow = { id: string; email: string; role: string | null; name: string | null }
type UsersResponse = { users?: UserRow[]; error?: string }

export default function UsersContent() {
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  const [users, setUsers] = useState<UserRow[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null)
  const [nameSavingId, setNameSavingId] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [nameEdits, setNameEdits] = useState<Record<string, string>>({})

  const [showAuthDebug, setShowAuthDebug] = useState(false)
  const [dbgEmail, setDbgEmail] = useState('')
  const [dbgRole, setDbgRole] = useState('')
  const [dbgRoles, setDbgRoles] = useState<string[]>([])
  const [dbgIsSuper, setDbgIsSuper] = useState(false)
  const [dbgIsAdmin, setDbgIsAdmin] = useState(false)

  const { has } = usePermissions()
  const canInviteUsers = has('invite-users')
  const canChangeRoles = has('change-roles')
  const canViewAdminPanels = has('view-admin-panels')

  const detectAccess = useCallback(async () => {
    const { data } = await supabase.auth.getUser()
    const info = deriveRoleInfo(data.user)
    const adminDetected = info.isAdmin
    const superDetected = info.isSuperAdmin
    setDbgEmail(info.email)
    setDbgRole(info.role)
    setDbgRoles(info.roles)
    setDbgIsAdmin(adminDetected)
    setDbgIsSuper(superDetected)
  }, [])

  const loadUsers = useCallback(async (tok?: string | null) => {
    setLoadingUsers(true)
    try {
      let authToken = tok
      if (!authToken) {
        const { data } = await supabase.auth.getSession()
        authToken = data.session?.access_token ?? null
      }
      if (!authToken) {
        setMessage('Please sign in to view users.')
        return
      }
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const payload = (await res.json()) as UsersResponse
      if (res.ok && payload.users) {
        const normalized = payload.users.map((u) => ({
          id: u.id,
          email: u.email,
          role: u.role ?? null,
          name: u.name ?? null,
        }))
        setUsers(normalized)
        setNameEdits(
          normalized.reduce<Record<string, string>>((acc, user) => {
            acc[user.id] = user.name || ''
            return acc
          }, {}),
        )
      } else {
        setMessage('Error: ' + (payload.error || 'Failed to load users'))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load users'
      setMessage('Error: ' + msg)
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession()
      const tok = data.session?.access_token || null
      setToken(tok)
      const { data: userData } = await supabase.auth.getUser()
      setCurrentUserId(userData.user?.id || null)
      await detectAccess()
      await loadUsers(tok)
    }
    init()
    const { data: listener } = supabase.auth.onAuthStateChange(async () => {
      const { data } = await supabase.auth.getSession()
      const tok = data.session?.access_token || null
      setToken(tok)
      await detectAccess()
      await loadUsers(tok)
    })
    return () => listener.subscription.unsubscribe()
  }, [detectAccess, loadUsers])

  useEffect(() => {
    if (token) {
      loadUsers(token)
    }
  }, [token, loadUsers])

  const canInvite = useMemo(() => !!email && !!inviteRole && !submitting && canInviteUsers && !!token, [email, inviteRole, submitting, canInviteUsers, token])

  async function inviteUser() {
    if (!canInvite) return
    if (!token) {
      setMessage('Error: Missing auth token.')
      return
    }
    setMessage('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, role: inviteRole }),
      })
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(payload.error || 'Failed to create user')
      setMessage('Success: Invitation sent')
      setEmail('')
      setInviteRole('viewer')
      await loadUsers(token)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed'
      setMessage('Error: ' + msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function updateUser(userId: string, payload: { role?: string; name?: string }) {
    if (!canChangeRoles) {
      setMessage('Error: You do not have permission to modify users.')
      return
    }
    if (!token) {
      setMessage('Error: Missing auth token.')
      return
    }
    setMessage('')
    if (payload.role) setSavingRoleId(userId)
    if (payload.name !== undefined) setNameSavingId(userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, ...payload }),
      })
      const result = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(result.error || 'Failed to update user')
      setMessage('Success: User updated')
      await loadUsers(token)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update user'
      setMessage('Error: ' + msg)
    } finally {
      if (payload.role) setSavingRoleId(null)
      if (payload.name !== undefined) setNameSavingId(null)
    }
  }

  const saveUserRole = (userId: string, newRole: string) => updateUser(userId, { role: newRole })

  const saveUserName = (userId: string) => {
    const next = (nameEdits[userId] || '').trim()
    if (!next) {
      setMessage('Error: Name cannot be empty.')
      return
    }
    updateUser(userId, { name: next })
  }

  async function deleteUser(userId: string) {
    if (!canChangeRoles) {
      setMessage('Error: You do not have permission to delete users.')
      return
    }
    if (userId === currentUserId) {
      setMessage('Error: You cannot delete your own account.')
      return
    }
    const proceed = typeof window !== 'undefined' ? window.confirm('Delete this user? This cannot be undone.') : true
    if (!proceed) return
    if (!token) {
      setMessage('Error: Missing auth token.')
      return
    }
    setDeletingUserId(userId)
    setMessage('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      })
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(payload.error || 'Failed to delete user')
      setMessage('Success: User deleted')
      await loadUsers(token)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete user'
      setMessage('Error: ' + msg)
    } finally {
      setDeletingUserId(null)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">User Management</h1>
        {canViewAdminPanels && (
          <button
            className="text-xs underline text-blue-700 hover:text-blue-900"
            onClick={() => setShowAuthDebug((s) => !s)}
          >
            {showAuthDebug ? 'Hide auth debug' : 'Show auth debug'}
          </button>
        )}
      </div>
      {canViewAdminPanels && showAuthDebug && (
        <div className="mb-4 text-sm bg-gray-50 border border-gray-200 rounded p-3">
          <div><span className="font-medium">Email:</span> {dbgEmail || '-'}</div>
          <div><span className="font-medium">app_metadata.role:</span> {dbgRole || '-'}</div>
          <div><span className="font-medium">app_metadata.roles:</span> {dbgRoles.length ? dbgRoles.join(', ') : '-'}</div>
          <div><span className="font-medium">Detected Admin:</span> {String(dbgIsAdmin)}</div>
          <div><span className="font-medium">Detected Super Admin:</span> {String(dbgIsSuper)}</div>
        </div>
      )}

      {!canViewAdminPanels ? (
        <p className="text-red-600">Access denied. Admin tools are disabled for this role.</p>
      ) : (
        <div className="space-y-8">
          <div className="max-w-lg bg-white border border-gray-200 rounded shadow-sm p-4">
            <h2 className="font-semibold mb-3">Invite New User</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border rounded p-2"
                  placeholder="new.user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select className="w-full border rounded p-2" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between pt-1">
                {message && (
                  <p className={`text-sm ${message.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>{message}</p>
                )}
                <button
                  onClick={inviteUser}
                  disabled={!canInvite}
                  className={`px-4 py-2 rounded text-white ${canInvite ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
                >
                  {submitting ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
              <p className="text-xs text-gray-600">Sends an invitation email. Role is stored in app_metadata to drive RLS and UI access.</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded shadow-sm">
            <div className="px-4 py-3 border-b"><h2 className="font-semibold">Existing Users</h2></div>
            <div className="overflow-x-auto">
              {loadingUsers ? (
                <p className="p-4">Loading...</p>
              ) : (
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-2 border-b">Email</th>
                      <th className="px-4 py-2 border-b">Name</th>
                      <th className="px-4 py-2 border-b">Role</th>
                      <th className="px-4 py-2 border-b w-px">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const current = (u.role || 'viewer').toLowerCase()
                      return (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 border-b">{u.email}</td>
                          <td className="px-4 py-2 border-b">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                className="border rounded p-2 w-full"
                                value={nameEdits[u.id] ?? ''}
                                onChange={(e) => setNameEdits((prev) => ({ ...prev, [u.id]: e.target.value }))}
                                placeholder="Full name"
                                disabled={!canChangeRoles}
                              />
                              {canChangeRoles && (
                                <button
                                  onClick={() => saveUserName(u.id)}
                                  disabled={
                                    nameSavingId === u.id ||
                                    (nameEdits[u.id] || '').trim() === (u.name || '')
                                  }
                                  className="px-3 py-1 rounded bg-blue-600 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                  {nameSavingId === u.id ? 'Saving...' : 'Save'}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 border-b">
                            <select
                              className="border rounded p-2"
                              value={current}
                              onChange={(e) => saveUserRole(u.id, e.target.value)}
                              disabled={!canChangeRoles || savingRoleId === u.id}
                            >
                              {ROLES.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2 border-b">
                            <div className="flex items-center gap-3">
                              {!canChangeRoles && <span className="text-xs text-gray-500">Permission required</span>}
                              {(savingRoleId === u.id || nameSavingId === u.id) && (
                                <span className="text-xs text-gray-500">Saving...</span>
                              )}
                              {canChangeRoles && (
                                <button
                                  onClick={() => deleteUser(u.id)}
                                  disabled={deletingUserId === u.id || u.id === currentUserId}
                                  className={`text-white px-3 py-1 rounded ${
                                    deletingUserId === u.id || u.id === currentUserId
                                      ? 'bg-gray-400 cursor-not-allowed'
                                      : 'bg-red-600 hover:bg-red-700'
                                  }`}
                                >
                                  {deletingUserId === u.id ? 'Deleting...' : u.id === currentUserId ? 'Cannot delete self' : 'Delete'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
