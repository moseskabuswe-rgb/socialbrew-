import { useEffect, useRef } from 'react'

type VisitedShop = {
  shop_id: string
  visit_count: number
  coffee_shops: {
    name: string
    city: string
    state: string
    lat: number | null
    lng: number | null
    photo_url: string | null
  }
}

type Props = { visits: VisitedShop[] }

export default function CoffeeMap({ visits }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Dynamically import Leaflet to avoid SSR issues
    import('leaflet').then(L => {
      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      const validVisits = visits.filter(v => v.coffee_shops?.lat && v.coffee_shops?.lng)
      const center: [number, number] = validVisits.length > 0
        ? [validVisits[0].coffee_shops.lat!, validVisits[0].coffee_shops.lng!]
        : [40.5089, -88.9906]

      const map = L.map(mapRef.current!, {
        center,
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: false,
      })

      mapInstanceRef.current = map

      // Warm muted map tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      // Custom coffee cup pin
      validVisits.forEach(visit => {
        const shop = visit.coffee_shops
        const icon = L.divIcon({
          className: '',
          html: `
            <div style="position:relative; width:44px; height:52px;">
              <div style="
                width:40px; height:40px;
                background: linear-gradient(135deg, #c8853a, #7a3f15);
                border: 3px solid white;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                box-shadow: 0 4px 14px rgba(0,0,0,0.35);
                display: flex; align-items: center; justify-content: center;
              ">
                <span style="transform: rotate(45deg); font-size:18px; line-height:1;">☕</span>
              </div>
              ${visit.visit_count > 1 ? `
                <div style="
                  position:absolute; top:-4px; right:-4px;
                  width:18px; height:18px;
                  background:#c8853a; border: 2px solid white;
                  border-radius:50%; display:flex; align-items:center; justify-content:center;
                  font-size:9px; font-weight:bold; color:white;
                ">${visit.visit_count}</div>
              ` : ''}
            </div>
          `,
          iconSize: [44, 52],
          iconAnchor: [20, 52],
          popupAnchor: [2, -52],
        })

        L.marker([shop.lat!, shop.lng!], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:system-ui; min-width:150px; padding:4px 0;">
              ${shop.photo_url
                ? `<img src="${shop.photo_url}" style="width:100%;height:75px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />`
                : `<div style="width:100%;height:50px;background:linear-gradient(135deg,#c8853a,#7a3f15);border-radius:8px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;font-size:24px;">☕</div>`
              }
              <p style="font-weight:700;color:#2a1f0e;font-size:14px;margin:0 0 2px;">${shop.name}</p>
              <p style="color:#9b7a45;font-size:11px;margin:0 0 6px;">${shop.city}, ${shop.state}</p>
              <div style="background:#f7f0e4;border-radius:8px;padding:4px 8px;display:inline-block;">
                <span style="color:#c8853a;font-size:12px;font-weight:600;">☕ Visited ${visit.visit_count}x</span>
              </div>
            </div>
          `, { maxWidth: 200 })
      })

      // Fit map to all pins if multiple
      if (validVisits.length > 1) {
        const bounds = L.latLngBounds(validVisits.map(v => [v.coffee_shops.lat!, v.coffee_shops.lng!]))
        map.fitBounds(bounds, { padding: [30, 30] })
      }
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [visits])

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      <div ref={mapRef} style={{ width: '100%', height: 300, borderRadius: '16px 16px 0 0', overflow: 'hidden' }} />
    </>
  )
}
