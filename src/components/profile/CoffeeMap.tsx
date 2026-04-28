/**
 * CoffeeMap.tsx
 *
 * Visual map of shops the user has visited.
 * Uses an iframe with OpenStreetMap embed — no external npm dependencies.
 * This avoids the react-leaflet _leaflet_pos timing error entirely
 * since the map renders in an isolated iframe context.
 *
 * For single shop: shows that shop centered on the map.
 * For multiple shops: shows all shops with pins via OSM's map embed.
 * Falls back to a clean list view if no coordinates available.
 */

import { useState } from 'react'
import { MapPin, Coffee } from 'lucide-react'

interface Visit {
  shop_id: string
  name: string
  lat: number
  lng: number
  avg_fill?: number
  total_visits?: number
  photo_url?: string | null
  city?: string | null
}

interface Props {
  visits: Visit[]
}

export default function CoffeeMap({ visits }: Props) {
  const [selected, setSelected] = useState<Visit | null>(null)

  // Filter to only shops with valid coordinates
  const validVisits = (visits || []).filter(
    v => v && typeof v.lat === 'number' && typeof v.lng === 'number'
      && !isNaN(v.lat) && !isNaN(v.lng)
      && v.lat !== 0 && v.lng !== 0
  )

  if (validVisits.length === 0) {
    return (
      <div className="w-full rounded-2xl overflow-hidden flex items-center justify-center bg-cream-100 border border-cream-200"
        style={{ height: 200 }}>
        <div className="text-center px-4">
          <p className="text-3xl mb-2">🗺️</p>
          <p className="text-coffee-400 text-sm font-medium">Your coffee map starts here</p>
          <p className="text-coffee-300 text-xs mt-1">Rate a visit to add your first pin</p>
        </div>
      </div>
    )
  }

  // Build OSM embed URL
  // For single shop — center on it with a marker
  // For multiple shops — show bounding box covering all shops
  function getMapUrl() {
    if (validVisits.length === 1) {
      const v = validVisits[0]
      const marker = `${v.lat},${v.lng}`
      return `https://www.openstreetmap.org/export/embed.html?bbox=${v.lng - 0.01},${v.lat - 0.01},${v.lng + 0.01},${v.lat + 0.01}&layer=mapnik&marker=${marker}`
    }
    // Multiple — compute bounding box
    const lats = validVisits.map(v => v.lat)
    const lngs = validVisits.map(v => v.lng)
    const minLat = Math.min(...lats) - 0.02
    const maxLat = Math.max(...lats) + 0.02
    const minLng = Math.min(...lngs) - 0.02
    const maxLng = Math.max(...lngs) + 0.02
    return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng},${minLat},${maxLng},${maxLat}&layer=mapnik`
  }

  function getFillColor(fill: number) {
    if (fill >= 86) return '#3d1a06'
    if (fill >= 71) return '#6b3410'
    if (fill >= 51) return '#b87333'
    if (fill >= 26) return '#c49a6c'
    return '#d4b896'
  }

  function getFillLabel(fill: number) {
    if (fill <= 25) return 'Disappointing'
    if (fill <= 50) return 'Just Okay'
    if (fill <= 70) return 'Pretty Good'
    if (fill <= 85) return 'Really Good'
    if (fill <= 99) return 'Excellent'
    return 'Perfect Brew ✨'
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-cream-200" style={{ background: '#f5ead8' }}>
      {/* Map iframe */}
      <div style={{ height: 200, position: 'relative' }}>
        <iframe
          src={getMapUrl()}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Coffee shop map"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
        />
        {/* Shop count badge */}
        <div className="absolute top-2 right-2 bg-white/90 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm">
          <MapPin size={11} className="text-caramel" />
          <span className="text-coffee-800 font-bold text-xs">{validVisits.length} shop{validVisits.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Shop list below map */}
      <div className="divide-y divide-cream-200">
        {validVisits.map(visit => (
          <button
            key={visit.shop_id}
            onClick={() => setSelected(selected?.shop_id === visit.shop_id ? null : visit)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cream-100 transition-colors text-left"
          >
            {/* Fill level dot */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: getFillColor(visit.avg_fill || 75) }}
            >
              <Coffee size={13} color="white" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-coffee-800 font-semibold text-sm truncate">{visit.name}</p>
              {visit.city && <p className="text-coffee-400 text-xs">{visit.city}</p>}
            </div>

            <div className="text-right flex-shrink-0">
              {visit.avg_fill && (
                <p className="text-caramel font-bold text-sm">{visit.avg_fill}%</p>
              )}
              {visit.avg_fill && (
                <p className="text-coffee-300 text-xs">{getFillLabel(visit.avg_fill)}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
