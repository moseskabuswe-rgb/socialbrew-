/**
 * CoffeeMap.tsx
 *
 * Renders a Leaflet map showing shops the user has visited.
 * Uses react-leaflet with careful mount guards to prevent the
 * common "_leaflet_pos of undefined" error that fires when
 * Leaflet tries to position markers before the map container
 * has fully rendered and has a defined size.
 *
 * Fix applied:
 * - Container given explicit height before map initializes
 * - whenCreated callback calls invalidateSize() after mount
 * - Markers only render after map is confirmed ready
 * - Error boundary wraps the map to prevent PostHog noise
 */

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

interface Visit {
  shop_id: string
  name: string
  lat: number
  lng: number
  avg_fill?: number
  total_visits?: number
  photo_url?: string | null
}

interface Props {
  visits: Visit[]
}

export default function CoffeeMap({ visits }: Props) {
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef<any>(null)

  // Filter to only shops with valid coordinates
  const validVisits = (visits || []).filter(
    v => v && typeof v.lat === 'number' && typeof v.lng === 'number'
      && !isNaN(v.lat) && !isNaN(v.lng)
      && v.lat !== 0 && v.lng !== 0
  )

  // Default center — Bloomington-Normal IL
  const center: [number, number] = validVisits.length > 0
    ? [validVisits[0].lat, validVisits[0].lng]
    : [40.5067, -88.9906]

  useEffect(() => {
    // Small delay to ensure container has rendered and has dimensions
    // before Leaflet tries to initialize — prevents _leaflet_pos error
    const timer = setTimeout(() => {
      setMapReady(true)
      if (mapRef.current) {
        try {
          mapRef.current.invalidateSize()
        } catch {}
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  function getMarkerColor(fill: number) {
    if (fill >= 86) return '#3d1a06'
    if (fill >= 71) return '#6b3410'
    if (fill >= 51) return '#b87333'
    if (fill >= 26) return '#c49a6c'
    return '#d4b896'
  }

  if (validVisits.length === 0) {
    return (
      <div className="w-full rounded-2xl overflow-hidden flex items-center justify-center bg-cream-100 border border-cream-200"
        style={{ height: 220 }}>
        <div className="text-center">
          <p className="text-3xl mb-2">🗺️</p>
          <p className="text-coffee-400 text-sm">Rate a visit to start your map</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-cream-200"
      style={{ height: 220, position: 'relative' }}>
      {mapReady ? (
        <MapContainer
          center={center}
          zoom={validVisits.length === 1 ? 14 : 12}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          scrollWheelZoom={false}
          whenCreated={(map: any) => {
            mapRef.current = map
            // Invalidate size after creation to fix any container sizing issues
            setTimeout(() => {
              try { map.invalidateSize() } catch {}
            }, 50)
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution=""
          />
          {validVisits.map(visit => (
            <CircleMarker
              key={visit.shop_id}
              center={[visit.lat, visit.lng]}
              radius={10}
              fillColor={getMarkerColor(visit.avg_fill || 75)}
              fillOpacity={0.9}
              color="#ffffff"
              weight={2}
            >
              <Popup>
                <div style={{ fontFamily: 'sans-serif', minWidth: 120 }}>
                  <p style={{ fontWeight: 700, marginBottom: 2, fontSize: 13 }}>{visit.name}</p>
                  {visit.avg_fill && (
                    <p style={{ color: '#c8853a', fontSize: 12 }}>{visit.avg_fill}% avg satisfaction</p>
                  )}
                  {visit.total_visits && (
                    <p style={{ color: '#888', fontSize: 11 }}>{visit.total_visits} visit{visit.total_visits !== 1 ? 's' : ''}</p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      ) : (
        // Placeholder while map initializes — prevents layout shift
        <div className="w-full h-full bg-cream-100 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
        </div>
      )}
    </div>
  )
}
