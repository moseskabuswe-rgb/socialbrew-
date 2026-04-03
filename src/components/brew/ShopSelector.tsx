import { useState, useEffect, useRef } from 'react'
import { Search, X, MapPin, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { CoffeeShop } from '../../lib/supabase'

type Props = {
  onSelect: (shop: CoffeeShop | { id: string; name: string; address: string | null; city: string | null; state: string | null; lat: null; lng: null; photo_url: null; vibes: string[]; avg_rating: number; total_ratings: number; weekly_visits: number; is_certified: boolean }) => void
  onClose: () => void
}

const CHAINS = ['starbucks', 'dunkin', 'dutch bros', "peet's", 'caribou', 'mcdonalds', 'panera']

export default function ShopSelector({ onSelect, onClose }: Props) {
  const [dbShops, setDbShops] = useState<CoffeeShop[]>([])
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<any>(null)

  // Load DB shops on mount
  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('coffee_shops')
        .select('*')
        .eq('is_active', true)
        .order('total_ratings', { ascending: false })
        .limit(30)
      setDbShops(data || [])
      setResults(data || [])
      setLoading(false)
    }
    load()
  }, [])

  // Search — filter DB first, then search OSM for anything not found
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!search.trim()) {
      setResults(dbShops)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const q = search.toLowerCase()

      // Filter from DB first
      const dbMatches = dbShops.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.city || '').toLowerCase().includes(q) ||
        (s.address || '').toLowerCase().includes(q)
      )

      // Also search OSM for comprehensive results
      const osmQuery = `
[out:json][timeout:20];
node["amenity"="cafe"]["name"~"${search}",i];
out body 10;`.trim()

      let osmResults: any[] = []
      try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST', body: osmQuery,
        })
        if (res.ok) {
          const data = await res.json()
          osmResults = (data.elements || [])
            .filter((el: any) => {
              const name = (el.tags?.name || '').toLowerCase()
              return !CHAINS.some(c => name.includes(c)) &&
                !dbMatches.some(db => db.name.toLowerCase() === name)
            })
            .slice(0, 5)
            .map((el: any) => ({
              id: `osm-${el.id}`,
              name: el.tags?.name,
              address: [el.tags?.['addr:housenumber'], el.tags?.['addr:street']].filter(Boolean).join(' ') || null,
              city: el.tags?.['addr:city'] || null,
              state: el.tags?.['addr:state'] || null,
              lat: null, lng: null, photo_url: null,
              vibes: [], avg_rating: 0, total_ratings: 0, weekly_visits: 0, is_certified: false,
            }))
        }
      } catch { }

      setResults([...dbMatches, ...osmResults])
      setSearching(false)
    }, 400)
  }, [search, dbShops])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.92)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm bg-coffee-700 rounded-t-3xl animate-slide-up" style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between p-5 pb-3 flex-shrink-0">
          <h2 className="text-white font-display text-xl font-bold">Which shop?</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-coffee-600 flex items-center justify-center text-coffee-300">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 mb-3 flex-shrink-0">
          <div className="flex items-center bg-coffee-800 rounded-xl px-4 py-3 border border-coffee-600 focus-within:border-caramel transition-colors">
            <Search size={15} className="text-coffee-400 mr-3 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search any coffee shop..."
              autoFocus
              className="flex-1 bg-transparent text-white text-sm placeholder-coffee-400 focus:outline-none"
            />
            {searching && <div className="w-4 h-4 rounded-full border-2 border-caramel border-t-transparent animate-spin flex-shrink-0" />}
          </div>
        </div>

        <div className="overflow-y-auto px-5 pb-8 flex-1">
          {(loading) && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
            </div>
          )}

          {!loading && results.length === 0 && search && !searching && (
            <div className="text-center py-8">
              <p className="text-coffee-300 text-sm">No shops found for "{search}"</p>
              <p className="text-coffee-400 text-xs mt-1">Try a different spelling or city name</p>
            </div>
          )}

          {results.map((shop, i) => {
            const isInDb = !String(shop.id).startsWith('osm-')
            return (
              <button key={shop.id || i} onClick={() => onSelect(shop)}
                className="w-full text-left flex items-center gap-3 py-3 border-b border-coffee-600/30 hover:bg-coffee-600/20 rounded-xl px-2 transition-colors">
                <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-coffee-800">
                  {shop.photo_url
                    ? <img src={shop.photo_url} alt={shop.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-xl">☕</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-white font-semibold text-sm truncate">{shop.name}</p>
                    {isInDb && shop.is_certified && <CheckCircle size={12} className="text-caramel flex-shrink-0" />}
                  </div>
                  {(shop.address || shop.city) && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={10} className="text-coffee-400" />
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
  )
}
