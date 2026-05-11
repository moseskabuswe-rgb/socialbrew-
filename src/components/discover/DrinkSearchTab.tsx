/**
 * DrinkSearchTab — standalone drink search component embedded in DiscoverTab.
 * Shows when user toggles to "Drink" mode in Discover.
 * Searches ratings by drink_name with fuzzy matching, sorted by proximity + rating.
 */
import { useState, useEffect, useRef } from 'react'
import { Search, MapPin, Star, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface DrinkResult {
  drink_name: string
  shop: any
  avg_rating: number
  rating_count: number
  distance_km: number | null
}

function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase().trim()
  const t = target.toLowerCase().trim()
  if (t.includes(q)) return true
  if (q.length < 3) return false
  const words = t.split(/\s+/)
  for (const word of words) {
    if (levenshtein(q, word) <= 2) return true
    if (word.startsWith(q.slice(0, Math.floor(q.length * 0.7)))) return true
  }
  return false
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

interface Props {
  userLat: number | null
  userLng: number | null
  onShopSelect?: (shop: any) => void // optional: navigate to shop detail
}

export default function DrinkSearchTab({ userLat, userLng, onShopSelect }: Props) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<DrinkResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<any>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!search.trim()) { setResults([]); setSearched(false); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setSearched(true)
      try {
        const { data: ratings } = await supabase
          .from('ratings')
          .select(`
            drink_name,
            fill_level,
            shop_id,
            coffee_shops (
              id, name, city, state, lat, lng,
              photo_url, is_certified, is_active, address,
              avg_rating, total_ratings
            )
          `)
          .not('drink_name', 'is', null)
          .neq('drink_name', '')

        if (!ratings) { setLoading(false); return }

        // Group by drink_name + shop, fuzzy-filter
        const grouped: Record<string, { fills: number[]; shop: any }> = {}
        for (const r of ratings) {
          const shop = (r as any).coffee_shops
          if (!shop || !shop.is_active) continue
          if (!fuzzyMatch(search, r.drink_name || '')) continue
          const key = `${(r.drink_name||'').toLowerCase().trim()}::${shop.id}`
          if (!grouped[key]) grouped[key] = { fills: [], shop }
          grouped[key].fills.push(r.fill_level)
        }

        const built: DrinkResult[] = Object.entries(grouped).map(([key, { fills, shop }]) => {
          const drink_name = key.split('::')[0]
          const avg = fills.reduce((a,b) => a+b, 0) / fills.length
          const dist = userLat && userLng && shop.lat && shop.lng
            ? distanceKm(userLat, userLng, shop.lat, shop.lng)
            : null
          return { drink_name, shop, avg_rating: avg, rating_count: fills.length, distance_km: dist }
        })

        // Sort: nearby first (< 80km), then by rating
        built.sort((a, b) => {
          const aClose = a.distance_km !== null && a.distance_km < 80
          const bClose = b.distance_km !== null && b.distance_km < 80
          if (aClose && !bClose) return -1
          if (bClose && !aClose) return 1
          if (aClose && bClose && a.distance_km !== null && b.distance_km !== null) {
            // closer first within nearby band
            if (Math.abs(a.distance_km - b.distance_km) > 5) return a.distance_km - b.distance_km
          }
          return b.avg_rating - a.avg_rating
        })

        setResults(built)
      } catch (e) {
        console.error(e)
      }
      setLoading(false)
    }, 500)
  }, [search, userLat, userLng])

  return (
    <div className="flex flex-col">
      {/* Search input */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center bg-white rounded-xl px-4 py-2.5 border border-stone-200 shadow-sm gap-2">
          <Search size={15} className="text-amber-500 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="e.g. oat latte, cold brew, cortado..."
            className="flex-1 bg-transparent text-stone-800 text-sm placeholder-stone-400 focus:outline-none"
            autoFocus
          />
          {search.length > 0 && (
            <button onClick={() => { setSearch(''); setResults([]) }}>
              <X size={14} className="text-stone-400" />
            </button>
          )}
        </div>
        <p className="text-stone-400 text-xs mt-1.5 px-1">
          Misspellings are ok — results ranked by proximity &amp; rating
        </p>
      </div>

      {/* Empty state */}
      {!search.trim() && (
        <div className="flex flex-col items-center py-16 px-8 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-stone-700 font-semibold text-base mb-1">Find a drink you love</p>
          <p className="text-stone-400 text-sm">Search any drink and see which shops near you make it best, ranked by real ratings.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {['cold brew', 'oat latte', 'cortado', 'matcha', 'pour over'].map(s => (
              <button
                key={s}
                onClick={() => setSearch(s)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-12">
          <div className="w-5 h-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <span className="text-stone-400 text-sm">Searching ratings...</span>
        </div>
      )}

      {/* No results */}
      {!loading && searched && search.trim() && results.length === 0 && (
        <div className="flex flex-col items-center py-12 px-8 text-center">
          <div className="text-4xl mb-3">🫗</div>
          <p className="text-stone-700 font-semibold">No ratings for "{search}" yet</p>
          <p className="text-stone-400 text-sm mt-1">Be the first to try it and rate it on Social Brew!</p>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="px-4 pb-6">
          <p className="text-xs text-stone-400 mb-3 px-1">
            {results.length} result{results.length !== 1 ? 's' : ''} for "{search}"
          </p>
          <div className="flex flex-col gap-3">
            {results.map((result, i) => (
              <button
                key={`${result.drink_name}-${result.shop.id}`}
                onClick={() => onShopSelect?.(result.shop)}
                className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-stone-100 text-left active:scale-98 transition-all"
              >
                {/* Rank */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={
                    i === 0
                      ? { background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff' }
                      : i === 1
                      ? { background: '#e5e7eb', color: '#6b7280' }
                      : { background: '#f3f4f6', color: '#9ca3af' }
                  }
                >
                  {i + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-stone-800 font-semibold text-sm capitalize">{result.drink_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <MapPin size={10} className="text-stone-400 flex-shrink-0" />
                    <p className="text-stone-500 text-xs truncate">{result.shop.name}</p>
                    {result.distance_km !== null && (
                      <span className="text-stone-400 text-xs flex-shrink-0">
                        · {result.distance_km < 1
                          ? `${Math.round(result.distance_km * 1000)}m`
                          : `${result.distance_km.toFixed(1)}km`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Rating */}
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1 justify-end">
                    <Star size={11} fill="#f59e0b" stroke="none" />
                    <p className="text-amber-600 text-sm font-bold">{Math.round(result.avg_rating)}%</p>
                  </div>
                  <p className="text-stone-400 text-xs">{result.rating_count} sip{result.rating_count !== 1 ? 's' : ''}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
