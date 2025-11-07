'use client'

import { useEffect, useMemo, useState } from 'react'
import SidebarLayout from '@/app/components/SidebarLayout'
import { supabase } from '@/lib/supabaseClient'
import { deriveRoleInfo, canAdminister, canManageEverything } from '@/lib/roles'

const ROLES = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
]

export default function AdminUsersPage() {
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  const [users, setUsers] = useState<{ id: string; email: string; role: string | null }[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [isAdmin, setIsAdmin] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  // Debug state (visible only to Super Admin)
  const [showAuthDebug, setShowAuthDebug] = useState(false)
  const [dbgEmail, setDbgEmail] = useState('')
  const [dbgRole, setDbgRole] = useState('')
  const [dbgRoles, setDbgRoles] = useState<string[]>([])
  const [dbgIsSuper, setDbgIsSuper] = useState(false)
  const [dbgIsAdmin, setDbgIsAdmin] = useState(false)

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
  }, [])

  async function detectAccess() {
    const { data } = await supabase.auth.getUser()
    const info = deriveRoleInfo(data.user)
    const adminDetected = canAdminister(info)
    const superDetected = canManageEverything(info)
    setIsAdmin(adminDetected)
    setIsSuperAdmin(superDetected)
    // Populate debug values for superadmins
    setDbgEmail(info.email)
    setDbgRole(info.role)
    setDbgRoles(info.roles)
    setDbgIsAdmin(adminDetected)
    setDbgIsSuper(superDetected)
  }

  async function loadUsers(tok?: string | null) {
    setLoadingUsers(true)
    try {
      const t = tok ?? token ?? (await supabase.auth.getSession()).data.session?.access_token
      if (!t) {
        setMessage('Please sign in to view users.')
        return
      }
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${t}` },
      })
      const payload = await res.json()
      if (res.ok) {
        setUsers(
          (payload.users || []).map((u: any) => ({ id: u.id, email: u.email, role: u.role || null }))
        )
      } else {
        setMessage('Error: ' + (payload.error || 'Failed to load users'))
      }
    } catch (e: any) {
      setMessage('Error: ' + (e?.message || 'Failed to load users'))
    } finally {
      setLoadingUsers(false)
    }
  }

  // If token becomes available later, refresh list automatically
  useEffect(() => {
    if (token) {
      loadUsers(token)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const canInvite = useMemo(() => !!email && !!inviteRole && !submitting && isAdmin && !!token, [email, inviteRole, submitting, isAdmin, token])

  async function inviteUser() {
    if (!canInvite) return
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
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to create user')
      setMessage('Success: Invitation sent')
      setEmail('')
      setInviteRole('viewer')
      await loadUsers()
    } catch (e: any) {
      setMessage('Error: ' + (e?.message || 'Failed'))
    } finally {
      setSubmitting(false)
    }
  }

  async function saveUserRole(userId: string, newRole: string) {
    if (!isSuperAdmin) {
      setMessage('Error: Only Super Admin can change roles.')
      return
    }
    setSavingRoleId(userId)
    setMessage('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, role: newRole }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to update role')
      setMessage('Success: Role updated')
      await loadUsers()
    } catch (e: any) {
      setMessage('Error: ' + (e?.message || 'Failed to update role'))
    } finally {
      setSavingRoleId(null)
    }
  }

  async function deleteUser(userId: string) {
    if (!isSuperAdmin) {
      setMessage('Error: Only Super Admin can delete users.')
      return
    }
    if (userId === currentUserId) {
      setMessage('Error: You cannot delete your own account.')
      return
    }
    const proceed = typeof window !== 'undefined' ? window.confirm('Delete this user? This cannot be undone.') : true
    if (!proceed) return
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
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to delete user')
      setMessage('Success: User deleted')
      await loadUsers()
    } catch (e: any) {
      setMessage('Error: ' + (e?.message || 'Failed to delete user'))
    } finally {
      setDeletingUserId(null)
    }
  }

  return (
    <SidebarLayout>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">User Management</h1>
        {isSuperAdmin && (
          <button
            className="text-xs underline text-blue-700 hover:text-blue-900"
            onClick={() => setShowAuthDebug((s) => !s)}
          >
            {showAuthDebug ? 'Hide auth debug' : 'Show auth debug'}
          </button>
        )}
      </div>
      {isSuperAdmin && showAuthDebug && (
        <div className="mb-4 text-sm bg-gray-50 border border-gray-200 rounded p-3">
          <div><span className="font-medium">Email:</span> {dbgEmail || '-'}</div>
          <div><span className="font-medium">app_metadata.role:</span> {dbgRole || '-'}</div>
          <div><span className="font-medium">app_metadata.roles:</span> {dbgRoles.length ? dbgRoles.join(', ') : '-'}</div>
          <div><span className="font-medium">Detected Admin:</span> {String(dbgIsAdmin)}</div>
          <div><span className="font-medium">Detected Super Admin:</span> {String(dbgIsSuper)}</div>
        </div>
      )}

      {!isAdmin ? (
        <p className="text-red-600">Access denied. Admins only.</p>
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
                <p className="p-4">Loading…</p>
              ) : (
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-2 border-b">Email</th>
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
                            <select
                              className="border rounded p-2"
                              value={current}
                              onChange={(e) => saveUserRole(u.id, e.target.value)}
                              disabled={!isSuperAdmin || savingRoleId === u.id}
                            >
                              {ROLES.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2 border-b">
                            <div className="flex items-center gap-3">
                              {!isSuperAdmin && <span className="text-xs text-gray-500">Super Admin only</span>}
                              {savingRoleId === u.id && <span className="text-xs text-gray-500">Saving…</span>}
                              {isSuperAdmin && (
                                <button
                                  onClick={() => deleteUser(u.id)}
                                  disabled={deletingUserId === u.id || u.id === currentUserId}
                                  className={`text-white px-3 py-1 rounded ${
                                    deletingUserId === u.id || u.id === currentUserId
                                      ? 'bg-gray-400 cursor-not-allowed'
                                      : 'bg-red-600 hover:bg-red-700'
                                  }`}
                                >
                                  {deletingUserId === u.id ? 'Deleting…' : u.id === currentUserId ? 'Cannot delete self' : 'Delete'}
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
    </SidebarLayout>
  )
}
