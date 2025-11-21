'use client'

import React, { useCallback, useEffect, useMemo, useState, useDeferredValue, type ReactNode } from 'react'
import { jsPDF } from 'jspdf'
import { supabase } from '@/lib/supabaseClient'
import type { SketchState } from '@/app/components/sketch/ChamberSketch'
import { usePermissions } from '@/app/components/PermissionsContext'
import { cacheList, getCachedList } from '@/lib/offlineCache'

type Project = { id: string; name: string | null; project_number: string | null; client: string | null }
type Manhole = { id: string; identifier: string | null; project_id: string }
type SortKey = 'project_number' | 'project_name' | 'identifier'
type DetailedManholeRecord = Record<string, unknown> & {
  id: string
  project_id: string
  identifier: string | null
  project_name: string | null
  project_number: string | null
  project_client: string | null
  location_desc?: string | null
  survey_date?: string | null
  measuring_tool?: string | null
  measuring_offset_mm?: number | null
  chainage_mileage?: string | null
  latitude?: number | null
  longitude?: number | null
  easting?: number | null
  northing?: number | null
  cover_level?: number | null
  cover_shape?: string | null
  cover_diameter_mm?: number | null
  cover_width_mm?: number | null
  cover_length_mm?: number | null
  cover_material?: string | null
  cover_material_other?: string | null
  cover_condition?: string | null
  cover_duty?: string | null
  chamber_shape?: string | null
  chamber_diameter_mm?: number | null
  chamber_width_mm?: number | null
  chamber_length_mm?: number | null
  chamber_material?: string | null
  chamber_material_other?: string | null
  service_type?: string | null
  type?: string | null
  type_other?: string | null
  cover_lifted?: string | null
  cover_lifted_reason?: string | null
  incoming_pipes?: PipeRecord[] | null
  outgoing_pipes?: PipeRecord[] | null
  internal_photo_url?: string | null
  external_photo_url?: string | null
  sketch_json?: SketchState | null
}
type PipeRecord = {
  label?: string | null
  shape?: string | null
  func?: string | null
  material?: string | null
  width_mm?: string | number | null
  height_mm?: string | number | null
  diameter_mm?: string | number | null
  invert_depth_m?: string | number | null
  soffit_level?: string | number | null
  notes?: string | null
}
type PipeRow = {
  label: string
  size: string
  shape: string
  material: string
  depth: string
  invert: string
  notes: string
}

class ChamberModalBoundary extends React.Component<
  { children: ReactNode; onError?: (err: Error) => void },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode; onError?: (err: Error) => void }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    try {
      localStorage.setItem(
        'lastNewChamberError',
        JSON.stringify({ message: error.message, stack: error.stack, ts: Date.now() })
      )
    } catch {
      /* ignore */
    }
    if (this.props.onError) this.props.onError(error)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-sm text-red-700 bg-red-50 rounded border border-red-200">
          <p className="font-semibold">New Chamber error (captured locally)</p>
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


const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M12 5c5 0 9 5 9 7s-4 7-9 7-9-5-9-7 4-7 9-7Zm0 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
  </svg>
)
const PencilIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M16.862 3.487a1.75 1.75 0 0 1 2.476 2.476l-10 10a1.75 1.75 0 0 1-.72.438l-4 1.25a.75.75 0 0 1-.938-.938l1.25-4a1.75.75 0 0 1 .438-.72l10-10Z" />
    <path d="M15 5 19 9" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M9 3.75A1.75 1.75 0 0 1 10.75 2h2.5A1.75 1.75 0 0 1 15 3.75V5h4.25a.75.75 0 0 1 0 1.5H4.75a.75.75 0 0 1 0-1.5H9V3.75Z" />
    <path d="M6.5 7h11l-.7 11.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6.5 7Z" />
  </svg>
)

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition-colors"
    >
      {children}
    </button>
  )
}

type EditModalMessage = {
  type: 'close-edit-modal'
  refresh?: boolean
}

function isEditModalMessage(payload: unknown): payload is EditModalMessage {
  if (!payload || typeof payload !== 'object') return false
  return (payload as { type?: string }).type === 'close-edit-modal'
}

type ImageAsset = { dataUrl: string; format: 'PNG' | 'JPEG'; width: number; height: number }
let cachedLogo: ImageAsset | null = null

async function getLogoAsset() {
  if (cachedLogo) return cachedLogo
  const data = await fetchImageData('/inorail-logo.png')
  if (data) cachedLogo = data
  return cachedLogo
}

function valueOrDash(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

const DIAMETER_SYMBOL = 'Ø'
const PIPE_DIAMETER_SHAPES = new Set(['Circular', 'Egg', 'Brick Arch', 'Unknown', 'Other'])

function formatPipeSize(pipe?: PipeRecord, shape?: string | null) {
  if (!pipe) return '-'
  const usesDiameter = shape ? PIPE_DIAMETER_SHAPES.has(shape) : false
  const diameter = pipe.diameter_mm
  const hasDiameter = diameter !== null && diameter !== undefined && String(diameter).trim() !== ''
  const width = pipe.width_mm
  const height = pipe.height_mm
  const hasWidthHeight = (width !== null && width !== undefined && String(width).trim() !== '') ||
    (height !== null && height !== undefined && String(height).trim() !== '')

  if (usesDiameter && hasDiameter) return `${DIAMETER_SYMBOL}${diameter} mm`
  if (!usesDiameter && hasWidthHeight) return `${width || '-'} x ${height || '-'}`
  if (hasDiameter) return `${DIAMETER_SYMBOL}${diameter} mm`
  if (hasWidthHeight) return `${width || '-'} x ${height || '-'}`
  return '-'
}

function formatDimensionByShape(
  shape?: string | null,
  diameter?: string | number | null,
  width?: string | number | null,
  length?: string | number | null
) {
  const usesDiameter = shape === 'Circle' || shape === 'Hexagon'
  const hasDiameter = diameter !== null && diameter !== undefined && String(diameter).trim() !== ''
  const hasWidth = width !== null && width !== undefined && String(width).trim() !== ''
  const hasLength = length !== null && length !== undefined && String(length).trim() !== ''
  if (usesDiameter && hasDiameter) return `${DIAMETER_SYMBOL}${diameter} mm`
  if (!usesDiameter && (hasWidth || hasLength)) return `${width || '-'} x ${length || '-'}`
  if (hasDiameter) return `${DIAMETER_SYMBOL}${diameter} mm`
  if (hasWidth || hasLength) return `${width || '-'} x ${length || '-'}`
  return '-'
}

function formatCoverLifted(record: DetailedManholeRecord) {
  if (record.cover_lifted === 'No') {
    const reason = (record.cover_lifted_reason || '').toString().trim()
    return reason ? `No - ${reason}` : 'No -'
  }
  return record.cover_lifted || '-'
}

async function fetchImageData(url?: string | null) {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    try {
      const { dataUrl, width, height } = await new Promise<{ dataUrl: string; width: number; height: number }>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const w = img.naturalWidth || img.width || 1
          const h = img.naturalHeight || img.height || 1
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve({ dataUrl: objectUrl, width: w, height: h })
            return
          }
          ctx.drawImage(img, 0, 0, w, h)
          const mime = blob.type === 'image/png' ? 'image/png' : 'image/jpeg'
          const data = canvas.toDataURL(mime, 0.92)
          resolve({ dataUrl: data, width: w, height: h })
        }
        img.onerror = reject
        img.src = objectUrl
      })
      const format: 'PNG' | 'JPEG' = blob.type === 'image/png' ? 'PNG' : 'JPEG'
      return { dataUrl, format, width, height }
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch {
    return null
  }
}

function renderSketchToDataUrl(sketch?: SketchState | null) {
  if (!sketch) return null
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 320
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#4b5563'
  ctx.lineWidth = 3
  const scale = (value?: number) => ((value ?? 250) / 500) * canvas.width
  const cx = scale(250)
  const cy = scale(250)
  const drawChamber = () => {
    switch (sketch.chamberShape) {
      case 'Square':
        ctx.strokeRect(cx - 110, cy - 110, 220, 220)
        break
      case 'Rectangle':
        ctx.strokeRect(cx - 90, cy - 150, 180, 300)
        break
      case 'Hexagon': {
        ctx.beginPath()
        const points = [
          [cx, cy - 120],
          [cx + 105, cy - 60],
          [cx + 105, cy + 60],
          [cx, cy + 120],
          [cx - 105, cy + 60],
          [cx - 105, cy - 60],
        ]
        points.forEach(([x, y], idx) => {
          if (idx === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.closePath()
        ctx.stroke()
        break
      }
      default:
        ctx.beginPath()
        ctx.arc(cx, cy, 115, 0, Math.PI * 2)
        ctx.stroke()
        break
    }
  }
  const drawCover = () => {
    ctx.setLineDash([6, 4])
    switch (sketch.coverShape) {
      case 'Square':
        ctx.strokeRect(cx - 80, cy - 80, 160, 160)
        break
      case 'Rectangle':
        ctx.strokeRect(cx - 60, cy - 80, 120, 160)
        break
      case 'Triangle':
        ctx.beginPath()
        ctx.moveTo(cx, cy - 80)
        ctx.lineTo(cx + 80, cy + 80)
        ctx.lineTo(cx - 80, cy + 80)
        ctx.closePath()
        ctx.stroke()
        break
      default:
        ctx.beginPath()
        ctx.arc(cx, cy, 80, 0, Math.PI * 2)
        ctx.stroke()
    }
    ctx.setLineDash([])
  }
  drawChamber()
  drawCover()
  const drawArrow = (sx: number, sy: number, ex: number, ey: number, color: string) => {
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    const angle = Math.atan2(ey - sy, ex - sx)
    const len = 12
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex - len * Math.cos(angle - Math.PI / 6), ey - len * Math.sin(angle - Math.PI / 6))
    ctx.lineTo(ex - len * Math.cos(angle + Math.PI / 6), ey - len * Math.sin(angle + Math.PI / 6))
    ctx.closePath()
    ctx.fill()
  }
  ctx.font = '16px Arial'
  ctx.fillStyle = '#111827'
  sketch.items.forEach((item) => {
    if (item.type === 'label') {
      if (item.label) ctx.fillText(item.label, scale(item.x), scale(item.y))
    } else {
      const sx = scale(item.sx)
      const sy = scale(item.sy)
      const ex = scale(item.ex)
      const ey = scale(item.ey)
      const isInlet = item.type === 'in'
      const color = item.type === 'out' ? '#b91c1c' : '#2563eb'
      const startX = isInlet ? ex : sx
      const startY = isInlet ? ey : sy
      const endX = isInlet ? sx : ex
      const endY = isInlet ? sy : ey
      drawArrow(startX, startY, endX, endY, color)
      const labelX = isInlet ? startX : endX
      const labelY = isInlet ? startY : endY
      if (item.label) ctx.fillText(item.label, labelX + 4, labelY + 4)
    }
  })
  return canvas.toDataURL('image/png')
}

const CSV_COLUMNS = [
  { key: 'project_number', label: 'Project No.' },
  { key: 'project_name', label: 'Project Name' },
  { key: 'project_client', label: 'Client' },
  { key: 'identifier', label: 'Manhole' },
  { key: 'location_desc', label: 'Location' },
  { key: 'survey_date', label: 'Survey Date' },
  { key: 'measuring_tool', label: 'Measuring Tool' },
  { key: 'measuring_offset_mm', label: 'Offset (mm)' },
  { key: 'latitude', label: 'Latitude' },
  { key: 'longitude', label: 'Longitude' },
  { key: 'easting', label: 'Easting' },
  { key: 'northing', label: 'Northing' },
  { key: 'cover_level', label: 'Cover Level' },
  { key: 'cover_shape', label: 'Cover Shape' },
  { key: 'cover_material', label: 'Cover Material' },
  { key: 'cover_condition', label: 'Cover Condition' },
  { key: 'chamber_shape', label: 'Chamber Shape' },
  { key: 'chamber_material', label: 'Chamber Material' },
  { key: 'incoming_pipes', label: 'Incoming Pipes' },
  { key: 'outgoing_pipes', label: 'Outgoing Pipes' },
] as const

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) return ''
  const raw =
    typeof value === 'object' ? JSON.stringify(value) : String(value).replace(/\r?\n/g, ' ').trim()
  if (raw === '') return ''
  return /[",]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw
}

function buildCsvContent(records: Record<string, unknown>[]) {
  const header = CSV_COLUMNS.map((col) => col.label).join(',')
  const lines = records.map((record) =>
    CSV_COLUMNS.map((col) => escapeCsvValue(record[col.key])).join(',')
  )
  return [header, ...lines].join('\r\n')
}

function safeFileSegment(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, '_') || 'manhole'
}

export default function ChambersContent() {
  const [editId, setEditId] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [Chambers, setChambers] = useState<Manhole[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('project_number')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  // Filters (in panel)
  const [filterProjectNo, setFilterProjectNo] = useState<string>('')
  const [filterClient, setFilterClient] = useState<string>('')
  const [filterProjectName, setFilterProjectName] = useState<string>('')
  const [query, setQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showFilter, setShowFilter] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [previewPdf, setPreviewPdf] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState<string>('')
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null)
  const [exportProject, setExportProject] = useState('')
  const [exportSelectAll, setExportSelectAll] = useState(true)
  const [exportSelected, setExportSelected] = useState<string[]>([])
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'jpeg'>('pdf')
  const [exportBusy, setExportBusy] = useState(false)
  const [exportSearch, setExportSearch] = useState('')
  const { has } = usePermissions()
  const canCreateManhole = has('manhole-create')
  const canEditManhole = has('manhole-edit')
  const canDeleteManhole = has('manhole-delete')
  const canExportChambers = has('export-pdf') || has('export-csv')

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setMessage('')
      try {
        const [projRes, mhRes] = await Promise.all([
          supabase.from('projects').select('id, name, project_number, client').is('deleted_at', null),
          supabase.from('chambers').select('id, identifier, project_id').is('deleted_at', null),
        ])
        if (projRes.error) throw new Error(projRes.error.message)
        if (mhRes.error) throw new Error(mhRes.error.message)
        const projData = (projRes.data as Project[]) || []
        const chamberData = mhRes.data || []
        setProjects(projData)
        setChambers(chamberData)
        cacheList('projects', projData)
        cacheList('chambers', chamberData)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error loading data'
        setMessage((prev) => prev || msg)
        const cachedProjects = await getCachedList<Project>('projects')
        const cachedChambers = await getCachedList<Manhole>('chambers')
        if (cachedProjects?.data) setProjects(cachedProjects.data)
        if (cachedChambers?.data) setChambers(cachedChambers.data)
      }
      setLoading(false)
    }
    loadData()
  }, [])

  useEffect(() => {
    setHydrated(true)
  }, [])

  async function reloadLists() {
    setLoading(true)
    try {
      const [projRes, mhRes] = await Promise.all([
        supabase.from('projects').select('id, name, project_number, client').is('deleted_at', null),
        supabase.from('chambers').select('id, identifier, project_id').is('deleted_at', null),
      ])
      if (projRes.error) throw new Error(projRes.error.message)
      if (mhRes.error) throw new Error(mhRes.error.message)
      const projData = projRes.data as Project[]
      const chamberData = mhRes.data || []
      setProjects(projData)
      setChambers(chamberData)
      cacheList('projects', projData)
      cacheList('chambers', chamberData)
    } catch {
      // On failure keep current state
    }
    setLoading(false)
  }

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      if (!ev) return
      if (isEditModalMessage(ev.data)) {
        setEditOpen(false)
        if (ev.data.refresh) reloadLists()
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // Close modal on ESC for accessibility/mobile convenience
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setEditOpen(false)
    }
    if (editOpen) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editOpen])

  const deferredQuery = useDeferredValue(query)
  const deferredExportSearch = useDeferredValue(exportSearch)

  const projectById = useMemo(() => {
    const map = new Map<string, { name: string; project_number: string; client: string }>()
    projects.forEach((p) =>
      map.set(p.id, {
        name: p.name || '',
        project_number: p.project_number || '',
        client: p.client || '',
      })
    )
    return map
  }, [projects])

  const rows = useMemo(() => {
    let data = Chambers.map((m) => {
      const p = projectById.get(m.project_id) || { name: '', project_number: '', client: '' }
      return {
        id: m.id,
        identifier: m.identifier || '',
        project_name: p.name,
        project_number: p.project_number,
        project_client: p.client || '',
      }
    })
    if (filterProjectNo) data = data.filter((r) => r.project_number === filterProjectNo)
    if (filterClient) data = data.filter((r) => r.project_client === filterClient)
    if (filterProjectName) data = data.filter((r) => r.project_name === filterProjectName)
    if (deferredQuery.trim()) {
      const q = deferredQuery.toLowerCase()
      data = data.filter(
        (r) =>
          (r.identifier || '').toLowerCase().includes(q) ||
          (r.project_name || '').toLowerCase().includes(q) ||
          (r.project_number || '').toLowerCase().includes(q) ||
          (r.project_client || '').toLowerCase().includes(q)
      )
    }
    const dir = sortDir === 'asc' ? 1 : -1
    return data.sort((a, b) => {
      const av = (a[sortKey] || '').toString().toLowerCase()
      const bv = (b[sortKey] || '').toString().toLowerCase()
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [Chambers, projectById, sortKey, sortDir, filterProjectNo, filterClient, filterProjectName, deferredQuery])

  const exportCandidates = useMemo(() => {
    const list = rows.filter((r) => !exportProject || r.project_number === exportProject)
    if (!deferredExportSearch.trim()) return list
    const q = deferredExportSearch.toLowerCase()
    return list.filter(
      (r) =>
        (r.identifier || '').toLowerCase().includes(q) ||
        (r.project_number || '').toLowerCase().includes(q) ||
        (r.project_name || '').toLowerCase().includes(q)
    )
  }, [rows, exportProject, deferredExportSearch])

  useEffect(() => {
    if (!exportOpen) return
    if (exportSelectAll) {
      setExportSelected(exportCandidates.map((r) => r.id))
    }
  }, [exportOpen, exportSelectAll, exportCandidates])

  const exportProjectOptions = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.project_number).filter(Boolean))) as string[]
  }, [rows])

  function handleExportOpen() {
    if (!canExportChambers) return
    setExportProject('')
    setExportSelectAll(true)
    setExportSelected(rows.map((r) => r.id))
    setExportFormat('pdf')
    setExportOpen(true)
  }

  const fetchDetailedChambers = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return []
      const { data, error } = await supabase
        .from('chambers')
        .select('*')
        .in('id', ids)
        .is('deleted_at', null)
      if (error) throw new Error(error.message)
      const records = (data as DetailedManholeRecord[]) || []
      const orderMap = new Map(ids.map((id, index) => [id, index]))
      return records
        .map((record) => {
          const info = projectById.get(record.project_id) || { name: '', project_number: '', client: '' }
          return {
            ...record,
            project_name: info.name,
            project_number: info.project_number,
            project_client: info.client,
          }
        })
        .sort((a, b) => {
          const aIdx = orderMap.get(a.id) ?? 0
          const bIdx = orderMap.get(b.id) ?? 0
          return aIdx - bIdx
        })
    },
    [projectById]
  )

  function toggleExportSelection(id: string) {
    setExportSelected((prev) => {
      if (prev.includes(id)) {
        setExportSelectAll(false)
        return prev.filter((item) => item !== id)
      }
      const next = [...prev, id]
      if (next.length === exportCandidates.length) setExportSelectAll(true)
      return next
    })
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function downloadCsvFile(records: DetailedManholeRecord[]) {
    const csv = buildCsvContent(records)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Chambers-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function downloadJpegFiles(records: DetailedManholeRecord[]) {
    const width = 1200
    const height = 800
    records.forEach((record) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = '#111827'
      ctx.font = 'bold 32px Arial'
      ctx.fillText('Manhole Summary', 40, 60)
      ctx.font = '20px Arial'
      const lines = [
        `Project: ${record.project_name || '-'}`,
        `Project No.: ${record.project_number || '-'}`,
        `Client: ${record.project_client || '-'}`,
        `Manhole: ${record.identifier || '-'}`,
        `Location: ${record.location_desc || '-'}`,
        `Survey Date: ${record.survey_date || '-'}`,
        `Cover: ${record.cover_shape || '-'} / ${record.cover_material || '-'}`,
        `Cover Condition: ${record.cover_condition || '-'}`,
        `Chainage/Mileage: ${record.chainage_mileage || '-'}`,
        `Chamber: ${record.chamber_shape || '-'} / ${record.chamber_material || '-'}`,
      ]
      lines.forEach((text, index) => {
        ctx.fillText(text, 40, 120 + index * 32)
      })
      ctx.font = '16px Arial'
      const url = canvas.toDataURL('image/jpeg', 0.92)
      const link = document.createElement('a')
      link.href = url
      const safeName = safeFileSegment(String(record.identifier || record.id || 'manhole'))
      link.download = `${safeName}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })
  }

const parseNumber = (value?: string | number | null, divisor = 1) => {
  if (value === null || value === undefined) return null
  const raw = String(value).trim()
  if (!raw) return null
  const parsed = parseFloat(raw.replace(/[^\d.-]/g, ''))
  if (Number.isNaN(parsed)) return null
  return parsed / divisor
}

const summarizePipes = (pipes?: PipeRecord[] | null, coverLevel?: number | null, limit = 6) => {
  if (!pipes || !pipes.length) return []
  return pipes.slice(0, limit).map((pipe) => {
    const invertDepth = parseNumber(pipe.invert_depth_m)
    const soffitLevel = parseNumber(pipe.soffit_level)
    const diameterMeters = parseNumber(pipe.diameter_mm, 1000)
    const derivedDepth = invertDepth ?? (soffitLevel !== null && diameterMeters !== null ? soffitLevel + diameterMeters : null)

    const displayDepth =
      invertDepth !== null
        ? valueOrDash(pipe.invert_depth_m)
        : derivedDepth !== null
          ? derivedDepth.toFixed(3)
          : '-'

    const computedInvert = (() => {
      if (derivedDepth !== null && coverLevel !== null && coverLevel !== undefined) {
        return (coverLevel - derivedDepth).toFixed(3)
      }
      return '-'
    })()

    return {
      label: pipe.label || '',
      size: formatPipeSize(pipe, pipe.shape),
      shape: pipe.shape || '-',
      material: pipe.material || '-',
      depth: displayDepth,
      invert: computedInvert,
      notes: pipe.notes || '',
    }
  })
}

  async function renderPdfPage(doc: jsPDF, record: DetailedManholeRecord, logo: ImageAsset | null, addPage = false) {
    if (addPage) doc.addPage()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 10
    const innerWidth = pageWidth - margin * 2
    const startX = margin
    doc.setDrawColor(60)
    doc.rect(startX, margin, innerWidth, pageHeight - margin * 2)
    if (logo) {
      const logoWidth = 44
      const logoHeight = logoWidth * (logo.height && logo.width ? logo.height / logo.width : 0.35)
      doc.addImage(logo.dataUrl, logo.format, startX + 4, margin + 4, logoWidth, logoHeight, undefined, 'FAST')
    } else {
      doc.setFontSize(18)
      doc.text('InoRail', startX + 24, margin + 12, { align: 'left' })
    }
      doc.setFontSize(10)
      const jobBoxY = margin + 18
      const jobBoxWidth = innerWidth - 4
      const jobBoxHeight = 28
      const jobBoxX = startX + 2
      doc.rect(jobBoxX, jobBoxY, jobBoxWidth, jobBoxHeight)
      const idBoxWidth = 55
      doc.line(jobBoxX + jobBoxWidth - idBoxWidth, jobBoxY, jobBoxX + jobBoxWidth - idBoxWidth, jobBoxY + jobBoxHeight)
      doc.text('Job No.:', jobBoxX + 3, jobBoxY + 6)
      doc.text(valueOrDash(record.project_number), jobBoxX + 25, jobBoxY + 6)
      doc.text('Project:', jobBoxX + 3, jobBoxY + 12)
      doc.text(valueOrDash(record.project_name), jobBoxX + 25, jobBoxY + 12)
      doc.text('Location:', jobBoxX + 3, jobBoxY + 18)
      doc.text(valueOrDash(record.location_desc), jobBoxX + 25, jobBoxY + 18)
      doc.text('Chainage/Mileage:', jobBoxX + 3, jobBoxY + 24)
      doc.text(valueOrDash(record.chainage_mileage), jobBoxX + 32, jobBoxY + 24)
      doc.text('Reference ID', jobBoxX + jobBoxWidth - idBoxWidth + 3, jobBoxY + 6)
      doc.text(valueOrDash(record.identifier), jobBoxX + jobBoxWidth - idBoxWidth + 3, jobBoxY + 12)

      const sectionY = jobBoxY + jobBoxHeight + 8
      const columnWidth = (jobBoxWidth - 4) / 2
      const drawSection = (
        title: string,
        rows: { label: string; value: string }[],
        x: number,
        y: number,
        forcedHeight?: number,
      ) => {
        const computedHeight = rows.length * 6 + 8
        const height = forcedHeight ?? computedHeight
        doc.rect(x, y, columnWidth, height)
        doc.setFontSize(11)
        doc.text(title, x + columnWidth / 2, y - 1, { align: 'center' })
        doc.setFontSize(9)
        rows.forEach((row, idx) => {
          doc.text(`${row.label} ${row.value}`, x + 3, y + 6 + idx * 6)
        })
        return height
      }
      const drawFullSection = (
        title: string,
        rows: { label: string; value: string }[],
        x: number,
        y: number,
      ) => {
        const height = rows.length * 6 + 8
        doc.rect(x, y, jobBoxWidth, height)
        doc.setFontSize(11)
        doc.text(title, x + jobBoxWidth / 2, y - 1, { align: 'center' })
        doc.setFontSize(9)
        rows.forEach((row, idx) => doc.text(`${row.label} ${row.value}`, x + 3, y + 6 + idx * 6))
        return height
      }
      const generalRows = [
        { label: 'Survey Date:', value: valueOrDash(record.survey_date) },
        { label: 'Tool:', value: valueOrDash(record.measuring_tool) },
        { label: 'Type:', value: valueOrDash(record.type_other || record.type) },
        { label: 'Cover Lifted:', value: formatCoverLifted(record) },
        { label: 'Service Type:', value: valueOrDash(record.service_type) },
      ]
      const coordRows = [
        { label: 'Easting:', value: valueOrDash(record.easting) },
        { label: 'Northing:', value: valueOrDash(record.northing) },
        { label: 'Latitude:', value: valueOrDash(record.latitude) },
        { label: 'Longitude:', value: valueOrDash(record.longitude) },
        { label: 'Cover Level:', value: valueOrDash(record.cover_level) },
      ]
      const generalHeight = drawSection('General Details', generalRows, jobBoxX, sectionY)
      const coordHeight = drawSection('Coordinates', coordRows, jobBoxX + columnWidth + 4, sectionY)
      const normalizedTopHeight = Math.max(generalHeight, coordHeight)
      let currentY = sectionY + normalizedTopHeight + 6

      const coverRows = [
        { label: 'Shape:', value: valueOrDash(record.cover_shape) },
        {
          label: 'Cover Size:',
          value: formatDimensionByShape(
            record.cover_shape,
            record.cover_diameter_mm,
            record.cover_width_mm,
            record.cover_length_mm,
          ),
        },
        { label: 'Material:', value: valueOrDash(record.cover_material || record.cover_material_other) },
        { label: 'Condition:', value: valueOrDash(record.cover_condition) },
      ]
      const chamberRows = [
        { label: 'Shape:', value: valueOrDash(record.chamber_shape) },
        {
          label: 'Dimensions:',
          value: formatDimensionByShape(
            record.chamber_shape,
            record.chamber_diameter_mm,
            record.chamber_width_mm,
            record.chamber_length_mm,
          ),
        },
        { label: 'Material:', value: valueOrDash(record.chamber_material || record.chamber_material_other) },
        { label: 'Condition:', value: valueOrDash(record.chamber_condition) },
      ]
      const coverHeightNeeded = coverRows.length * 6 + 8
      const chamberHeightNeeded = chamberRows.length * 6 + 8
      const normalizedHeight = Math.max(coverHeightNeeded, chamberHeightNeeded)
      drawSection('Cover Details', coverRows, jobBoxX, currentY, normalizedHeight)
      drawSection('Chamber Details', chamberRows, jobBoxX + columnWidth + 4, currentY, normalizedHeight)
      currentY += normalizedHeight + 6

      const shrinkTextToFit = (text: string, maxWidth: number, baseFont = 9, minFont = 6) => {
        let fontSize = baseFont
        doc.setFontSize(fontSize)
        while (doc.getTextWidth(text) > maxWidth && fontSize > minFont) {
          fontSize -= 0.5
          doc.setFontSize(fontSize)
        }
        return fontSize
      }

      const drawPipeTable = (title: string, entries: PipeRow[], y: number, rows = 6) => {
        const cols = [
          { label: 'Label', width: 12 },
          { label: 'Size', width: 25 },
          { label: 'Shape', width: 22 },
          { label: 'Material', width: 28 },
          { label: 'Depth', width: 24 },
          { label: 'Invert', width: 24 },
          { label: 'Notes', width: 45 },
        ]
        doc.setFontSize(11)
        doc.text(title, jobBoxX + jobBoxWidth / 2, y - 2, { align: 'center' })
        const headerHeight = 7
        doc.setFontSize(9)
        let cursorX = jobBoxX
        cols.forEach((col) => {
          doc.rect(cursorX, y, col.width, headerHeight)
          doc.text(col.label, cursorX + 2, y + 5)
          cursorX += col.width
        })
        let rowY = y + headerHeight
        for (let i = 0; i < rows; i++) {
          const row = entries[i]
          cursorX = jobBoxX
          cols.forEach((col, idx) => {
            doc.rect(cursorX, rowY, col.width, headerHeight)
            if (row) {
              const text =
                idx === 0 ? row.label || '' :
                idx === 1 ? row.size :
                idx === 2 ? row.shape :
                idx === 3 ? row.material :
                idx === 4 ? row.depth :
                idx === 5 ? row.invert :
                row.notes
              if (idx === 6) {
                const safeText = text || '-'
                const fontSize = shrinkTextToFit(safeText, col.width - 4)
                doc.setFontSize(fontSize)
                doc.text(safeText, cursorX + 2, rowY + 5, { maxWidth: col.width - 4 })
                doc.setFontSize(9)
              } else {
                doc.text(text || '-', cursorX + 2, rowY + 5)
              }
            }
            cursorX += col.width
          })
          rowY += headerHeight
        }
        return rowY
      }
      const incomingEntries = summarizePipes(record.incoming_pipes, record.cover_level as number | null, 6)
      const outgoingEntries = summarizePipes(record.outgoing_pipes, record.cover_level as number | null, 2)
      const allPipeEntries = [...incomingEntries, ...outgoingEntries]
      const hasNumericLabels = allPipeEntries.some((entry) => /^\s*Pipe\s*\d+/i.test(entry.label || ''))
      if (hasNumericLabels) {
        currentY = drawPipeTable('Pipe Information', allPipeEntries, currentY + 4, Math.max(allPipeEntries.length, 1)) + 6
      } else {
        currentY = drawPipeTable('Incoming Pipes', incomingEntries, currentY + 4, Math.max(incomingEntries.length, 1)) + 6
        currentY = drawPipeTable('Outgoing Pipes', outgoingEntries, currentY, Math.max(outgoingEntries.length, 1)) + 6
      }

      const bottomHeight = 60
      const boxWidth = (jobBoxWidth - 8) / 3
      const boxY = Math.min(currentY, pageHeight - bottomHeight - margin - 5)
      const boxes: Array<{ label: string; dataUrl: string | null; url?: string | null; width?: number; height?: number }> = [
        { label: 'Chamber Sketch', dataUrl: renderSketchToDataUrl(record.sketch_json), width: 320, height: 320 },
        { label: 'Internal Photo', dataUrl: null, url: record.internal_photo_url },
        { label: 'External Photo', dataUrl: null, url: record.external_photo_url },
      ]
      const measuredArrowLabel = record.sketch_json?.measuredTo === 'hm' ? 'HM' : 'N'
      for (let i = 0; i < boxes.length; i++) {
        const x = jobBoxX + i * (boxWidth + 4)
        doc.rect(x, boxY, boxWidth, bottomHeight)
        doc.setFontSize(10)
        doc.text(boxes[i].label, x + 2, boxY + 6)
        const targetHeight = bottomHeight - 12
        const targetWidth = boxWidth - 4
        let dataUrl = boxes[i].dataUrl
        let format: 'PNG' | 'JPEG' = 'PNG'
        let imgWidth = boxes[i].width ?? 0
        let imgHeight = boxes[i].height ?? 0
        if (!dataUrl && boxes[i].url) {
          const fetched = await fetchImageData(boxes[i].url)
          if (fetched) {
            dataUrl = fetched.dataUrl
            format = fetched.format
            imgWidth = fetched.width
            imgHeight = fetched.height
          }
        }
        if (dataUrl) {
          try {
            const aspect = imgWidth > 0 && imgHeight > 0 ? imgWidth / imgHeight : targetWidth / targetHeight
            let drawWidth = targetWidth
            let drawHeight = drawWidth / aspect
            if (drawHeight > targetHeight) {
              drawHeight = targetHeight
              drawWidth = drawHeight * aspect
            }
            const offsetX = x + 2 + (targetWidth - drawWidth) / 2
            const offsetY = boxY + 8 + (targetHeight - drawHeight) / 2
            doc.addImage(dataUrl, format, offsetX, offsetY, drawWidth, drawHeight, undefined, 'FAST')
            if (boxes[i].label === 'Chamber Sketch') {
              // North arrow (bottom-right, smaller)
              const arrowBaseY = boxY + bottomHeight - 4
              const arrowX = x + boxWidth - 6
              doc.setFillColor(225, 17, 17)
              doc.triangle(arrowX, arrowBaseY - 4, arrowX + 2.5, arrowBaseY, arrowX - 2.5, arrowBaseY, 'F')
              doc.setTextColor(17, 24, 39)
              doc.setFontSize(6)
              doc.text(measuredArrowLabel, arrowX, arrowBaseY + 1.6, { align: 'center' })
              doc.setTextColor(0, 0, 0)
            }
          } catch {
            doc.text('Image unavailable', x + 2, boxY + 12)
          }
        } else {
          doc.text('No data', x + 2, boxY + 12)
        }
      }

    return doc
  }

  async function createPdfDoc(record: DetailedManholeRecord, logo: ImageAsset | null) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    await renderPdfPage(doc, record, logo, false)
    return doc
  }

  async function downloadPdfFiles(records: DetailedManholeRecord[]) {
    if (!records.length) return
    const logo = await getLogoAsset()
    const [first, ...rest] = records
    const doc = await createPdfDoc(first, logo || null)
    for (const record of rest) {
      await renderPdfPage(doc, record, logo || null, true)
    }
    const base = first
    const segments = [
      base.project_number || 'Project',
      base.project_client || 'Client',
      base.project_name || 'Chambers',
    ].map((segment, idx) => {
      const fallback = idx === 0 ? 'Project' : idx === 1 ? 'Client' : 'Chambers'
      return safeFileSegment(String(segment || fallback))
    })
    doc.save(`${segments.join(' - ')}.pdf`)
  }

  async function handleExportSelected() {
    if (exportSelected.length === 0 || exportBusy) return
    setExportBusy(true)
    try {
      const records = await fetchDetailedChambers(exportSelected)
      if (!records.length) throw new Error('No data found for the selected Chambers.')
      if (exportFormat === 'csv') {
        downloadCsvFile(records)
      } else if (exportFormat === 'jpeg') {
        downloadJpegFiles(records)
      } else {
        // PDF: download a single file; when multiple chambers are selected we combine them
        // into one multi-page PDF so the user has one download instead of many tabs.
        await downloadPdfFiles(records)
        setMessage(`Downloaded ${records.length} PDF${records.length > 1 ? 's (combined into one file)' : ''}.`)
        setExportOpen(false)
      }
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err)
      setMessage('Export failed: ' + messageText)
    } finally {
      setExportBusy(false)
    }
  }

  useEffect(() => {
    return () => {
      if (previewPdf?.startsWith('blob:')) {
        try { URL.revokeObjectURL(previewPdf) } catch {}
      }
    }
  }, [previewPdf])

  function closePreview() {
    setPreviewPdf((prev) => {
      if (prev?.startsWith('blob:')) {
        try { URL.revokeObjectURL(prev) } catch {}
      }
      return null
    })
    setPreviewTitle('')
  }

  async function previewManhole(id: string, identifier?: string | null) {
    // Open the live export page inside an in-app modal (iframe) instead of a new tab/popup
    const slug = encodeURIComponent(identifier || id)
    const url = `/chambers/${slug}/export?embed=1`
    setPreviewTitle(identifier || 'Chamber Preview')
    setPreviewPdf(url)
  }

  const SortButton = ({ label, keyName }: { label: string; keyName: SortKey }) => (
    <button onClick={() => toggleSort(keyName)} className="font-medium hover:underline inline-flex items-center">
      {label}
      <span className="ml-2 text-xs">{sortKey === keyName ? (sortDir === 'asc' ? '^' : 'v') : ''}</span>
    </button>
  )

  async function deleteManhole(id: string) {
    if (!canDeleteManhole) return
    const proceed =
      typeof window !== 'undefined' ? window.confirm('Move this chamber to the recycle bin?') : true
    if (!proceed) return
    setMessage('')
    setDeletingId(id)
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id ?? null
    const deletedAt = new Date().toISOString()
    const { error } = await supabase
      .from('chambers')
      .update({ deleted_at: deletedAt, deleted_by: userId })
      .eq('id', id)
      .is('deleted_at', null)
    setDeletingId(null)
    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setChambers((list) => list.filter((m) => m.id !== id))
      setMessage('Chamber moved to recycle bin.')
    }
  }

  if (!hydrated) {
    return (
      <div className="p-8 text-sm text-gray-500">
        Loading Chambers...
      </div>
    )
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold">Chambers</h1>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
          <div className="relative flex-1 min-w-[160px] md:min-w-[220px]">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M10 3.75a6.25 6.25 0 1 1 0 12.5 6.25 6.25 0 0 1 0-12.5Zm8.53 13.72-2.91-2.91a7.75 7.75 0 1 0-1.06 1.06l2.91 2.91a.75.75 0 1 0 1.06-1.06Z"/></svg>
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Chambers..."
              className="w-full min-w-0 pl-7 pr-3 py-2 rounded-lg border border-gray-300 bg-transparent placeholder-gray-400"
            />
          </div>
          <button
            onClick={() => setShowFilter((v) => !v)}
            className="flex-shrink-0 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            <span className="inline-flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3.75 5.5a.75.75 0 0 1 .75-.75h15a.75.75 0 0 1 .55 1.25l-5.3 5.96v4.29a.75.75 0 0 1-1.06.69l-3-1.2a.75.75 0 0 1-.47-.69v-3.09L3.2 6a.75.75 0 0 1 .55-1.25Z"/></svg>
              Filter
            </span>
          </button>
          {canExportChambers && (
            <button
              onClick={handleExportOpen}
              className="flex-shrink-0 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              <span className="inline-flex items-center gap-2">Export</span>
            </button>
          )}
          {canCreateManhole && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex-shrink-0 px-3 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700"
            >
              <span className="inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 4.75a.75.75 0 0 1 .75.75v5.75H18.5a.75.75 0 0 1 0 1.5h-5.75V18.5a.75.75 0 0 1-1.5 0v-5.75H5.5a.75.75 0 0 1 0-1.5h5.75V5.5a.75.75 0 0 1 .75-.75Z"/></svg>
                New Chamber
              </span>
            </button>
          )}
        </div>
      </div>

      {showFilter && (
        <div className="mb-4 p-3 border rounded-lg bg-white dark:bg-neutral-900 text-sm text-gray-600 dark:text-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Project No.</label>
              <select
                className="w-full border rounded px-2 py-1 bg-white dark:bg-neutral-800"
                value={filterProjectNo}
                onChange={(e) => setFilterProjectNo(e.target.value)}
              >
                <option value="">All numbers</option>
                {[...new Set(projects.map(p => p.project_number || '').filter(Boolean))]
                  .sort((a,b)=>a.localeCompare(b))
                  .map(n => (<option key={n} value={n}>{n}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Client</label>
              <select
                className="w-full border rounded px-2 py-1 bg-white dark:bg-neutral-800"
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
              >
                <option value="">All clients</option>
                {[...new Set(projects.map(p => p.client || '').filter(Boolean))]
                  .sort((a,b)=>a.localeCompare(b))
                  .map(c => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Project Name</label>
              <select
                className="w-full border rounded px-2 py-1 bg-white dark:bg-neutral-800"
                value={filterProjectName}
                onChange={(e) => setFilterProjectName(e.target.value)}
              >
                <option value="">All names</option>
                {[...new Set(projects.map(p => p.name || '').filter(Boolean))]
                  .sort((a,b)=>a.localeCompare(b))
                  .map(n => (<option key={n} value={n}>{n}</option>))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => { setFilterProjectNo(''); setFilterClient(''); setFilterProjectName(''); setQuery('') }}
              className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              onClick={() => setShowFilter(false)}
              className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
            {previewPdf && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-0 sm:p-6">
          <div className="relative bg-white dark:bg-neutral-900 w-screen h-screen sm:w-[90vw] sm:h-[85vh] rounded-none sm:rounded-lg shadow-lg">
            <button
              aria-label="Close preview"
              className="absolute top-2 right-2 px-2 py-1 rounded bg-neutral-800 text-white hover:bg-neutral-700"
              onClick={closePreview}
            >
              �
            </button>
            <div className="absolute top-2 left-4 text-sm font-semibold text-gray-200">{previewTitle}</div>
            <iframe src={previewPdf} className="w-full h-full border-0" title="Chamber Preview" />
          </div>
        </div>
      )}
      {previewPdf && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-0 sm:p-6">
          <div className="relative bg-white dark:bg-neutral-900 w-screen h-screen sm:w-[90vw] sm:h-[85vh] rounded-none sm:rounded-lg shadow-lg">
            <button
              aria-label="Close preview"
              className="absolute top-2 right-2 px-2 py-1 rounded bg-neutral-800 text-white hover:bg-neutral-700"
              onClick={closePreview}
            >
              ×
            </button>
            <div className="absolute top-2 left-4 text-sm font-semibold text-gray-200">{previewTitle}</div>
            <iframe src={previewPdf} className="w-full h-full border-0" title="Chamber Preview" />
          </div>
        </div>
      )}
{exportOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2" onClick={() => setExportOpen(false)}>
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
              <h3 className="text-lg font-semibold">Export Chambers</h3>
              <button className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50" onClick={() => setExportOpen(false)}>Close</button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Project</label>
                  <select className="w-full border rounded p-2 bg-white dark:bg-neutral-800" value={exportProject} onChange={(e) => setExportProject(e.target.value)}>
                    <option value="">All projects</option>
                    {exportProjectOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <label className="mt-2 inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={exportSelectAll}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setExportSelectAll(checked)
                        if (checked) setExportSelected(exportCandidates.map((row) => row.id))
                      }}
                    />
                    Select all Chambers in this list
                  </label>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Search</label>
                  <input
                    type="text"
                    value={exportSearch}
                    onChange={(e) => setExportSearch(e.target.value)}
                    placeholder="Search Chambers..."
                    className="w-full border rounded p-2 bg-white dark:bg-neutral-800"
                  />
                </div>
              </div>

              {!exportSelectAll && (
                <div className="border rounded p-3 max-h-64 overflow-y-auto bg-white dark:bg-neutral-800">
                  {exportCandidates.length === 0 ? (
                    <p className="text-sm text-gray-500">No Chambers found for the selected project.</p>
                  ) : (
                    exportCandidates.map((row) => (
                      <label key={row.id} className="flex items-center gap-2 py-1 text-sm">
                        <input
                          type="checkbox"
                          checked={exportSelected.includes(row.id)}
                          onChange={() => toggleExportSelection(row.id)}
                        />
                        <span>{row.identifier || 'Unnamed'} ({row.project_number || 'No Project'})</span>
                      </label>
                    ))
                  )}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Export format</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  {[
                    { value: 'pdf', label: 'PDF (print sheet)' },
                    { value: 'csv', label: 'CSV (spreadsheet)' },
                    { value: 'jpeg', label: 'Image (JPEG)' },
                  ].map((option) => (
                    <label key={option.value} className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="export-format"
                        value={option.value}
                        checked={exportFormat === option.value}
                        onChange={() => setExportFormat(option.value as 'pdf' | 'csv' | 'jpeg')}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  CSV downloads a single file. JPEG creates individual summary cards. PDF opens the detailed sheet in new tabs.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                  onClick={() => {
                    setExportSelected([])
                    setExportOpen(false)
                  }}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={exportSelected.length === 0 || exportBusy}
                  onClick={handleExportSelected}
                >
                  {exportBusy ? 'Preparing…' : `Export Selected (${exportSelected.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {message && <p className="mb-4 text-red-600">{message}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-600">No Chambers yet. Add your first one.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2 border-b"><SortButton label="Projects" keyName="project_number" /></th>
                <th className="px-4 py-2 border-b"><SortButton label="Project Name" keyName="project_name" /></th>
                <th className="px-4 py-2 border-b"><SortButton label="Reference Number" keyName="identifier" /></th>
                <th className="px-4 py-2 border-b w-px">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border-b">{r.project_number || '-'}</td>
                  <td className="px-4 py-2 border-b">{r.project_name || '-'}</td>
                  <td className="px-4 py-2 border-b font-medium">{r.identifier || '-'}</td>
                  <td className="px-4 py-2 border-b text-right">
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn title="Preview chamber sheet" onClick={() => previewManhole(r.id, r.identifier)}>
                        {previewLoadingId === r.id ? (
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" stroke="#999" strokeWidth="4" fill="none" strokeDasharray="60" strokeDashoffset="20" />
                          </svg>
                        ) : (
                          <EyeIcon />
                        )}
                      </IconBtn>
                      {canEditManhole && (
                        <IconBtn title="Edit manhole" onClick={() => { setEditId(r.id); setEditOpen(true) }}><PencilIcon /></IconBtn>
                      )}
                      {canDeleteManhole && (
                        <IconBtn title="Delete manhole" onClick={() => deleteManhole(r.id)}>
                          {deletingId === r.id ? (
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" stroke="#999" strokeWidth="4" fill="none" strokeDasharray="60" strokeDashoffset="20" />
                            </svg>
                          ) : (
                            <TrashIcon />
                          )}
                        </IconBtn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editOpen && editId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2" onClick={() => setEditOpen(false)}>
          <div className="bg-white theme-dark:bg-[#0b0b0b] border border-gray-200 theme-dark:border-gray-700 rounded-lg shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 theme-dark:border-gray-700">
              <h3 className="text-lg font-semibold">Edit Chamber</h3>
              <button type="button" onClick={() => setEditOpen(false)} className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">Close</button>
            </div>
            <div className="p-0 overflow-hidden">
              <iframe
                title="Edit Chamber"
                src={`/chambers/${editId}/edit?embed=1`}
                loading="lazy"
                className="w-full"
                style={{ height: '80vh', border: 'none', background: 'transparent' }}
              />
            </div>
          </div>
        </div>
      )}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2" onClick={() => setCreateOpen(false)}>
          <div className="bg-white theme-dark:bg-[#0b0b0b] border border-gray-200 theme-dark:border-gray-700 rounded-lg shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 theme-dark:border-gray-700">
              <h3 className="text-lg font-semibold">New Chamber</h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">Close</button>
            </div>
            <div className="p-0 overflow-hidden">
              <iframe title="Add Chamber" src={`/chambers/add?embed=1`} loading="lazy" className="w-full" style={{ height: '80vh', border: 'none', background: 'transparent' }} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}







