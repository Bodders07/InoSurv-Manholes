'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import SidebarLayout from '@/app/components/SidebarLayout'

type Project = { id: string; name: string | null; project_number: string | null }
type Manhole = { id: string; identifier: string | null; project_id: string }
type SortKey = 'project_number' | 'project_name' | 'identifier'

export default function ManholesPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [manholes, setManholes] = useState<Manhole[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('project_number')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setMessage('')
      const [projRes, mhRes] = await Promise.all([
        supabase.from('projects').select('id, name, project_number'),
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

  const projectById = useMemo(() => {
    const map = new Map<string, { name: string; project_number: string }>()
    projects.forEach((p) => map.set(p.id, { name: p.name || '', project_number: p.project_number || '' }))
    return map
  }, [projects])

  const rows = useMemo(() => {
    const data = manholes.map((m) => {
      const p = projectById.get(m.project_id) || { name: '', project_number: '' }
      return {
        id: m.id,
        identifier: m.identifier || '',
        project_name: p.name,
        project_number: p.project_number,
      }
    })
    const dir = sortDir === 'asc' ? 1 : -1
    return data.sort((a, b) => {
      const av = (a[sortKey] || '').toString().toLowerCase()
      const bv = (b[sortKey] || '').toString().toLowerCase()
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [manholes, projectById, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const SortButton = ({ label, keyName }: { label: string; keyName: SortKey }) => (
    <button onClick={() => toggleSort(keyName)} className="font-medium hover:underline inline-flex items-center">
      {label}
      <span className="ml-2 text-xs">{sortKey === keyName ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
    </button>
  )

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
      ) : rows.length === 0 ? (
        <p className="text-gray-600">No manholes yet. Add your first one.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2 border-b"><SortButton label="Projects" keyName="project_number" /></th>
                <th className="px-4 py-2 border-b"><SortButton label="Project Name" keyName="project_name" /></th>
                <th className="px-4 py-2 border-b"><SortButton label="Manhole Number" keyName="identifier" /></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border-b">{r.project_number || '-'}</td>
                  <td className="px-4 py-2 border-b">{r.project_name || '-'}</td>
                  <td className="px-4 py-2 border-b font-medium">{r.identifier || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SidebarLayout>
  )
}

