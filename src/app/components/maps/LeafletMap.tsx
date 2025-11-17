'use client'

import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import customMarker from '@/../public/icons/manhole-marker.svg'
import '@/app/components/maps/leaflet-marker.css'

type MapPoint = {
  id: string
  name: string
  lat: number
  lng: number
}

// Fix Leaflet's default icon paths in Next.js bundles
function createMarkerIcon(label: string) {
  return L.divIcon({
    html: `
      <div class="manhole-marker">
        <img src="${customMarker.src}" alt="Manhole marker" />
        <span>${label}</span>
      </div>
    `,
    className: '',
    iconSize: [42, 54],
    iconAnchor: [21, 50],
    popupAnchor: [0, -46],
  })
}

const DEFAULT_CENTER: LatLngExpression = [54.5, -3.0] // UK-ish fallback

export default function LeafletMap({ points }: { points: MapPoint[] }) {
  const bounds = useMemo(() => {
    if (!points.length) return null
    const latLngs = points.map((p) => [p.lat, p.lng] as [number, number])
    return L.latLngBounds(latLngs)
  }, [points])

  const center = bounds ? bounds.getCenter() : DEFAULT_CENTER

  return (
    <MapContainer
      center={center}
      bounds={bounds ?? undefined}
      zoom={points.length ? undefined : 5}
      className="rounded-xl border border-gray-200"
      style={{ height: '520px', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((point) => (
        <Marker
          key={point.id}
          position={[point.lat, point.lng]}
          icon={createMarkerIcon(point.name?.slice(0, 4) || point.id.slice(0, 4))}
        >
          <Popup>
            <div className="space-y-1">
              <p className="font-semibold">{point.name || 'Unnamed Manhole'}</p>
              <p className="text-xs text-gray-600">
                {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
