'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { usePermissions } from '@/app/components/PermissionsContext'

type DeletedChamber = {
  id: string
  identifier: string | null
  project_id: string | null
  deleted_at: string | null
  deleted_by: string | null
}

type DeletedProject = {
  id: string
  name: string | null
  project_number: string | null
  client: string | null
  deleted_at: string | null
  deleted_by: string | null
}

const formatDate = (value?: string | null) => {
  if (!value) return 'Unknown'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

const formatDeletedBy = (userId?: string | null) => {
  if (!userId) return 'Unknown'
  return `${userId.slice(0, 8)}…`
}

export default function RecycleContent() {
  const { has } = usePermissions()
  const canRestore = has('run-maintenance') || has('manage-permissions')
  const [activeTab, setActiveTab] = useState<'chambers' | 'projects'>('chambers')
  const [chambers, setChambers] = useState<DeletedChamber[]>([])
  const [projects, setProjects] = useState<DeletedProject[]>([])
  const [loadingChambers, setLoadingChambers] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  const loadChambers = useCallback(async () => {
    setLoadingChambers(true)
    const { data, error } = await supabase
      .from('chambers')
      .select('id, identifier, project_id, deleted_at, deleted_by')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (error) setMessage('Failed to load deleted chambers: ' + error.message)
    else setChambers((data as DeletedChamber[]) || [])
    setLoadingChambers(false)
  }, [])

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true)
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, project_number, client, deleted_at, deleted_by')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (error) setMessage('Failed to load deleted projects: ' + error.message)
    else setProjects((data as DeletedProject[]) || [])
    setLoadingProjects(false)
  }, [])

  useEffect(() => {
    loadChambers()
    loadProjects()
  }, [loadChambers, loadProjects])

  const restoreChamber = async (id: string) => {
    if (!canRestore) {
      setMessage('You do not have permission to restore chambers.')
      return
    }
    setBusyId(id)
    const { error } = await supabase
      .from('chambers')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', id)
      .not('deleted_at', 'is', null)
    setBusyId(null)
    if (error) setMessage('Failed to restore chamber: ' + error.message)
    else {
      setMessage('Chamber restored.')
      loadChambers()
    }
  }

  const restoreProject = async (id: string) => {
    if (!canRestore) {
      setMessage('You do not have permission to restore projects.')
      return
    }
    setBusyId(id)
    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', id)
      .not('deleted_at', 'is', null)
    setBusyId(null)
    if (error) setMessage('Failed to restore project: ' + error.message)
    else {
      setMessage('Project restored.')
      loadProjects()
    }
  }

  const deleteAllChambers = async () => {
    if (!canRestore) {
      setMessage('You do not have permission to delete chambers.')
      return
    }
    if (!chambers.length) return
    const confirmText = `Permanently delete ${chambers.length} chamber(s)? This cannot be undone.`
    if (!window.confirm(confirmText)) return
    setBulkBusy(true)
    setMessage('')
    const ids = chambers.map((c) => c.id)
    const { error } = await supabase.from('chambers').delete().in('id', ids)
    setBulkBusy(false)
    if (error) setMessage('Failed to delete all chambers: ' + error.message)
    else {
      setMessage('Deleted all chambers in recycle bin.')
      loadChambers()
    }
  }

  const deleteAllProjects = async () => {
    if (!canRestore) {
      setMessage('You do not have permission to delete projects.')
      return
    }
    if (!projects.length) return
    const confirmText = `Permanently delete ${projects.length} project(s)? This cannot be undone.`
    if (!window.confirm(confirmText)) return
    setBulkBusy(true)
    setMessage('')
    const ids = projects.map((p) => p.id)
    const { error } = await supabase.from('projects').delete().in('id', ids)
    setBulkBusy(false)
    if (error) setMessage('Failed to delete all projects: ' + error.message)
    else {
      setMessage('Deleted all projects in recycle bin.')
      loadProjects()
    }
  }

  const chamberRows = useMemo(() => {
    if (!chambers.length) return <p className="text-sm text-gray-600">No deleted chambers.</p>
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Identifier</th>
              <th className="px-4 py-2 text-left font-semibold">Project ID</th>
              <th className="px-4 py-2 text-left font-semibold">Deleted</th>
              <th className="px-4 py-2 text-left font-semibold">Deleted By</th>
              <th className="px-4 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {chambers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/70">
                <td className="px-4 py-2 font-semibold">{c.identifier || 'Untitled'}</td>
                <td className="px-4 py-2">{c.project_id || '—'}</td>
                <td className="px-4 py-2">{formatDate(c.deleted_at)}</td>
                <td className="px-4 py-2">{formatDeletedBy(c.deleted_by)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => restoreChamber(c.id)}
                    disabled={!canRestore || busyId === c.id}
                    className={`inline-flex items-center rounded border px-3 py-1.5 text-sm font-medium ${
                      busyId === c.id ? 'border-gray-300 text-gray-400' : 'border-blue-600 text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {busyId === c.id ? 'Restoring…' : 'Restore'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }, [busyId, canRestore, chambers])

  const projectRows = useMemo(() => {
    if (!projects.length) return <p className="text-sm text-gray-600">No deleted projects.</p>
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Project</th>
              <th className="px-4 py-2 text-left font-semibold">Client</th>
              <th className="px-4 py-2 text-left font-semibold">Deleted</th>
              <th className="px-4 py-2 text-left font-semibold">Deleted By</th>
              <th className="px-4 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50/70">
                <td className="px-4 py-2">
                  <div className="font-semibold text-gray-900">{p.name || 'Untitled Project'}</div>
                  <div className="text-xs text-gray-500">{p.project_number || 'No reference'}</div>
                </td>
                <td className="px-4 py-2">{p.client || '—'}</td>
                <td className="px-4 py-2">{formatDate(p.deleted_at)}</td>
                <td className="px-4 py-2">{formatDeletedBy(p.deleted_by)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => restoreProject(p.id)}
                    disabled={!canRestore || busyId === p.id}
                    className={`inline-flex items-center rounded border px-3 py-1.5 text-sm font-medium ${
                      busyId === p.id ? 'border-gray-300 text-gray-400' : 'border-blue-600 text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {busyId === p.id ? 'Restoring…' : 'Restore'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }, [busyId, canRestore, projects])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-500">Admin Tools</p>
            <h1 className="text-2xl font-bold text-gray-900">Recycle Bin</h1>
            <p className="text-sm text-gray-600">
              Review deleted chambers and projects. Restoring an item makes it visible again across the workspace.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMessage('')
                loadChambers()
                loadProjects()
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(['chambers', 'projects'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab === 'chambers' ? 'Chambers' : 'Projects'}
            </button>
          ))}
          {activeTab === 'chambers' && chambers.length > 0 && (
            <button
              type="button"
              onClick={deleteAllChambers}
              disabled={bulkBusy}
              className="ml-auto rounded border border-red-600 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {bulkBusy ? 'Deleting...' : 'Delete All Chambers'}
            </button>
          )}
          {activeTab === 'projects' && projects.length > 0 && (
            <button
              type="button"
              onClick={deleteAllProjects}
              disabled={bulkBusy}
              className="ml-auto rounded border border-red-600 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {bulkBusy ? 'Deleting...' : 'Delete All Projects'}
            </button>
          )}
        </div>
      </div>

      {message && <p className="text-sm text-gray-700">{message}</p>}

      {activeTab === 'chambers' ? (
        loadingChambers ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm">Loading chambers…</div>
        ) : (
          chamberRows
        )
      ) : loadingProjects ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm">Loading projects…</div>
      ) : (
        projectRows
      )}
    </div>
  )
}
