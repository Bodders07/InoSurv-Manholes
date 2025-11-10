'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SidebarLayout from '@/app/components/SidebarLayout'
import { supabase } from '@/lib/supabaseClient'

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
const TYPE_OPTIONS = ['Manhole','Hatchbox','Lamphole','Dual','Junction','Rodding Eye','Outfall','CSO Chamber','Pumping Station','Inlet','Other']
const MEASURING_TOOLS = ['Tape','Staff','Laser Level']
const PIPE_FUNCTIONS = ['Sewer','Watercourse','Combined','Highway','Gulley','Outlet','Inlet','Overflow','Backdrop','Vent Pipe','Foul Water Pipe','Surface Water Pipe','Duct','MH','OS','UTT','UTS','RWP','GU','BLD','Post','Empty']
const PIPE_SHAPES = ['Circular','Egg','Rectangular','Trapezoidal','Square','Brick Arch','Unknown','Other']
const PIPE_MATERIALS = ['Vitrified Clay','Concrete','Plastic','Asbestos Cement','Cast Iron','Spun Iron','Steel','Brick','Pitch Fibre','Unknown','Other']

export default function EditManholePage() {
  const router = useRouter()
  const params = useParams() as { id: string }
  const manholeId = params.id

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  // basic
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

  // service/type
  const [serviceType, setServiceType] = useState('')
  const [type, setType] = useState('')
  const [typeOther, setTypeOther] = useState('')
  const [coverLifted, setCoverLifted] = useState('')
  const [coverNotReason, setCoverNotReason] = useState('')

  // Cover shape
  const [coverShape, setCoverShape] = useState('')
  const [coverDiameter, setCoverDiameter] = useState('')
  const [coverWidth, setCoverWidth] = useState('')
  const [coverLength, setCoverLength] = useState('')

  // Chamber shape
  const [chamberShape, setChamberShape] = useState('')
  const [chamberDiameter, setChamberDiameter] = useState('')
  const [chamberWidth, setChamberWidth] = useState('')
  const [chamberLength, setChamberLength] = useState('')

  // pipes
  const [incoming, setIncoming] = useState<Pipe[]>([])
  const [outgoing, setOutgoing] = useState<Pipe[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('manholes')
        .select('*')
        .eq('id', manholeId)
        .maybeSingle()
      if (error) setMessage('Error loading manhole: ' + error.message)
      if (data) {
        setIdentifier(data.identifier || '')
        setSurveyDate(data.survey_date || '')
        setMeasuringTool(data.measuring_tool || '')
        setLaserOffset((data.measuring_offset_mm ?? '').toString())
        setLocationDesc(data.location_desc || '')
        setLatitude((data.latitude ?? '').toString())
        setLongitude((data.longitude ?? '').toString())
        setEasting((data.easting ?? '').toString())
        setNorthing((data.northing ?? '').toString())
        setCoverLevel((data.cover_level ?? '').toString())
        setCoverShape(data.cover_shape || '')
        setCoverDiameter((data.cover_diameter_mm ?? '').toString())
        setCoverWidth((data.cover_width_mm ?? '').toString())
        setCoverLength((data.cover_length_mm ?? '').toString())
        setChamberShape(data.chamber_shape || '')
        setChamberDiameter((data.chamber_diameter_mm ?? '').toString())
        setChamberWidth((data.chamber_width_mm ?? '').toString())
        setChamberLength((data.chamber_length_mm ?? '').toString())
        setServiceType(data.service_type || '')
        setType(data.type || '')
        setTypeOther(data.type_other || '')
        setCoverLifted(data.cover_lifted || '')
        setCoverNotReason(data.cover_lifted_reason || '')
        setIncoming(Array.isArray(data.incoming_pipes) && data.incoming_pipes.length
          ? data.incoming_pipes
          : [{ label: 'Pipe A', func: '', shape: '', material: '', invert_depth_m: '', width_mm: '', height_mm: '', diameter_mm: '', notes: '' }])
        setOutgoing(Array.isArray(data.outgoing_pipes) && data.outgoing_pipes.length
          ? data.outgoing_pipes
          : [{ label: 'Pipe X', func: '', shape: '', material: '', invert_depth_m: '', width_mm: '', height_mm: '', diameter_mm: '', notes: '' }])
      }
      setLoading(false)
    }
    load()
  }, [manholeId])

  function nextLabel(current: string) {
    const code = current.charCodeAt(0)
    return String.fromCharCode(Math.min(90, code + 1))
  }
  function addIncomingPipe() {
    const last = incoming[incoming.length - 1]?.label || 'Pipe A'
    const next = nextLabel(last.replace('Pipe ', '') || 'A')
    setIncoming([...incoming, { label: `Pipe ${next}`, func: '', shape: '', material: '', invert_depth_m: '', width_mm: '', height_mm: '', diameter_mm: '', notes: '' }])
  }
  function removeIncomingPipe(index: number) { if (index === 0) return; setIncoming((arr)=>arr.filter((_,i)=>i!==index)) }
  function addOutgoingPipe() {
    const last = outgoing[outgoing.length - 1]?.label || 'Pipe X'
    const next = nextLabel(last.replace('Pipe ', '') || 'X')
    setOutgoing([...outgoing, { label: `Pipe ${next}`, func: '', shape: '', material: '', invert_depth_m: '', width_mm: '', height_mm: '', diameter_mm: '', notes: '' }])
  }
  function removeOutgoingPipe(index: number) { if (index === 0) return; setOutgoing((arr)=>arr.filter((_,i)=>i!==index)) }

  async function save() {
    setMessage('')
    const update: any = {
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
      cover_shape: coverShape || null,
      cover_diameter_mm: coverShape === 'Circle' ? (coverDiameter || null) : null,
      cover_width_mm: coverShape && coverShape !== 'Circle' ? (coverWidth || null) : null,
      cover_length_mm: coverShape && coverShape !== 'Circle' ? (coverLength || null) : null,
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
    const { error } = await supabase.from('manholes').update(update).eq('id', manholeId)
    if (error) setMessage('Error: ' + error.message)
    else setMessage('Success: Manhole updated.')
  }

  return (
    <SidebarLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Edit Manhole</h1>
        {message && <p className={`mb-4 ${message.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>{message}</p>}
        {loading ? (
          <p>Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Identifier</label>
                <input className="w-full border p-2 rounded" value={identifier} onChange={(e)=>setIdentifier(e.target.value)} />
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
                <input className="w-full border p-2 rounded" value={locationDesc} onChange={(e)=>setLocationDesc(e.target.value)} />
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

          {/* Cover Shape */}
          <h2 className="text-xl font-semibold mt-8 mb-3">Cover Shape</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">Shape</label>
              <select className="w-full border p-2 rounded" value={coverShape} onChange={(e)=>setCoverShape(e.target.value)}>
                <option value="">Select shape</option>
                {['Circle','Square','Rectangle','Triangle'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
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
                      <select className="w-full border p-2 rounded" value={p.func} onChange={(e)=>{const v=[...incoming]; v[idx].func=e.target.value; setIncoming(v)}}>
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
                  {idx > 0 && (
                    <div className="mt-3 text-right">
                      <button onClick={()=>removeIncomingPipe(idx)} className="px-3 py-1 rounded text-white bg-red-600 hover:bg-red-700">Remove Pipe</button>
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
                  {idx > 0 && (
                    <div className="mt-3 text-right md:col-span-3">
                      <button onClick={()=>removeOutgoingPipe(idx)} className="px-3 py-1 rounded text-white bg-red-600 hover:bg-red-700">Remove Pipe</button>
                    </div>
                  )}
                </div>
              ))}
              <button onClick={addOutgoingPipe} className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50">Add pipe</button>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Save</button>
              <button onClick={()=> router.back()} className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50">Back</button>
            </div>
          </>
        )}
      </div>
    </SidebarLayout>
  )
}
