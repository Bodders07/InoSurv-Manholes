"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import dynamic from "next/dynamic"

const ChamberSketch = dynamic(() => import("@/app/components/sketch/ChamberSketch"), { ssr: false })

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

type ManholeRow = {
  id: string
  project_id: string
  identifier: string | null
  service_type: string | null
  survey_date: string | null
  measuring_tool: string | null
  measuring_offset_mm: number | null
  location_desc: string | null
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
  cover_lifted: string | null
  cover_lifted_reason: string | null
  chamber_shape: string | null
  chamber_diameter_mm: number | null
  chamber_width_mm: number | null
  chamber_length_mm: number | null
  chamber_material: string | null
  chamber_material_other: string | null
  incoming_pipes: Pipe[] | null
  outgoing_pipes: Pipe[] | null
  internal_photo_url: string | null
  external_photo_url: string | null
  sketch_json: any | null
}

export default function ExportManholeSheet() {
  const params = useParams() as { id: string }
  const [row, setRow] = useState<ManholeRow | null>(null)
  const [project, setProject] = useState<{ name: string | null; project_number: string | null; client?: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState("")

  useEffect(() => {
    async function load() {
      setLoading(true)
      setMsg("")
      try {
        const { data: sess } = await supabase.auth.getSession()
        if (!sess?.session) {
          setMsg('Not signed in. Please sign in and try again.')
          setLoading(false)
          return
        }
        // Select only needed columns
        const { data, error } = await supabase
          .from("manholes")
          .select(`
            id, project_id, identifier, service_type, survey_date, measuring_tool, measuring_offset_mm, location_desc,
            easting, northing, cover_level, cover_shape, cover_diameter_mm, cover_width_mm, cover_length_mm,
            cover_material, cover_material_other, cover_duty, cover_condition, cover_lifted, cover_lifted_reason,
            chamber_shape, chamber_diameter_mm, chamber_width_mm, chamber_length_mm, chamber_material, chamber_material_other,
            incoming_pipes, outgoing_pipes, internal_photo_url, external_photo_url, sketch_json
          `)
          .eq("id", params.id)
          .maybeSingle()
        if (error) {
          setMsg("Error: " + error.message)
          setLoading(false)
          return
        }
        setRow(data as any)
        if (data?.project_id) {
          const p = await supabase
            .from("projects")
            .select("name, project_number, client")
            .eq("id", data.project_id)
            .maybeSingle()
          if (!p.error) setProject(p.data as any)
        }
      } catch (e: any) {
        setMsg('Unexpected error loading export: ' + (e?.message || String(e)))
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  const incoming = useMemo(() => row?.incoming_pipes || [], [row])
  const outgoing = useMemo(() => row?.outgoing_pipes || [], [row])

  if (loading) return <div className="p-6">Loading...</div>
  if (!row) return <div className="p-6">Not found</div>

  return (
    <div className="p-6" style={{ background: "#fff" }}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manhole Sheet</h1>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded border border-gray-300" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </div>

      {msg && <p className="mb-2 text-red-600">{msg}</p>}

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display:none !important; }
          .sheet { box-shadow:none !important; border:1px solid #000 !important; }
        }
        .sheet h2 { font-weight: 600; font-size: 14px; }
        .kv td:first-child { width: 140px; font-weight: 600; }
        .kv td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; }
        .box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; }
        .table th, .table td { border: 1px solid #cbd5e1; padding: 6px; font-size: 12px; }
        .table th { background: #f1f5f9; text-align:left; }
      `}</style>

      <div className="sheet box bg-white shadow">
        {/* Header */}
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div className="col-span-2 box">
            <table className="kv w-full">
              <tbody>
                <tr><td>Job No:</td><td>{project?.project_number || "-"}</td></tr>
                <tr><td>Project:</td><td>{project?.name || "-"}</td></tr>
                <tr><td>Client:</td><td>{project?.client || "-"}</td></tr>
                <tr><td>Location:</td><td>{row.location_desc || "-"}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="box">
            <table className="kv w-full">
              <tbody>
                <tr><td>Manhole ID:</td><td>{row.identifier || "-"}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Cover + General */}
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="box">
            <h2 className="mb-2">Cover Details</h2>
            <table className="kv w-full">
              <tbody>
                <tr><td>Service Type:</td><td>{row.service_type || "-"}</td></tr>
                <tr><td>Cover Material:</td><td>{row.cover_material === 'Other' ? (row.cover_material_other || 'Other') : (row.cover_material || '-')}</td></tr>
                <tr><td>Cover Shape:</td><td>{row.cover_shape || "-"}</td></tr>
                <tr><td>Cover Size:</td><td>{row.cover_shape === 'Circle' ? (row.cover_diameter_mm ? `${row.cover_diameter_mm} mm Ø` : '-') : (row.cover_width_mm || row.cover_length_mm ? `${row.cover_width_mm || '-'} x ${row.cover_length_mm || '-'} mm` : '-')}</td></tr>
                <tr><td>Cover Cond:</td><td>{row.cover_condition || '-'}</td></tr>
                <tr><td>Cover Duty:</td><td>{row.cover_duty || '-'}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="box">
            <h2 className="mb-2">General Details</h2>
            <table className="kv w-full">
              <tbody>
                <tr><td>Survey Date:</td><td>{row.survey_date || '-'}</td></tr>
                <tr><td>Surveyor:</td><td>{row.measuring_tool || '-'}</td></tr>
                <tr><td>Eastings:</td><td>{row.easting ?? '-'}</td></tr>
                <tr><td>Northings:</td><td>{row.northing ?? '-'}</td></tr>
                <tr><td>Cover Level:</td><td>{row.cover_level ?? '-'}</td></tr>
                <tr><td>Cover Lifted:</td><td>{row.cover_lifted || '-'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Chamber */}
        <div className="box mb-3">
          <h2 className="mb-2">Chamber Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <table className="kv w-full"><tbody>
              <tr><td>Dimensions:</td><td>{row.chamber_shape === 'Circle' || row.chamber_shape === 'Hexagon' ? (row.chamber_diameter_mm ? `${row.chamber_diameter_mm} mm Ø` : '-') : (row.chamber_width_mm || row.chamber_length_mm ? `${row.chamber_width_mm || '-'} x ${row.chamber_length_mm || '-'} mm` : '-')}</td></tr>
              <tr><td>Shape:</td><td>{row.chamber_shape || '-'}</td></tr>
            </tbody></table>
            <table className="kv w-full"><tbody>
              <tr><td>Material:</td><td>{row.chamber_material === 'Other' ? (row.chamber_material_other || 'Other') : (row.chamber_material || '-')}</td></tr>
              <tr><td>Condition:</td><td>-</td></tr>
            </tbody></table>
          </div>
        </div>

        {/* Incoming pipes */}
        <div className="box mb-3">
          <h2 className="mb-2">Incoming Pipes</h2>
          <table className="table w-full">
            <thead>
              <tr>
                <th>Size</th><th>Shape</th><th>Material</th><th>Function</th><th>Depth</th><th>Invert level</th>
              </tr>
            </thead>
            <tbody>
              {incoming.length === 0 ? (
                <tr><td colSpan={6}>-</td></tr>
              ) : incoming.map((p) => (
                <tr key={p.label}>
                  <td>{p.diameter_mm || (p.width_mm && p.height_mm ? `${p.width_mm}x${p.height_mm}` : '')}</td>
                  <td>{p.shape}</td>
                  <td>{p.material}</td>
                  <td>{p.func}</td>
                  <td>{p.invert_depth_m}</td>
                  <td>-</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Outgoing pipes */}
        <div className="box mb-3">
          <h2 className="mb-2">Outgoing Pipes</h2>
          <table className="table w-full">
            <thead>
              <tr>
                <th>Size</th><th>Shape</th><th>Material</th><th>Function</th><th>Depth</th><th>Invert level</th>
              </tr>
            </thead>
            <tbody>
              {outgoing.length === 0 ? (
                <tr><td colSpan={6}>-</td></tr>
              ) : outgoing.map((p) => (
                <tr key={p.label}>
                  <td>{p.diameter_mm || (p.width_mm && p.height_mm ? `${p.width_mm}x${p.height_mm}` : '')}</td>
                  <td>{p.shape}</td>
                  <td>{p.material}</td>
                  <td>{p.func}</td>
                  <td>{p.invert_depth_m}</td>
                  <td>-</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom: Sketch + Photos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="box" style={{ minHeight: 220 }}>
            <h2 className="mb-2">Sketch</h2>
            <div className="border border-dashed p-2" style={{ minHeight: 170 }}>
              {row.sketch_json ? (
                <ChamberSketch compact value={row.sketch_json as any} />
              ) : (
                <div className="text-gray-500 text-sm">No sketch</div>
              )}
            </div>
          </div>
          <div className="box" style={{ minHeight: 220 }}>
            <h2 className="mb-2">Internal Photo</h2>
            {row.internal_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Internal" src={row.internal_photo_url} className="w-full object-contain" style={{ maxHeight: 180 }} />
            ) : <div className="text-gray-500 text-sm">No photo</div>}
          </div>
          <div className="box" style={{ minHeight: 220 }}>
            <h2 className="mb-2">External Photo</h2>
            {row.external_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="External" src={row.external_photo_url} className="w-full object-contain" style={{ maxHeight: 180 }} />
            ) : <div className="text-gray-500 text-sm">No photo</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
