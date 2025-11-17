'use client'

import { useEffect, useMemo, useState } from 'react'
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
}

export default function MapViewPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [points, setPoints] = useState<ManholePoint[]>([])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('manholes')
        .select('id, identifier, latitude, longitude')

      if (!active) return
      if (error) {
        setError(error.message)
        setPoints([])
      } else {
        setPoints((data as ManholePoint[]) || [])
      }
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
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
        return { id: point.id, name: point.identifier || point.id, lat, lng }
      })
      .filter(Boolean) as { id: string; name: string; lat: number; lng: number }[]
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
      <LeafletMap points={mappedPoints} />
    </div>
  )
}
