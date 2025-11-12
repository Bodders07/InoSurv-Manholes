'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useView } from '@/app/components/ViewContext'
import { supabase } from '@/lib/supabaseClient'
import { deriveRoleInfo, canAdminister, canManageEverything } from '@/lib/roles'

type Project = { id: string; name: string | null; project_number: string | null }
type Manhole = { id: string; identifier: string | null; project_id: string }
type SortKey = 'project_number' | 'project_name' | 'identifier'

export default function ManholesContent() {
  const { setView } = useView()
  const [editId, setEditId] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [manholes, setManholes] = useState<Manhole[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('project_number')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filterProject, setFilterProject] = useState<string>('')
  const [query, setQuery] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
    const detect = async () => {
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
    detect()
    const { data: sub } = supabase.auth.onAuthStateChange(() => detect())
    return () => sub.subscription.unsubscribe()
  }, [])

  async function reloadLists() {
    setLoading(true)
    const [projRes, mhRes] = await Promise.all([
      supabase.from('projects').select('id, name, project_number'),
      supabase.from('manholes').select('id, identifier, project_id'),
    ])
    if (!projRes.error && projRes.data) setProjects(projRes.data)
    if (!mhRes.error && mhRes.data) setManholes(mhRes.data)
    setLoading(false)
  }

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      if (!ev || typeof ev.data !== 'object') return
      const { type, refresh } = ev.data as any
      if (type === 'close-edit-modal') {
        setEditOpen(false)
        if (refresh) reloadLists()
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // Close modal on ESC for accessibility/mobile convenience
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setEditOpen(false)
    }
    if (editOpen) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editOpen])

  const projectById = useMemo(() => {
    const map = new Map<string, { name: string; project_number: string }>()
    projects.forEach((p) => map.set(p.id, { name: p.name || '', project_number: p.project_number || '' }))
    return map
  }, [projects])

  const rows = useMemo(() => {
    let data = manholes.map((m) => {
      const p = projectById.get(m.project_id) || { name: '', project_number: '' }
      return {
        id: m.id,
        identifier: m.identifier || '',
        project_name: p.name,
        project_number: p.project_number,
      }
    })
    if (filterProject) {
      data = data.filter((r) => r.project_number === filterProject || r.project_name === filterProject)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      data = data.filter(
        (r) =>
          (r.identifier || '').toLowerCase().includes(q) ||
          (r.project_name || '').toLowerCase().includes(q) ||
          (r.project_number || '').toLowerCase().includes(q)
      )
    }
    const dir = sortDir === 'asc' ? 1 : -1
    return data.sort((a, b) => {
      const av = (a[sortKey] || '').toString().toLowerCase()
      const bv = (b[sortKey] || '').toString().toLowerCase()
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [manholes, projectById, sortKey, sortDir, filterProject, query])

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
      <span className="ml-2 text-xs">{sortKey === keyName ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
    </button>
  )

  async function deleteManhole(id: string) {
    if (!isAdmin && !isSuperAdmin) return
    const proceed = typeof window !== 'undefined' ? window.confirm('Delete this manhole? This cannot be undone.') : true
    if (!proceed) return
    setMessage('')
    setDeletingId(id)
    const { error } = await supabase.from('manholes').delete().eq('id', id)
    setDeletingId(null)
    if (error) setMessage('Error: ' + error.message)
    else setManholes((list) => list.filter((m) => m.id !== id))
  }

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Manholes</h1>
        <button onClick={() => setView('manholes_add')} className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700">Add Manhole</button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Filter by Project</label>
          <select
            className="border rounded p-2 min-w-[220px]"
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
          >
            <option value="">All projects</option>
            {projects
              .slice()
              .sort((a, b) => (a.project_number || '').localeCompare(b.project_number || ''))
              .map((p) => (
                <option key={p.id} value={p.project_number || p.name || ''}>
                  {p.project_number || '-'} {p.name ? '— ' + p.name : ''}
                </option>
              ))}
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs text-gray-600 mb-1">Search</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by project or manhole number"
            className="w-full border rounded p-2"
          />
        </div>
        {(filterProject || query) && (
          <button
            onClick={() => {
              setFilterProject('')
              setQuery('')
            }}
            className="mt-5 h-9 px-3 rounded border border-gray-300 hover:bg-gray-50"
          >
            Clear filters
          </button>
        )}
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
                <th className="px-4 py-2 border-b w-px">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border-b">{r.project_number || '-'}</td>
                  <td className="px-4 py-2 border-b">{r.project_name || '-'}</td>
                  <td className="px-4 py-2 border-b font-medium">{r.identifier || '-'}</td>
                  <td className="px-4 py-2 border-b text-right">
                    <button
                      onClick={() => { setEditId(r.id); setEditOpen(true) }}
                      className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    {(isAdmin || isSuperAdmin) && (
                      <button
                        onClick={() => deleteManhole(r.id)}
                        disabled={deletingId === r.id}
                        className={`ml-2 px-3 py-1 rounded text-white ${
                          deletingId === r.id ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
                        }`}
                      >
                        {deletingId === r.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editOpen && editId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2" onClick={() => setEditOpen(false)}>
          <div className="bg-white theme-dark:bg-[#0b0b0b] border border-gray-200 theme-dark:border-gray-700 rounded-lg shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 theme-dark:border-gray-700">
              <h3 className="text-lg font-semibold">Edit Manhole</h3>
              <button type="button" onClick={() => setEditOpen(false)} className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">Close</button>
            </div>
            <div className="p-0 overflow-hidden">
              <iframe
                title="Edit Manhole"
                src={`/manholes/${editId}/edit?embed=1`}
                className="w-full"
                style={{ height: '80vh', border: 'none', background: 'transparent' }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
