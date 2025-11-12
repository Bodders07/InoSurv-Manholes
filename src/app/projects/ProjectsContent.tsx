'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { deriveRoleInfo, canAdminister, canManageEverything } from '@/lib/roles'

type Project = {
  id: string
  name: string | null
  client: string | null
  project_number: string | null
  created_at?: string | null
  updated_at?: string | null
}

export default function ProjectsContent() {
  const router = useRouter()
  // Create form state
  const [projectNumber, setProjectNumber] = useState('')
  const [client, setClient] = useState('')
  const [projectName, setProjectName] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  // List + feature detection
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [hasExtendedFields, setHasExtendedFields] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editProjectNumber, setEditProjectNumber] = useState('')
  const [editClient, setEditClient] = useState('')
  const [editProjectName, setEditProjectName] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // New top-bar UX state
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [filterNumber, setFilterNumber] = useState('')
  const [filterClient, setFilterClient] = useState('')

  // Distinct lists for dropdown filters
  const numberOptions = useMemo(() => {
    const vals = Array.from(new Set((projects.map(p => p.project_number || '').filter(Boolean)))) as string[]
    return vals.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [projects])
  const clientOptions = useMemo(() => {
    const vals = Array.from(new Set((projects.map(p => p.client || '').filter(Boolean)))) as string[]
    return vals.sort((a, b) => a.localeCompare(b))
  }, [projects])
  const [viewId, setViewId] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)

  useEffect(() => {
    async function loadProjects() {
      setLoading(true)
      setMessage('')
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, client, project_number, created_at, updated_at')
        .order('project_number', { ascending: true })

      if (error) {
        // Columns not found: fall back to minimal selection
        setHasExtendedFields(false)
        const fallback = await supabase.from('projects').select('id, name').order('id')
        if (!fallback.error) setProjects((fallback.data as any[]) as Project[])
      } else {
        setHasExtendedFields(true)
        setProjects(data || [])
      }

      await detectRoles()
      setLoading(false)
    }
    loadProjects()
    const { data: listener } = supabase.auth.onAuthStateChange(async () => {
      await detectRoles()
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === 'close-project-view') {
        setViewId(null)
        refreshProjects()
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('message', onMsg)
      return () => window.removeEventListener('message', onMsg)
    }
  }, [])

  async function detectRoles() {
    try {
      const { data } = await supabase.auth.getUser()
      const info = deriveRoleInfo(data.user)
      setIsAdmin(canAdminister(info))
      setIsSuperAdmin(canManageEverything(info))
    } catch {
      setIsAdmin(false)
      setIsSuperAdmin(false)
    }
  }

  // Allow saving as long as a name is provided; optional fields are included if present
  const disableCreateSave = useMemo(() => saving || !projectName, [projectName, saving])
  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = projects
    if (q) {
      list = list.filter((p) =>
        (p.project_number || '').toLowerCase().includes(q) ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.client || '').toLowerCase().includes(q)
      )
    }
    if (filterNumber) list = list.filter((p) => (p.project_number || '') === filterNumber)
    if (filterClient) list = list.filter((p) => (p.client || '') === filterClient)
    return list
  }, [projects, search, filterNumber, filterClient])

  async function addProject() {
    setMessage('')
    if (!projectNumber || !client || !projectName) {
      setMessage('Please complete all fields before saving.')
      return
    }
    setSaving(true)
    const payload: any = { name: projectName }
    if (projectNumber) payload.project_number = projectNumber
    if (client) payload.client = client
    const { error } = await supabase.from('projects').insert([payload])
    setSaving(false)
    if (error) setMessage('Error: ' + error.message)
    else {
      setMessage('Success: Project created.')
      if (hasExtendedFields) {
        setProjectNumber('')
        setClient('')
      }
      setProjectName('')
      await refreshProjects()
      setShowCreate(false)
    }
  }

  async function refreshProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, client, project_number, created_at, updated_at')
      .order('project_number', { ascending: true })
    if (error) return
    setProjects(data || [])
  }

  async function duplicateProject(id: string) {
    setMessage('')
    const { data, error } = await supabase
      .from('projects')
      .select('name, client, project_number')
      .eq('id', id)
      .maybeSingle()
    if (error) {
      setMessage('Error duplicating: ' + error.message)
      return
    }
    const src: any = data
    const insert = {
      name: src?.name ? src.name + ' (Copy)' : 'Copy',
      client: src?.client ?? null,
      project_number: src?.project_number ?? null,
    }
    const { error: insErr } = await supabase.from('projects').insert([insert])
    if (insErr) setMessage('Error duplicating: ' + insErr.message)
    else {
      setMessage('Success: Project duplicated.')
      await refreshProjects()
    }
  }

  async function archiveProject(p: Project) {
    setMessage('')
    const { error } = await supabase.from('projects').update({ archived: true } as any).eq('id', p.id)
    if (!error) {
      setMessage('Success: Project archived.')
      await refreshProjects()
      return
    }
    if (error.message?.toLowerCase().includes('archived') && error.message?.toLowerCase().includes('column')) {
      const { error: nameErr } = await supabase
        .from('projects')
        .update({ name: `Archived - ${p.name ?? ''}` })
        .eq('id', p.id)
      if (nameErr) setMessage('Error archiving: ' + nameErr.message)
      else {
        setMessage('Success: Project archived (name prefixed).')
        await refreshProjects()
      }
    } else {
      setMessage('Error archiving: ' + error.message)
    }
  }

  // Small inline icon buttons
  const IconBtn = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
    <button title={title} aria-label={title} onClick={onClick} className="p-1.5 rounded hover:bg-gray-200 text-gray-700">
      {children}
    </button>
  )
  const Eye = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 5c5 0 9 5 9 7s-4 7-9 7-9-5-9-7 4-7 9-7Zm0 3.5A3.5 3.5 0 1 0 12 15a3.5 3.5 0 0 0 0-7Z"/></svg>
  )
  const Pencil = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M16.862 3.487a1.75 1.75 0 0 1 2.476 2.476l-10 10a1.75 1.75 0 0 1-.72.438l-4 1.25a.75.75 0 0 1-.938-.938l1.25-4a1.75 1.75 0 0 1 .438-.72l10-10Z"/><path d="M15 5 19 9" stroke="currentColor" strokeWidth="1.5"/></svg>
  )
  const Trash = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M9 3.75A1.75 1.75 0 0 1 10.75 2h2.5A1.75 1.75 0 0 1 15 3.75V5h4.25a.75.75 0 0 1 0 1.5H4.75a.75.75 0 0 1 0-1.5H9V3.75Z"/><path d="M6.5 7h11l-.7 11.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6.5 7Z"/></svg>
  )
  const Dots = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><circle cx="5" cy="12" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="19" cy="12" r="1.75"/></svg>
  )

  function startEdit(p: Project) {
    setEditingId(p.id)
    setEditProjectNumber(p.project_number || '')
    setEditClient(p.client || '')
    setEditProjectName(p.name || '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditProjectNumber('')
    setEditClient('')
    setEditProjectName('')
  }

  const disableEditSave = useMemo(
    () =>
      editSaving ||
      (hasExtendedFields
        ? !editProjectNumber || !editClient || !editProjectName
        : !editProjectName),
    [editSaving, hasExtendedFields, editProjectNumber, editClient, editProjectName]
  )

  async function saveEdit() {
    if (!editingId) return
    setMessage('')
    setEditSaving(true)
    const update: any = { name: editProjectName }
    if (hasExtendedFields) {
      update.project_number = editProjectNumber
      update.client = editClient
    }
    const { error } = await supabase.from('projects').update(update).eq('id', editingId)
    setEditSaving(false)
    if (error) setMessage('Error: ' + error.message)
    else {
      setMessage('Success: Project updated.')
      setEditingId(null)
      await refreshProjects()
    }
  }

  async function deleteProject(id: string) {
    if (!isAdmin && !isSuperAdmin) {
      setMessage('Error: Only admins can delete projects.')
      return
    }

    const rel = await supabase
      .from('manholes')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id)
    const relatedCount = rel.count ?? 0

    let confirmText = 'Delete this project? This cannot be undone.'
    if (relatedCount > 0) {
      confirmText = `Delete this project and its ${relatedCount} manhole(s)? This cannot be undone. If your database is not set to cascade deletes, this will fail.`
    }

    const proceed = typeof window !== 'undefined' ? window.confirm(confirmText) : true
    if (!proceed) return

    setMessage('')
    setDeletingId(id)

    const { error, data } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .select('id')

    setDeletingId(null)

    if (error) {
      if (error.message.toLowerCase().includes('foreign key')) {
        setMessage('Error: Project has related manholes. Enable ON DELETE CASCADE on manholes.project_id or delete the manholes first.')
      } else {
        setMessage('Error: ' + error.message)
      }
      return
    }

    if (!data || data.length === 0) {
      setMessage('Error: Project not deleted (RLS or missing permissions). Ensure a DELETE policy exists for your role.')
      return
    }

    setMessage('Success: Project deleted.')
    await refreshProjects()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M10 3.75a6.25 6.25 0 1 1 0 12.5 6.25 6.25 0 0 1 0-12.5Zm8.53 13.72-2.91-2.91a7.75 7.75 0 1 0-1.06 1.06l2.91 2.91a.75.75 0 1 0 1.06-1.06Z"/></svg>
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="pl-7 pr-3 py-2 rounded-lg border border-gray-300 bg-transparent placeholder-gray-400 min-w-[220px]"
            />
          </div>
          <button
            onClick={() => setShowFilter((v) => !v)}
            className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            <span className="inline-flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3.75 5.5a.75.75 0 0 1 .75-.75h15a.75.75 0 0 1 .55 1.25l-5.3 5.96v4.29a.75.75 0 0 1-1.06.69l-3-1.2a.75.75 0 0 1-.47-.69v-3.09L3.2 6a.75.75 0 0 1 .55-1.25Z"/></svg>
              Filter
            </span>
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700"
          >
            <span className="inline-flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 4.75a.75.75 0 0 1 .75.75v5.75H18.5a.75.75 0 0 1 0 1.5h-5.75V18.5a.75.75 0 0 1-1.5 0v-5.75H5.5a.75.75 0 0 1 0-1.5h5.75V5.5a.75.75 0 0 1 .75-.75Z"/></svg>
              New Project
            </span>
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="font-semibold">New Project</h2>
              <button
                className="px-2 py-1 rounded bg-neutral-800 text-white hover:bg-neutral-700"
                onClick={() => setShowCreate(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Project Number</label>
                  <input
                    type="text"
                    value={projectNumber}
                    onChange={(e) => setProjectNumber(e.target.value)}
                    placeholder="e.g., 24-001"
                    className="w-full border rounded p-2 bg-white dark:bg-neutral-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Client</label>
                  <input
                    type="text"
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    placeholder="e.g., City of Springfield"
                    className="w-full border rounded p-2 bg-white dark:bg-neutral-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Project Name</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g., Downtown Manhole Survey"
                    className="w-full border rounded p-2 bg-white dark:bg-neutral-800"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                {message && (
                  <p className={`text-sm ${message.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>
                    {message}
                  </p>
                )}
                <button
                  onClick={addProject}
                  disabled={disableCreateSave}
                  className={`px-4 py-2 rounded text-white ${
                    disableCreateSave ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {saving ? 'Saving…' : 'Save Project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFilter && (
        <div className="mb-4 p-3 border rounded-lg bg-white dark:bg-neutral-900 text-sm text-gray-600 dark:text-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Project Number</label>
              <select
                value={filterNumber}
                onChange={(e) => setFilterNumber(e.target.value)}
                className="w-full border rounded px-2 py-1 bg-white dark:bg-neutral-800"
              >
                <option value="">All numbers</option>
                {numberOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Client</label>
              <select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="w-full border rounded px-2 py-1 bg-white dark:bg-neutral-800"
              >
                <option value="">All clients</option>
                {clientOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => { setFilterNumber(''); setFilterClient(''); }}
              className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              onClick={() => setShowFilter(false)}
              className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold">Existing Projects</h2>
        </div>
        <div className="p-0 overflow-x-auto">
          {loading ? (
            <p className="p-4">Loading…</p>
          ) : filteredProjects.length === 0 ? (
            <p className="p-4 text-gray-600">No projects yet. Create your first one above.</p>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2 border-b">Project No.</th>
                  <th className="px-4 py-2 border-b">Client</th>
                  <th className="px-4 py-2 border-b">Project Name</th>
                  <th className="px-4 py-2 border-b">Created</th>
                  <th className="px-4 py-2 border-b">Last Updated</th>
                  <th className="px-4 py-2 border-b w-px">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p) => {
                  const isEditing = editingId === p.id
                  const created = p.created_at ? new Date(p.created_at) : null
                  const updated = p.updated_at ? new Date(p.updated_at) : null
                  const dt = (d: Date | null) => (d ? d.toLocaleString() : '-')
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border-b align-top">{p.project_number || '-'}</td>
                      <td className="px-4 py-2 border-b align-top">{p.client || '-'}</td>
                      <td className="px-4 py-2 border-b align-top">
                        {p.name ? (
                          <button className="text-orange-600 hover:underline" onClick={() => setViewId(p.id)}>
                            {p.name}
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-2 border-b align-top">{dt(created)}</td>
                      <td className="px-4 py-2 border-b align-top">{dt(updated)}</td>
                      <td className="px-4 py-2 border-b align-top text-right">
                        {isEditing ? (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={saveEdit}
                              disabled={disableEditSave}
                              className={`px-3 py-1 rounded text-white ${
                                disableEditSave ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                              }`}
                            >
                              {editSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-end items-center relative">
                            <IconBtn title="View" onClick={() => setViewId(p.id)}><Eye /></IconBtn>
                            <IconBtn title="Edit" onClick={() => startEdit(p)}><Pencil /></IconBtn>
                            {(isAdmin || isSuperAdmin) && (
                              <IconBtn title="Delete" onClick={() => deleteProject(p.id)}><Trash /></IconBtn>
                            )}
                            <IconBtn
                              title="More"
                              onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
                            >
                              <Dots />
                            </IconBtn>
                            {menuFor === p.id && (
                              <div className="absolute right-0 top-full mt-1 w-40 rounded-md shadow-lg bg-white ring-1 ring-black/5 z-10">
                                <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100" onClick={() => { setMenuFor(null); duplicateProject(p.id) }}>Duplicate</button>
                                <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100" onClick={() => { setMenuFor(null); archiveProject(p) }}>Archive</button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {viewId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-0 sm:p-6">
          <div className="relative bg-white dark:bg-neutral-900 w-screen h-screen sm:w-[90vw] sm:h-[85vh] rounded-none sm:rounded-lg shadow-lg">
            <button
              aria-label="Close"
              className="absolute top-2 right-2 px-2 py-1 rounded bg-neutral-800 text-white hover:bg-neutral-700"
              onClick={() => setViewId(null)}
            >
              ✕
            </button>
            <iframe
              src={`/projects/${viewId}?embed=1`}
              className="w-full h-full border-0 bg-white dark:bg-neutral-900"
            />
          </div>
        </div>
      )}
    </>
  )
}
