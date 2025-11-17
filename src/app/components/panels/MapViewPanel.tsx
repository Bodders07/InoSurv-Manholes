'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabaseClient'

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
}

const LABEL_COLORS = [
  { name: 'Amber', value: 'rgba(140,72,0,0.95)' },
  { name: 'Slate', value: 'rgba(47, 65, 86, 0.95)' },
  { name: 'Forest', value: 'rgba(21, 83, 64, 0.95)' },
  { name: 'Charcoal', value: 'rgba(10,10,10,0.9)' },
]

const ICON_COLORS = [
  { name: 'Orange', value: '#a74c07' },
  { name: 'Blue', value: '#1d4ed8' },
  { name: 'Green', value: '#15803d' },
  { name: 'Purple', value: '#6d28d9' },
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

  const fetchPoints = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('manholes')
      .select('id, identifier, latitude, longitude, cover_shape')

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
        }
      })
      .filter(Boolean) as { id: string; name: string; lat: number; lng: number; shape: string }[]
  }, [points])

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

  if (!mappedPoints.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-500">No manholes with latitude/longitude have been recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold">Map View</h2>
        <p className="text-sm text-gray-600">
          Showing {mappedPoints.length} manhole{mappedPoints.length === 1 ? '' : 's'} with coordinates.
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
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
      <LeafletMap
        points={mappedPoints}
        iconColor={iconColor}
        labelColor={labelColor}
        onPreview={(id) => setPreviewUrl(`/manholes/${id}/export?embed=1`)}
        onEdit={(id) => setEditUrl(`/manholes/${id}/edit?embed=1`)}
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
              <h3 className="font-semibold">Edit Manhole</h3>
              <button className="text-sm text-gray-500 hover:text-gray-800" onClick={() => setEditUrl(null)}>Close</button>
            </div>
            <div className="h-[80vh]">
              <iframe title="Edit Manhole" src={editUrl} className="w-full h-full border-0" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
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
