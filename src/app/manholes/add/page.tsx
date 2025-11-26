'use client'

import React, { Suspense, useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import SidebarLayout from '@/app/components/SidebarLayout'
import { supabase } from '@/lib/supabaseClient'
import { enqueueMutation } from '@/lib/mutationQueue'
import { getCachedList } from '@/lib/offlineCache'
import ChamberSketch, { type SketchState } from '@/app/components/sketch/ChamberSketch'
import { storeOfflineFile } from '@/lib/offlinePhotos'

interface Project {
  id: string
  name: string
  project_number?: string | null
  client?: string | null
}

type Pipe = {
  label: string
  shape: string
  material: string
  invert_depth_m: string
  width_mm: string
  height_mm: string
  diameter_mm: string
  notes: string
  soffit_level: string
}

type PipeLabelMode = 'letters' | 'numbers'

class ChamberFormBoundary extends React.Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    try {
      localStorage.setItem(
        'lastAddChamberError',
        JSON.stringify({ message: error.message, stack: error.stack, ts: Date.now() })
      )
    } catch {
      /* ignore */
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-sm text-red-700 bg-red-50 rounded border border-red-200">
          <p className="font-semibold">Add Chamber error (captured locally)</p>
          <p className="mt-1 break-words">{this.state.error.message}</p>
          {this.state.error.stack && (
            <pre className="mt-2 whitespace-pre-wrap text-xs text-red-800">{this.state.error.stack}</pre>
          )}
          <p className="mt-2 text-xs text-gray-600">
            Screenshot this block and share it so we can patch the iOS offline crash.
          </p>
        </div>
      )
    }
    return this.props.children as ReactNode
  }
}

const SERVICE_TYPES = [
  'Water','Foul Water','Surface Water','Combined','Soakaway','Interceptor','Storm Water Overflow','Electric','BT','Telecom',
  'Traffic Sig','CATV','SV','FH','AV','WO','CCTV','Comms','Fuel Tank','Fuel Vent','Fuel Filler','WM','Empty','GV','Other',
  'Cables','Ducts','Fibre','FWS','Gas','Heating Pipes','Pipes','CWS','SWS','Unidentified'
]
const SERVICE_TYPE_SET = new Set(SERVICE_TYPES)

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
const PIPE_SHAPES = ['Circular','Egg','Rectangular','Trapezoidal','Square','Brick Arch','Unknown','Other']
const PIPE_MATERIALS = ['Vitrified Clay','Concrete','Plastic','Asbestos Cement','Cast Iron','Spun Iron','Steel','Brick','Pitch Fibre','Unknown','Other']

function nextLabel(current: string) {
  const code = current.charCodeAt(0)
  return String.fromCharCode(Math.min(90, code + 1)) // up to 'Z'
}

function createEmptyPipe(label: string): Pipe {
  return {
    label,
    shape: '',
    material: '',
    invert_depth_m: '',
    width_mm: '',
    height_mm: '',
    diameter_mm: '',
    notes: '',
    soffit_level: '',
  }
}

function letterForIndex(startCode: number, offset: number) {
  return String.fromCharCode(Math.min(90, startCode + offset))
}

function AddManholeForm({ standaloneLayout = true }: { standaloneLayout?: boolean }) {
  const params = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState(() => params.get('project') || '')

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
  const [pipeLabelMode, setPipeLabelMode] = useState<PipeLabelMode>('letters')

  // Cover lifted
  const [coverLifted, setCoverLifted] = useState('')
  const [coverNotReason, setCoverNotReason] = useState('')
  const [chainageMileage, setChainageMileage] = useState('')
  const resetForm = () => {
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
    setCoverDiameter('')
    setCoverWidth('')
    setCoverLength('')
    setServiceType('')
    setType('')
    setTypeOther('')
    setCoverLifted('')
    setCoverNotReason('')
    setIncoming([createEmptyPipe('A')])
    setOutgoing([createEmptyPipe('X')])
    setInternalPhoto(null)
    setExternalPhoto(null)
    setSketch(null)
    setChainageMileage('')
    setCoverShape('')
    setCoverCondition('')
    setCoverMaterial('')
    setCoverMaterialOther('')
    setCoverThickness('')
    setCoverDuty('')
    setSumpDepth('')
    setChamberShape('')
    setChamberDiameter('')
    setChamberWidth('')
    setChamberLength('')
    setChamberMaterial('')
    setChamberMaterialOther('')
    setChamberCondition('')
    setPipeLabelMode('letters')
  }

  // Pipes
  const [incoming, setIncoming] = useState<Pipe[]>(() => [createEmptyPipe('Pipe A')])
  const [outgoing, setOutgoing] = useState<Pipe[]>(() => [createEmptyPipe('Pipe X')])

  const [message, setMessage] = useState('')
  const [copyList, setCopyList] = useState(false)
  const [sketch, setSketch] = useState<SketchState | null>(null)
  const [sketchOpen, setSketchOpen] = useState(false)
  const [sketchDraft, setSketchDraft] = useState<SketchState | null>(null)

  const handleCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setMessage('Geolocation not supported on this device.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords
        setLatitude(lat.toFixed(6))
        setLongitude(lng.toFixed(6))
      },
      (err) => {
        setMessage(`Unable to fetch location: ${err.message}`)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }
  useEffect(() => {
    // Lock body scroll while sketch is open (mobile-friendly)
    if (sketchOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [sketchOpen])

  // Cover
  const [coverShape, setCoverShape] = useState('')
  const [coverDiameter, setCoverDiameter] = useState('')
  const [coverWidth, setCoverWidth] = useState('')
  const [coverLength, setCoverLength] = useState('')
  const [coverMaterial, setCoverMaterial] = useState('')
  const [coverMaterialOther, setCoverMaterialOther] = useState('')
  const [coverCondition, setCoverCondition] = useState('')
  const [coverThickness, setCoverThickness] = useState('')
  const [coverDuty, setCoverDuty] = useState('')

  // Chamber
  const [chamberShape, setChamberShape] = useState('')
  const [chamberDiameter, setChamberDiameter] = useState('')
  const [chamberWidth, setChamberWidth] = useState('')
  const [chamberLength, setChamberLength] = useState('')
  const [chamberMaterial, setChamberMaterial] = useState('')
  const [chamberMaterialOther, setChamberMaterialOther] = useState('')
  const [chamberCondition, setChamberCondition] = useState('')
  const chamberConditionOption = chamberCondition.startsWith('Other:') ? 'Other' : chamberCondition
  const chamberConditionOtherText = chamberCondition.startsWith('Other:') ? chamberCondition.replace(/^Other:\s*/, '') : ''
  const [sumpDepth, setSumpDepth] = useState('')
  // Photos
  const [internalPhoto, setInternalPhoto] = useState<File | null>(null)
  const [internalPreview, setInternalPreview] = useState('')
  const [externalPhoto, setExternalPhoto] = useState<File | null>(null)
  const [externalPreview, setExternalPreview] = useState('')

  const numericLabelRegex = /^Pipe\s+(\d+)/i

  const getNextLetterLabel = (list: Pipe[], fallback: string) => {
    const last = list[list.length - 1]?.label.replace('Pipe ', '') || fallback
    return `Pipe ${nextLabel(last)}`
  }

  const getNextNumericLabel = () => {
    const numbers = [...incoming, ...outgoing]
      .map(pipe => {
        const match = pipe.label.match(numericLabelRegex)
        return match ? Number(match[1]) : Number.NaN
      })
      .filter(value => !Number.isNaN(value))
    const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1
    return `Pipe ${nextNumber}`
  }

  const handlePipeModeChange = (mode: PipeLabelMode) => {
    setPipeLabelMode(mode)
  }

  useEffect(() => {
    if (type !== 'Catchpit' && pipeLabelMode !== 'letters') {
      setPipeLabelMode('letters')
    }
  }, [type, pipeLabelMode])

  // Keep minimal defaults per mode: letters => Pipe A (incoming) and Pipe X (outgoing),
  // numbers => Pipe 1 only (incoming) and no outgoing until added.
  useEffect(() => {
    if (pipeLabelMode === 'numbers') {
      setOutgoing([])
      setIncoming((prev) => {
        const first = prev[0] ? { ...prev[0], label: 'Pipe 1' } : createEmptyPipe('Pipe 1')
        return [first]
      })
    } else {
      setIncoming((prev) => {
        const first = prev[0] ? { ...prev[0], label: `Pipe ${letterForIndex(65, 0)}` } : createEmptyPipe('Pipe A')
        return [first]
      })
      setOutgoing((prev) => {
        const first = prev[0] ? { ...prev[0], label: `Pipe ${letterForIndex(88, 0)}` } : createEmptyPipe('Pipe X')
        return [first]
      })
    }
  }, [pipeLabelMode])

  useEffect(() => {
    async function fetchProjects() {
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false
      const cached = await getCachedList<Project>('projects')
      if (isOffline && cached?.data?.length) {
        setProjects(cached.data)
        setMessage('Offline: using cached projects. New chamber will queue for sync.')
        return
      }
      try {
    const { data, error } = await supabase.from('projects').select('id, name, project_number, client').is('deleted_at', null)
        if (error) throw error
        if (data?.length) {
          setProjects(data)
        } else if (cached?.data?.length) {
          setProjects(cached.data)
        }
      } catch {
        const cached = await getCachedList<Project>('projects')
        if (cached?.data?.length) {
          setProjects(cached.data)
          setMessage('Offline: using cached projects. New chamber will queue for sync.')
        } else {
          setMessage('Offline: no cached projects available. Connect to pick a project.')
        }
      }
    }
    fetchProjects()
  }, [])

  function addIncomingPipe() {
    const label = pipeLabelMode === 'numbers' ? getNextNumericLabel() : getNextLetterLabel(incoming, 'A')
    setIncoming([...incoming, createEmptyPipe(label)])
  }
  function removeIncomingPipe(index: number) {
    if (index === 0) return // keep a default pipe entry
    setIncoming((arr) => arr.filter((_, i) => i !== index))
  }
  function addOutgoingPipe() {
    const label = pipeLabelMode === 'numbers' ? getNextNumericLabel() : getNextLetterLabel(outgoing, 'X')
    setOutgoing([...outgoing, createEmptyPipe(label)])
  }
  function removeOutgoingPipe(index: number) {
    if (index === 0) return // keep a default pipe entry
    setOutgoing((arr) => arr.filter((_, i) => i !== index))
  }

  async function addChamber() {
    try {
      if (!projectId || !identifier) {
        setMessage('Please select a project and enter an identifier.')
        return
      }
      const selectedProject = projects.find((p) => p.id === projectId)

      const payload: Record<string, unknown> = {
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
        cover_shape: coverShape || null,
        cover_diameter_mm: coverShape === 'Circle' ? (coverDiameter || null) : null,
        cover_width_mm: ['Square','Rectangle','Hexagon'].includes(coverShape) ? (coverWidth || null) : null,
        cover_length_mm: ['Square','Rectangle','Hexagon'].includes(coverShape) ? (coverLength || null) : null,
        cover_material: coverMaterial || null,
        cover_material_other: coverMaterial === 'Other' ? (coverMaterialOther || null) : null,
        cover_condition: coverCondition || null,
        cover_thickness_mm: type === 'Catchpit' ? (coverThickness || null) : null,
        cover_duty: coverDuty || null,
        chamber_shape: chamberShape || null,
        chamber_diameter_mm: (chamberShape === 'Circle' || chamberShape === 'Hexagon') ? (chamberDiameter || null) : null,
        chamber_width_mm: (chamberShape === 'Square' || chamberShape === 'Rectangle') ? (chamberWidth || null) : null,
        chamber_length_mm: (chamberShape === 'Square' || chamberShape === 'Rectangle') ? (chamberLength || null) : null,
        chamber_material: chamberMaterial || null,
        chamber_material_other: chamberMaterial === 'Other' ? (chamberMaterialOther || null) : null,
        chamber_condition: chamberCondition || null,
        sump_depth_m: sumpDepth || null,
        service_type: serviceType
          ? (SERVICE_TYPE_SET.has(serviceType) ? serviceType : 'Other')
          : null,
        type: type || null,
        type_other: type === 'Other' ? (typeOther || null) : null,
        cover_lifted: coverLifted || null,
        cover_lifted_reason: coverLifted === 'No' ? (coverNotReason || null) : null,
        chainage_mileage: chainageMileage || null,
        incoming_pipes: incoming,
        outgoing_pipes: outgoing,
        sketch_json: sketch ? sketch : null,
      }

      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false
      if (isOffline) {
        if (!projects.length) {
          setMessage('Offline: no cached projects to assign. Go online once, then retry.')
          return
        }
        const fileToDataUrl = (file: File) =>
          new Promise<{ dataUrl: string; name: string; type: string }>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve({ dataUrl: String(reader.result), name: file.name, type: file.type })
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
          })

        const offline_photos: { internal?: Record<string, unknown>; external?: Record<string, unknown> } = {}
        if (internalPhoto) {
          const key = await storeOfflineFile(internalPhoto)
          const data = await fileToDataUrl(internalPhoto)
          offline_photos.internal = { key, ...data }
        }
        if (externalPhoto) {
          const key = await storeOfflineFile(externalPhoto)
          const data = await fileToDataUrl(externalPhoto)
          offline_photos.external = { key, ...data }
        }
        const project_lookup = selectedProject
          ? {
              project_number: selectedProject.project_number || null,
              name: selectedProject.name || null,
              client: selectedProject.client || null,
            }
          : undefined
        const payloadWithPhotos = offline_photos.internal || offline_photos.external ? { ...payload, offline_photos } : payload
        await enqueueMutation('chamber-insert', project_lookup ? { ...payloadWithPhotos, project_lookup } : payloadWithPhotos)
        setMessage('Offline: Chamber queued for sync. Photos will upload after you reconnect.')
        resetForm()
        return
      }

      const insertRes = await supabase.from('chambers').insert([payload]).select('id').single()
      if (insertRes.error) {
        const hint = `
To support these fields, add columns in Supabase (run once):

ALTER TABLE public.chambers
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
  ADD COLUMN IF NOT EXISTS cover_duty text,
  ADD COLUMN IF NOT EXISTS cover_condition text,
  ADD COLUMN IF NOT EXISTS chamber_shape text,
  ADD COLUMN IF NOT EXISTS chamber_diameter_mm integer,
  ADD COLUMN IF NOT EXISTS chamber_width_mm integer,
  ADD COLUMN IF NOT EXISTS chamber_length_mm integer,
  ADD COLUMN IF NOT EXISTS chamber_material text,
  ADD COLUMN IF NOT EXISTS chamber_material_other text,
  ADD COLUMN IF NOT EXISTS chamber_condition text,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS type_other text,
  ADD COLUMN IF NOT EXISTS cover_lifted text,
  ADD COLUMN IF NOT EXISTS cover_lifted_reason text,
  ADD COLUMN IF NOT EXISTS incoming_pipes jsonb,
  ADD COLUMN IF NOT EXISTS outgoing_pipes jsonb;`
        setMessage('Error: ' + insertRes.error.message + hint)
      } else {
        const newId = insertRes.data?.id
        let uploadMsg = ''
        if (newId && (internalPhoto || externalPhoto)) {
          const bucket = supabase.storage.from('manhole-photos')
          async function uploadOne(file: File | null, kind: 'internal' | 'external') {
            if (!file) return null
            const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
            const path = `${newId}/${kind}-${Date.now()}.${ext}`
            const up = await bucket.upload(path, file, {
              upsert: true,
              contentType: file.type || 'image/jpeg',
              cacheControl: '3600',
            })
            if (up.error) {
              uploadMsg += '\nNote: Failed to upload ' + kind + ' photo (' + up.error.message + '). Ensure a public storage bucket named "manhole-photos" exists and Authenticated users can upload.'
              return null
            }
            const pub = bucket.getPublicUrl(path)
            const url = pub.data.publicUrl
            const upRow = await supabase
              .from('chambers')
              .update(kind === 'internal' ? { internal_photo_url: url } : { external_photo_url: url })
              .eq('id', newId)
            if (upRow.error) {
              uploadMsg += '\nNote: Saved file but failed to write URL to DB (' + upRow.error.message + '). Check manholes RLS allows your role to update.'
            }
            return url
          }
          await uploadOne(internalPhoto, 'internal')
          await uploadOne(externalPhoto, 'external')
        }
        setMessage('Success: Chamber created.' + uploadMsg)
        resetForm()
      }
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const content = (
    <ChamberFormBoundary>
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Add Chamber</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Project</label>
            <select className="w-full border p-2 rounded" value={projectId} onChange={(e)=>setProjectId(e.target.value)}>
              <option value="">Select Project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Chamber Identifier</label>
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
              Copy list (keep Project, Date, Measuring Tool for next chamber)
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Location (description)</label>
            <input className="w-full border p-2 rounded" value={locationDesc} onChange={(e)=>setLocationDesc(e.target.value)} placeholder="e.g., Near signal, left cess" />
          </div>
        </div>

        <h2 className="text-xl font-semibold mt-8 mb-3">Coordinates</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
        </div>

        <h2 className="text-xl font-semibold mt-8 mb-3">General Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

          <div className="md:col-span-3">
            <label className="block text-sm mb-1">Chainage / Mileage</label>
            <input
              className="w-full border p-2 rounded"
              placeholder="Enter chainage or mileage"
              value={chainageMileage}
              onChange={(e) => setChainageMileage(e.target.value)}
            />
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
          {coverShape === 'Circle' && (
            <div>
              <label className="block text-sm mb-1">Diameter (mm)</label>
              <input className="w-full border p-2 rounded" value={coverDiameter} onChange={(e)=>setCoverDiameter(e.target.value)} />
            </div>
          )}
          {['Square','Rectangle','Hexagon'].includes(coverShape) && (
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
          )}
          <div>
            <label className="block text-sm mb-1">Cover Condition</label>
            <select className="w-full border p-2 rounded" value={coverCondition} onChange={(e)=>setCoverCondition(e.target.value)}>
              <option value="">Select condition</option>
              {['Good','OK','Cracked','Rocking','Re-Set','Replace','Needs Attention','Urgent Attention'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Cover Duty</label>
            <select className="w-full border p-2 rounded" value={coverDuty} onChange={(e)=>setCoverDuty(e.target.value)}>
              <option value="">Select duty</option>
              {['Light','Medium','Heavy','N/A'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {type === 'Catchpit' && (
            <div>
              <label className="block text-sm mb-1">Cover Thickness (mm)</label>
              <input
                className="w-full border p-2 rounded text-sm placeholder:text-xs"
                placeholder="Leave blank if measuring depth to lid"
                value={coverThickness}
                onChange={(e)=>setCoverThickness(e.target.value)}
              />
            </div>
          )}
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

        {/* Chamber */}
        <h2 className="text-xl font-semibold mt-8 mb-3">Chamber</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Shape</label>
            <select className="w-full border p-2 rounded" value={chamberShape} onChange={(e)=>setChamberShape(e.target.value)}>
              <option value="">Select shape</option>
              {['Circle','Square','Rectangle','Hexagon'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
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
          <div>
            <label className="block text-sm mb-1">Chamber Condition</label>
            <select
              className="w-full border p-2 rounded"
              value={chamberConditionOption}
              onChange={(e) => {
                const value = e.target.value
                setChamberCondition(value === 'Other' ? 'Other' : value)
              }}
            >
              <option value="">Select condition</option>
              {['Poor','Fair','Good','Other'].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {chamberConditionOption === 'Other' && (
              <input
                className="mt-2 w-full border p-2 rounded"
                placeholder="If Other, why?"
                value={chamberConditionOtherText}
                onChange={(e)=>setChamberCondition(`Other: ${e.target.value}`)}
              />
            )}
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
          <div>
            <label className="block text-sm mb-1">Sump Depth (m)</label>
            <input
              className="w-full border p-2 rounded"
              value={sumpDepth}
              onChange={(e)=>setSumpDepth(e.target.value)}
            />
          </div>
        </div>

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
                {/* Function removed */}
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
                  <label className="block text-sm mb-1">Soffit Level (m)</label>
                  <input
                    className="w-full border p-2 rounded"
                    placeholder="Only needed if invert is UTS"
                    value={p.soffit_level}
                    onChange={(e)=>{const v=[...incoming]; v[idx].soffit_level=e.target.value; setIncoming(v)}}
                  />
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

        {pipeLabelMode !== 'numbers' && (
          <>
            <h2 className="text-xl font-semibold mt-8 mb-3">Outgoing Pipes</h2>
            <div className="space-y-4">
              {outgoing.map((p, idx) => (
                <div key={idx} className="border rounded p-4 bg-white">
                  <div className="font-medium mb-3">{p.label}</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Function removed */}
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
                      <label className="block text-sm mb-1">Soffit Level (m)</label>
                      <input
                        className="w-full border p-2 rounded"
                        placeholder="Only needed if invert is UTS"
                        value={p.soffit_level}
                        onChange={(e)=>{const v=[...outgoing]; v[idx].soffit_level=e.target.value; setOutgoing(v)}}
                      />
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
                setInternalPhoto(f)
                setInternalPreview(f ? URL.createObjectURL(f) : '')
              }}
              className="block w-full text-sm text-gray-900 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-600 mt-1">Choose a photo or take one on mobile (camera prompt).</p>
          </div>
          {internalPreview && (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={internalPreview} alt="Internal preview" className="max-h-40 rounded border" />
              <button type="button" onClick={() => { setInternalPhoto(null); setInternalPreview('') }} className="mt-2 px-3 py-1 rounded border border-gray-300 hover:bg-gray-50">Remove</button>
            </div>
          )}
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
                setExternalPhoto(f)
                setExternalPreview(f ? URL.createObjectURL(f) : '')
              }}
              className="block w-full text-sm text-gray-900 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-600 mt-1">Choose a photo or take one on mobile (camera prompt).</p>
          </div>
          {externalPreview && (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={externalPreview} alt="External preview" className="max-h-40 rounded border" />
              <button type="button" onClick={() => { setExternalPhoto(null); setExternalPreview('') }} className="mt-2 px-3 py-1 rounded border border-gray-300 hover:bg-gray-50">Remove</button>
            </div>
          )}
        </div>

        {/* Sketch */}
        <h2 className="text-xl font-semibold mt-10 mb-3">Chamber Sketch (beta)</h2>
        <button
          type="button"
          onClick={() => { setSketchDraft(sketch ? { ...sketch } : null); setSketchOpen(true) }}
          className="px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700"
        >
          Open Sketch Editor
        </button>

        {sketchOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2">
            <div className="bg-white theme-dark:bg-[#0b0b0b] border border-gray-200 theme-dark:border-gray-700 rounded-lg shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 theme-dark:border-gray-700">
                <h3 className="text-lg font-semibold">Chamber Sketch</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSketchOpen(false)}
                    className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (sketchDraft) setSketch(sketchDraft); setSketchOpen(false) }}
                    className="px-3 py-1.5 rounded text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </div>
              <div className="p-3 overflow-auto">
                  <ChamberSketch compact showHandlesAlways hideCoverControls value={sketchDraft ?? undefined} onChange={(s)=>setSketchDraft(s)} />
              </div>
            </div>
          </div>
        )}

        <button onClick={addChamber} className="mt-8 w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Save Chamber</button>

        {message && <pre className="mt-4 whitespace-pre-wrap text-sm">{message}</pre>}
      </div>
    </ChamberFormBoundary>);
  if (standaloneLayout) { return (<SidebarLayout>{content}</SidebarLayout>); }
  return content;
}

export const dynamic = 'force-dynamic'

export default function AddManholePage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <AddManholePageInner />
    </Suspense>
  )
}

function AddManholePageInner() {
  const params = useSearchParams()
  const embed = params?.get('embed') === '1'
  return <AddManholeForm standaloneLayout={!embed} />
}
