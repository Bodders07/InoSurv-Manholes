'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SidebarLayout from '@/app/components/SidebarLayout'
import { supabase } from '@/lib/supabaseClient'
import { usePermissions } from '@/app/components/PermissionsContext'

type Manhole = {
  id: string
  identifier: string | null
  project_id: string
  service_type: string | null
  location_type: string | null
  lid_material: string | null
  chamber_construction: string | null
}

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams() as { id?: string }
  const projectId = params?.id ?? ''

  const [Chambers, setChambers] = useState<Manhole[]>([])
  const [projectName, setProjectName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [embed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return new URLSearchParams(window.location.search).get('embed') === '1'
    } catch {
      return false
    }
  })

  const { has } = usePermissions()
  const canCreateManhole = has('manhole-create')
  const canEditManhole = has('manhole-edit')
  const canDeleteManhole = has('manhole-delete')

  useEffect(() => {
    async function load() {
      if (!projectId) return
      setLoading(true)
      setMessage('')
      const [{ data: proj, error: projErr }, { data: mhs, error: mhErr }] = await Promise.all([
        supabase.from('projects').select('name').eq('id', projectId).is('deleted_at', null).maybeSingle(),
        supabase
          .from('chambers')
          .select('id, identifier, project_id, service_type, location_type, lid_material, chamber_construction')
          .eq('project_id', projectId)
          .is('deleted_at', null)
          .order('identifier', { ascending: true }),
      ])
      if (projErr) setMessage('Error loading project: ' + projErr.message)
      else if (!proj) {
        setProjectName('')
        setMessage('This project was not found or has been deleted.')
      } else setProjectName(proj.name || '')
      if (mhErr) setMessage((prev) => prev || 'Error loading Chambers: ' + mhErr.message)
      else setChambers(mhs || [])
      setLoading(false)
    }
    load()
  }, [projectId])

  async function deleteManhole(id: string) {
    if (!canDeleteManhole) return
    const proceed =
      typeof window !== 'undefined' ? window.confirm('Move this chamber to the recycle bin?') : true
    if (!proceed) return
    setMessage('')
    setDeletingId(id)
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id ?? null
    const { error } = await supabase
      .from('chambers')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq('id', id)
      .is('deleted_at', null)
    setDeletingId(null)
    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setChambers((list) => list.filter((m) => m.id !== id))
      setMessage('Chamber moved to recycle bin.')
    }
  }

  const emptyState = useMemo(
    () => (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-600 shadow-sm">
        <p>No Chambers recorded for this project yet.</p>
        {canCreateManhole && (
          <button
            onClick={() => router.push(`/chambers/add?project=${projectId}`)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
              <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add Chamber
          </button>
        )}
      </div>
    ),
    [canCreateManhole, projectId, router],
  )

  const tableContent = (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 text-sm font-semibold text-gray-700">
          <tr>
            <th className="px-4 py-3 text-left">Identifier</th>
            <th className="px-4 py-3 text-left">Service</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
          {Chambers.map((m) => (
            <tr key={m.id} className="hover:bg-gray-50/70">
              <td className="px-4 py-3 font-semibold text-gray-900">{m.identifier || '-'}</td>
              <td className="px-4 py-3">{m.service_type || '-'}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1.5">
                  {canEditManhole && (
                    <button
          onClick={() => router.push(`/chambers/${m.id}/edit`)}
                      className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                      title="Edit"
                      aria-label="Edit"
                    >
                      Edit
                    </button>
                  )}
                  {canDeleteManhole && (
                    <button
                      onClick={() => deleteManhole(m.id)}
                      disabled={deletingId === m.id}
                      className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium text-white ${
                        deletingId === m.id ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
                      }`}
                      title="Delete"
                      aria-label="Delete"
                    >
                      {deletingId === m.id ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const headerBlock = (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm uppercase tracking-wide text-gray-500">Project Chambers</p>
        <h1 className="text-2xl font-bold text-gray-900">{projectName || 'Untitled Project'}</h1>
        <p className="text-sm text-gray-500">Track, edit, and manage Chambers scoped to this project.</p>
      </div>
      {canCreateManhole && (
        <button
          onClick={() => router.push(`/chambers/add?project=${projectId}`)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
            <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add Chamber
        </button>
      )}
    </div>
  )

  const listView = loading ? (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-sm text-gray-600 shadow-sm">Loading Chambers…</div>
  ) : Chambers.length === 0 ? (
    emptyState
  ) : (
    tableContent
  )

  if (embed) {
    return (
      <div className="space-y-4 font-sans">
        <div className="flex justify-end">
          <button
            className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm hover:bg-gray-100"
            onClick={() => window.parent?.postMessage({ type: 'close-project-view' }, '*')}
          >
            Close
          </button>
        </div>
        {headerBlock}
        {message && <p className="text-sm text-red-600">{message}</p>}
        {listView}
      </div>
    )
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {headerBlock}
        {message && <p className="text-sm text-red-600">{message}</p>}
        {listView}
      </div>
    </SidebarLayout>
  )
}


