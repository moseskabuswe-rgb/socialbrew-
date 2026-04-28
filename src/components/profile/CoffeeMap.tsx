/**
 * CoffeeMap.tsx
 *
 * Interactive map of visited coffee shops with colored pins.
 * Uses Leaflet loaded via CDN (no npm dependency needed).
 * Pin colors reflect fill level satisfaction score.
 *
 * Handles nested data from user_shop_visits join:
 * { visit_count, coffee_shops: { id, name, lat, lng, ... } }
 *
 * Fix for _leaflet_pos error: map only initializes after container
 * has mounted and has real dimensions (100ms delay + invalidateSize).
 */

import { useEffect, useRef, useState } from 'react'

interface Visit {
  shop_id?: string
  name?: string
  lat?: number
  lng?: number
  avg_fill?: number
  total_visits?: number
  visit_count?: number
  city?: string | null
  coffee_shops?: {
    id: string
    name: string
    lat: number
    lng: number
    city?: string | null
    state?: string | null
    photo_url?: string | null
    avg_fill?: number
  }
}

interface NormalizedVisit {
  shop_id: string
  name: string
  lat: number
  lng: number
  city: string | null
  avg_fill: number
  visit_count: number
}

interface Props {
  visits: Visit[]
}

function getFillColor(fill: number): string {
  if (fill >= 90) return '#3d1a06'
  if (fill >= 80) return '#6b3410'
  if (fill >= 70) return '#b87333'
  if (fill >= 60) return '#c49a6c'
  return '#d4b896'
}

function getFillLabel(fill: number): string {
  if (fill <= 59) return 'Not My Cup'
  if (fill <= 69) return 'Just a Sip'
  if (fill <= 79) return 'Decent Pour'
  if (fill <= 89) return 'Good Brew'
  if (fill <= 99) return 'Loved It'
  return 'Perfect Brew ✨'
}

export default function CoffeeMap({ visits }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<any>(null)
  const [mapError, setMapError] = useState(false)

  // Normalize nested or flat visit data
  const normalized: NormalizedVisit[] = (visits || [])
    .map((v: any) => {
      const shop = v.coffee_shops || v
      return {
        shop_id: shop.id || v.shop_id || '',
        name: shop.name || v.name || 'Unknown Shop',
        lat: Number(shop.lat ?? v.lat),
        lng: Number(shop.lng ?? v.lng),
        city: shop.city || v.city || null,
        avg_fill: Number(shop.avg_fill ?? v.avg_fill ?? 75),
        visit_count: Number(v.visit_count ?? v.total_visits ?? 1),
      }
    })
    .filter(v =>
      v.lat && v.lng &&
      !isNaN(v.lat) && !isNaN(v.lng) &&
      v.lat !== 0 && v.lng !== 0
    )

  useEffect(() => {
    if (normalized.length === 0 || !mapRef.current) return

    // Delay to ensure container has real pixel dimensions
    const timer = setTimeout(() => {
      if (!mapRef.current) return

      // Load Leaflet CSS
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      // Load Leaflet JS dynamically
      const existingScript = document.getElementById('leaflet-js')
      const initMap = () => {
        try {
          const L = (window as any).L
          if (!L || !mapRef.current) return

          // Destroy existing map instance if any
          if (leafletMap.current) {
            leafletMap.current.remove()
            leafletMap.current = null
          }

          const map = L.map(mapRef.current, {
            zoomControl: true,
            scrollWheelZoom: false,
            tap: false,
          })

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '',
            maxZoom: 19,
          }).addTo(map)

          // Add colored circle markers with popups
          normalized.forEach(v => {
            const color = getFillColor(v.avg_fill)
            const label = getFillLabel(v.avg_fill)

            const marker = L.circleMarker([v.lat, v.lng], {
              radius: 10,
              fillColor: color,
              fillOpacity: 0.92,
              color: '#ffffff',
              weight: 2.5,
            }).addTo(map)

            marker.bindPopup(`
              <div style="font-family: sans-serif; min-width: 130px; padding: 2px 0">
                <p style="font-weight: 700; font-size: 13px; margin: 0 0 4px 0; color: #1c0a02">${v.name}</p>
                ${v.city ? `<p style="font-size: 11px; color: #888; margin: 0 0 4px 0">${v.city}</p>` : ''}
                <p style="font-size: 12px; font-weight: 600; margin: 0 0 2px 0" style="color: ${color}">${v.avg_fill}% · ${label}</p>
                <p style="font-size: 11px; color: #888; margin: 0">${v.visit_count} visit${v.visit_count !== 1 ? 's' : ''}</p>
              </div>
            `)
          })

          // Fit map to show all markers
          if (normalized.length === 1) {
            map.setView([normalized[0].lat, normalized[0].lng], 15)
          } else {
            const bounds = L.latLngBounds(normalized.map(v => [v.lat, v.lng]))
            map.fitBounds(bounds, { padding: [30, 30] })
          }

          // Fix sizing after mount
          setTimeout(() => {
            try { map.invalidateSize() } catch {}
          }, 50)

          leafletMap.current = map
        } catch (err) {
          console.error('Map init error:', err)
          setMapError(true)
        }
      }

      if (existingScript) {
        // Script already loaded
        if ((window as any).L) initMap()
        else existingScript.addEventListener('load', initMap)
      } else {
        const script = document.createElement('script')
        script.id = 'leaflet-js'
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.onload = initMap
        script.onerror = () => setMapError(true)
        document.head.appendChild(script)
      }
    }, 100)

    return () => {
      clearTimeout(timer)
      if (leafletMap.current) {
        try { leafletMap.current.remove() } catch {}
        leafletMap.current = null
      }
    }
  }, [normalized.length])

  if (normalized.length === 0) {
    return (
      <div className="w-full rounded-2xl overflow-hidden flex items-center justify-center bg-cream-100 border border-cream-200"
        style={{ height: 220 }}>
        <div className="text-center px-4">
          <p className="text-3xl mb-2">🗺️</p>
          <p className="text-coffee-400 text-sm font-medium">Your coffee map starts here</p>
          <p className="text-coffee-300 text-xs mt-1">Rate a visit to add your first pin</p>
        </div>
      </div>
    )
  }

  if (mapError) {
    return (
      <div className="w-full rounded-2xl overflow-hidden bg-cream-100 border border-cream-200 p-4">
        <p className="text-coffee-400 text-sm text-center">Map unavailable — check your connection</p>
        <div className="mt-3 space-y-2">
          {normalized.map(v => (
            <div key={v.shop_id} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: getFillColor(v.avg_fill) }} />
              <p className="text-coffee-700 text-sm font-medium">{v.name}</p>
              <p className="text-coffee-400 text-xs ml-auto">{v.avg_fill}%</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={mapRef}
      style={{ height: 260, width: '100%', borderRadius: '1rem', overflow: 'hidden' }}
    />
  )
}
