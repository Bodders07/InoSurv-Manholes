'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import NextDynamic from 'next/dynamic'
import type { SketchState } from '@/app/components/sketch/ChamberSketch'
import { supabase } from '@/lib/supabaseClient'

const ChamberSketch = NextDynamic(() => import('@/app/components/sketch/ChamberSketch'), { ssr: false })
const BUILD_TAG = 'export-layout-v3'

type Pipe = {
  label?: string | null
  func?: string | null
  shape?: string | null
  material?: string | null
  invert_depth_m?: string | number | null
  width_mm?: string | number | null
  height_mm?: string | number | null
  diameter_mm?: string | number | null
  soffit_level?: string | number | null
  notes?: string | null
}

type ManholeRecord = {
  id: string
  project_id: string
  identifier: string | null
  service: string | null
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
  cover_material: string | null
  cover_material_other: string | null
  cover_duty: string | null
  cover_width_mm?: number | null
  cover_length_mm?: number | null
  cover_diameter_mm?: number | null
  cover_condition: string | null
  chamber_shape: string | null
  chamber_material: string | null
  chamber_material_other: string | null
  chamber_length_mm?: number | null
  chamber_width_mm?: number | null
  chamber_diameter_mm?: number | null
  chamber_condition?: string | null
  sump_depth_m?: number | null
  type: string | null
  type_other: string | null
  cover_lifted: string | null
  cover_lifted_reason: string | null
  incoming_pipes: Pipe[] | null
  outgoing_pipes: Pipe[] | null
  internal_photo_url?: string | null
  external_photo_url?: string | null
  sketch_json?: SketchState | null
  chainage_mileage: string | null
}

type ProjectRecord = {
  id: string
  name: string | null
  project_number: string | null
  client: string | null
}

export default function ExportManholePage() {
  const params = useParams() as { id?: string }
  const manholeId = params?.id
  const search = useSearchParams()
  const embed = search?.get('embed') === '1'

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [manhole, setManhole] = useState<ManholeRecord | null>(null)
  const [project, setProject] = useState<ProjectRecord | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      if (!manholeId) return
      setLoading(true)
      setMessage(null)
      try {
        // Try by UUID first, then by identifier (e.g., MH05)
        const fetchChamber = async (key: string) => {
          let record: ManholeRecord | null = null

          const { data: byId, error: idError } = await supabase
            .from('chambers')
            .select('*')
            .eq('id', key)
            .is('deleted_at', null)
            .maybeSingle()
          if (byId) record = byId as ManholeRecord
          if (!record) {
            const { data: byIdent, error: identError } = await supabase
              .from('chambers')
              .select('*')
              .eq('identifier', key)
              .is('deleted_at', null)
              .limit(1)
              .maybeSingle()
            if (identError) throw identError
            record = byIdent as ManholeRecord | null
          }
          if (!record) throw new Error('Chamber not found')
          return record
        }

        const record = await fetchChamber(manholeId)

        let projectRow: ProjectRecord | null = null
        if (record.project_id) {
          const { data: projData, error: projError } = await supabase
            .from('projects')
            .select('id, name, project_number, client')
            .eq('id', record.project_id)
            .is('deleted_at', null)
            .maybeSingle()
          if (projError) throw projError
          projectRow = projData as ProjectRecord | null
        }

        if (!active) return
        setManhole(record)
        setProject(projectRow)
      } catch (err) {
        if (!active) return
        setMessage(toErrorText(err))
        setManhole(null)
        setProject(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [manholeId])

  const incoming = useMemo(
    () => (Array.isArray(manhole?.incoming_pipes) ? manhole?.incoming_pipes ?? [] : []),
    [manhole?.incoming_pipes],
  )
  const outgoing = useMemo(
    () => (Array.isArray(manhole?.outgoing_pipes) ? manhole?.outgoing_pipes ?? [] : []),
    [manhole?.outgoing_pipes],
  )

  return (
    <div className={`min-h-screen ${embed ? 'bg-white' : 'bg-neutral-100'} text-gray-900`}>
      <div className="mx-auto w-full max-w-4xl p-6 bg-white">
        {loading && <p>Loading details...</p>}
        {!loading && message && <p className="text-red-600">{message}</p>}

        {!loading && manhole && (
          <div className="space-y-4 border border-gray-400 p-4">
            {/* Header with logo and summary */}
            <div className="border border-gray-400">
              <div className="flex border-b border-gray-400">
                <div className="flex-1 p-3 space-y-1">
                  <img src="/inorail-logo.png" alt="InoRail" className="h-10 mb-2" />
                  <div className="text-sm"><span className="font-semibold">Job No.</span>: {project?.project_number || '-'}</div>
                  <div className="text-sm"><span className="font-semibold">Project</span>: {project?.name || '-'}</div>
                  <div className="text-sm"><span className="font-semibold">Location</span>: {manhole.location_desc || '-'}</div>
                  <div className="text-sm"><span className="font-semibold">Chainage/Mileage</span>: {manhole.chainage_mileage || '-'}</div>
                </div>
                <div className="w-1/3 p-3 border-l border-gray-400">
                  <div className="text-sm font-semibold">Reference ID</div>
                  <div className="font-medium">{manhole.identifier || '-'}</div>
                </div>
              </div>
            </div>

            {/* General + Coordinates row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border border-gray-400">
                <div className="border-b border-gray-400 p-2 text-center font-semibold">General Details</div>
                <div className="p-3 text-sm space-y-1">
                  <div><span className="font-semibold">Survey Date:</span> {formatValue(manhole.survey_date)}</div>
                  <div><span className="font-semibold">Tool:</span> {manhole.measuring_tool || '-'}</div>
                  <div><span className="font-semibold">Type:</span> {manhole.type_other || manhole.type || '-'}</div>
                  <div><span className="font-semibold">Cover Lifted:</span> {formatCoverLifted(manhole)}</div>
                  <div><span className="font-semibold">Service Type:</span> {manhole.service || '-'}</div>
                </div>
              </div>
              <div className="border border-gray-400">
                <div className="border-b border-gray-400 p-2 text-center font-semibold">Coordinates</div>
                <div className="p-3 text-sm space-y-1">
                  <div><span className="font-semibold">Easting:</span> {formatValue(manhole.easting)}</div>
                  <div><span className="font-semibold">Northing:</span> {formatValue(manhole.northing)}</div>
                  <div><span className="font-semibold">Latitude:</span> {formatValue(manhole.latitude)}</div>
                  <div><span className="font-semibold">Longitude:</span> {formatValue(manhole.longitude)}</div>
                  <div><span className="font-semibold">Cover Level:</span> {formatValue(manhole.cover_level)}</div>
                </div>
              </div>
            </div>

            {/* Cover + Chamber row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border border-gray-400">
                <div className="border-b border-gray-400 p-2 text-center font-semibold">Cover Details</div>
                <div className="p-3 text-sm space-y-1">
                  <div><span className="font-semibold">Cover Material:</span> {manhole.cover_material_other || manhole.cover_material || '-'}</div>
                  <div><span className="font-semibold">Cover Shape:</span> {manhole.cover_shape || '-'}</div>
                  <div><span className="font-semibold">Cover Size:</span> {formatCoverDimensions(manhole)}</div>
                  <div><span className="font-semibold">Cover Duty:</span> {manhole.cover_duty || '-'}</div>
                  <div><span className="font-semibold">Cover Cond:</span> {manhole.cover_condition || '-'}</div>
                </div>
              </div>
              <div className="border border-gray-400">
                <div className="border-b border-gray-400 p-2 text-center font-semibold">Chamber Details</div>
                <div className="p-3 text-sm space-y-1">
                  <div><span className="font-semibold">Shape:</span> {manhole.chamber_shape || '-'}</div>
                  <div><span className="font-semibold">Dimensions:</span> {formatChamberDimensions(manhole)}</div>
                  <div><span className="font-semibold">Material:</span> {manhole.chamber_material_other || manhole.chamber_material || '-'}</div>
                  <div><span className="font-semibold">Condition:</span> {manhole.chamber_condition || '-'}</div>
                  <div><span className="font-semibold">Sump Depth (m):</span> {formatValue(manhole.sump_depth_m ?? null)}</div>
                </div>
              </div>
            </div>

            {/* Pipes tables */}
            {(() => {
              const allPipes = [...incoming, ...outgoing]
              const usesNumericLabels = allPipes.some((p) => isNumericLabel(p.label))
              if (usesNumericLabels) {
                return <PipeTableLegacy title="Pipe Information" pipes={allPipes} coverLevel={numberOrNull(manhole.cover_level)} />
              }
              return (
                <>
                  <PipeTableLegacy title="Incoming Pipes" pipes={incoming} coverLevel={numberOrNull(manhole.cover_level)} />
                  <PipeTableLegacy title="Outgoing Pipes" pipes={outgoing} coverLevel={numberOrNull(manhole.cover_level)} />
                </>
              )
            })()}

            {/* Photos / sketch */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {manhole.sketch_json ? (
                <div className="border border-gray-400 p-2">
                  <div className="text-center font-semibold mb-2">Chamber Sketch</div>
                    <div className="border border-gray-300 inline-block sketch-preview">
                      <div className="w-[220px] h-[220px] pointer-events-none select-none">
                        <ChamberSketch compact minimal value={manhole.sketch_json} palette="print-light" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border border-gray-400 p-2 text-sm text-gray-500 text-center">Chamber Sketch: No data</div>
                )}
              {manhole.internal_photo_url ? (
                <PhotoCard label="Internal Photo" url={manhole.internal_photo_url} />
              ) : (
                <div className="border border-gray-400 p-2 text-sm text-gray-500 text-center">Internal Photo: No data</div>
              )}
              {manhole.external_photo_url ? (
                <PhotoCard label="External Photo" url={manhole.external_photo_url} />
              ) : (
                <div className="border border-gray-400 p-2 text-sm text-gray-500 text-center">External Photo: No data</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PhotoCard({ label, url }: { label: string; url: string }) {
  return (
    <div className="border rounded-lg bg-white p-4">
      <h2 className="text-lg font-semibold mb-3">{label}</h2>
      <div className="aspect-video overflow-hidden rounded border border-gray-200 bg-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="h-full w-full object-cover" />
      </div>
    </div>
  )
}

function formatValue(value: string | number | null) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value.toString()
    return '-'
  }
  return value
}

function formatCoverDimensions(manhole: ManholeRecord) {
  const width = manhole.cover_width_mm
  const length = manhole.cover_length_mm
  const diameter = manhole.cover_diameter_mm

  const mm = (v: number | null | undefined) =>
    v === null || v === undefined || !Number.isFinite(v) ? null : `${v} mm`

  const d = mm(diameter)
  if (d) return d

  const w = mm(width)
  const l = mm(length)
  if (w && l) return `${w} x ${l}`
  if (w) return w
  if (l) return l

  return '-'
}

function toErrorText(err: unknown) {
  if (!err) return 'Unknown error'
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

function numberOrNull(v: string | number | null | undefined) {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const cleaned = v.trim().replace(/[^\d.-]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function PipeTableLegacy({ title, pipes, coverLevel }: { title: string; pipes: Pipe[]; coverLevel: number | null }) {
  const headers = ['Label', 'Size', 'Shape', 'Material', 'Depth', 'Invert', 'Notes']

  const getSize = (p: Pipe) => {
    const d = numberOrNull(p.diameter_mm)
    const w = numberOrNull(p.width_mm)
    const h = numberOrNull(p.height_mm)
    if (d) return `${d} mm`
    if (w && h) return `${w} x ${h}`
    if (w) return `${w} mm`
    if (h) return `${h} mm`
    return '-'
  }

  const fmt = (v: string | number | null | undefined) => {
    if (v === null || v === undefined || v === '') return '-'
    if (typeof v === 'number') return Number.isFinite(v) ? v.toString() : '-'
    return v as string
  }

  const deriveDepthAndInvert = (p: Pipe) => {
    const depth = (() => {
      const explicitDepth = numberOrNull(p.invert_depth_m)
      if (explicitDepth !== null) return explicitDepth
      const soffit = numberOrNull(p.soffit_level)
      const dia =
        numberOrNull(p.diameter_mm) ??
        numberOrNull(p.width_mm) ??
        numberOrNull(p.height_mm)
      if (soffit !== null && dia !== null) return soffit + dia / 1000 // add pipe diameter (m) to soffit to get depth
      return null
    })()

    const invert = coverLevel !== null && depth !== null ? coverLevel - depth : null
    return { depth, invert }
  }

  return (
    <div className="border border-gray-400">
      <div className="border-b border-gray-400 p-2 text-center font-semibold">{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-gray-300">
              {headers.map((h) => (
                <th key={h} className="px-2 py-1 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pipes.length === 0 ? (
              <tr>
                <td className="px-2 py-2 text-gray-500 text-center" colSpan={headers.length}>
                  No data
                </td>
              </tr>
            ) : (
              pipes.map((p, idx) => (
                <tr key={`${p.label || idx}-${idx}`} className="border-t border-gray-200">
                  {(() => {
                    const { depth, invert } = deriveDepthAndInvert(p)
                    return (
                      <>
                        <td className="px-2 py-1">{p.label || '-'}</td>
                        <td className="px-2 py-1">{getSize(p)}</td>
                        <td className="px-2 py-1">{p.shape || '-'}</td>
                        <td className="px-2 py-1">{p.material || '-'}</td>
                        <td className="px-2 py-1">{fmt(depth)}</td>
                        <td className="px-2 py-1">{fmt(invert)}</td>
                        <td className="px-2 py-1">{p.notes || '-'}</td>
                      </>
                    )
                  })()}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatChamberDimensions(m: ManholeRecord) {
  const w = m.chamber_length_mm ?? null
  const l = m.chamber_width_mm ?? null
  const d = m.chamber_diameter_mm ?? null
  const mm = (v: number | null) => (v === null || !Number.isFinite(v) ? null : `${v} mm`)
  if (Number.isFinite(d)) return mm(d)
  if (Number.isFinite(w) && Number.isFinite(l)) return `${mm(w)} x ${mm(l)}`
  if (Number.isFinite(w)) return mm(w)
  if (Number.isFinite(l)) return mm(l)
  return '-'
}

function formatCoverLifted(m: ManholeRecord) {
  if (m.cover_lifted === 'No') {
    const reason = m.cover_lifted_reason?.trim()
    return reason ? `No - ${reason}` : 'No -'
  }
  return m.cover_lifted || '-'
}

function isNumericLabel(label?: string | null) {
  if (!label) return false
  const s = label.trim()
  return /^(\s*pipe\s*)?\d+$/i.test(s) || /^\d+/.test(s)
}
