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
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('project_number')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  // Filters (in panel)
  const [filterProjectNo, setFilterProjectNo] = useState<string>('')
  const [filterClient, setFilterClient] = useState<string>('')
  const [filterProjectName, setFilterProjectName] = useState<string>('')
  const [query, setQuery] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showFilter, setShowFilter] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setMessage('')
      const [projRes, mhRes] = await Promise.all([
        supabase.from('projects').select('id, name, project_number, client'),
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
      supabase.from('projects').select('id, name, project_number, client'),
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
    const map = new Map<string, { name: string; project_number: string; client?: string | null }>()
    projects.forEach((p) => map.set(p.id, { name: p.name || '', project_number: p.project_number || '', client: (p as any).client || '' }))
    return map
  }, [projects])

  const rows = useMemo(() => {
    let data = manholes.map((m) => {
      const p = projectById.get(m.project_id) || { name: '', project_number: '', client: '' }
      return {
        id: m.id,
        identifier: m.identifier || '',
        project_name: p.name,
        project_number: p.project_number,
        project_client: (p as any).client || '',
      }
    })
    if (filterProjectNo) data = data.filter((r) => r.project_number === filterProjectNo)
    if (filterClient) data = data.filter((r) => r.project_client === filterClient)
    if (filterProjectName) data = data.filter((r) => r.project_name === filterProjectName)
    if (query.trim()) {
      const q = query.toLowerCase()
      data = data.filter(
        (r) =>
          (r.identifier || '').toLowerCase().includes(q) ||
          (r.project_name || '').toLowerCase().includes(q) ||
          (r.project_number || '').toLowerCase().includes(q) ||
          (r.project_client || '').toLowerCase().includes(q)
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
  }, [manholes, projectById, sortKey, sortDir, filterProjectNo, filterClient, filterProjectName, query])

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manholes</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M10 3.75a6.25 6.25 0 1 1 0 12.5 6.25 6.25 0 0 1 0-12.5Zm8.53 13.72-2.91-2.91a7.75 7.75 0 1 0-1.06 1.06l2.91 2.91a.75.75 0 1 0 1.06-1.06Z"/></svg>
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search manholes..."
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
            onClick={() => setCreateOpen(true)}
            className="px-3 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700"
          >
            <span className="inline-flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 4.75a.75.75 0 0 1 .75.75v5.75H18.5a.75.75 0 0 1 0 1.5h-5.75V18.5a.75.75 0 0 1-1.5 0v-5.75H5.5a.75.75 0 0 1 0-1.5h5.75V5.5a.75.75 0 0 1 .75-.75Z"/></svg>
              New Manhole
            </span>
          </button>
        </div>
      </div>

      {showFilter && (
        <div className="mb-4 p-3 border rounded-lg bg-white dark:bg-neutral-900 text-sm text-gray-600 dark:text-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Project No.</label>
              <select
                className="w-full border rounded px-2 py-1 bg-white dark:bg-neutral-800"
                value={filterProjectNo}
                onChange={(e) => setFilterProjectNo(e.target.value)}
              >
                <option value="">All numbers</option>
                {[...new Set(projects.map(p => p.project_number || '').filter(Boolean))]
                  .sort((a,b)=>a.localeCompare(b))
                  .map(n => (<option key={n} value={n}>{n}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Client</label>
              <select
                className="w-full border rounded px-2 py-1 bg-white dark:bg-neutral-800"
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
              >
                <option value="">All clients</option>
                {[...new Set(projects.map(p => (p as any).client || '').filter(Boolean))]
                  .sort((a,b)=>a.localeCompare(b))
                  .map(c => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Project Name</label>
              <select
                className="w-full border rounded px-2 py-1 bg-white dark:bg-neutral-800"
                value={filterProjectName}
                onChange={(e) => setFilterProjectName(e.target.value)}
              >
                <option value="">All names</option>
                {[...new Set(projects.map(p => p.name || '').filter(Boolean))]
                  .sort((a,b)=>a.localeCompare(b))
                  .map(n => (<option key={n} value={n}>{n}</option>))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => { setFilterProjectNo(''); setFilterClient(''); setFilterProjectName(''); setQuery('') }}
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
                    <a
                      href={`/manholes/${r.id}/export`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
                    >
                      Export
                    </a>
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
                loading="lazy"
                className="w-full"
                style={{ height: '80vh', border: 'none', background: 'transparent' }}
              />
            </div>
          </div>
        </div>
      )}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2" onClick={() => setCreateOpen(false)}>
          <div className="bg-white theme-dark:bg-[#0b0b0b] border border-gray-200 theme-dark:border-gray-700 rounded-lg shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 theme-dark:border-gray-700">
              <h3 className="text-lg font-semibold">New Manhole</h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">Close</button>
            </div>
            <div className="p-0 overflow-hidden">
              <iframe title="Add Manhole" src={`/manholes/add?embed=1`} loading="lazy" className="w-full" style={{ height: '80vh', border: 'none', background: 'transparent' }} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
