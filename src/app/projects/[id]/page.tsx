'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SidebarLayout from '@/app/components/SidebarLayout'
import { supabase } from '@/lib/supabaseClient'
import { deriveRoleInfo, canManageEverything } from '@/lib/roles'

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
  const params = useParams() as { id: string }
  const projectId = params.id

  const [manholes, setManholes] = useState<Manhole[]>([])
  const [projectName, setProjectName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [embed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return new URLSearchParams(window.location.search).get('embed') === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    async function load() {
      setLoading(true)
      setMessage('')
      const [{ data: proj, error: projErr }, { data: mhs, error: mhErr }] = await Promise.all([
        supabase.from('projects').select('name').eq('id', projectId).maybeSingle(),
        supabase
          .from('manholes')
          .select('id, identifier, project_id, service_type, location_type, lid_material, chamber_construction')
          .eq('project_id', projectId)
          .order('identifier', { ascending: true }),
      ])
      if (projErr) setMessage('Error loading project: ' + projErr.message)
      else setProjectName(proj?.name || '')
      if (mhErr) setMessage((prev) => prev || 'Error loading manholes: ' + mhErr.message)
      else setManholes(mhs || [])

      // detect super admin
      try {
        const { data } = await supabase.auth.getUser()
        const info = deriveRoleInfo(data.user)
        setIsSuperAdmin(canManageEverything(info))
      } catch {
        setIsSuperAdmin(false)
      }
      setLoading(false)
    }
    load()
  }, [projectId])

  async function deleteManhole(id: string) {
    if (!isSuperAdmin) return
    const proceed = typeof window !== 'undefined' ? window.confirm('Delete this manhole? This cannot be undone.') : true
    if (!proceed) return
    setMessage('')
    setDeletingId(id)
    const { error } = await supabase.from('manholes').delete().eq('id', id)
    setDeletingId(null)
    if (error) setMessage('Error: ' + error.message)
    else setManholes((list) => list.filter((m) => m.id !== id))
  }

  // When embedded, render without the sidebar layout and include a Close button
  if (embed) {
    return (
      <>
        <div className="flex justify-end mb-2">
          <button
            className="px-3 py-1 rounded bg-neutral-800 text-white hover:bg-neutral-700"
            onClick={() => window.parent?.postMessage({ type: 'close-project-view' }, '*')}
          >
            Close
          </button>
        </div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Project Manholes{projectName ? ` - ${projectName}` : ''}</h1>
          <button
            onClick={() => router.push(`/manholes/add?project=${projectId}`)}
            className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
          >
            Add Manhole
          </button>
        </div>

        {message && <p className="mb-4 text-red-600">{message}</p>}

      {loading ? (
        <p>Loading...</p>
        ) : manholes.length === 0 ? (
          <p className="text-gray-600">No manholes yet for this project.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
              <thead>
                <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2 border-b">Manhole ID</th>
                <th className="px-4 py-2 border-b w-px">Actions</th>
                </tr>
              </thead>
              <tbody>
                {manholes.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-b font-medium">{m.Manhole ID || '-'}</td>
                    <td className="px-4 py-2 border-b text-right">
                      <div className="flex justify-end gap-2"></div>
                      <button
                        onClick={() => router.push(`/manholes/${m.id}/edit`)}
                        className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      {isSuperAdmin && (
                        <button
                          onClick={() => deleteManhole(m.id)}
                          disabled={deletingId === m.id}
                          className={`ml-2 px-3 py-1 rounded text-white ${
                            deletingId === m.id ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
                          }`}
                        >
                          {deletingId === m.id ? 'Deleting�?�' : 'Delete'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    )
  }

  return (
    <SidebarLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Project Manholes {projectName ? `— ${projectName}` : ''}</h1>
        <button
          onClick={() => router.push(`/manholes/add?project=${projectId}`)}
          className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
        >
          Add Manhole
        </button>
      </div>

      {message && <p className="mb-4 text-red-600">{message}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : manholes.length === 0 ? (
        <p className="text-gray-600">No manholes yet for this project.</p>
      ) : (
        <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2 border-b">Identifier</th>
                  <th className="px-4 py-2 border-b">Service</th>
                  <th className="px-4 py-2 border-b w-px">Actions</th>
                </tr>
              </thead>
              <tbody>
                {manholes.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-b font-medium">{m.identifier || '-'}</td>
                    <td className="px-4 py-2 border-b">{m.service_type || '-'}</td>
                    <td className="px-4 py-2 border-b text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => router.push(`/manholes/${m.id}/edit`)}
                          className="p-1.5 rounded hover:bg-gray-200 text-gray-700"
                          title="Edit"
                          aria-label="Edit"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M16.862 3.487a1.75 1.75 0 0 1 2.476 2.476l-10 10a1.75 1.75 0 0 1-.72.438l-4 1.25a.75.75 0 0 1-.938-.938l1.25-4a1.75 1.75 0 0 1 .438-.72l10-10Z" />
                            <path d="M15 5 19 9" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={() => deleteManhole(m.id)}
                            disabled={deletingId === m.id}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50"
                            title="Delete"
                            aria-label="Delete"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                              <path d="M9 3.75A1.75 1.75 0 0 1 10.75 2h2.5A1.75 1.75 0 0 1 15 3.75V5h4.25a.75.75 0 0 1 0 1.5H4.75a.75.75 0 0 1 0-1.5H9V3.75Z" />
                              <path d="M6.5 7h11l-.7 11.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6.5 7Z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      )}
    </SidebarLayout>
  )
}
