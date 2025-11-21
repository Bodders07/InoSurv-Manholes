'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import NextDynamic from 'next/dynamic'
import type { SketchState } from '@/app/components/sketch/ChamberSketch'
import { supabase } from '@/lib/supabaseClient'

const ChamberSketch = NextDynamic(() => import('@/app/components/sketch/ChamberSketch'), { ssr: false })

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
  cover_condition: string | null
  chamber_shape: string | null
  chamber_material: string | null
  chamber_material_other: string | null
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
        const { data: mhRow, error: mhError } = await supabase
          .from('chambers')
          .select('*')
          .eq('id', manholeId)
          .is('deleted_at', null)
          .maybeSingle()
        if (mhError) throw mhError
        if (!mhRow) {
          throw new Error('Manhole not found')
        }
        const record = mhRow as ManholeRecord
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
        const msg = err instanceof Error ? err.message : String(err)
        setMessage(msg)
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

  const incoming = useMemo(() => (Array.isArray(manhole?.incoming_pipes) ? manhole?.incoming_pipes ?? [] : []), [manhole?.incoming_pipes])
  const outgoing = useMemo(() => (Array.isArray(manhole?.outgoing_pipes) ? manhole?.outgoing_pipes ?? [] : []), [manhole?.outgoing_pipes])

  const headerTitle = manhole?.identifier || 'Manhole Export'
  const projectName = project?.name || 'Unnamed Project'

  return (
    <div className={`min-h-screen ${embed ? 'bg-white' : 'bg-neutral-100'} text-gray-900`}>
      <div className="mx-auto w-full max-w-5xl p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-500">Project</p>
            <h1 className="text-3xl font-semibold">
              {projectName}
              <span className="text-gray-400 text-xl font-normal ml-2">
                ({project?.project_number || 'No Project No.'})
              </span>
            </h1>
            <p className="text-sm text-gray-600">{project?.client || 'Client: —'}</p>
            <p className="mt-2 text-lg font-medium">Manhole: {headerTitle}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50"
            >
              Print / Save PDF
            </button>
            <span className="text-xs text-gray-500">Generated {new Date().toLocaleString()}</span>
          </div>
        </div>

        {loading && <p>Loading details…</p>}
        {!loading && message && <p className="text-red-600">{message}</p>}

        {!loading && manhole && (
          <div className="space-y-6">
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoCard
                title="Survey Details"
              rows={[
                { label: 'Identifier', value: manhole.identifier || '—' },
                { label: 'Location', value: manhole.location_desc || '�' },
                { label: 'Service', value: manhole.service || '�' },
                { label: 'Chainage / Mileage', value: manhole.chainage_mileage || '�' },
                { label: 'Offset (mm)', value: formatValue(manhole.measuring_offset_mm) },
                ]}
              />
              <InfoCard
                title="General Details"
                rows={[
                  { label: 'Survey Date', value: formatValue(manhole.survey_date) },
                  { label: 'Tool', value: manhole.measuring_tool || '�' },
                  { label: 'Cover Lifted', value: manhole.cover_lifted === 'No' ? ('No - ' + (manhole.cover_lifted_reason || '-')) : manhole.cover_lifted || '�' },
                  { label: 'Type', value: manhole.type_other || manhole.type || '�' },
                ]}
              />

            </section>
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoCard
                title="Coordinates"
                rows={[
                  { label: 'Easting', value: formatValue(manhole.easting) },
                  { label: 'Northing', value: formatValue(manhole.northing) },
                  { label: 'Latitude', value: formatValue(manhole.latitude) },
                  { label: 'Longitude', value: formatValue(manhole.longitude) },
                  { label: 'Cover Level', value: formatValue(manhole.cover_level) },
                ]}
              />
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoCard
                title="Cover"
                rows={[
                  { label: 'Shape', value: manhole.cover_shape || '—' },
                  { label: 'Material', value: manhole.cover_material_other || manhole.cover_material || '—' },
                  { label: 'Duty', value: manhole.cover_duty || '—' },
                  { label: 'Condition', value: manhole.cover_condition || '—' },
                  { label: 'Lifted?', value: manhole.cover_lifted || '—' },
                  { label: 'Reason', value: manhole.cover_lifted_reason || '—' },
                ]}
              />
              <InfoCard
                title="Chamber"
                rows={[
                  { label: 'Shape', value: manhole.chamber_shape || '—' },
                  { label: 'Material', value: manhole.chamber_material_other || manhole.chamber_material || '—' },
                  { label: 'Type', value: manhole.type_other || manhole.type || '—' },
                ]}
              />
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PipeTable title="Incoming Pipes" pipes={incoming} emptyText="No incoming pipes recorded." />
              <PipeTable title="Outgoing Pipes" pipes={outgoing} emptyText="No outgoing pipes recorded." />
            </section>

            {(manhole.internal_photo_url || manhole.external_photo_url) && (
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {manhole.internal_photo_url && (
                  <PhotoCard label="Internal Photo" url={manhole.internal_photo_url} />
                )}
                {manhole.external_photo_url && (
                  <PhotoCard label="External Photo" url={manhole.external_photo_url} />
                )}
              </section>
            )}

            {manhole.sketch_json && (
              <section className="border rounded-lg p-4 bg-white">
                <h2 className="text-lg font-semibold mb-2">Sketch</h2>
                <div className="inline-block border border-gray-300 rounded p-3">
                  <div className="w-[500px] h-[500px]">
                    <ChamberSketch compact value={manhole.sketch_json} palette="print-light" />
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCard({ title, rows }: { title: string; rows: { label: string; value: string | number | null }[] }) {
  return (
    <div className="border rounded-lg bg-white p-4">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <dl className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-gray-500">{row.label}</dt>
            <dd className="font-medium text-right break-words">{row.value ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function PipeTable({ title, pipes, emptyText }: { title: string; pipes: Pipe[]; emptyText: string }) {
  return (
    <div className="border rounded-lg bg-white p-4">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {pipes.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1 pr-2 font-medium">Label</th>
                <th className="py-1 pr-2 font-medium">Function</th>
                <th className="py-1 pr-2 font-medium">Shape</th>
                <th className="py-1 pr-2 font-medium">Material</th>
                <th className="py-1 pr-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {pipes.map((pipe, idx) => (
                <tr key={`${pipe.label || idx}-${idx}`} className="border-t">
                  <td className="py-1 pr-2">{pipe.label || '-'}</td>
                  <td className="py-1 pr-2">{pipe.func || '-'}</td>
                  <td className="py-1 pr-2">{pipe.shape || '-'}</td>
                  <td className="py-1 pr-2">{pipe.material || '-'}</td>
                  <td className="py-1 pr-2">{pipe.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value.toString()
    return '—'
  }
  return value
}

