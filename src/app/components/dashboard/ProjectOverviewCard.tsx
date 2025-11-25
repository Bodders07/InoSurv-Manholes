"use client"

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface ProjectSummary {
  total: number
  archived: number
  completed: number
  chambers: number
}

interface RecentProject {
  id: string
  name: string | null
  project_number: string | null
  client: string | null
}

export default function ProjectOverviewCard() {
  const [stats, setStats] = useState<ProjectSummary>({ total: 0, archived: 0, completed: 0, chambers: 0 })
  const [recent, setRecent] = useState<RecentProject[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [{ count: totalProjects, error: totalError }, { count: archivedProjects, error: archivedError }, { count: completedProjects, error: completedError }, { count: chamberCount, error: chamberError }] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('archived', true).is('deleted_at', null),
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('completed', true).is('deleted_at', null),
        supabase.from('chambers').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      ])

      if (totalError || archivedError || completedError || chamberError) {
        const err = totalError || archivedError || completedError || chamberError
        throw err
      }

      setStats({
        total: totalProjects ?? 0,
        archived: archivedProjects ?? 0,
        completed: completedProjects ?? 0,
        chambers: chamberCount ?? 0,
      })

      const { data: recentProjects, error: recentError } = await supabase
        .from('projects')
        .select('id, name, project_number, client')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(5)

      if (recentError) throw recentError
      setRecent(recentProjects || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to load project summary')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const active = Math.max(stats.total - stats.archived, 0)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Project overview</h2>
          <p className="text-sm text-gray-500">Workspace snapshot</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-gray-500">Active projects</dt>
          <dd className="text-2xl font-semibold">{active}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Completed projects</dt>
          <dd className="text-2xl font-semibold">{stats.completed}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Archived projects</dt>
          <dd className="text-2xl font-semibold">{stats.archived}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Total chambers</dt>
          <dd className="text-2xl font-semibold">{stats.chambers}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <h3 className="text-sm font-semibold text-gray-700">Recently updated</h3>
        <ul className="mt-2 space-y-1 text-sm text-gray-600">
          {recent.length === 0 && <li className="text-gray-400">No recent projects</li>}
          {recent.map((proj) => (
            <li key={proj.id} className="flex justify-between">
              <span className="font-medium">{proj.project_number || proj.name || 'Unnamed project'}</span>
              {proj.client && <span className="text-gray-500">{proj.client}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
