'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import SidebarLayout from '@/app/components/SidebarLayout'
import { supabase } from '@/lib/supabaseClient'

interface Project {
  id: string
  name: string
}

type Pipe = {
  label: string
  func: string
  shape: string
  material: string
  invert_depth_m: string
  width_mm: string
  height_mm: string
  diameter_mm: string
  notes: string
}

const SERVICE_TYPES = [
  'Water','Foul Water','Surface Water','Combined','Soakaway','Interceptor','Storm Water Overflow','Electric','BT','Telecom',
  'Traffic Sig','CATV','SV','FH','AV','WO','CCTV','Comms','Fuel Tank','Fuel Vent','Fuel Filler','WM','Empty','GV','Other',
  'Cables','Ducts','Fibre','FWS','Gas','Heating Pipes','Pipes','CWS','SWS','Unidentified'
]

const TYPE_OPTIONS = [
  'Manhole','Hatchbox','Lamphole','Dual','Junction','Rodding Eye','Outfall','CSO Chamber','Pumping Station','Inlet','Other'
]

const MEASURING_TOOLS = ['Tape','Staff','Laser Level']
const PIPE_FUNCTIONS = [
  'Sewer','Watercourse','Combined','Highway','Gulley','Outlet','Inlet','Overflow','Backdrop','Vent Pipe','Foul Water Pipe',
  'Surface Water Pipe','Duct','MH','OS','UTT','UTS','RWP','GU','BLD','Post','Empty'
]
const PIPE_SHAPES = ['Circular','Egg','Rectangular','Trapezoidal','Square','Brick Arch','Unknown','Other']
const PIPE_MATERIALS = ['Vitrified Clay','Concrete','Plastic','Asbestos Cement','Cast Iron','Spun Iron','Steel','Brick','Pitch Fibre','Unknown','Other']

function nextLabel(current: string) {
  const code = current.charCodeAt(0)
  return String.fromCharCode(Math.min(90, code + 1)) // up to 'Z'
}

export default function AddManholePage() {
  const params = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')

  // Basic fields
  const [identifier, setIdentifier] = useState('')
  const [surveyDate, setSurveyDate] = useState('')
  const [measuringTool, setMeasuringTool] = useState('')
  const [laserOffset, setLaserOffset] = useState('')
  const [locationDesc, setLocationDesc] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [easting, setEasting] = useState('')
  const [northing, setNorthing] = useState('')
  const [coverLevel, setCoverLevel] = useState('')

  // Service/type
  const [serviceType, setServiceType] = useState('')
  const [type, setType] = useState('')
  const [typeOther, setTypeOther] = useState('')

  // Cover lifted
  const [coverLifted, setCoverLifted] = useState('')
  const [coverNotReason, setCoverNotReason] = useState('')

  // Pipes
  const [incoming, setIncoming] = useState<Pipe[]>(() =>
    ['A','B','C','D','E','F'].map(l => ({ label: `Pipe ${l}`, func: '', shape: '', material: '', invert_depth_m: '', width_mm: '', height_mm: '', diameter_mm: '', notes: '' }))
  )
  const [outgoing, setOutgoing] = useState<Pipe[]>(() =>
    ['X'].map(l => ({ label: `Pipe ${l}`, func: '', shape: '', material: '', invert_depth_m: '', width_mm: '', height_mm: '', diameter_mm: '', notes: '' }))
  )

  const [message, setMessage] = useState('')

  useEffect(() => {
    async function fetchProjects() {
      const { data, error } = await supabase.from('projects').select('id, name')
      if (!error && data) setProjects(data)
    }
    fetchProjects()
  }, [])

  // Preselect project via ?project=
  useEffect(() => {
    const q = params.get('project')
    if (q) setProjectId(q)
  }, [params])

  function addIncomingPipe() {
    const last = incoming[incoming.length - 1]?.label || 'Pipe A'
    const next = nextLabel(last.replace('Pipe ', '') || 'A')
    setIncoming([...incoming, { label: `Pipe ${next}`, func: '', shape: '', material: '', invert_depth_m: '', width_mm: '', height_mm: '', diameter_mm: '', notes: '' }])
  }
  function addOutgoingPipe() {
    const last = outgoing[outgoing.length - 1]?.label || 'Pipe X'
    const next = nextLabel(last.replace('Pipe ', '') || 'X')
    setOutgoing([...outgoing, { label: `Pipe ${next}`, func: '', shape: '', material: '', invert_depth_m: '', width_mm: '', height_mm: '', diameter_mm: '', notes: '' }])
  }

  async function addManhole() {
    if (!projectId || !identifier) {
      setMessage('Please select a project and enter an identifier.')
      return
    }

    const payload: any = {
      project_id: projectId,
      identifier,
      survey_date: surveyDate || null,
      measuring_tool: measuringTool || null,
      measuring_offset_mm: measuringTool === 'Laser Level' ? (laserOffset || null) : null,
      location_desc: locationDesc || null,
      latitude: latitude || null,
      longitude: longitude || null,
      easting: easting || null,
      northing: northing || null,
      cover_level: coverLevel || null,
      service_type: serviceType || null,
      type: type || null,
      type_other: type === 'Other' ? (typeOther || null) : null,
      cover_lifted: coverLifted || null,
      cover_lifted_reason: coverLifted === 'No' ? (coverNotReason || null) : null,
      incoming_pipes: incoming,
      outgoing_pipes: outgoing,
    }

    const { error } = await supabase.from('manholes').insert([payload])
    if (error) {
      const hint = `\nTo support these fields, add columns in Supabase (run once):\n\nALTER TABLE public.manholes\n  ADD COLUMN IF NOT EXISTS survey_date date,\n  ADD COLUMN IF NOT EXISTS measuring_tool text,\n  ADD COLUMN IF NOT EXISTS measuring_offset_mm integer,\n  ADD COLUMN IF NOT EXISTS location_desc text,\n  ADD COLUMN IF NOT EXISTS latitude numeric,\n  ADD COLUMN IF NOT EXISTS longitude numeric,\n  ADD COLUMN IF NOT EXISTS easting numeric,\n  ADD COLUMN IF NOT EXISTS northing numeric,\n  ADD COLUMN IF NOT EXISTS cover_level numeric,\n  ADD COLUMN IF NOT EXISTS type text,\n  ADD COLUMN IF NOT EXISTS type_other text,\n  ADD COLUMN IF NOT EXISTS cover_lifted text,\n  ADD COLUMN IF NOT EXISTS cover_lifted_reason text,\n  ADD COLUMN IF NOT EXISTS incoming_pipes jsonb,\n  ADD COLUMN IF NOT EXISTS outgoing_pipes jsonb;`
      setMessage('Error: ' + error.message + hint)
    } else {
      setMessage('Success: Manhole created.')
      // reset key fields minimally
      setIdentifier('')
    }
  }

  return (
    <SidebarLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Add Manhole</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Project</label>
            <select className="w-full border p-2 rounded" value={projectId} onChange={(e)=>setProjectId(e.target.value)}>
              <option value="">Select Project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Manhole Identifier</label>
            <input className="w-full border p-2 rounded" value={identifier} onChange={(e)=>setIdentifier(e.target.value)} placeholder="e.g., MH-001" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Survey Date</label>
            <input type="date" className="w-full border p-2 rounded" value={surveyDate} onChange={(e)=>setSurveyDate(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Measuring Tools</label>
            <select className="w-full border p-2 rounded" value={measuringTool} onChange={(e)=>setMeasuringTool(e.target.value)}>
              <option value="">Select tool</option>
              {MEASURING_TOOLS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {measuringTool === 'Laser Level' && (
              <input className="mt-2 w-full border p-2 rounded" placeholder="Offset (mm)" value={laserOffset} onChange={(e)=>setLaserOffset(e.target.value)} />
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Location (description)</label>
            <input className="w-full border p-2 rounded" value={locationDesc} onChange={(e)=>setLocationDesc(e.target.value)} placeholder="e.g., Near signal, left cess" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Latitude</label>
            <input className="w-full border p-2 rounded" value={latitude} onChange={(e)=>setLatitude(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Longitude</label>
            <input className="w-full border p-2 rounded" value={longitude} onChange={(e)=>setLongitude(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Easting</label>
            <input className="w-full border p-2 rounded" value={easting} onChange={(e)=>setEasting(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Northing</label>
            <input className="w-full border p-2 rounded" value={northing} onChange={(e)=>setNorthing(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cover Level</label>
            <input className="w-full border p-2 rounded" value={coverLevel} onChange={(e)=>setCoverLevel(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Service Type</label>
            <select className="w-full border p-2 rounded" value={serviceType} onChange={(e)=>setServiceType(e.target.value)}>
              <option value="">Select service type</option>
              {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select className="w-full border p-2 rounded" value={type} onChange={(e)=>setType(e.target.value)}>
              <option value="">Select type</option>
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {type === 'Other' && (
              <input className="mt-2 w-full border p-2 rounded" placeholder="If Other, specify" value={typeOther} onChange={(e)=>setTypeOther(e.target.value)} />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cover Lifted</label>
            <select className="w-full border p-2 rounded" value={coverLifted} onChange={(e)=>setCoverLifted(e.target.value)}>
              <option value="">Select option</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
            {coverLifted === 'No' && (
              <input className="mt-2 w-full border p-2 rounded" placeholder="If No, specify why" value={coverNotReason} onChange={(e)=>setCoverNotReason(e.target.value)} />
            )}
          </div>
        </div>

        {/* Incoming Pipes */}
        <h2 className="text-xl font-semibold mt-8 mb-3">Incoming Pipes</h2>
        <div className="space-y-4">
          {incoming.map((p, idx) => (
            <div key={idx} className="border rounded p-4 bg-white">
              <div className="font-medium mb-3">{p.label}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm mb-1">Function</label>
                  <select className="w-full border p-2 rounded" value={p.func} onChange={(e)=>{
                    const v=[...incoming]; v[idx].func=e.target.value; setIncoming(v)
                  }}>
                    <option value="">Select</option>
                    {PIPE_FUNCTIONS.map(o=> <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Shape</label>
                  <select className="w-full border p-2 rounded" value={p.shape} onChange={(e)=>{const v=[...incoming]; v[idx].shape=e.target.value; setIncoming(v)}}>
                    <option value="">Select</option>
                    {PIPE_SHAPES.map(o=> <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Material</label>
                  <select className="w-full border p-2 rounded" value={p.material} onChange={(e)=>{const v=[...incoming]; v[idx].material=e.target.value; setIncoming(v)}}>
                    <option value="">Select</option>
                    {PIPE_MATERIALS.map(o=> <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm mb-1">Invert Depth (m)</label>
                  <input className="w-full border p-2 rounded" value={p.invert_depth_m} onChange={(e)=>{const v=[...incoming]; v[idx].invert_depth_m=e.target.value; setIncoming(v)}} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Pipe Width (mm)</label>
                  <input className="w-full border p-2 rounded" value={p.width_mm} onChange={(e)=>{const v=[...incoming]; v[idx].width_mm=e.target.value; setIncoming(v)}} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Pipe Height (mm)</label>
                  <input className="w-full border p-2 rounded" value={p.height_mm} onChange={(e)=>{const v=[...incoming]; v[idx].height_mm=e.target.value; setIncoming(v)}} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Pipe Diameter (mm)</label>
                  <input className="w-full border p-2 rounded" value={p.diameter_mm} onChange={(e)=>{const v=[...incoming]; v[idx].diameter_mm=e.target.value; setIncoming(v)}} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1">Notes</label>
                  <input className="w-full border p-2 rounded" value={p.notes} onChange={(e)=>{const v=[...incoming]; v[idx].notes=e.target.value; setIncoming(v)}} />
                </div>
              </div>
            </div>
          ))}
          <button onClick={addIncomingPipe} className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50">Add pipe</button>
        </div>

        {/* Outgoing Pipes */}
        <h2 className="text-xl font-semibold mt-8 mb-3">Outgoing Pipes</h2>
        <div className="space-y-4">
          {outgoing.map((p, idx) => (
            <div key={idx} className="border rounded p-4 bg-white">
              <div className="font-medium mb-3">{p.label}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm mb-1">Function</label>
                  <select className="w-full border p-2 rounded" value={p.func} onChange={(e)=>{const v=[...outgoing]; v[idx].func=e.target.value; setOutgoing(v)}}>
                    <option value="">Select</option>
                    {PIPE_FUNCTIONS.map(o=> <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Shape</label>
                  <select className="w-full border p-2 rounded" value={p.shape} onChange={(e)=>{const v=[...outgoing]; v[idx].shape=e.target.value; setOutgoing(v)}}>
                    <option value="">Select</option>
                    {PIPE_SHAPES.map(o=> <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Material</label>
                  <select className="w-full border p-2 rounded" value={p.material} onChange={(e)=>{const v=[...outgoing]; v[idx].material=e.target.value; setOutgoing(v)}}>
                    <option value="">Select</option>
                    {PIPE_MATERIALS.map(o=> <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Invert Depth (m)</label>
                  <input className="w-full border p-2 rounded" value={p.invert_depth_m} onChange={(e)=>{const v=[...outgoing]; v[idx].invert_depth_m=e.target.value; setOutgoing(v)}} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Pipe Width (mm)</label>
                  <input className="w-full border p-2 rounded" value={p.width_mm} onChange={(e)=>{const v=[...outgoing]; v[idx].width_mm=e.target.value; setOutgoing(v)}} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Pipe Height (mm)</label>
                  <input className="w-full border p-2 rounded" value={p.height_mm} onChange={(e)=>{const v=[...outgoing]; v[idx].height_mm=e.target.value; setOutgoing(v)}} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Pipe Diameter (mm)</label>
                  <input className="w-full border p-2 rounded" value={p.diameter_mm} onChange={(e)=>{const v=[...outgoing]; v[idx].diameter_mm=e.target.value; setOutgoing(v)}} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1">Notes</label>
                  <input className="w-full border p-2 rounded" value={p.notes} onChange={(e)=>{const v=[...outgoing]; v[idx].notes=e.target.value; setOutgoing(v)}} />
                </div>
              </div>
            </div>
          ))}
          <button onClick={addOutgoingPipe} className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50">Add pipe</button>
        </div>

        <button onClick={addManhole} className="mt-8 w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Save Manhole</button>

        {message && <pre className="mt-4 whitespace-pre-wrap text-sm">{message}</pre>}
      </div>
    </SidebarLayout>
  )
}
