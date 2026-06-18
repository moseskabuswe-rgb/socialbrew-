import { useState, useEffect, useRef } from 'react'
import { Search, X, MapPin, CheckCircle, Coffee, Zap } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AddShopForm from '../shared/AddShopForm'

type Props = {
  onSelect: (shop: any) => void
  onClose: () => void
}

type SearchMode = 'shop' | 'drink'

interface DrinkResult {
  drink_name: string
  shop: any
  avg_rating: number
  rating_count: number
  distance_km: number | null
}

// Fuzzy match — tolerates misspellings up to 2 char difference (Levenshtein-lite)
function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase().trim()
  const t = target.toLowerCase().trim()
  if (t.includes(q)) return true
  if (q.length < 3) return false
  // check each word in target
  const words = t.split(/\s+/)
  for (const word of words) {
    if (levenshtein(q, word) <= 2) return true
    if (word.includes(q.slice(0, Math.floor(q.length * 0.7)))) return true
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
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const CHAINS = [
  'starbucks', 'dunkin', 'dutch bros', "peet's", 'caribou', 'mcdonalds',
  'panera', 'tim hortons', 'costa coffee', 'mccafe', 'biggby', 'scooters',
]

function isChain(name: string): boolean {
  const n = name.toLowerCase()
  return CHAINS.some((c) => n.includes(c))
}

// Nominatim search — same service Discover tab uses for non-DB shops
async function searchNominatim(query: string, userLat: number | null, userLng: number | null): Promise<any[]> {
  try {
    // Build URL — bias results toward user location if available
    const viewbox = userLat && userLng
      ? `&viewbox=${userLng - 2},${userLat + 2},${userLng + 2},${userLat - 2}&bounded=0`
      : ''
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(query + ' coffee')}` +
      `&format=json&limit=12&addressdetails=1` +
      `&featuretype=amenity${viewbox}`

    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'SocialBrew/1.0' },
    })
    if (!res.ok) return []
    const data = await res.json()

    return data
      .filter((item: any) => {
        const name = item.display_name || ''
        const type = (item.type || '').toLowerCase()
        const cls = (item.class || '').toLowerCase()
        // Only keep cafes/amenities, exclude chains
        if (!['cafe', 'coffee', 'amenity', 'shop'].includes(cls) &&
            !['cafe', 'coffee'].includes(type)) return false
        return !isChain(name)
      })
      .map((item: any) => {
        const addr = item.address || {}
        const city = addr.city || addr.town || addr.village || addr.county || null
        const state = addr.state || null
        // Extract just the shop name (first part before the first comma)
        const rawName = item.display_name?.split(',')[0]?.trim() || item.name || 'Unknown'
        return {
          id: `osm-nominatim-${item.place_id}`,
          name: rawName,
          address: [addr.house_number, addr.road].filter(Boolean).join(' ') || null,
          city,
          state,
          lat: parseFloat(item.lat) || null,
          lng: parseFloat(item.lon) || null,
          photo_url: null,
          is_certified: false,
          is_verified: false,
          is_active: true,
          avg_rating: 0,
          total_ratings: 0,
          weekly_visits: 0,
          vibes: [],
          _from_nominatim: true,
        }
      })
  } catch {
    return []
  }
}

export default function ShopSelector({ onSelect, onClose }: Props) {
  const [shops, setShops] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAddShop, setShowAddShop] = useState(false)
  const [mode, setMode] = useState<SearchMode>('shop')
  const [drinkResults, setDrinkResults] = useState<DrinkResult[]>([])
  const [drinkLoading, setDrinkLoading] = useState(false)
  const [nominatimLoading, setNominatimLoading] = useState(false)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const debounceRef = useRef<any>(null)
  const nominatimRef = useRef<any>(null)

  // Get user location for proximity sorting
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude)
        setUserLng(pos.coords.longitude)
      },
      () => {} // silent fail
    )
  }, [])

  // Load ALL active shops — no limit so anything searchable in Discover also appears here
  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('coffee_shops')
          .select('*')
          .eq('is_active', true)
          .order('total_ratings', { ascending: false })
        if (data) {
          setShops(data)
          setFiltered(data)
        }
      } catch {
        // Network error — proceed to show empty state so user can still add a shop
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Shop mode filtering + Nominatim live search
  useEffect(() => {
    if (mode !== 'shop') return
    if (nominatimRef.current) clearTimeout(nominatimRef.current)

    if (!search.trim()) {
      // No search — show DB shops sorted by proximity
      if (userLat && userLng) {
        const sorted = [...shops].sort((a, b) => {
          if (!a.lat || !a.lng) return 1
          if (!b.lat || !b.lng) return -1
          return distanceKm(userLat, userLng, a.lat, a.lng) - distanceKm(userLat, userLng, b.lat, b.lng)
        })
        setFiltered(sorted)
      } else {
        setFiltered(shops)
      }
      setNominatimLoading(false)
      return
    }

    const q = search.toLowerCase()

    // 1. Immediately show DB matches while Nominatim loads
    const dbMatches = shops.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.city || '').toLowerCase().includes(q) ||
        (s.address || '').toLowerCase().includes(q) ||
        fuzzyMatch(search, s.name)
    )
    setFiltered(dbMatches)

    // 2. Debounce Nominatim so we don't hammer it on every keystroke
    if (search.trim().length < 2) return
    setNominatimLoading(true)
    nominatimRef.current = setTimeout(async () => {
      const nominatimResults = await searchNominatim(search, userLat, userLng)

      // Deduplicate: drop any Nominatim result whose name closely matches a DB shop
      const dbNames = new Set(shops.map((s) => s.name.toLowerCase().trim()))
      const deduped = nominatimResults.filter((nr) => {
        const n = nr.name.toLowerCase().trim()
        if (dbNames.has(n)) return false
        // also drop if fuzzy-close to any existing DB shop name
        for (const dbShop of shops) {
          if (levenshtein(n, dbShop.name.toLowerCase()) <= 3) return false
        }
        return true
      })

      // Merge: DB matches first (they have ratings), then Nominatim extras
      setFiltered([...dbMatches, ...deduped])
      setNominatimLoading(false)
    }, 600)
  }, [search, shops, mode, userLat, userLng])

  // Drink mode search with fuzzy + proximity + rating sort
  useEffect(() => {
    if (mode !== 'drink') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!search.trim()) {
      setDrinkResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setDrinkLoading(true)
      try {
        // Fetch all ratings that have a drink_name
        const { data: ratings } = await supabase
          .from('ratings')
          .select('drink_name, fill_level, shop_id, coffee_shops(id, name, city, lat, lng, photo_url, is_certified, is_active, address)')
          .not('drink_name', 'is', null)
          .eq('coffee_shops.is_active', true)

        if (!ratings) { setDrinkLoading(false); return }

        // Group and fuzzy-filter by drink name
        const grouped: Record<string, { fills: number[]; shop: any }> = {}
        for (const r of ratings) {
          const shop = (r as any).coffee_shops
          if (!shop) continue
          if (!fuzzyMatch(search, r.drink_name || '')) continue
          const key = `${(r.drink_name || '').toLowerCase()}::${shop.id}`
          if (!grouped[key]) grouped[key] = { fills: [], shop }
          grouped[key].fills.push(r.fill_level)
        }

        const results: DrinkResult[] = Object.entries(grouped).map(([key, { fills, shop }]) => {
          const drink_name = key.split('::')[0]
          const avg = fills.reduce((a, b) => a + b, 0) / fills.length
          const dist =
            userLat && userLng && shop.lat && shop.lng
              ? distanceKm(userLat, userLng, shop.lat, shop.lng)
              : null
          return { drink_name, shop, avg_rating: avg, rating_count: fills.length, distance_km: dist }
        })

        // Sort: proximity first (within 50km), then by rating desc
        results.sort((a, b) => {
          const aClose = a.distance_km !== null && a.distance_km < 50
          const bClose = b.distance_km !== null && b.distance_km < 50
          if (aClose && !bClose) return -1
          if (bClose && !aClose) return 1
          if (aClose && bClose && a.distance_km !== null && b.distance_km !== null) {
            // within same proximity band, sort by rating
            return b.avg_rating - a.avg_rating
          }
          return b.avg_rating - a.avg_rating
        })

        setDrinkResults(results)
      } catch (e) {
        console.error(e)
      }
      setDrinkLoading(false)
    }, 400)
  }, [search, mode, userLat, userLng])

  function handleShopCreated(shop: any) {
    setShops((prev) => [shop, ...prev])
    setShowAddShop(false)
    onSelect(shop)
  }

  function handleDrinkSelect(result: DrinkResult) {
    // Select the shop and pass drink name hint via extended object
    onSelect({ ...result.shop, _prefillDrink: result.drink_name })
  }

  const showEmpty = !loading && mode === 'shop' && filtered.length === 0
  const showDrinkEmpty =
    !drinkLoading && mode === 'drink' && search.trim().length > 1 && drinkResults.length === 0

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: 'rgba(13,9,4,0.92)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <div
          className="w-full max-w-sm rounded-t-3xl animate-slide-up flex flex-col"
          style={{ background: '#2c1a0e', maxHeight: '88vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
            <h2 className="text-white font-display text-xl font-bold">
              {mode === 'shop' ? 'Where did you go?' : 'Find by Drink'}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-amber-300"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="px-5 mb-3 flex-shrink-0">
            <div
              className="flex rounded-xl p-1 gap-1"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <button
                onClick={() => { setMode('shop'); setSearch('') }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all"
                style={
                  mode === 'shop'
                    ? { background: 'linear-gradient(135deg, #c8853a, #9b5e1a)', color: '#fff' }
                    : { color: 'rgba(255,255,255,0.5)' }
                }
              >
                <Coffee size={14} />
                Shop
              </button>
              <button
                onClick={() => { setMode('drink'); setSearch('') }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all"
                style={
                  mode === 'drink'
                    ? { background: 'linear-gradient(135deg, #7ab0c8, #4a8aaa)', color: '#fff' }
                    : { color: 'rgba(255,255,255,0.5)' }
                }
              >
                <Zap size={14} />
                Drink
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-5 mb-3 flex-shrink-0">
            <div
              className="flex items-center rounded-xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Search size={16} className="text-amber-400 mr-3 flex-shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={mode === 'shop' ? 'Search coffee shops...' : 'Search drink name (e.g. oat latte)'}
                className="flex-1 bg-transparent text-white text-sm placeholder-stone-500 focus:outline-none"
              />
              {search.length > 0 && (
                <button onClick={() => setSearch('')} className="text-stone-500 ml-2">
                  <X size={14} />
                </button>
              )}
            </div>
            {mode === 'drink' && (
              <p className="text-xs text-stone-500 mt-1.5 px-1">
                Misspellings are ok — we'll find close matches
              </p>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1 px-5 pb-6">
            {/* ── SHOP MODE ── */}
            {mode === 'shop' && (
              <>
                {(loading || nominatimLoading) && (
                  <div className="flex items-center justify-center gap-2 py-6">
                    <div className="w-5 h-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                    {nominatimLoading && !loading && (
                      <span className="text-stone-500 text-xs">Searching nearby...</span>
                    )}
                  </div>
                )}

                {!loading &&
                  filtered.map((shop) => {
                    const dist =
                      userLat && userLng && shop.lat && shop.lng
                        ? distanceKm(userLat, userLng, shop.lat, shop.lng)
                        : null
                    return (
                      <button
                        key={shop.id}
                        onClick={() => onSelect(shop)}
                        className="w-full flex items-center gap-3 py-3 border-b text-left transition-colors active:opacity-70"
                        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #c8853a22, #9b5e1a44)' }}
                        >
                          <Coffee size={16} className="text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-white text-sm font-semibold truncate">{shop.name}</p>
                            {shop.is_certified && (
                              <CheckCircle size={12} className="text-amber-400 flex-shrink-0" />
                            )}
                            {shop._from_nominatim && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: 'rgba(120,180,200,0.15)', color: '#7ab0c8' }}
                              >
                                Nearby
                              </span>
                            )}
                            {!shop._from_nominatim && !shop.is_verified && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: 'rgba(200,133,58,0.15)', color: '#c8853a' }}
                              >
                                Community
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-stone-400 text-xs truncate">
                              {[shop.city, shop.state].filter(Boolean).join(', ')}
                            </p>
                            {dist !== null && (
                              <span className="text-stone-500 text-xs flex-shrink-0">
                                · {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
                              </span>
                            )}
                          </div>
                        </div>
                        {shop.avg_rating > 0 && (
                          <div className="flex-shrink-0 text-right">
                            <p className="text-amber-400 text-xs font-bold">{Math.round(shop.avg_rating)}%</p>
                            <p className="text-stone-500 text-xs">{shop.total_ratings} ratings</p>
                          </div>
                        )}
                      </button>
                    )
                  })}

                {showEmpty && (
                  <div className="text-center py-8">
                    <p className="text-stone-400 text-sm font-semibold">
                      {search ? `No shops found for "${search}"` : 'No shops found'}
                    </p>
                    <p className="text-stone-500 text-xs mt-1 mb-4">
                      Only independent coffee shops are listed
                    </p>
                    <button
                      onClick={() => setShowAddShop(true)}
                      className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold active:scale-95 transition-all"
                      style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
                    >
                      + Add {search ? `"${search}"` : 'a Shop'}
                    </button>
                  </div>
                )}

                {!loading && filtered.length > 0 && (
                  <button
                    onClick={() => setShowAddShop(true)}
                    className="w-full mt-4 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
                  >
                    + Can't find your shop? Add it
                  </button>
                )}
              </>
            )}

            {/* ── DRINK MODE ── */}
            {mode === 'drink' && (
              <>
                {!search.trim() && (
                  <div className="text-center py-10">
                    <div className="text-4xl mb-3">☕</div>
                    <p className="text-stone-400 text-sm">Type a drink name to find where it's rated best</p>
                    <p className="text-stone-600 text-xs mt-1">e.g. "oat latte", "cold brew", "cortado"</p>
                  </div>
                )}

                {drinkLoading && (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
                  </div>
                )}

                {!drinkLoading &&
                  drinkResults.map((result, i) => (
                    <button
                      key={`${result.drink_name}-${result.shop.id}`}
                      onClick={() => handleDrinkSelect(result)}
                      className="w-full flex items-center gap-3 py-3.5 border-b text-left transition-colors active:opacity-70"
                      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                    >
                      {/* Rank badge */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={
                          i === 0
                            ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff' }
                            : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }
                        }
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold capitalize truncate">
                          {result.drink_name}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <MapPin size={10} className="text-stone-500 flex-shrink-0" />
                          <p className="text-stone-400 text-xs truncate">{result.shop.name}</p>
                          {result.distance_km !== null && (
                            <span className="text-stone-600 text-xs flex-shrink-0">
                              ·{' '}
                              {result.distance_km < 1
                                ? `${Math.round(result.distance_km * 1000)}m`
                                : `${result.distance_km.toFixed(1)}km`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-amber-400 text-sm font-bold">{Math.round(result.avg_rating)}%</p>
                        <p className="text-stone-500 text-xs">{result.rating_count} sip{result.rating_count !== 1 ? 's' : ''}</p>
                      </div>
                    </button>
                  ))}

                {showDrinkEmpty && (
                  <div className="text-center py-8">
                    <div className="text-3xl mb-3">🫗</div>
                    <p className="text-stone-300 text-sm font-semibold">No ratings for "{search}" yet</p>
                    <p className="text-stone-500 text-xs mt-1 mb-4">Be the first to rate it!</p>
                    <button
                      onClick={() => setMode('shop')}
                      className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
                      style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
                    >
                      Pick a shop to rate it →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showAddShop && (
        <AddShopForm
          initialName={search}
          onClose={() => setShowAddShop(false)}
          onShopCreated={handleShopCreated}
        />
      )}
    </>
  )
}
