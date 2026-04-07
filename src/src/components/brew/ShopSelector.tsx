import { useState, useEffect, useRef } from 'react'
import { Search, X, MapPin, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Props = {
  onSelect: (shop: any) => void
  onClose: () => void
}

const FALLBACK_SHOPS = [
  { id: 'fb-1', name: 'Coffee Hound', address: '407 N Main St', city: 'Bloomington', state: 'IL', lat: 40.4851, lng: -88.9937, photo_url: null, vibes: ['Cozy', 'Work-friendly'], avg_rating: 4.6, total_ratings: 0, weekly_visits: 0, is_certified: true },
  { id: 'fb-2', name: 'Fusion Brew', address: '503 S Main St', city: 'Normal', state: 'IL', lat: 40.5089, lng: -88.9889, photo_url: null, vibes: ['Social', 'Cozy'], avg_rating: 4.3, total_ratings: 0, weekly_visits: 0, is_certified: true },
  { id: 'fb-3', name: 'Lvl Up Coffee Bar', address: '1 Uptown Circle', city: 'Normal', state: 'IL', lat: 40.5142, lng: -88.9906, photo_url: null, vibes: ['Social', 'Work-friendly'], avg_rating: 4.5, total_ratings: 0, weekly_visits: 0, is_certified: true },
  { id: 'fb-4', name: 'Blooms Coffee Bar', address: '1209 Towanda Ave', city: 'Bloomington', state: 'IL', lat: 40.4882, lng: -88.9612, photo_url: null, vibes: ['Cozy', 'Social'], avg_rating: 4.7, total_ratings: 0, weekly_visits: 0, is_certified: false },
  { id: 'fb-5', name: 'The Coffeehouse & Deli', address: '112 E Beaufort St', city: 'Normal', state: 'IL', lat: 40.5138, lng: -88.9902, photo_url: null, vibes: ['Cozy', 'Quiet'], avg_rating: 4.5, total_ratings: 0, weekly_visits: 0, is_certified: true },
  { id: 'fb-6', name: 'Recreation Coffee', address: '915 E Washington St', city: 'Bloomington', state: 'IL', lat: 40.4821, lng: -88.9801, photo_url: null, vibes: ['Social', 'Work-friendly'], avg_rating: 4.8, total_ratings: 0, weekly_visits: 0, is_certified: false },
  { id: 'fb-7', name: 'Viking Brews Coffee House', address: '1 Mikes Way', city: 'Bloomington', state: 'IL', lat: 40.4890, lng: -88.9456, photo_url: null, vibes: ['Cozy', 'Aesthetic'], avg_rating: 4.8, total_ratings: 0, weekly_visits: 0, is_certified: false },
  { id: 'fb-8', name: 'CRAFTED Coffee & Wine', address: '1101 Airport Rd', city: 'Bloomington', state: 'IL', lat: 40.4712, lng: -88.9189, photo_url: null, vibes: ['Date Night', 'Social'], avg_rating: 4.5, total_ratings: 0, weekly_visits: 0, is_certified: false },
]

async function searchOSM(query: string): Promise<any[]> {
  const q = `
[out:json][timeout:15];
(
  node["amenity"="cafe"]["name"~"${query.replace(/[^a-zA-Z0-9 ]/g, '')}",i];
  node["shop"="coffee"]["name"~"${query.replace(/[^a-zA-Z0-9 ]/g, '')}",i];
);
out body 10;`
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 12000)
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST', body: q, signal: controller.signal,
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json.elements || [])
      .filter((el: any) => el.tags?.name)
      .map((el: any) => ({
        id: `osm-${el.id}`,
        name: el.tags.name,
        address: [el.tags['addr:housenumber'], el.tags['addr:street']].filter(Boolean).join(' ') || null,
        city: el.tags['addr:city'] || null,
        state: el.tags['addr:state'] || null,
        lat: null, lng: null, photo_url: null,
        vibes: [], avg_rating: 0, total_ratings: 0, weekly_visits: 0, is_certified: false,
      }))
  } catch { return [] }
}

export default function ShopSelector({ onSelect, onClose }: Props) {
  const [dbShops, setDbShops] = useState<any[]>([])
  const [results, setResults] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('coffee_shops').select('*').eq('is_active', true)
        .order('total_ratings', { ascending: false }).limit(50)
      const shops = data && data.length > 0 ? data : FALLBACK_SHOPS
      setDbShops(shops)
      setResults(shops)
      setLoading(false)
    }
    load()
    // Auto focus search after mount
    setTimeout(() => inputRef.current?.focus(), 300)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!search.trim()) {
      setResults(dbShops)
      return
    }

    const q = search.toLowerCase()

    // Immediate local filter
    const localMatches = dbShops.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.city || '').toLowerCase().includes(q) ||
      (s.address || '').toLowerCase().includes(q)
    )
    setResults(localMatches)

    // Then search OSM after delay if local results are sparse
    if (search.trim().length >= 3) {
      debounceRef.current = setTimeout(async () => {
        setSearching(true)
        const osmResults = await searchOSM(search)
        setResults(prev => {
          const existing = new Set(prev.map(p => p.name.toLowerCase()))
          const newOSM = osmResults.filter(o => !existing.has((o.name || '').toLowerCase()))
          return [...prev, ...newOSM]
        })
        setSearching(false)
      }, 800)
    }
  }, [search, dbShops])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.92)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm bg-coffee-700 rounded-t-3xl animate-slide-up flex flex-col"
        style={{ maxHeight: '85vh' }}>

        <div className="flex items-center justify-between p-5 pb-3 flex-shrink-0">
          <div>
            <h2 className="text-white font-display text-xl font-bold">Which shop?</h2>
            <p className="text-coffee-300 text-xs mt-0.5">
              {loading ? 'Loading shops...' : searching ? 'Searching...' : `${results.length} shops found`}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-coffee-600 flex items-center justify-center text-coffee-300">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 mb-3 flex-shrink-0">
          <div className="flex items-center bg-coffee-800 rounded-xl px-4 py-3 border border-coffee-500 focus-within:border-caramel transition-colors">
            <Search size={15} className="text-coffee-400 mr-3 flex-shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search any coffee shop..."
              className="flex-1 bg-transparent text-white text-sm placeholder-coffee-400 focus:outline-none"
            />
            {searching && <div className="w-4 h-4 rounded-full border-2 border-caramel border-t-transparent animate-spin flex-shrink-0" />}
            {search && !searching && <button onClick={() => setSearch('')} className="text-coffee-400 flex-shrink-0"><X size={14} /></button>}
          </div>
        </div>

        <div className="overflow-y-auto px-4 pb-6 flex-1">
          {loading && (
            <div className="flex flex-col items-center py-10 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
              <p className="text-coffee-300 text-sm">Loading shops...</p>
            </div>
          )}

          {!loading && results.length === 0 && search && !searching && (
            <div className="text-center py-8">
              <p className="text-coffee-300 text-sm">No shops found for "{search}"</p>
              <p className="text-coffee-400 text-xs mt-1">Try a different name or city</p>
            </div>
          )}

          <div className="space-y-1">
            {results.map((shop, i) => {
              const isInDb = !String(shop.id).startsWith('osm-') && !String(shop.id).startsWith('fb-')
              return (
                <button key={`${shop.id}-${i}`} onClick={() => onSelect(shop)}
                  className="w-full text-left flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-coffee-600/30 active:bg-coffee-600/50 transition-colors">
                  <div className="w-11 h-11 rounded-xl flex-shrink-0 bg-coffee-800 flex items-center justify-center overflow-hidden">
                    {shop.photo_url
                      ? <img src={shop.photo_url} alt={shop.name} className="w-full h-full object-cover" />
                      : <span className="text-xl">☕</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-white font-semibold text-sm truncate">{shop.name}</p>
                      {shop.is_certified && <CheckCircle size={12} className="text-caramel flex-shrink-0" />}
                    </div>
                    {(shop.address || shop.city) && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={10} className="text-coffee-400 flex-shrink-0" />
                        <p className="text-coffee-400 text-xs truncate">
                          {[shop.address, shop.city, shop.state].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    )}
                    {isInDb && shop.avg_rating > 0 && (
                      <p className="text-caramel text-xs mt-0.5">★ {shop.avg_rating} · {shop.total_ratings} ratings</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
