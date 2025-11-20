'use client'

import type { ReactNode } from 'react'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { usePermissions } from '@/app/components/PermissionsContext'

type Project = {
  id: string
  name: string | null
  client: string | null
  project_number: string | null
  created_at?: string | null
  updated_at?: string | null
  archived?: boolean | null
}

type ProjectInsertPayload = {
  name: string
  project_number?: string | null
  client?: string | null
}

type ProjectUpdatePayload = {
  name?: string
  project_number?: string | null
  client?: string | null
}

type ProjectMinimal = {
  name: string | null
  client: string | null
  project_number: string | null
}

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(value))
  } catch {
    return '-'
  }
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button title={title} aria-label={title} onClick={onClick} className="p-1.5 rounded hover:bg-gray-200 text-gray-700">
      {children}
    </button>
  )
}

function EyeIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 5c5 0 9 5 9 7s-4 7-9 7-9-5-9-7 4-7 9-7Zm0 3.5A3.5 3.5 0 1 0 12 15a3.5 3.5 0 0 0 0-7Z"/></svg>
}

function PencilIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M16.862 3.487a1.75 1.75 0 0 1 2.476 2.476l-10 10a1.75 1.75 0 0 1-.72.438l-4 1.25a.75.75 0 0 1-.938-.938l1.25-4a1.75 1.75 0 0 1 .438-.72l10-10Z"/><path d="M15 5 19 9" stroke="currentColor" strokeWidth="1.5"/></svg>
}

function TrashIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M9 3.75A1.75 1.75 0 0 1 10.75 2h2.5A1.75 1.75 0 0 1 15 3.75V5h4.25a.75.75 0 0 1 0 1.5H4.75a.75.75 0 0 1 0-1.5H9V3.75Z"/><path d="M6.5 7h11l-.7 11.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6.5 7Z"/></svg>
}

function DotsIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><circle cx="5" cy="12" r="1.75" /><circle cx="12" cy="12" r="1.75" /><circle cx="19" cy="12" r="1.75" /></svg>
}

export default function ProjectsContent() {
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

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editProjectNumber, setEditProjectNumber] = useState('')
  const [editClient, setEditClient] = useState('')
  const [editProjectName, setEditProjectName] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  // New top-bar UX state
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [filterNumber, setFilterNumber] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const { has } = usePermissions()
  const canCreateProject = has('project-create')
  const canEditProject = has('project-edit')
  const canDeleteProject = has('project-delete')
  useEffect(() => {
    if (!canCreateProject) setShowCreate(false)
  }, [canCreateProject])
  useEffect(() => {
    if (!canEditProject) setEditingId(null)
  }, [canEditProject])

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
  const [importOpen, setImportOpen] = useState(false)
  const [importProjectId, setImportProjectId] = useState<string>('')
  const [importBusy, setImportBusy] = useState(false)
  const [importSummary, setImportSummary] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search)

  const refreshProjects = useCallback(async () => {
    setLoading(true)
    setMessage('')
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, client, project_number, created_at, updated_at, archived')
      .is('deleted_at', null)
      .order('project_number', { ascending: true })

    if (error) {
      setHasExtendedFields(false)
      const fallback = await supabase
        .from('projects')
        .select('id, name, client, project_number, created_at, updated_at')
        .is('deleted_at', null)
        .order('id')
      if (!fallback.error) {
        const records = (fallback.data as Project[]).map((p) => ({ ...p, archived: undefined }))
        setProjects(records || [])
      } else {
        setProjects([])
      }
    } else {
      setHasExtendedFields(true)
      setProjects((data as Project[]) || [])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      refreshProjects()
    })
    return () => cancelAnimationFrame(id)
  }, [refreshProjects])

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
    return undefined
  }, [refreshProjects])

  // Allow saving as long as a name is provided; optional fields are included if present
  const disableCreateSave = useMemo(() => saving || !projectName, [projectName, saving])
  const filteredProjects = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
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
  }, [projects, deferredSearch, filterNumber, filterClient])

  const activeProjects = useMemo(() => filteredProjects.filter((p) => !p.archived), [filteredProjects])
  const archivedProjects = useMemo(() => filteredProjects.filter((p) => !!p.archived), [filteredProjects])

  const checkExactProject = useCallback(
    async ({
      name,
      projectNumber,
      clientName,
      excludeId,
    }: {
      name: string
      projectNumber: string | null
      clientName: string | null
      excludeId?: string | null
    }) => {
      try {
        let query = supabase
          .from('projects')
          .select('id, name')
        query = projectNumber ? query.eq('project_number', projectNumber) : query.is('project_number', null)
        query = clientName ? query.eq('client', clientName) : query.is('client', null)
        if (excludeId) query = query.neq('id', excludeId)
        const { data, error } = await query
        if (error) return { duplicate: false, error }
        const matchName = (data || []).some(
          (row) => (row.name || '').trim().toLowerCase() === name.trim().toLowerCase(),
        )
        return { duplicate: matchName, error: null }
      } catch (err) {
        return {
          duplicate: false,
          error: err instanceof Error ? err : new Error('Unknown error checking duplicates'),
        }
      }
    },
    [],
  )

  async function addProject() {
    setMessage('')
    if (!canCreateProject) {
      setMessage('You do not have permission to create projects.')
      return
    }
    if (!projectNumber || !client || !projectName) {
      setMessage('Please complete all fields before saving.')
      return
    }
    setSaving(true)
    const normalizedName = projectName.trim()
    const normalizedNumber = projectNumber.trim()
    const normalizedClient = client.trim()

    const { duplicate, error: dupError } = await checkExactProject({
      name: normalizedName,
      projectNumber: normalizedNumber || null,
      clientName: normalizedClient || null,
    })
    if (dupError) {
      setSaving(false)
      setMessage('Error checking existing projects: ' + dupError.message)
      return
    }
    if (duplicate) {
      setSaving(false)
      setMessage('A project with the same name, client, and project number already exists.')
      return
    }

    const payload: ProjectInsertPayload = { name: normalizedName }
    if (normalizedNumber) payload.project_number = normalizedNumber
    if (normalizedClient) payload.client = normalizedClient
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

  async function duplicateProject(id: string) {
    setMessage('')
    const { data, error } = await supabase
      .from('projects')
      .select('name, client, project_number')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) {
      setMessage('Error duplicating: ' + error.message)
      return
    }
    const src = data as ProjectMinimal | null
    const insert: ProjectInsertPayload = {
      name: src?.name ? `${src.name} (Copy)` : 'Copy',
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

  async function toggleArchive(p: Project) {
    setMessage('')
    const nextArchived = !p.archived
    const { error } = await supabase
      .from('projects')
      .update({ archived: nextArchived } as { archived: boolean })
      .eq('id', p.id)
      .is('deleted_at', null)
    if (!error) {
      setMessage(`Success: Project ${nextArchived ? 'archived' : 'unarchived'}.`)
      await refreshProjects()
      return
    }
    if (error.message?.toLowerCase().includes('archived') && error.message?.toLowerCase().includes('column')) {
      const { error: nameErr } = await supabase
        .from('projects')
        .update({
          name: nextArchived
            ? `Archived - ${p.name ?? ''}`
            : (p.name || '').replace(/^Archived -\s*/, '') || p.name,
        })
        .eq('id', p.id)
        .is('deleted_at', null)
      if (nameErr) setMessage('Error updating project: ' + nameErr.message)
      else {
        setMessage(`Success: Project ${nextArchived ? 'archived (name prefixed)' : 'unarchived (name restored)'}.`)
        await refreshProjects()
      }
    } else {
      setMessage('Error updating project: ' + error.message)
    }
  }

  function startEdit(p: Project) {
    if (!canEditProject) return
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

  async function handleCsvImport(file: File) {
    if (!importProjectId) {
      setImportError('Please choose a project first.')
      return
    }
    setImportBusy(true)
    setImportSummary(null)
    setImportError(null)
    try {
      const text = await file.text()
      const rows = parseCsv(text)
      if (!rows.length) throw new Error('No data rows detected.')
      let updated = 0
      for (const row of rows) {
        const identifier = row.identifier?.trim()
        if (!identifier) continue
        const payload: Record<string, number | null> = {
          latitude: toNumber(row.latitude),
          longitude: toNumber(row.longitude),
          easting: toNumber(row.easting),
          northing: toNumber(row.northing),
          cover_level: toNumber(row.cover_level),
        }
        const { error } = await supabase
          .from('chambers')
          .update(payload)
          .eq('project_id', importProjectId)
          .eq('identifier', identifier)
          .is('deleted_at', null)
        if (error) throw error
        updated++
      }
      setImportSummary(`Updated ${updated} chamber${updated === 1 ? '' : 's'}.`)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    } finally {
      setImportBusy(false)
    }
  }

  function parseCsv(text: string) {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    if (!lines.length) return []
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const rows: Record<string, string>[] = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim())
      const row: Record<string, string> = {}
      headers.forEach((header, idx) => {
        row[header] = values[idx] ?? ''
      })
      rows.push(row)
    }
    return rows
  }

  function toNumber(value?: string) {
    if (value === undefined || value === null || value === '') return null
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
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
    if (!editingId || !canEditProject) return
    setMessage('')
    setEditSaving(true)
    const normalizedName = editProjectName.trim()
    const normalizedNumber = editProjectNumber.trim()
    const normalizedClient = editClient.trim()
    const { duplicate, error: dupError } = await checkExactProject({
      name: normalizedName,
      projectNumber: normalizedNumber || null,
      clientName: normalizedClient || null,
      excludeId: editingId,
    })
    if (dupError) {
      setEditSaving(false)
      setMessage('Error checking existing projects: ' + dupError.message)
      return
    }
    if (duplicate) {
      setEditSaving(false)
      setMessage('A project with the same name, client, and project number already exists.')
      return
    }
    const update: ProjectUpdatePayload = { name: normalizedName }
    if (hasExtendedFields) {
      update.project_number = normalizedNumber || null
      update.client = normalizedClient || null
    }
    const { error } = await supabase
      .from('projects')
      .update(update)
      .eq('id', editingId)
      .is('deleted_at', null)
    setEditSaving(false)
    if (error) setMessage('Error: ' + error.message)
    else {
      setMessage('Success: Project updated.')
      setEditingId(null)
      await refreshProjects()
    }
  }

  async function deleteProject(id: string) {
    if (!canDeleteProject) {
      setMessage('Error: You do not have permission to delete projects.')
      return
    }

    const rel = await supabase
      .from('chambers')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id)
      .is('deleted_at', null)
    const relatedCount = rel.count ?? 0

    let confirmText = 'Move this project to the recycle bin?'
    if (relatedCount > 0) {
      confirmText = `Move this project and its ${relatedCount} chamber(s) to the recycle bin? You can restore them later from Admin Tools.`
    }

    const proceed = typeof window !== 'undefined' ? window.confirm(confirmText) : true
    if (!proceed) return

    setMessage('')

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id ?? null
    const deletedAt = new Date().toISOString()
    const { error, data } = await supabase
      .from('projects')
      .update({ deleted_at: deletedAt, deleted_by: userId })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')

    if (error) {
      setMessage('Error: ' + error.message)
      return
    }

    if (!data || data.length === 0) {
      setMessage('Error: Project not removed (RLS or missing permissions). Ensure an UPDATE policy exists for your role.')
      return
    }

    const { error: cascadeErr } = await supabase
      .from('chambers')
      .update({ deleted_at: deletedAt, deleted_by: userId })
      .eq('project_id', id)
      .is('deleted_at', null)

    if (cascadeErr) {
      setMessage('Project moved to recycle bin, but failed to recycle some chambers: ' + cascadeErr.message)
    } else {
      setMessage('Success: Project and related chambers moved to recycle bin.')
    }
    await refreshProjects()
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
          <div className="relative flex-1 min-w-[160px] md:min-w-[220px]">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M10 3.75a6.25 6.25 0 1 1 0 12.5 6.25 6.25 0 0 1 0-12.5Zm8.53 13.72-2.91-2.91a7.75 7.75 0 1 0-1.06 1.06l2.91 2.91a.75.75 0 1 0 1.06-1.06Z"/></svg>
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full min-w-0 pl-7 pr-3 py-2 rounded-lg border border-gray-300 bg-transparent placeholder-gray-400"
            />
          </div>
          <button
            onClick={() => setShowFilter((v) => !v)}
            className="flex-shrink-0 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            <span className="inline-flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3.75 5.5a.75.75 0 0 1 .75-.75h15a.75.75 0 0 1 .55 1.25l-5.3 5.96v4.29a.75.75 0 0 1-1.06.69l-3-1.2a.75.75 0 0 1-.47-.69v-3.09L3.2 6a.75.75 0 0 1 .55-1.25Z"/></svg>
              Filter
            </span>
          </button>
          <button
            onClick={() => {
              setImportProjectId('')
              setImportSummary(null)
              setImportError(null)
              setImportOpen(true)
            }}
            className="flex-shrink-0 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            <span className="inline-flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M5 4.75A.75.75 0 0 1 5.75 4H18.25A.75.75 0 0 1 19 4.75V6a.75.75 0 0 1-.75.75H5.75A.75.75 0 0 1 5 6V4.75ZM5 10.75A.75.75 0 0 1 5.75 10H18.25A.75.75 0 0 1 19 10.75V12a.75.75 0 0 1-.75.75H5.75A.75.75 0 0 1 5 12v-1.25ZM5 16.75A.75.75 0 0 1 5.75 16h6.5a.75.75 0 0 1 .75.75V18a.75.75 0 0 1-.75.75H5.75A.75.75 0 0 1 5 18v-1.25Z"/></svg>
              Import CSV
            </span>
          </button>
          {canCreateProject && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex-shrink-0 px-3 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700"
            >
              <span className="inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 4.75a.75.75 0 0 1 .75.75v5.75H18.5a.75.75 0 0 1 0 1.5h-5.75V18.5a.75.75 0 0 1-1.5 0v-5.75H5.5a.75.75 0 0 1 0-1.5h5.75V5.5a.75.75 0 0 1 .75-.75Z"/></svg>
                New Project
              </span>
            </button>
          )}
        </div>
      </div>

      {canCreateProject && showCreate && (
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
                  {saving ? 'Saving...' : 'Save Project'}
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

      <div className="space-y-8">
        <section className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold">Existing Projects</h2>
          </div>
          <div className="p-0 overflow-x-auto">
            {loading ? (
              <p className="p-4">Loading…</p>
            ) : activeProjects.length === 0 ? (
              <p className="p-4 text-gray-600">No existing projects match your filters.</p>
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
                  {activeProjects.map((p) => {
                    const isEditing = canEditProject && editingId === p.id
                  const createdText = formatDate(p.created_at)
                  const updatedText = formatDate(p.updated_at)
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 border-b align-top">
                          {isEditing ? (
                            <input
                              className="w-full border rounded px-2 py-1 text-sm"
                              value={editProjectNumber}
                              onChange={(e) => setEditProjectNumber(e.target.value)}
                              placeholder="Project No."
                            />
                          ) : (
                            p.project_number || '-'
                          )}
                        </td>
                        <td className="px-4 py-2 border-b align-top">
                          {isEditing ? (
                            <input
                              className="w-full border rounded px-2 py-1 text-sm"
                              value={editClient}
                              onChange={(e) => setEditClient(e.target.value)}
                              placeholder="Client"
                            />
                          ) : (
                            p.client || '-'
                          )}
                        </td>
                        <td className="px-4 py-2 border-b align-top">
                          {isEditing ? (
                            <input
                              className="w-full border rounded px-2 py-1 text-sm"
                              value={editProjectName}
                              onChange={(e) => setEditProjectName(e.target.value)}
                              placeholder="Project name"
                            />
                          ) : p.name ? (
                            <button className="text-orange-600 hover:underline" onClick={() => setViewId(p.id)}>
                              {p.name}
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                      <td className="px-4 py-2 border-b align-top">{createdText}</td>
                      <td className="px-4 py-2 border-b align-top">{updatedText}</td>
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
                                {editSaving ? 'Saving...' : 'Save'}
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
                              <IconBtn title="View" onClick={() => setViewId(p.id)}><EyeIcon /></IconBtn>
                              {canEditProject && <IconBtn title="Edit" onClick={() => startEdit(p)}><PencilIcon /></IconBtn>}
                              {canDeleteProject && (
                                <IconBtn title="Delete" onClick={() => deleteProject(p.id)}><TrashIcon /></IconBtn>
                              )}
                              <IconBtn
                                title="More"
                                onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
                              >
                                <DotsIcon />
                              </IconBtn>
                              {menuFor === p.id && (
                                <div className="absolute right-0 top-full mt-1 w-40 rounded-md shadow-lg bg-white ring-1 ring-black/5 z-10">
                                  <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100" onClick={() => { setMenuFor(null); duplicateProject(p.id) }}>Duplicate</button>
                                  <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100" onClick={() => { setMenuFor(null); toggleArchive(p) }}>Archive</button>
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
        </section>

        {archivedProjects.length > 0 && (
          <section className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold">Archived Projects</h2>
              <span className="text-xs text-gray-500">{archivedProjects.length} archived</span>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-2 border-b">Project No.</th>
                    <th className="px-4 py-2 border-b">Client</th>
                    <th className="px-4 py-2 border-b">Project Name</th>
                    <th className="px-4 py-2 border-b">Archived On</th>
                    <th className="px-4 py-2 border-b w-px">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedProjects.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border-b">{p.project_number || '-'}</td>
                      <td className="px-4 py-2 border-b">{p.client || '-'}</td>
                      <td className="px-4 py-2 border-b">
                        {p.name ? (
                          <button className="text-orange-600 hover:underline" onClick={() => setViewId(p.id)}>
                            {p.name}
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-2 border-b">{formatDate(p.updated_at)}</td>
                      <td className="px-4 py-2 border-b text-right">
                        <button
                          className="text-blue-600 hover:underline text-sm"
                          onClick={() => toggleArchive(p)}
                        >
                          Unarchive
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
      {importOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setImportOpen(false)}>
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-lg font-semibold">Import chamber coordinates</h3>
              <button className="text-sm text-gray-500 hover:text-gray-900" onClick={() => setImportOpen(false)}>
                Close
              </button>
            </div>
            <div className="space-y-4 px-4 py-5 text-sm text-gray-700">
              <div>
                <label className="mb-1 block font-medium">Project</label>
                <select
                  className="w-full rounded border border-gray-300 px-3 py-2"
                  value={importProjectId}
                  disabled={importBusy}
                  onChange={(e) => setImportProjectId(e.target.value)}
                >
                  <option value="">Choose a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.project_number ? `${project.project_number} – ` : ''}
                      {project.name || 'Untitled'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium">CSV file</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="w-full text-sm"
                  disabled={importBusy || !importProjectId}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleCsvImport(file)
                  }}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Required columns: <code>identifier, latitude, longitude, easting, northing, cover_level</code>.
                </p>
              </div>
              {importSummary && <p className="rounded border border-green-200 bg-green-50 p-2 text-green-700">{importSummary}</p>}
              {importError && <p className="rounded border border-red-200 bg-red-50 p-2 text-red-700">{importError}</p>}
              <p className="text-xs text-gray-500">
                Each row updates the matching chamber (by identifier) inside the selected project with the provided coordinates.
              </p>
            </div>
          </div>
        </div>
      )}

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

