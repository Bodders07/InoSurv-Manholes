'use client'

import { useEffect, useState } from 'react'
import NextDynamic from 'next/dynamic'
import { type SketchState } from '@/app/components/sketch/ChamberSketch'
const ChamberSketch = NextDynamic(() => import('@/app/components/sketch/ChamberSketch'), { ssr: false })
import { useParams, useRouter, useSearchParams } from 'next/navigation'
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

type PipeLabelMode = 'letters' | 'numbers'

const PIPE_NUMBER_REGEX = /^Pipe\s+(\d+)/i

function createEmptyPipe(label: string): Pipe {
  return {
    label,
    func: '',
    shape: '',
    material: '',
    invert_depth_m: '',
    width_mm: '',
    height_mm: '',
    diameter_mm: '',
    notes: '',
  }
}

function letterForIndex(startCode: number, offset: number) {
  return String.fromCharCode(Math.min(90, startCode + offset))
}

function nextLabel(current: string) {
  const code = current.charCodeAt(0)
  return String.fromCharCode(Math.min(90, code + 1))
}

const SERVICE_TYPES = [
  'Water','Foul Water','Surface Water','Combined','Soakaway','Interceptor','Storm Water Overflow','Electric','BT','Telecom',
  'Traffic Sig','CATV','SV','FH','AV','WO','CCTV','Comms','Fuel Tank','Fuel Vent','Fuel Filler','WM','Empty','GV','Other',
  'Cables','Ducts','Fibre','FWS','Gas','Heating Pipes','Pipes','CWS','SWS','Unidentified'
]
const TYPE_OPTIONS = [
  'Manhole',
  'Catchpit',
  'Hatchbox',
  'Lamphole',
  'Dual',
  'Junction',
  'Rodding Eye',
  'Outfall',
  'CSO Chamber',
  'Pumping Station',
  'Inlet',
  'Other',
]
const MEASURING_TOOLS = ['Tape','Staff','Laser Level']
const PIPE_FUNCTIONS = ['Sewer','Watercourse','Combined','Highway','Gulley','Outlet','Inlet','Overflow','Backdrop','Vent Pipe','Foul Water Pipe','Surface Water Pipe','Duct','MH','OS','UTT','UTS','RWP','GU','BLD','Post','Empty']
const PIPE_SHAPES = ['Circular','Egg','Rectangular','Trapezoidal','Square','Brick Arch','Unknown','Other']
const PIPE_MATERIALS = ['Vitrified Clay','Concrete','Plastic','Asbestos Cement','Cast Iron','Spun Iron','Steel','Brick','Pitch Fibre','Unknown','Other']
type ManholeRow = {
  id: string
  identifier: string | null
  survey_date: string | null
  measuring_tool: string | null
  measuring_offset_mm: number | null
  location_desc: string | null
  latitude: number | null
  longitude: number | null
  easting: number | null
  northing: number | null
  cover_level: number | null
  cover_shape: string | null
  cover_diameter_mm: number | null
  cover_width_mm: number | null
  cover_length_mm: number | null
  cover_material: string | null
  cover_material_other: string | null
  cover_duty: string | null
  cover_condition: string | null
  chamber_shape: string | null
  chamber_diameter_mm: number | null
  chamber_width_mm: number | null
  chamber_length_mm: number | null
  chamber_material: string | null
  chamber_material_other: string | null
  service_type: string | null
  type: string | null
  type_other: string | null
  cover_lifted: string | null
  cover_lifted_reason: string | null
  incoming_pipes: Pipe[] | null
  outgoing_pipes: Pipe[] | null
  internal_photo_url: string | null
  external_photo_url: string | null
  sketch_json: SketchState | null
}

export default function EditManholePage() {
  const router = useRouter()
  const params = useParams() as { id: string }
  const searchParams = useSearchParams()
  const manholeId = params.id
  const embed = searchParams?.get('embed') === '1'

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
  const [pipeLabelMode, setPipeLabelMode] = useState<PipeLabelMode>('letters')
  const [coverLifted, setCoverLifted] = useState('')
  const [coverNotReason, setCoverNotReason] = useState('')

  // Cover shape
  const [coverShape, setCoverShape] = useState('')
  const [coverDiameter, setCoverDiameter] = useState('')
  const [coverWidth, setCoverWidth] = useState('')
  const [coverLength, setCoverLength] = useState('')
  const [coverMaterial, setCoverMaterial] = useState('')
  const [coverMaterialOther, setCoverMaterialOther] = useState('')
  const [coverDuty, setCoverDuty] = useState('')
  const [coverCondition, setCoverCondition] = useState('')

  // Chamber shape
  const [chamberShape, setChamberShape] = useState('')
  const [chamberDiameter, setChamberDiameter] = useState('')
  const [chamberWidth, setChamberWidth] = useState('')
  const [chamberLength, setChamberLength] = useState('')
  const [chamberMaterial, setChamberMaterial] = useState('')
  const [chamberMaterialOther, setChamberMaterialOther] = useState('')
  const [chamberCondition, setChamberCondition] = useState('')

  // photos
  const [internalPhotoUrl, setInternalPhotoUrl] = useState('')
  const [externalPhotoUrl, setExternalPhotoUrl] = useState('')
  const [internalPhotoFile, setInternalPhotoFile] = useState<File | null>(null)
  const [externalPhotoFile, setExternalPhotoFile] = useState<File | null>(null)

  // sketch
  const [sketch, setSketch] = useState<SketchState | null>(null)
  const [sketchOpen, setSketchOpen] = useState(false)
  const [sketchDraft, setSketchDraft] = useState<SketchState | null>(null)

  // pipes
  const [incoming, setIncoming] = useState<Pipe[]>([createEmptyPipe('Pipe A')])
  const [outgoing, setOutgoing] = useState<Pipe[]>([createEmptyPipe('Pipe X')])

  const getNextLetterLabel = (list: Pipe[], fallback: string) => {
    const last = list[list.length - 1]?.label.replace('Pipe ', '') || fallback
    return `Pipe ${nextLabel(last)}`
  }

  const getNextNumericLabel = () => {
    const numbers = [...incoming, ...outgoing]
      .map(pipe => {
        const match = pipe.label.match(PIPE_NUMBER_REGEX)
        return match ? Number(match[1]) : Number.NaN
      })
      .filter(value => !Number.isNaN(value))
    const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1
    return `Pipe ${nextNumber}`
  }

  const handleCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setMessage('Geolocation is not supported on this device.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setLatitude(lat.toFixed(6))
        setLongitude(lng.toFixed(6))
      },
      (err) => {
        setMessage(`Unable to fetch location: ${err.message}`)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const relabelPipesToNumbers = () => {
    let counter = 1
    setIncoming(prev => prev.map(pipe => ({ ...pipe, label: `Pipe ${counter++}` })))
    setOutgoing(prev => prev.map(pipe => ({ ...pipe, label: `Pipe ${counter++}` })))
  }

  const relabelPipesToLetters = () => {
    setIncoming(prev => {
      const source = prev.length ? prev : [createEmptyPipe('Pipe A')]
      return source.map((pipe, idx) => ({ ...pipe, label: `Pipe ${letterForIndex(65, idx)}` }))
    })
    setOutgoing(prev => {
      const source = prev.length ? prev : [createEmptyPipe('Pipe X')]
      return source.map((pipe, idx) => ({ ...pipe, label: `Pipe ${letterForIndex(88, idx)}` }))
    })
  }

  const handlePipeModeChange = (mode: PipeLabelMode) => {
    setPipeLabelMode(mode)
    if (mode === 'numbers') {
      relabelPipesToNumbers()
    } else {
      relabelPipesToLetters()
    }
  }

  useEffect(() => {
    if (type !== 'Catchpit' && pipeLabelMode !== 'letters') {
      setPipeLabelMode('letters')
      relabelPipesToLetters()
    }
  }, [type, pipeLabelMode])

  useEffect(() => {
    if (pipeLabelMode !== 'numbers') return
    if (!outgoing.length) return
    setIncoming(prev => {
      const combined = [...prev, ...outgoing]
      return combined.map((pipe, idx) => ({ ...pipe, label: `Pipe ${idx + 1}` }))
    })
    setOutgoing([])
  }, [pipeLabelMode, outgoing])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('chambers')
        .select('*')
        .eq('id', manholeId)
        .maybeSingle()
      if (error) setMessage('Error loading manhole: ' + error.message)
      const row = data as ManholeRow | null
      if (row) {
        setIdentifier(row.identifier || '')
        setSurveyDate(row.survey_date || '')
        setMeasuringTool(row.measuring_tool || '')
        setLaserOffset((row.measuring_offset_mm ?? '').toString())
        setLocationDesc(row.location_desc || '')
        setLatitude((row.latitude ?? '').toString())
        setLongitude((row.longitude ?? '').toString())
        setEasting((row.easting ?? '').toString())
        setNorthing((row.northing ?? '').toString())
        setCoverLevel((row.cover_level ?? '').toString())
        setCoverShape(row.cover_shape || '')
        setCoverDiameter((row.cover_diameter_mm ?? '').toString())
        setCoverWidth((row.cover_width_mm ?? '').toString())
        setCoverLength((row.cover_length_mm ?? '').toString())
        setCoverMaterial(row.cover_material || '')
        setCoverMaterialOther(row.cover_material_other || '')
        setCoverDuty(row.cover_duty || '')
        setCoverCondition(row.cover_condition || '')
        setChamberShape(row.chamber_shape || '')
        setChamberDiameter((row.chamber_diameter_mm ?? '').toString())
        setChamberWidth((row.chamber_width_mm ?? '').toString())
        setChamberLength((row.chamber_length_mm ?? '').toString())
        setChamberMaterial(row.chamber_material || '')
        setChamberMaterialOther(row.chamber_material_other || '')
        setChamberCondition((row as { chamber_condition?: string | null }).chamber_condition || '')
        setServiceType(row.service_type || '')
        setType(row.type || '')
        setTypeOther(row.type_other || '')
        setCoverLifted(row.cover_lifted || '')
        setCoverNotReason(row.cover_lifted_reason || '')
        setInternalPhotoUrl(row.internal_photo_url || '')
        setExternalPhotoUrl(row.external_photo_url || '')
        setSketch(row.sketch_json || null)
        const incomingPipes = Array.isArray(row.incoming_pipes) && row.incoming_pipes.length ? (row.incoming_pipes as Pipe[]) : null
        const outgoingPipes = Array.isArray(row.outgoing_pipes) && row.outgoing_pipes.length ? (row.outgoing_pipes as Pipe[]) : null
        const incomingList = incomingPipes ?? [createEmptyPipe('Pipe A')]
        const outgoingList = outgoingPipes ?? [createEmptyPipe('Pipe X')]
        setIncoming(incomingList)
        setOutgoing(outgoingList)
        const hasNumericLabels = [...incomingList, ...outgoingList].some(pipe => PIPE_NUMBER_REGEX.test(pipe.label ?? ''))
        setPipeLabelMode(row.type === 'Catchpit' && hasNumericLabels ? 'numbers' : 'letters')
      }
      setLoading(false)
    }
    load()
  }, [manholeId])

  function addIncomingPipe() {
    const label = pipeLabelMode === 'numbers' ? getNextNumericLabel() : getNextLetterLabel(incoming, 'A')
    setIncoming([...incoming, createEmptyPipe(label)])
  }
  function removeIncomingPipe(index: number) {
    if (index === 0) return
    setIncoming((arr)=>arr.filter((_,i)=>i!==index))
  }
  function addOutgoingPipe() {
    const label = pipeLabelMode === 'numbers' ? getNextNumericLabel() : getNextLetterLabel(outgoing, 'X')
    setOutgoing([...outgoing, createEmptyPipe(label)])
  }
  function removeOutgoingPipe(index: number) {
    if (index === 0) return
    setOutgoing((arr)=>arr.filter((_,i)=>i!==index))
  }

  async function save() {
    setMessage('')
    const update: Record<string, unknown> = {
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
      cover_material: coverMaterial || null,
      cover_material_other: coverMaterial === 'Other' ? (coverMaterialOther || null) : null,
      cover_duty: coverDuty || null,
      cover_condition: coverCondition || null,
      chamber_shape: chamberShape || null,
      chamber_diameter_mm: (chamberShape === 'Circle' || chamberShape === 'Hexagon') ? (chamberDiameter || null) : null,
      chamber_width_mm: (chamberShape === 'Square' || chamberShape === 'Rectangle') ? (chamberWidth || null) : null,
      chamber_length_mm: (chamberShape === 'Square' || chamberShape === 'Rectangle') ? (chamberLength || null) : null,
      service_type: serviceType || null,
      type: type || null,
      type_other: type === 'Other' ? (typeOther || null) : null,
      chamber_condition: chamberCondition || null,
      cover_lifted: coverLifted || null,
      cover_lifted_reason: coverLifted === 'No' ? (coverNotReason || null) : null,
      incoming_pipes: incoming,
      outgoing_pipes: outgoing,
    }
    // Chamber material + sketch
    update.chamber_material = chamberMaterial || null
    update.chamber_material_other = chamberMaterial === 'Other' ? (chamberMaterialOther || null) : null
    update.sketch_json = sketch || null

    const { error } = await supabase.from('chambers').update(update).eq('id', manholeId)
    if (error) {
      setMessage('Error: ' + error.message)
      return
    }
    // Upload any new photos
    let uploadMsg = ''
    const bucket = supabase.storage.from('manhole-photos')
    async function uploadOne(file: File | null, kind: 'internal' | 'external') {
      if (!file) return null
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${manholeId}/${kind}-${Date.now()}.${ext}`
      const up = await bucket.upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
      })
      if (up.error) {
        uploadMsg += `\nNote: Failed to upload ${kind} photo (${up.error.message}).`
        return null
      }
      const pub = bucket.getPublicUrl(path)
      const url = pub.data.publicUrl
      const upRow = await supabase
        .from('chambers')
        .update(kind === 'internal' ? { internal_photo_url: url } : { external_photo_url: url })
        .eq('id', manholeId)
      if (upRow.error) {
        uploadMsg += `\nNote: Saved file but failed to write URL to DB (${upRow.error.message}). Check manholes RLS allows your role to update.`
      }
      if (kind === 'internal') setInternalPhotoUrl(url)
      else setExternalPhotoUrl(url)
      return url
    }
    await uploadOne(internalPhotoFile, 'internal')
    await uploadOne(externalPhotoFile, 'external')
    setMessage('Success: Manhole updated.' + uploadMsg)
    if (embed) {
      window.parent?.postMessage({ type: 'close-edit-modal', refresh: true }, '*')
    }
  }

  const content = (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Edit Chamber</h1>
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
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium mb-1">Latitude</label>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline px-1"
                    onClick={handleCurrentLocation}
                  >
                    Use current location
                  </button>
                </div>
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
              {type === 'Catchpit' && (
                <div className="mt-2">
                  <label className="block text-xs font-semibold text-gray-600 tracking-wide uppercase mb-1">Pipe labels</label>
                  <select
                    className="w-full border p-2 rounded"
                    value={pipeLabelMode}
                    onChange={(e) => handlePipeModeChange(e.target.value as PipeLabelMode)}
                  >
                    <option value="letters">X-ABC (letters)</option>
                    <option value="numbers">1-9 (numbers)</option>
                  </select>
                </div>
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
              <label className="block text-sm mb-1">Cover Duty</label>
              <select className="w-full border p-2 rounded" value={coverDuty} onChange={(e)=>setCoverDuty(e.target.value)}>
                <option value="">Select duty</option>
                {['Heavy','Medium','Light'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Cover Condition</label>
              <select className="w-full border p-2 rounded" value={coverCondition} onChange={(e)=>setCoverCondition(e.target.value)}>
                <option value="">Select condition</option>
                {['Good','OK','Cracked','Rocking','Re-Set','Replace','Needs Attention','Urgent Attention'].map(c => <option key={c} value={c}>{c}</option>)}
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

          {/* Cover Material */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
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
          </div>

          {/* Chamber Shape */}
          <h2 className="text-xl font-semibold mt-8 mb-3">Chamber</h2>
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
          <div>
            <label className="block text-sm mb-1">Condition</label>
            <select className="w-full border p-2 rounded" value={chamberCondition} onChange={(e)=>setChamberCondition(e.target.value)}>
              <option value="">Select condition</option>
              {['Poor','Poor/Fair','Fair','Fair/Good','Good','Unknown','Unsafe','OK','Needs Attention','Other'].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {chamberCondition === 'Other' && (
              <input className="mt-2 w-full border p-2 rounded" placeholder="If Other, specify" onChange={(e)=>setChamberCondition(`Other: ${e.target.value}`)} />
            )}
          </div>

          {/* Chamber Material */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div>
              <label className="block text-sm mb-1">Chamber Material</label>
              <select className="w-full border p-2 rounded" value={chamberMaterial} onChange={(e)=>setChamberMaterial(e.target.value)}>
                <option value="">Select material</option>
                {['Brick','Concrete Rings','In-Situ Concrete','Brick/Concrete','PCC','Plastic','Fibreglass','Cast Iron','Metal','Other'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {chamberMaterial === 'Other' && (
                <input className="mt-2 w-full border p-2 rounded" placeholder="If Other, specify" value={chamberMaterialOther} onChange={(e)=>setChamberMaterialOther(e.target.value)} />
              )}
            </div>
          </div>

          {/* Sketch editor (moved to bottom) */}
          <h2 className="hidden">Chamber Sketch</h2>
          <button
            type="button"
            onClick={() => { setSketchDraft(sketch ? { ...sketch } as SketchState : null); setSketchOpen(true) }}
            className="hidden"
          >Open Sketch Editor</button>
          {sketchOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2">
              <div className="bg-white theme-dark:bg-[#0b0b0b] border border-gray-200 theme-dark:border-gray-700 rounded-lg shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 theme-dark:border-gray-700">
                  <h3 className="text-lg font-semibold">Chamber Sketch</h3>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSketchOpen(false)} className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
                    <button type="button" onClick={() => { if (sketchDraft) setSketch(sketchDraft); setSketchOpen(false) }} className="px-3 py-1.5 rounded text-white bg-blue-600 hover:bg-blue-700">Done</button>
                  </div>
                </div>
                <div className="p-3 overflow-auto">
                  <ChamberSketch compact value={sketchDraft ?? undefined} onChange={(s)=>setSketchDraft(s)} />
                </div>
              </div>
            </div>
          )}

        {/* Incoming Pipes */}
        {pipeLabelMode === 'numbers' ? (
          <h2 className="text-xl font-semibold mt-8 mb-3">Pipe Information</h2>
        ) : (
          <h2 className="text-xl font-semibold mt-8 mb-3">Incoming Pipes</h2>
        )}
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
                      <button onClick={()=>removeIncomingPipe(idx)} className="px-3 py-1 rounded text-white bg-red-600 hover:bg-red-700">Remove Pipe</button>
                    </div>
                  )}
                </div>
              ))}
              <button onClick={addIncomingPipe} className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50">Add pipe</button>
            </div>

        {pipeLabelMode !== 'numbers' && (
          <>
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
          </>
        )}

            {/* Photos */}
            <h2 className="text-xl font-semibold mt-10 mb-3">Internal Photo</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
              <div className="md:col-span-2">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0] || null
                    setInternalPhotoFile(f)
                  }}
                  className="block w-full text-sm text-gray-900 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-600 mt-1">Upload a replacement or take a photo on mobile.</p>
              </div>
              <div className="mt-2">
                {internalPhotoFile ? (
                  <span className="text-xs text-gray-600">New photo selected</span>
                ) : internalPhotoUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={internalPhotoUrl} alt="Internal" className="max-h-40 rounded border" />
                  </>
                ) : (
                  <span className="text-xs text-gray-500">No photo</span>
                )}
                {internalPhotoUrl && !internalPhotoFile && (
                  <button type="button" onClick={() => setInternalPhotoUrl('')} className="mt-2 px-3 py-1 rounded border border-gray-300 hover:bg-gray-50">Remove existing</button>
                )}
              </div>
            </div>

            <h2 className="text-xl font-semibold mt-8 mb-3">External Photo</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
              <div className="md:col-span-2">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0] || null
                    setExternalPhotoFile(f)
                  }}
                  className="block w-full text-sm text-gray-900 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-600 mt-1">Upload a replacement or take a photo on mobile.</p>
              </div>
              <div className="mt-2">
                {externalPhotoFile ? (
                  <span className="text-xs text-gray-600">New photo selected</span>
                ) : externalPhotoUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={externalPhotoUrl} alt="External" className="max-h-40 rounded border" />
                  </>
                ) : (
                  <span className="text-xs text-gray-500">No photo</span>
                )}
                {externalPhotoUrl && !externalPhotoFile && (
                  <button type="button" onClick={() => setExternalPhotoUrl('')} className="mt-2 px-3 py-1 rounded border border-gray-300 hover:bg-gray-50">Remove existing</button>
                )}
              </div>
            </div>

            {/* Sketch editor at bottom */}
            <h2 className="text-xl font-semibold mt-8 mb-3">Chamber Sketch</h2>
            <button
              type="button"
              onClick={() => { setSketchDraft(sketch ? { ...sketch } as SketchState : null); setSketchOpen(true) }}
              className="px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700 mb-4"
            >
              Open Sketch Editor
            </button>

            <div className="mt-6 flex gap-3">
              <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Save</button>
              {/* Close/back respects embed mode to avoid navigating the main URL */}
              {embed ? (
                <button
                  type="button"
                  onClick={() => window.parent?.postMessage({ type: 'close-edit-modal' }, '*')}
                  className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
                >
                  Close
                </button>
              ) : (
                <button onClick={()=> router.back()} className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50">Back</button>
              )}
            </div>
          </>
        )}
      </div>
  )

  // Support embed mode to render without the app sidebar (for SPA/modal usage)
  if (embed) return content
  return (
    <SidebarLayout>
      {content}
    </SidebarLayout>
  )
}

