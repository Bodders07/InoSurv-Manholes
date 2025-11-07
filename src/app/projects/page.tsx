'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import SidebarLayout from '@/app/components/SidebarLayout'
import { supabase } from '@/lib/supabaseClient'
import { deriveRoleInfo, canAdminister, canManageEverything } from '@/lib/roles'

type Project = {
  id: string
  name: string | null
  client: string | null
  project_number: string | null
}

export default function ProjectsPage() {
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

  useEffect(() => {
    async function loadProjects() {
      setLoading(true)
      setMessage('')
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, client, project_number')
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

  const disableCreateSave = useMemo(
    () => !projectNumber || !client || !projectName || saving,
    [projectNumber, client, projectName, saving]
  )

  async function addProject() {
    setMessage('')
    if (!projectNumber || !client || !projectName) {
      setMessage('Please complete all fields before saving.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('projects').insert([
      { project_number: projectNumber, client, name: projectName },
    ])
    setSaving(false)
    if (error) setMessage('Error: ' + error.message)
    else {
      setMessage('Success: Project created.')
      setProjectNumber('')
      setClient('')
      setProjectName('')
      await refreshProjects()
    }
  }

  async function refreshProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, client, project_number')
      .order('project_number', { ascending: true })
    if (error) return
    setProjects(data || [])
  }

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
    const proceed = typeof window !== 'undefined' ? window.confirm('Delete this project? This cannot be undone.') : true
    if (!proceed) return
    setMessage('')
    setDeletingId(id)
    const { error } = await supabase.from('projects').delete().eq('id', id)
    setDeletingId(null)
    if (error) setMessage('Error: ' + error.message)
    else {
      setMessage('Success: Project deleted.')
      await refreshProjects()
    }
  }

  return (
    <SidebarLayout>
      <h1 className="text-2xl font-bold mb-6">Projects</h1>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-8">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold">Add Project</h2>
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
                className="w-full border rounded p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Client</label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="e.g., City of Springfield"
                className="w-full border rounded p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., Downtown Manhole Survey"
                className="w-full border rounded p-2"
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
              disabled={disableCreateSave || !hasExtendedFields}
              className={`px-4 py-2 rounded text-white ${
                disableCreateSave || !hasExtendedFields
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {saving ? 'Saving…' : 'Save Project'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold">Existing Projects</h2>
        </div>
        <div className="p-0 overflow-x-auto">
          {loading ? (
            <p className="p-4">Loading…</p>
          ) : projects.length === 0 ? (
            <p className="p-4 text-gray-600">No projects yet. Create your first one above.</p>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2 border-b">Project #</th>
                  <th className="px-4 py-2 border-b">Client</th>
                  <th className="px-4 py-2 border-b">Project Name</th>
                  <th className="px-4 py-2 border-b w-px">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const isEditing = editingId === p.id
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border-b align-top">{p.project_number || '-'}</td>
                      <td className="px-4 py-2 border-b align-top">{p.client || '-'}</td>
                      <td className="px-4 py-2 border-b align-top">{p.name || '-'}</td>
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
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => router.push(`/projects/${p.id}`)}
                              className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
                            >
                              View
                            </button>
                            <button
                              onClick={() => startEdit(p)}
                              className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            {(isAdmin || isSuperAdmin) && (
                              <button
                                onClick={() => deleteProject(p.id)}
                                disabled={deletingId === p.id}
                                className={`px-3 py-1 rounded text-white ${
                                  deletingId === p.id ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
                                }`}
                              >
                                {deletingId === p.id ? 'Deleting…' : 'Delete'}
                              </button>
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
    </SidebarLayout>
  )
}

