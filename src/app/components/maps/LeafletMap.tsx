'use client'

import { useMemo } from 'react'
import { MapContainer, TileLayer, LayersControl, Marker, Popup } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@/app/components/maps/leaflet-marker.css'

type MapPoint = {
  id: string
  name: string
  lat: number
  lng: number
  shape?: string
}

const SHAPE_CLASS: Record<string, string> = {
  circle: 'shape-circle',
  round: 'shape-circle',
  triangle: 'shape-triangle',
  square: 'shape-square',
  rectangle: 'shape-square',
  hexagon: 'shape-hexagon',
  default: 'shape-circle',
}

// Fix Leaflet's default icon paths in Next.js bundles
function createMarkerIcon(label: string, shape = '', iconColor: string, labelColor: string) {
  const shapeClass = SHAPE_CLASS[shape || ''] || SHAPE_CLASS.default
  return L.divIcon({
    html: `
      <div class="manhole-marker" style="--icon-color:${iconColor}; --label-bg:${labelColor};">
        <span class="shape ${shapeClass}"></span>
        <span class="marker-label">${label}</span>
      </div>
    `,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -16],
  })
}

const DEFAULT_CENTER: LatLngExpression = [54.5, -3.0] // UK-ish fallback

export default function LeafletMap({
  points,
  iconColor,
  labelColor,
  onPreview,
  onEdit,
}: {
  points: MapPoint[]
  iconColor: string
  labelColor: string
  onPreview?: (id: string) => void
  onEdit?: (id: string) => void
}) {
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
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Street">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer
            attribution='Tiles &copy; Google'
            url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Terrain">
          <TileLayer
            attribution='Tiles &copy; Google'
            url="https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
          />
        </LayersControl.BaseLayer>
      </LayersControl>
      {points.map((point) => (
        <Marker
          key={point.id}
          position={[point.lat, point.lng]}
          icon={createMarkerIcon(point.name || point.id, point.shape, iconColor, labelColor)}
        >
          <Popup>
            <div className="space-y-1">
              <p className="font-semibold">{point.name || 'Unnamed Manhole'}</p>
              <p className="text-xs text-gray-600">
                {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => onPreview?.(point.id)}
                  className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => onEdit?.(point.id)}
                  className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Edit
                </button>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
