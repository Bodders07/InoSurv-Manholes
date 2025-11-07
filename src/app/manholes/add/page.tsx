'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import SidebarLayout from '@/app/components/SidebarLayout'

interface Project {
  id: string
  name: string
}

export default function AddManholePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function fetchProjects() {
      const { data, error } = await supabase.from('projects').select('id, name')
      if (error) console.error(error)
      else setProjects(data)
    }
    fetchProjects()
  }, [])

  async function addManhole() {
    if (!projectId || !identifier) {
      setMessage('Please select a project and enter an identifier.')
      return
    }

    const { error } = await supabase.from('manholes').insert([
      {
        project_id: projectId,
        identifier,
        location: 'POINT(0 0)',
      },
    ])

    if (error) setMessage('Error: ' + error.message)
    else {
      setMessage('Success: Manhole added successfully!')
      setIdentifier('')
    }
  }

  return (
    <SidebarLayout>
      <div className="p-8 max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">Add Manhole</h1>

        <select
          className="w-full border p-2 mb-4 rounded"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">Select Project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Manhole Identifier"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="w-full border p-2 mb-4 rounded"
        />

        <button
          onClick={addManhole}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition"
        >
          Add Manhole
        </button>

        {message && <p className="mt-4">{message}</p>}
      </div>
    </SidebarLayout>
  )
}

