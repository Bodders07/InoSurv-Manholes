'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabaseClient'
import { usePermissions } from '@/app/components/PermissionsContext'

const LeafletMap = dynamic(() => import('../maps/LeafletMap'), {
  ssr: false,
  loading: () => <div className="h-64 w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 animate-pulse" />,
})

type ManholePoint = {
  id: string
  identifier: string | null
  latitude: number | null
  longitude: number | null
  cover_shape: string | null
  project_id: string | null
}

type ProjectOption = {
  id: string
  name: string | null
  project_number: string | null
}

const LABEL_COLORS = [
  { name: 'Amber', value: 'rgba(140,72,0,0.95)' },
  { name: 'Slate', value: 'rgba(47, 65, 86, 0.95)' },
  { name: 'Forest', value: 'rgba(21, 83, 64, 0.95)' },
  { name: 'Charcoal', value: 'rgba(10,10,10,0.9)' },
  { name: 'Sunset', value: 'rgba(217, 119, 6, 0.95)' },
  { name: 'Ocean', value: 'rgba(14, 116, 144, 0.95)' },
  { name: 'Rose', value: 'rgba(190, 24, 93, 0.95)' },
  { name: 'Plum', value: 'rgba(107, 33, 168, 0.95)' },
  { name: 'Arctic', value: 'rgba(15, 76, 117, 0.95)' },
  { name: 'Moss', value: 'rgba(63, 98, 18, 0.95)' },
]

const ICON_COLORS = [
  { name: 'Orange', value: '#a74c07' },
  { name: 'Blue', value: '#1d4ed8' },
  { name: 'Green', value: '#15803d' },
  { name: 'Purple', value: '#6d28d9' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Teal', value: '#0f766e' },
  { name: 'Gold', value: '#d97706' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Gray', value: '#4b5563' },
  { name: 'Indigo', value: '#4338ca' },
]

export default function MapViewPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [points, setPoints] = useState<ManholePoint[]>([])
  const [activeTab, setActiveTab] = useState<'label' | 'icon'>('label')
  const [labelColor, setLabelColor] = useState('rgba(140,72,0,0.95)')
  const [iconColor, setIconColor] = useState('#a74c07')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [editUrl, setEditUrl] = useState<string | null>(null)
  const [projectFilterOpen, setProjectFilterOpen] = useState(false)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [exportOpen, setExportOpen] = useState(false)
  const [exportMode, setExportMode] = useState<'project' | 'manual'>('project')
  const [exportProjectIds, setExportProjectIds] = useState<string[]>([])
  const [exportSelectedIds, setExportSelectedIds] = useState<string[]>([])
  const [exportFormat, setExportFormat] = useState<'kml' | 'kmz'>('kml')
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const { has } = usePermissions()

  const canPreview = has('map-preview')
  const canEdit = has('map-edit')

  const fetchPoints = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('chambers')
      .select('id, identifier, latitude, longitude, cover_shape, project_id')

    if (error) {
      setError(error.message)
      setPoints([])
    } else {
      setPoints((data as ManholePoint[]) || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPoints()
  }, [fetchPoints])

  useEffect(() => {
    async function loadProjects() {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, project_number')
        .order('name', { ascending: true, nullsFirst: false })
      if (!error) {
        setProjects((data as ProjectOption[]) || [])
      }
    }
    loadProjects()
  }, [])

  const mappedPoints = useMemo(() => {
    return points
      .map((point) => {
        const rawLat = point.latitude
        const rawLng = point.longitude
        if (rawLat === null || rawLng === null) return null
        const latString = typeof rawLat === 'string' ? rawLat : String(rawLat)
        const lngString = typeof rawLng === 'string' ? rawLng : String(rawLng)
        if (latString.trim() === '' || lngString.trim() === '') return null
        const lat = Number(latString)
        const lng = Number(lngString)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        return {
          id: point.id,
          name: point.identifier || point.id,
          lat,
          lng,
          shape: (point.cover_shape || '').toLowerCase(),
          projectId: point.project_id,
        }
      })
      .filter(Boolean) as { id: string; name: string; lat: number; lng: number; shape: string; projectId: string | null }[]
  }, [points])

  const filteredPoints = useMemo(() => {
    if (!selectedProjectIds.length) return mappedPoints
    const selectedSet = new Set(selectedProjectIds)
    return mappedPoints.filter((point) => (point.projectId ? selectedSet.has(point.projectId) : false))
  }, [mappedPoints, selectedProjectIds])

  const hasAnyPoints = mappedPoints.length > 0

  const projectLookup = useMemo(() => {
    const map = new Map<string, ProjectOption>()
    projects.forEach((project) => map.set(project.id, project))
    return map
  }, [projects])

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjectIds((prev) => {
      if (prev.includes(projectId)) {
        return prev.filter((id) => id !== projectId)
      }
      return [...prev, projectId]
    })
  }

  const clearProjectFilter = () => setSelectedProjectIds([])

  const formatProjectLabel = (project: ProjectOption) => {
    if (project.name) return project.name
    if (project.project_number) return `Project ${project.project_number}`
    return 'Untitled project'
  }

  useEffect(() => {
    function handleMessage(ev: MessageEvent) {
      if (!ev.data || typeof ev.data !== 'object') return
      if ((ev.data as { type?: string }).type === 'close-edit-modal') {
        setEditUrl(null)
        if ((ev.data as { refresh?: boolean }).refresh) {
          fetchPoints()
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [fetchPoints])

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-500">Loading map data…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        Failed to load map data: {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold">Map View</h2>
        <p className="text-sm text-gray-600">
          Showing {filteredPoints.length} chamber{filteredPoints.length === 1 ? '' : 's'} with coordinates
          {selectedProjectIds.length ? ` in ${selectedProjectIds.length} project${selectedProjectIds.length === 1 ? '' : 's'}` : ''}.
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        {!filteredPoints.length && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-600">
            {hasAnyPoints
              ? 'No chambers match the selected project filters. Adjust or clear the filter to see more locations.'
              : 'No chambers with latitude/longitude have been recorded yet.'}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setProjectFilterOpen((prev) => !prev)}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {projectFilterOpen ? 'Hide Filters' : 'Filter Projects'}
          </button>
          {selectedProjectIds.length > 0 && (
            <span className="text-sm text-gray-600">
              {selectedProjectIds.length} project{selectedProjectIds.length === 1 ? '' : 's'} selected
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setExportMode('project')
              setExportProjectIds(selectedProjectIds)
              setExportSelectedIds(filteredPoints.map((point) => point.id))
              setExportFormat('kml')
              setExportError(null)
              setExportOpen(true)
            }}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Export KML / KMZ
          </button>
        </div>
        {projectFilterOpen && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Projects</p>
              <button type="button" className="text-sm text-blue-600 hover:underline" onClick={clearProjectFilter}>
                Clear selection
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-gray-200 bg-white rounded border border-gray-200">
              {projects.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">No projects available.</div>
              ) : (
                projects.map((project) => (
                  <label key={project.id} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedProjectIds.includes(project.id)}
                      onChange={() => toggleProjectSelection(project.id)}
                    />
                    <span>{formatProjectLabel(project)}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}
        <div>
          <div className="flex gap-2 mb-3">
            {(['label', 'icon'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                  activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {tab === 'label' ? 'Label' : 'Icon'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(activeTab === 'label' ? LABEL_COLORS : ICON_COLORS).map((option) => {
              const selected = activeTab === 'label' ? labelColor === option.value : iconColor === option.value
              return (
                <button
                  key={option.name}
                  onClick={() => (activeTab === 'label' ? setLabelColor(option.value) : setIconColor(option.value))}
                  className={`flex items-center gap-2 rounded border px-3 py-1 text-sm ${
                    selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-400'
                  }`}
                >
                  <span
                    className="inline-block h-4 w-4 rounded-full border border-gray-300"
                    style={{ backgroundColor: option.value }}
                  />
                  {option.name}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <LeafletMap
        points={filteredPoints}
        iconColor={iconColor}
        labelColor={labelColor}
        canPreview={canPreview}
        canEdit={canEdit}
        onPreview={canPreview ? (id) => setPreviewUrl(`/manholes/${id}/export?embed=1`) : undefined}
        onEdit={canEdit ? (id) => setEditUrl(`/manholes/${id}/edit?embed=1`) : undefined}
      />

      {previewUrl && (
        <div className="fixed inset-0 z-[1000] bg-black/60 p-4 flex items-center justify-center" onClick={() => setPreviewUrl(null)}>
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <h3 className="font-semibold">Preview Manhole</h3>
              <button className="text-sm text-gray-500 hover:text-gray-800" onClick={() => setPreviewUrl(null)}>Close</button>
            </div>
            <div className="h-[75vh]">
              <iframe title="Preview Manhole" src={previewUrl} className="w-full h-full border-0" />
            </div>
          </div>
        </div>
      )}

      {editUrl && (
        <div className="fixed inset-0 z-[1000] bg-black/60 p-4 flex items-center justify-center" onClick={() => setEditUrl(null)}>
          <div className="w-full max-w-5xl bg-white rounded-xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <h3 className="font-semibold">Edit Chamber</h3>
              <button className="text-sm text-gray-500 hover:text-gray-800" onClick={() => setEditUrl(null)}>Close</button>
            </div>
            <div className="h-[80vh]">
              <iframe title="Edit Chamber" src={editUrl} className="w-full h-full border-0" />
            </div>
          </div>
        </div>
      )}

      {exportOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-3" onClick={() => setExportOpen(false)}>
          <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-lg font-semibold">Export Chambers</h3>
              <button className="text-sm text-gray-500 hover:text-gray-800" onClick={() => setExportOpen(false)}>
                Close
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Choose what to export</p>
                <div className="inline-flex rounded-full border border-gray-200 bg-gray-50">
                  {(['project', 'manual'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setExportMode(mode)
                        setExportError(null)
                      }}
                      className={`px-3 py-1.5 text-sm font-medium rounded-full ${
                        exportMode === mode ? 'bg-blue-600 text-white' : 'text-gray-600'
                      }`}
                    >
                      {mode === 'project' ? 'By Project' : 'Individual Chambers'}
                    </button>
                  ))}
                </div>
              </div>

              {exportMode === 'project' ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">Projects</p>
                    <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => setExportProjectIds([])}>
                      Clear selection
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-200 rounded border border-gray-200">
                    {projects.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">No projects available.</div>
                    ) : (
                      projects.map((project) => (
                        <label key={project.id} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={exportProjectIds.includes(project.id)}
                            onChange={() =>
                              setExportProjectIds((prev) =>
                                prev.includes(project.id) ? prev.filter((id) => id !== project.id) : [...prev, project.id]
                              )
                            }
                          />
                          <span>{formatProjectLabel(project)}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">If no projects are selected, the current map selection will be used.</p>
                </div>
              ) : (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">Chambers</p>
                    <button
                      type="button"
                      className="text-sm text-blue-600 hover:underline"
                      onClick={() => setExportSelectedIds(filteredPoints.map((point) => point.id))}
                    >
                      Select all shown
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-200 rounded border border-gray-200">
                    {filteredPoints.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">No chambers available with the current filters.</div>
                    ) : (
                      filteredPoints.map((point) => (
                        <label key={point.id} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={exportSelectedIds.includes(point.id)}
                            onChange={() =>
                              setExportSelectedIds((prev) =>
                                prev.includes(point.id) ? prev.filter((id) => id !== point.id) : [...prev, point.id]
                              )
                            }
                          />
                          <span>
                            {point.name}{' '}
                            <span className="text-gray-500">
                              ({point.lat.toFixed(5)}, {point.lng.toFixed(5)})
                            </span>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Format</p>
                <div className="flex items-center gap-4 text-sm">
                  {(['kml', 'kmz'] as const).map((fmt) => (
                    <label key={fmt} className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="map-export-format"
                        value={fmt}
                        checked={exportFormat === fmt}
                        onChange={() => setExportFormat(fmt)}
                      />
                      {fmt.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>

              {exportError && <p className="text-sm text-red-600">{exportError}</p>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-sm"
                  onClick={() => setExportOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={exportBusy}
                  className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
                  onClick={async () => {
                    setExportError(null)
                    const targetPoints =
                      exportMode === 'project'
                        ? getPointsByProjects(mappedPoints, exportProjectIds.length ? exportProjectIds : selectedProjectIds, filteredPoints)
                        : getPointsByIds(mappedPoints, exportSelectedIds.length ? exportSelectedIds : filteredPoints.map((point) => point.id))

                    if (!targetPoints.length) {
                      setExportError('No chambers selected for export.')
                      return
                    }

                    setExportBusy(true)
                    try {
                      const kml = buildKmlDocument(targetPoints, projectLookup)
                      const baseName = buildFileBase(targetPoints, projectLookup)
                      if (exportFormat === 'kml') {
                        const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' })
                        triggerDownload(blob, `${baseName}.kml`)
                      } else {
                        const blob = createKmzBlob(kml)
                        triggerDownload(blob, `${baseName}.kmz`)
                      }
                      setExportOpen(false)
                    } catch (err) {
                      const messageText = err instanceof Error ? err.message : String(err)
                      setExportError(messageText)
                    } finally {
                      setExportBusy(false)
                    }
                  }}
                >
                  {exportBusy ? 'Preparing…' : 'Download'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type ExportPoint = { id: string; name: string; lat: number; lng: number; shape: string; projectId: string | null }

function getPointsByProjects(allPoints: ExportPoint[], projectIds: string[], fallback: ExportPoint[]) {
  if (!projectIds.length) return fallback
  const set = new Set(projectIds)
  return allPoints.filter((point) => point.projectId && set.has(point.projectId))
}

function getPointsByIds(allPoints: ExportPoint[], ids: string[]) {
  if (!ids.length) return []
  const set = new Set(ids)
  return allPoints.filter((point) => set.has(point.id))
}

function escapeXml(input: string) {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function buildKmlDocument(points: ExportPoint[], projects: Map<string, ProjectOption>) {
  const placemarks = points
    .map((point) => {
      const project = point.projectId ? projects.get(point.projectId) : null
      const projectName = project?.name || project?.project_number || 'Project'
      return `
        <Placemark>
          <name>${escapeXml(point.name)}</name>
          <description>Project: ${escapeXml(projectName || 'Project')}</description>
          <Point><coordinates>${point.lng},${point.lat},0</coordinates></Point>
        </Placemark>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Chamber Export</name>
    ${placemarks}
  </Document>
</kml>`
}

function buildFileBase(points: ExportPoint[], projects: Map<string, ProjectOption>) {
  if (!points.length) return 'chambers'
  const first = points[0]
  const project = first.projectId ? projects.get(first.projectId) : null
  const raw = project?.project_number || project?.name || (points.length === 1 ? first.name : `chambers-${points.length}`)
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array) {
  let crc = 0 ^ -1
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ -1) >>> 0
}

function getDosDateTime(date = new Date()) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = Math.floor(date.getSeconds() / 2)
  const dosDate = ((year - 1980) << 9) | (month << 5) | day
  const dosTime = (hours << 11) | (minutes << 5) | seconds
  return { dosDate, dosTime }
}

function createKmzBlob(kml: string) {
  const encoder = new TextEncoder()
  const kmlBytes = encoder.encode(kml)
  const nameBytes = encoder.encode('doc.kml')
  const { dosDate, dosTime } = getDosDateTime()
  const crc = crc32(kmlBytes)

  const localHeaderSize = 30 + nameBytes.length
  const centralHeaderSize = 46 + nameBytes.length
  const endSize = 22
  const total = localHeaderSize + kmlBytes.length + centralHeaderSize + endSize

  const buffer = new ArrayBuffer(total)
  const view = new DataView(buffer)
  let offset = 0

  view.setUint32(offset, 0x04034b50, true)
  offset += 4
  view.setUint16(offset, 20, true)
  offset += 2
  view.setUint16(offset, 0, true)
  offset += 2
  view.setUint16(offset, 0, true)
  offset += 2
  view.setUint16(offset, dosTime, true)
  offset += 2
  view.setUint16(offset, dosDate, true)
  offset += 2
  view.setUint32(offset, crc, true)
  offset += 4
  view.setUint32(offset, kmlBytes.length, true)
  offset += 4
  view.setUint32(offset, kmlBytes.length, true)
  offset += 4
  view.setUint16(offset, nameBytes.length, true)
  offset += 2
  view.setUint16(offset, 0, true)
  offset += 2
  new Uint8Array(buffer, offset, nameBytes.length).set(nameBytes)
  offset += nameBytes.length
  new Uint8Array(buffer, offset, kmlBytes.length).set(kmlBytes)
  offset += kmlBytes.length

  const centralStart = offset

  view.setUint32(offset, 0x02014b50, true)
  offset += 4
  view.setUint16(offset, 0x0014, true)
  offset += 2
  view.setUint16(offset, 20, true)
  offset += 2
  view.setUint16(offset, 0, true)
  offset += 2
  view.setUint16(offset, 0, true)
  offset += 2
  view.setUint16(offset, dosTime, true)
  offset += 2
  view.setUint16(offset, dosDate, true)
  offset += 2
  view.setUint32(offset, crc, true)
  offset += 4
  view.setUint32(offset, kmlBytes.length, true)
  offset += 4
  view.setUint32(offset, kmlBytes.length, true)
  offset += 4
  view.setUint16(offset, nameBytes.length, true)
  offset += 2
  view.setUint16(offset, 0, true)
  offset += 2
  view.setUint16(offset, 0, true)
  offset += 2
  view.setUint16(offset, 0, true)
  offset += 2
  view.setUint16(offset, 0, true)
  offset += 2
  view.setUint32(offset, 0, true)
  offset += 4
  view.setUint32(offset, 0, true)
  offset += 4
  new Uint8Array(buffer, offset, nameBytes.length).set(nameBytes)
  offset += nameBytes.length

  const centralSize = offset - centralStart

  view.setUint32(offset, 0x06054b50, true)
  offset += 4
  view.setUint16(offset, 0, true)
  offset += 2
  view.setUint16(offset, 0, true)
  offset += 2
  view.setUint16(offset, 1, true)
  offset += 2
  view.setUint16(offset, 1, true)
  offset += 2
  view.setUint32(offset, centralSize, true)
  offset += 4
  view.setUint32(offset, centralStart, true)
  offset += 4
  view.setUint16(offset, 0, true)

  return new Blob([buffer], { type: 'application/vnd.google-earth.kmz' })
}

