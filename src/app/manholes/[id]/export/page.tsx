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
      <div className="mx-auto w-full max-w-6xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-500">Project</p>
            <h1 className="text-3xl font-semibold flex items-center gap-2">
              {project?.name || 'Unnamed Project'}
              <span className="text-gray-400 text-xl font-normal">
                ({project?.project_number || 'No Project No.'})
              </span>
            </h1>
            <p className="text-sm text-gray-600">Client: {project?.client || '---'}</p>
            <p className="mt-2 text-lg font-medium">Manhole: {manhole?.identifier || 'Manhole Export'}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button onClick={() => window.print()} className="px-4 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50">
              Print / Save PDF
            </button>
            <span className="text-xs text-gray-500">Generated {new Date().toLocaleString()}</span>
            <span className="text-[10px] text-gray-400">Build: {BUILD_TAG}</span>
          </div>
        </div>

        {loading && <p>Loading details...</p>}
        {!loading && message && <p className="text-red-600">{message}</p>}

        {!loading && manhole && (
          <div className="space-y-4">
            {/* Header box */}
            <div className="border border-gray-400">
              <div className="flex border-b border-gray-400">
                <div className="flex-1 border-r border-gray-400 p-3 space-y-2 text-sm">
                  <div>
                    <div className="text-gray-500">Job No.:</div>
                    <div className="font-medium">{project?.project_number || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Project:</div>
                    <div className="font-medium">{project?.name || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Location:</div>
                    <div className="font-medium">{manhole.location_desc || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Chainage/Mileage:</div>
                    <div className="font-medium">{manhole.chainage_mileage || '-'}</div>
                  </div>
                </div>
                <div className="w-1/3 p-3">
                  <div className="text-sm text-gray-500">Reference ID</div>
                  <div className="font-medium">{manhole.identifier || '-'}</div>
                </div>
              </div>
            </div>

            {/* General + Coordinates boxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border border-gray-400">
                <div className="border-b border-gray-400 p-2 text-center font-semibold">General Details</div>
                <div className="p-3 grid grid-cols-1 gap-1 text-sm">
                  <div className="flex justify-between gap-2"><span>Survey Date:</span><span>{formatValue(manhole.survey_date)}</span></div>
                  <div className="flex justify-between gap-2"><span>Tool:</span><span>{manhole.measuring_tool || '-'}</span></div>
                  <div className="flex justify-between gap-2"><span>Service Type:</span><span>{manhole.service || '-'}</span></div>
                  <div className="flex justify-between gap-2">
                    <span>Cover Lifted:</span>
                    <span>
                      {manhole.cover_lifted === 'No'
                        ? `No - ${manhole.cover_lifted_reason || '-'}`
                        : manhole.cover_lifted || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2"><span>Type:</span><span>{manhole.type_other || manhole.type || '-'}</span></div>
                </div>
              </div>
              <div className="border border-gray-400">
                <div className="border-b border-gray-400 p-2 text-center font-semibold">Coordinates</div>
                <div className="p-3 grid grid-cols-1 gap-1 text-sm">
                  <div className="flex justify-between gap-2"><span>Easting:</span><span>{formatValue(manhole.easting)}</span></div>
                  <div className="flex justify-between gap-2"><span>Northing:</span><span>{formatValue(manhole.northing)}</span></div>
                  <div className="flex justify-between gap-2"><span>Latitude:</span><span>{formatValue(manhole.latitude)}</span></div>
                  <div className="flex justify-between gap-2"><span>Longitude:</span><span>{formatValue(manhole.longitude)}</span></div>
                  <div className="flex justify-between gap-2"><span>Cover Level:</span><span>{formatValue(manhole.cover_level)}</span></div>
                </div>
              </div>
            </div>

            {/* Cover + Chamber row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border border-gray-400">
                <div className="border-b border-gray-400 p-2 text-center font-semibold">Cover Details</div>
                <div className="p-3 text-sm space-y-1">
                  <div className="flex justify-between gap-2"><span>Shape:</span><span>{manhole.cover_shape || '-'}</span></div>
                  <div className="flex justify-between gap-2"><span>Dimensions:</span><span>{formatCoverDimensions(manhole)}</span></div>
                  <div className="flex justify-between gap-2"><span>Material:</span><span>{manhole.cover_material_other || manhole.cover_material || '-'}</span></div>
                  <div className="flex justify-between gap-2"><span>Condition:</span><span>{manhole.cover_condition || '-'}</span></div>
                </div>
              </div>
              <div className="border border-gray-400">
                <div className="border-b border-gray-400 p-2 text-center font-semibold">Chamber Details</div>
                <div className="p-3 text-sm space-y-1">
                  <div className="flex justify-between gap-2"><span>Shape:</span><span>{manhole.chamber_shape || '-'}</span></div>
                  <div className="flex justify-between gap-2"><span>Dimensions:</span><span>{formatChamberDimensions(manhole)}</span></div>
                  <div className="flex justify-between gap-2"><span>Material:</span><span>{manhole.chamber_material_other || manhole.chamber_material || '-'}</span></div>
                  <div className="flex justify-between gap-2"><span>Condition:</span><span>{manhole.chamber_condition || '-'}</span></div>
                </div>
              </div>
            </div>

            {/* Pipes tables */}
            <PipeTableLegacy title="Incoming Pipes" pipes={incoming} />
            <PipeTableLegacy title="Outgoing Pipes" pipes={outgoing} />

            {/* Photos / sketch */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {manhole.sketch_json ? (
                <div className="border border-gray-400 p-2">
                  <div className="text-center font-semibold mb-2">Chamber Sketch</div>
                  <div className="border border-gray-300 inline-block">
                    <div className="w-[220px] h-[220px]">
                      <ChamberSketch compact value={manhole.sketch_json} palette="print-light" />
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

function PipeTableLegacy({ title, pipes }: { title: string; pipes: Pipe[] }) {
  const headers = ['Label', 'Size', 'Shape', 'Material', 'Depth', 'Invert', 'Notes']

  const numberOrNull = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return null
    const n = typeof v === 'string' ? Number(v) : v
    return Number.isFinite(n) ? n : null
  }

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
                  <td className="px-2 py-1">{p.label || '-'}</td>
                  <td className="px-2 py-1">{getSize(p)}</td>
                  <td className="px-2 py-1">{p.shape || '-'}</td>
                  <td className="px-2 py-1">{p.material || '-'}</td>
                  <td className="px-2 py-1">{fmt(p.invert_depth_m)}</td>
                  <td className="px-2 py-1">{fmt(p.soffit_level)}</td>
                  <td className="px-2 py-1">{p.notes || '-'}</td>
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
