'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import SidebarLayout from '@/app/components/SidebarLayout'

interface Project {
  id: string
  name: string
}

interface Manhole {
  id: string
  identifier: string
  project_id: string
}

export default function ManholesPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [manholes, setManholes] = useState<Manhole[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setMessage('')
      const [projRes, mhRes] = await Promise.all([
        supabase.from('projects').select('id, name'),
        supabase.from('manholes').select('id, identifier, project_id'),
      ])

      if (projRes.error) setMessage('Error loading projects: ' + projRes.error.message)
      else setProjects(projRes.data || [])

      if (mhRes.error) setMessage((prev) => prev || 'Error loading manholes: ' + mhRes.error!.message)
      else setManholes(mhRes.data || [])

      setLoading(false)
    }
    loadData()
  }, [])

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>()
    projects.forEach((p) => map.set(p.id, p.name))
    return map
  }, [projects])

  return (
    <SidebarLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manholes</h1>
        <Link href="/manholes/add" className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700">
          Add Manhole
        </Link>
      </div>

      {message && <p className="mb-4 text-red-600">{message}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : manholes.length === 0 ? (
        <p className="text-gray-600">No manholes yet. Add your first one.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2 border-b">Identifier</th>
                <th className="px-4 py-2 border-b">Project</th>
              </tr>
            </thead>
            <tbody>
              {manholes.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border-b font-medium">{m.identifier}</td>
                  <td className="px-4 py-2 border-b">{projectNameById.get(m.project_id) || m.project_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SidebarLayout>
  )
}

