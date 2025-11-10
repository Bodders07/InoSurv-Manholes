'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
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

export function AddManholeForm({ standaloneLayout = true }: { standaloneLayout?: boolean }) {
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
    ['A'].map(l => ({ label: `Pipe ${l}`, func: '', shape: '', material: '', invert_depth_m: '', width_mm: '', height_mm: '', diameter_mm: '', notes: '' }))
  )
  const [outgoing, setOutgoing] = useState<Pipe[]>(() =>
    ['X'].map(l => ({ label: `Pipe ${l}`, func: '', shape: '', material: '', invert_depth_m: '', width_mm: '', height_mm: '', diameter_mm: '', notes: '' }))
  )

  const [message, setMessage] = useState('')
  const [copyList, setCopyList] = useState(false)

  // Cover
  const [coverShape, setCoverShape] = useState('')
  const [coverDiameter, setCoverDiameter] = useState('')
  const [coverWidth, setCoverWidth] = useState('')
  const [coverLength, setCoverLength] = useState('')
  const [coverMaterial, setCoverMaterial] = useState('')
  const [coverMaterialOther, setCoverMaterialOther] = useState('')

  // Chamber shape
  const [chamberShape, setChamberShape] = useState('')
  const [chamberDiameter, setChamberDiameter] = useState('')
  const [chamberWidth, setChamberWidth] = useState('')
  const [chamberLength, setChamberLength] = useState('')

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
  function removeIncomingPipe(index: number) {
    if (index === 0) return // keep Pipe A as default
    setIncoming((arr) => arr.filter((_, i) => i !== index))
  }
  function addOutgoingPipe() {
    const last = outgoing[outgoing.length - 1]?.label || 'Pipe X'
    const next = nextLabel(last.replace('Pipe ', '') || 'X')
    setOutgoing([...outgoing, { label: `Pipe ${next}`, func: '', shape: '', material: '', invert_depth_m: '', width_mm: '', height_mm: '', diameter_mm: '', notes: '' }])
  }
  function removeOutgoingPipe(index: number) {
    if (index === 0) return // keep Pipe X as default
    setOutgoing((arr) => arr.filter((_, i) => i !== index))
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
      // cover specifics
      cover_shape: coverShape || null,
      cover_diameter_mm: coverShape === 'Circle' ? (coverDiameter || null) : null,
      cover_width_mm: coverShape && coverShape !== 'Circle' ? (coverWidth || null) : null,
      cover_length_mm: coverShape && coverShape !== 'Circle' ? (coverLength || null) : null,
      cover_material: coverMaterial || null,
      cover_material_other: coverMaterial === 'Other' ? (coverMaterialOther || null) : null,
      // chamber shape specifics
      chamber_shape: chamberShape || null,
      chamber_diameter_mm: (chamberShape === 'Circle' || chamberShape === 'Hexagon') ? (chamberDiameter || null) : null,
      chamber_width_mm: (chamberShape === 'Square' || chamberShape === 'Rectangle') ? (chamberWidth || null) : null,
      chamber_length_mm: (chamberShape === 'Square' || chamberShape === 'Rectangle') ? (chamberLength || null) : null,
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
      const hint = `
To support these fields, add columns in Supabase (run once):

ALTER TABLE public.manholes
  ADD COLUMN IF NOT EXISTS survey_date date,
  ADD COLUMN IF NOT EXISTS measuring_tool text,
  ADD COLUMN IF NOT EXISTS measuring_offset_mm integer,
  ADD COLUMN IF NOT EXISTS location_desc text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS easting numeric,
  ADD COLUMN IF NOT EXISTS northing numeric,
  ADD COLUMN IF NOT EXISTS cover_level numeric,
  ADD COLUMN IF NOT EXISTS cover_shape text,
  ADD COLUMN IF NOT EXISTS cover_diameter_mm integer,
  ADD COLUMN IF NOT EXISTS cover_width_mm integer,
  ADD COLUMN IF NOT EXISTS cover_length_mm integer,
  ADD COLUMN IF NOT EXISTS cover_material text,
  ADD COLUMN IF NOT EXISTS cover_material_other text,
  ADD COLUMN IF NOT EXISTS chamber_shape text,
  ADD COLUMN IF NOT EXISTS chamber_diameter_mm integer,
  ADD COLUMN IF NOT EXISTS chamber_width_mm integer,
  ADD COLUMN IF NOT EXISTS chamber_length_mm integer,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS type_other text,
  ADD COLUMN IF NOT EXISTS cover_lifted text,
  ADD COLUMN IF NOT EXISTS cover_lifted_reason text,
  ADD COLUMN IF NOT EXISTS incoming_pipes jsonb,
  ADD COLUMN IF NOT EXISTS outgoing_pipes jsonb;`
      setMessage('Error: ' + error.message + hint)
    } else {
      setMessage('Success: Manhole created.')
      // Reset fields; optionally keep project/date/tool when copyList is enabled
      setIdentifier('')
      if (!copyList) {
        setProjectId('')
        setSurveyDate('')
        setMeasuringTool('')
      }
      setLaserOffset('')
      setLocationDesc('')
      setLatitude('')
      setLongitude('')
      setEasting('')
      setNorthing('')
      setCoverLevel('')
      setServiceType('')
      setType('')
      setTypeOther('')
      setCoverLifted('')
      setCoverNotReason('')
      setCoverShape('')
      setCoverDiameter('')
      setCoverWidth('')
      setCoverLength('')
      setChamberShape('')
      setChamberDiameter('')
      setChamberWidth('')
      setChamberLength('')
      setIncoming([{ label: 'Pipe A', func: '', shape: '', material: '', invert_depth_m: '', width_mm: '', height_mm: '', diameter_mm: '', notes: '' }])
      setOutgoing([{ label: 'Pipe X', func: '', shape: '', material: '', invert_depth_m: '', width_mm: '', height_mm: '', diameter_mm: '', notes: '' }])
    }
  }

  const content = (<>
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

          <div className="md:col-span-2 flex items-center justify-end gap-2">
            <input
              id="copy-list"
              type="checkbox"
              checked={copyList}
              onChange={(e) => setCopyList(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="copy-list" className="text-sm text-gray-700">
              Copy list (keep Project, Date, Measuring Tool for next manhole)
            </label>
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

        {/* Cover */}
        <h2 className="text-xl font-semibold mt-8 mb-3">Cover</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Shape</label>
            <select className="w-full border p-2 rounded" value={coverShape} onChange={(e)=>setCoverShape(e.target.value)}>
              <option value="">Select shape</option>
              {['Circle','Square','Rectangle','Triangle'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Cover Material</label>
            <select className="w-full border p-2 rounded" value={coverMaterial} onChange={(e)=>setCoverMaterial(e.target.value)}>
              <option value="">Select material</option>
              {['Cast Iron','Light Steel','Heavy Steel','Concrete','Plastic','Metal','Other'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {coverMaterial === 'Other' && (
              <input className="mt-2 w-full border p-2 rounded" placeholder="If Other, specify" value={coverMaterialOther} onChange={(e)=>setCoverMaterialOther(e.target.value)} />
            )}
          </div>
          {coverShape === 'Circle' ? (
            <div>
              <label className="block text-sm mb-1">Diameter (mm)</label>
              <input className="w-full border p-2 rounded" value={coverDiameter} onChange={(e)=>setCoverDiameter(e.target.value)} />
            </div>
          ) : coverShape ? (
            <>
              <div>
                <label className="block text-sm mb-1">Width (mm)</label>
                <input className="w-full border p-2 rounded" value={coverWidth} onChange={(e)=>setCoverWidth(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-1">Length (mm)</label>
                <input className="w-full border p-2 rounded" value={coverLength} onChange={(e)=>setCoverLength(e.target.value)} />
              </div>
            </>
          ) : null}
        </div>

        {/* Chamber Shape */}
        <h2 className="text-xl font-semibold mt-8 mb-3">Chamber Shape</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Shape</label>
            <select className="w-full border p-2 rounded" value={chamberShape} onChange={(e)=>setChamberShape(e.target.value)}>
              <option value="">Select shape</option>
              {['Circle','Square','Rectangle','Hexagon'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {(chamberShape === 'Circle' || chamberShape === 'Hexagon') ? (
            <div>
              <label className="block text-sm mb-1">Diameter (mm)</label>
              <input className="w-full border p-2 rounded" value={chamberDiameter} onChange={(e)=>setChamberDiameter(e.target.value)} />
            </div>
          ) : (chamberShape === 'Square' || chamberShape === 'Rectangle') ? (
            <>
              <div>
                <label className="block text-sm mb-1">Width (mm)</label>
                <input className="w-full border p-2 rounded" value={chamberWidth} onChange={(e)=>setChamberWidth(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-1">Length (mm)</label>
                <input className="w-full border p-2 rounded" value={chamberLength} onChange={(e)=>setChamberLength(e.target.value)} />
              </div>
            </>
          ) : null}
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
                {['Circular','Egg','Brick Arch','Unknown','Other'].includes(p.shape) ? (
                  <div>
                    <label className="block text-sm mb-1">Pipe Diameter (mm)</label>
                    <input className="w-full border p-2 rounded" value={p.diameter_mm} onChange={(e)=>{const v=[...incoming]; v[idx].diameter_mm=e.target.value; setIncoming(v)}} />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm mb-1">Pipe Width (mm)</label>
                      <input className="w-full border p-2 rounded" value={p.width_mm} onChange={(e)=>{const v=[...incoming]; v[idx].width_mm=e.target.value; setIncoming(v)}} />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Pipe Height (mm)</label>
                      <input className="w-full border p-2 rounded" value={p.height_mm} onChange={(e)=>{const v=[...incoming]; v[idx].height_mm=e.target.value; setIncoming(v)}} />
                    </div>
                  </>
                )}
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1">Notes</label>
                  <input className="w-full border p-2 rounded" value={p.notes} onChange={(e)=>{const v=[...incoming]; v[idx].notes=e.target.value; setIncoming(v)}} />
                </div>
              </div>
              {idx > 0 && (
                <div className="mt-3 text-right">
                  <button
                    onClick={() => removeIncomingPipe(idx)}
                    className="px-3 py-1 rounded text-white bg-red-600 hover:bg-red-700"
                  >
                    Remove Pipe
                  </button>
                </div>
              )}
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
                {['Circular','Egg','Brick Arch','Unknown','Other'].includes(p.shape) ? (
                  <div>
                    <label className="block text-sm mb-1">Pipe Diameter (mm)</label>
                    <input className="w-full border p-2 rounded" value={p.diameter_mm} onChange={(e)=>{const v=[...outgoing]; v[idx].diameter_mm=e.target.value; setOutgoing(v)}} />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm mb-1">Pipe Width (mm)</label>
                      <input className="w-full border p-2 rounded" value={p.width_mm} onChange={(e)=>{const v=[...outgoing]; v[idx].width_mm=e.target.value; setOutgoing(v)}} />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Pipe Height (mm)</label>
                      <input className="w-full border p-2 rounded" value={p.height_mm} onChange={(e)=>{const v=[...outgoing]; v[idx].height_mm=e.target.value; setOutgoing(v)}} />
                    </div>
                  </>
                )}
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1">Notes</label>
                  <input className="w-full border p-2 rounded" value={p.notes} onChange={(e)=>{const v=[...outgoing]; v[idx].notes=e.target.value; setOutgoing(v)}} />
                </div>
                {idx > 0 && (
                  <div className="mt-3 text-right md:col-span-3">
                    <button
                      onClick={() => removeOutgoingPipe(idx)}
                      className="px-3 py-1 rounded text-white bg-red-600 hover:bg-red-700"
                    >
                      Remove Pipe
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <button onClick={addOutgoingPipe} className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50">Add pipe</button>
        </div>

        <button onClick={addManhole} className="mt-8 w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Save Manhole</button>

        {message && <pre className="mt-4 whitespace-pre-wrap text-sm">{message}</pre>}
      </div>
    </>);
  if (standaloneLayout) { return (<SidebarLayout>{content}</SidebarLayout>); }
  return content;
}

export const dynamic = 'force-dynamic'

export default function AddManholePage() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <AddManholeForm />
    </Suspense>
  )
}








