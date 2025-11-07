'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SidebarLayout from '@/app/components/SidebarLayout'
import { supabase } from '@/lib/supabaseClient'

type Manhole = {
  id: string
  identifier: string | null
  project_id: string
  service_type: string | null
  location_type: string | null
  lid_material: string | null
  chamber_construction: string | null
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const projectId = params.id
  const [manholes, setManholes] = useState<Manhole[]>([])
  const [projectName, setProjectName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

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
      setLoading(false)
    }
    load()
  }, [projectId])

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
                <th className="px-4 py-2 border-b">Location</th>
                <th className="px-4 py-2 border-b">Lid</th>
                <th className="px-4 py-2 border-b">Chamber</th>
                <th className="px-4 py-2 border-b w-px">Actions</th>
              </tr>
            </thead>
            <tbody>
              {manholes.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border-b font-medium">{m.identifier || '-'}</td>
                  <td className="px-4 py-2 border-b">{m.service_type || '-'}</td>
                  <td className="px-4 py-2 border-b">{m.location_type || '-'}</td>
                  <td className="px-4 py-2 border-b">{m.lid_material || '-'}</td>
                  <td className="px-4 py-2 border-b">{m.chamber_construction || '-'}</td>
                  <td className="px-4 py-2 border-b text-right">
                    <button
                      onClick={() => router.push(`/manholes/${m.id}/edit`)}
                      className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
                    >
                      Edit
                    </button>
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

