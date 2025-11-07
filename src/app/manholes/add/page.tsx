'use client'

import { useState, useEffect } from 'react'
import SidebarLayout from '@/app/components/SidebarLayout'
import { supabase } from '@/lib/supabaseClient'

interface Project {
  id: string
  name: string
}

export default function AddManholePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [message, setMessage] = useState('')

  const [serviceType, setServiceType] = useState('')
  const [serviceTypeOther, setServiceTypeOther] = useState('')
  const [locationType, setLocationType] = useState('')
  const [locationOther, setLocationOther] = useState('')
  const [lidMaterial, setLidMaterial] = useState('')
  const [chamberConstruction, setChamberConstruction] = useState('')

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

    const payload: any = {
      project_id: projectId,
      identifier,
      location: 'POINT(0 0)',
      service_type: serviceType || null,
      service_type_other: serviceType === 'Other' ? serviceTypeOther || null : null,
      location_type: locationType || null,
      location_other: locationType === 'Other' ? locationOther || null : null,
      lid_material: lidMaterial || null,
      chamber_construction: chamberConstruction || null,
    }

    const { error } = await supabase.from('manholes').insert([payload])

    if (error) {
      const hint = `\nIf columns are missing, add them in Supabase:\n\nALTER TABLE public.manholes\n  ADD COLUMN IF NOT EXISTS service_type text,\n  ADD COLUMN IF NOT EXISTS service_type_other text,\n  ADD COLUMN IF NOT EXISTS location_type text,\n  ADD COLUMN IF NOT EXISTS location_other text,\n  ADD COLUMN IF NOT EXISTS lid_material text,\n  ADD COLUMN IF NOT EXISTS chamber_construction text;`
      setMessage('Error: ' + error.message + hint)
    } else {
      setMessage('Success: Manhole added successfully!')
      setIdentifier('')
      setServiceType('')
      setServiceTypeOther('')
      setLocationType('')
      setLocationOther('')
      setLidMaterial('')
      setChamberConstruction('')
    }
  }

  return (
    <SidebarLayout>
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Add Manhole</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Project</label>
            <select
              className="w-full border p-2 rounded"
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
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Manhole Identifier</label>
            <input
              type="text"
              placeholder="e.g., MH-001"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full border p-2 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Service Type</label>
            <select
              className="w-full border p-2 rounded"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
            >
              <option value="">Select service type</option>
              {[
                'Water','Foul Water','Surface Water','Combined','Soakaway','Interceptor','Storm Water overflow',
                'Electric','BT','Telecom','Traffic Signal','CATV','SV','FH','AV','Water Outlet','CCTV','Comms',
                'Fuel Vent','Fuel Filler','WM','Empty','Gas Valve','Other'
              ].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {serviceType === 'Other' && (
              <input
                className="mt-2 w-full border p-2 rounded"
                placeholder="If Other, specify"
                value={serviceTypeOther}
                onChange={(e)=>setServiceTypeOther(e.target.value)}
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <select
              className="w-full border p-2 rounded"
              value={locationType}
              onChange={(e) => setLocationType(e.target.value)}
            >
              <option value="">Select location</option>
              {[
                'Dn Cess','Up Cess','6ft','10ft','Left Cess','Right Cess','Off Track','Up & Dn Cess','Other'
              ].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {locationType === 'Other' && (
              <input
                className="mt-2 w-full border p-2 rounded"
                placeholder="If Other, specify"
                value={locationOther}
                onChange={(e)=>setLocationOther(e.target.value)}
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Lid Material</label>
            <select
              className="w-full border p-2 rounded"
              value={lidMaterial}
              onChange={(e) => setLidMaterial(e.target.value)}
            >
              <option value="">Select lid material</option>
              {[
                'Lid Missing','Concrete Single Lid','Concrete Multiple Lids','Concrete Lids with Metal Grille','Plastic Grille',
                'Timber','Metal Grille','Steel','Cast Iron','Metal'
              ].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Chamber Construction</label>
            <select
              className="w-full border p-2 rounded"
              value={chamberConstruction}
              onChange={(e) => setChamberConstruction(e.target.value)}
            >
              <option value="">Select chamber construction</option>
              {[
                'Unknown / Unable to lift','Brick','Concrete Rings','Plastic','Excavated'
              ].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={addManhole}
          className="mt-6 w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition"
        >
          Add Manhole
        </button>

        {message && (
          <pre className="mt-4 whitespace-pre-wrap text-sm">{message}</pre>
        )}
      </div>
    </SidebarLayout>
  )
}

