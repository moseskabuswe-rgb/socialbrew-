import { useState, useEffect, useCallback } from 'react'
import { Search, MapPin, Star, CheckCircle, PlusCircle, X, RefreshCw, Globe, Phone, ChevronRight, ArrowLeft, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { CoffeeShop } from '../../lib/supabase'


import { fetchNearbyCoffeeShops, searchCoffeeShops } from '../../lib/places'

const VIBES = ['All', 'Cozy', 'Social', 'Quiet', 'Date Night', 'Work-friendly']

const FALLBACK_PHOTOS = [
  'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800',
  'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800',
  'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=800',
  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800',
]

function getPhoto(shop: Partial<CoffeeShop>, index: number) {
  return shop.photo_url || FALLBACK_PHOTOS[index % FALLBACK_PHOTOS.length]
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(km: number) {
  const miles = km * 0.621371
  if (miles < 0.1) return 'Nearby'
  if (miles < 10) return `${miles.toFixed(1)} mi`
  return `${Math.round(miles)} mi`
}


// Shop detail page
function ShopDetail({ shop, photo, onBack }: { shop: Partial<CoffeeShop>; photo: string; onBack: () => void }) {
  const [imgError, setImgError] = useState(false)
  const website = (shop as any).website
  const phone = (shop as any).phone
  const hours = (shop as any).hours
  const googleMapsUrl = shop.lat && shop.lng
    ? `https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((shop.name || '') + ' ' + (shop.address || ''))}`

  return (
    <div className="min-h-screen bg-cream-100 animate-fade-in">
      {/* Hero image */}
      <div className="relative h-64 bg-coffee-200">
        {!imgError ? (
          <img src={photo} alt={shop.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-coffee-200 to-coffee-300">
            <span className="text-7xl opacity-20">☕</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <button
          onClick={onBack}
          className="absolute top-4 left-4 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md"
        >
          <ArrowLeft size={18} className="text-coffee-800" />
        </button>
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-white font-display text-2xl font-bold leading-tight">{shop.name}</h1>
          {shop.address && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin size={12} className="text-white/80" />
              <p className="text-white/80 text-sm">{shop.address}{shop.city ? `, ${shop.city}` : ''}</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Stats row */}
        <div className="flex gap-3">
          {(shop.avg_rating ?? 0) > 0 && (
            <div className="flex-1 bg-white rounded-xl p-3 border border-cream-200 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Star size={14} className="text-caramel fill-caramel" />
                <span className="text-coffee-800 font-bold">{shop.avg_rating}</span>
              </div>
              <p className="text-coffee-400 text-xs">{shop.total_ratings} ratings</p>
            </div>
          )}
          {(shop.weekly_visits ?? 0) > 0 && (
            <div className="flex-1 bg-white rounded-xl p-3 border border-cream-200 text-center">
              <p className="text-coffee-800 font-bold">{shop.weekly_visits}</p>
              <p className="text-coffee-400 text-xs">this week</p>
            </div>
          )}
          {(shop as any).is_certified && (
            <div className="flex-1 bg-white rounded-xl p-3 border border-cream-200 text-center">
              <CheckCircle size={16} className="text-caramel mx-auto mb-0.5" />
              <p className="text-coffee-400 text-xs">Certified</p>
            </div>
          )}
        </div>

        {/* Vibes */}
        {(shop.vibes?.length ?? 0) > 0 && (
          <div>
            <p className="text-coffee-600 text-xs font-semibold uppercase tracking-wider mb-2">Vibes</p>
            <div className="flex flex-wrap gap-2">
              {shop.vibes!.map(v => (
                <span key={v} className="bg-white text-coffee-600 px-3 py-1 rounded-full text-sm border border-cream-200">{v}</span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {(shop as any).description && (
          <div>
            <p className="text-coffee-600 text-xs font-semibold uppercase tracking-wider mb-2">About</p>
            <p className="text-coffee-700 text-sm leading-relaxed">{(shop as any).description}</p>
          </div>
        )}

        {/* Hours */}
        {hours && (
          <div>
            <p className="text-coffee-600 text-xs font-semibold uppercase tracking-wider mb-2">Hours</p>
            <p className="text-coffee-700 text-sm">{hours}</p>
          </div>
        )}

        {/* Action links */}
        <div className="space-y-2">
          {website && (
            <a
              href={website.startsWith('http') ? website : `https://${website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-white rounded-xl p-4 border border-cream-200 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-caramel/10 rounded-xl flex items-center justify-center">
                  <Globe size={16} className="text-caramel" />
                </div>
                <div>
                  <p className="text-coffee-800 font-medium text-sm">Website</p>
                  <p className="text-coffee-400 text-xs truncate max-w-48">{website.replace(/^https?:\/\//, '')}</p>
                </div>
              </div>
              <ExternalLink size={14} className="text-coffee-400" />
            </a>
          )}

          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center justify-between bg-white rounded-xl p-4 border border-cream-200 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-caramel/10 rounded-xl flex items-center justify-center">
                  <Phone size={16} className="text-caramel" />
                </div>
                <div>
                  <p className="text-coffee-800 font-medium text-sm">Call</p>
                  <p className="text-coffee-400 text-xs">{phone}</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-coffee-400" />
            </a>
          )}

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between bg-white rounded-xl p-4 border border-cream-200 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-caramel/10 rounded-xl flex items-center justify-center">
                <MapPin size={16} className="text-caramel" />
              </div>
              <div>
                <p className="text-coffee-800 font-medium text-sm">Get Directions</p>
                <p className="text-coffee-400 text-xs">Open in Google Maps</p>
              </div>
            </div>
            <ExternalLink size={14} className="text-coffee-400" />
          </a>
        </div>
      </div>
    </div>
  )
}

export default function DiscoverTab() {
  const [dbShops, setDbShops] = useState<CoffeeShop[]>([])
  const [nearbyShops, setNearbyShops] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeVibe, setActiveVibe] = useState('All')
  const [loading, setLoading] = useState(true)
  const [loadingNearby, setLoadingNearby] = useState(false)
  const [userLat, setUserLat] = useState(40.5089)
  const [userLng, setUserLng] = useState(-88.9906)
  const [showSuggest, setShowSuggest] = useState(false)
  const [suggestName, setSuggestName] = useState('')
  const [suggestAddr, setSuggestAddr] = useState('')
  const [suggestSent, setSuggestSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedShop, setSelectedShop] = useState<{ shop: Partial<CoffeeShop>; photo: string } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 500)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('coffee_shops').select('*').eq('is_active', true)
        .order('weekly_visits', { ascending: false })
      if (data) setDbShops(data)
      setLoading(false)
    }
    load()
    navigator.geolocation?.getCurrentPosition(
      pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude) },
      () => {}
    )
  }, [])

  const loadNearby = useCallback(async (query?: string) => {
    setLoadingNearby(true)
    const shops = query
      ? await searchCoffeeShops(query, userLat, userLng)
      : await fetchNearbyCoffeeShops(userLat, userLng)
    setNearbyShops(shops)
    setLoadingNearby(false)
  }, [userLat, userLng])

  useEffect(() => { loadNearby() }, [userLat, userLng])

  useEffect(() => {
    if (debouncedSearch.trim().length >= 2) {
      loadNearby(debouncedSearch)
    } else if (debouncedSearch.trim().length === 0) {
      loadNearby()
    }
  }, [debouncedSearch])

  // Merge DB shops + nearby, dedupe, sort by proximity
  const allShops = [
    ...dbShops.map(s => ({ ...s, _fromDb: true })),
    ...nearbyShops.filter(n =>
      !dbShops.some(db => db.name.toLowerCase().trim() === (n.name || '').toLowerCase().trim())
    ).map(s => ({ ...s, _fromDb: false }))
  ]

  // Sort by distance if we have user location
  const shopsWithDistance = allShops.map(shop => ({
    ...shop,
    _distance: shop.lat && shop.lng ? distanceKm(userLat, userLng, shop.lat, shop.lng) : 999,
  }))

  const isSearching = search.trim().length >= 2

  const filtered = shopsWithDistance
    .filter(shop => {
      // When not searching: only show coffee shops (from DB = already filtered, nearby = cafe type)
      // When searching: show all results since user is specifically looking
      const matchVibe = isSearching || activeVibe === 'All' || shop.vibes?.includes(activeVibe)
      const matchSearch = !search.trim() ||
        shop.name?.toLowerCase().includes(search.toLowerCase()) ||
        (shop.address || '').toLowerCase().includes(search.toLowerCase()) ||
        (shop.city || '').toLowerCase().includes(search.toLowerCase())
      return matchVibe && matchSearch
    })
    .sort((a, b) => a._distance - b._distance)

  async function submitSuggestion() {
    if (!suggestName.trim()) return
    setSubmitting(true)
    await supabase.from('coffee_shops').insert({
      name: suggestName.trim(),
      address: suggestAddr.trim() || null,
      city: 'Unknown', state: 'IL',
      is_active: false,
      vibes: [], avg_rating: 0, total_ratings: 0, weekly_visits: 0
    })
    setSuggestSent(true)
    setSubmitting(false)
  }

  // Show shop detail page
  if (selectedShop) {
    return <ShopDetail shop={selectedShop.shop} photo={selectedShop.photo} onBack={() => setSelectedShop(null)} />
  }

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="sticky top-0 z-10 bg-cream-100/95 backdrop-blur-sm border-b border-cream-200 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-display text-2xl font-bold text-coffee-800">Discover</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowSuggest(true)}
              className="w-8 h-8 rounded-full bg-white border border-cream-200 flex items-center justify-center text-coffee-600 shadow-sm">
              <PlusCircle size={15} />
            </button>
            <button onClick={() => loadNearby(debouncedSearch || undefined)}
              className="w-8 h-8 rounded-full bg-white border border-cream-200 flex items-center justify-center text-coffee-600 shadow-sm">
              <RefreshCw size={14} className={loadingNearby ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="flex items-center bg-white rounded-xl px-4 py-2.5 border border-cream-200 shadow-sm mb-3">
          <Search size={15} className="text-coffee-400 mr-2.5" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isSearching ? "Searching all cafes & coffee shops..." : "Search coffee shops near you..."}
            className="flex-1 bg-transparent text-coffee-800 text-sm placeholder-coffee-400 focus:outline-none" />
          {search && <button onClick={() => setSearch('')} className="text-coffee-400 ml-2"><X size={14} /></button>}
        </div>

        {!isSearching && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {VIBES.map(vibe => (
              <button key={vibe} onClick={() => setActiveVibe(vibe)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${activeVibe === vibe ? 'bg-coffee-700 text-white shadow' : 'bg-white text-coffee-600 border border-cream-200'}`}>
                {vibe}
              </button>
            ))}
          </div>
        )}

        {isSearching && (
          <p className="text-coffee-400 text-xs px-1">
            Searching all cafes & coffee shops — no limits
          </p>
        )}
      </div>

      {/* Suggest modal */}
      {showSuggest && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(8,4,1,0.92)', backdropFilter: 'blur(10px)' }}>
          <div className="w-full max-w-sm bg-coffee-700 rounded-t-3xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-display text-lg font-bold">Suggest a Shop</h3>
              <button onClick={() => { setShowSuggest(false); setSuggestSent(false); setSuggestName(''); setSuggestAddr('') }}
                className="w-7 h-7 rounded-full bg-coffee-600 flex items-center justify-center text-coffee-300">
                <X size={14} />
              </button>
            </div>
            {suggestSent ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-3">✅</p>
                <p className="text-white font-display text-lg">Thanks!</p>
                <p className="text-coffee-300 text-sm mt-1">We'll review and add it shortly.</p>
                <button onClick={() => { setShowSuggest(false); setSuggestSent(false); setSuggestName(''); setSuggestAddr('') }}
                  className="mt-5 text-caramel text-sm font-medium">Close</button>
              </div>
            ) : (
              <>
                <p className="text-coffee-300 text-sm mb-4">Can't find a shop? Tell us and we'll add it.</p>
                <div className="space-y-3 mb-5">
                  <input value={suggestName} onChange={e => setSuggestName(e.target.value)}
                    placeholder="Shop name"
                    className="w-full bg-coffee-800 text-white rounded-xl px-4 py-3 text-sm border border-coffee-600 focus:border-caramel focus:outline-none placeholder-coffee-400" />
                  <input value={suggestAddr} onChange={e => setSuggestAddr(e.target.value)}
                    placeholder="Address (optional)"
                    className="w-full bg-coffee-800 text-white rounded-xl px-4 py-3 text-sm border border-coffee-600 focus:border-caramel focus:outline-none placeholder-coffee-400" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowSuggest(false)}
                    className="flex-1 py-3 rounded-xl border border-coffee-500 text-coffee-300 text-sm">Cancel</button>
                  <button onClick={submitSuggestion} disabled={!suggestName.trim() || submitting}
                    className="flex-1 py-3 rounded-xl bg-caramel text-white font-semibold text-sm disabled:opacity-40">
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="p-4 pb-28 space-y-4">
        {(loading || (loadingNearby && filtered.length === 0)) && (
          <div className="flex flex-col items-center py-12 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
            <p className="text-coffee-400 text-sm">
              {isSearching ? `Searching for "${search}"...` : 'Finding coffee shops near you...'}
            </p>
          </div>
        )}

        {!loading && !loadingNearby && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">☕</p>
            <p className="text-coffee-700 font-display text-xl">No shops found</p>
            <p className="text-coffee-400 text-sm mt-1">Try a different search or suggest one</p>
            <button onClick={() => setShowSuggest(true)} className="mt-3 text-caramel text-sm underline">
              Suggest a shop →
            </button>
          </div>
        )}

        {filtered.map((shop, i) => {
          const photo = getPhoto(shop, i)
          return (
            <ShopCard
              key={shop.id || i}
              shop={shop}
              photo={photo}
              index={i}
              distance={shop._distance < 900 ? formatDistance(shop._distance) : undefined}
              onTap={() => setSelectedShop({ shop, photo })}
            />
          )
        })}

        {filtered.length > 0 && (
          <div className="text-center pt-2">
            <p className="text-coffee-400 text-xs">
              {isSearching ? 'Showing all cafes & coffee shops' : 'Sorted by proximity · Independent coffee shops'}
            </p>
            <button onClick={() => setShowSuggest(true)} className="text-caramel text-xs underline mt-1 block">
              Missing a shop? Suggest it →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ShopCard({
  shop, photo, index, distance, onTap
}: {
  shop: Partial<CoffeeShop> & { _fromDb?: boolean }
  photo: string
  index: number
  distance?: string
  onTap: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const isInDb = (shop as any)._fromDb

  return (
    <button
      onClick={onTap}
      className="w-full text-left bg-white rounded-2xl overflow-hidden shadow-sm border border-cream-200 animate-fade-in active:scale-98 transition-transform"
      style={{ animationDelay: `${Math.min(index * 0.04, 0.4)}s` }}
    >
      <div className="relative h-44 bg-coffee-200 overflow-hidden">
        {!imgError ? (
          <img src={photo} alt={shop.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-coffee-200 to-coffee-300">
            <span className="text-5xl opacity-30">☕</span>
          </div>
        )}
        {isInDb && shop.is_certified && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 shadow">
            <CheckCircle size={11} className="text-caramel" />
            <span className="text-coffee-700 text-xs font-semibold">Certified</span>
          </div>
        )}
        {distance && (
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 shadow">
            <MapPin size={10} className="text-coffee-500" />
            <span className="text-coffee-700 text-xs font-semibold">{distance}</span>
          </div>
        )}
        {(shop.avg_rating ?? 0) > 0 && (
          <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 shadow">
            <Star size={11} className="text-caramel fill-caramel" />
            <span className="text-coffee-800 text-xs font-bold">{shop.avg_rating}</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-coffee-800 font-display font-bold text-lg leading-tight">{shop.name}</h3>
          <ChevronRight size={16} className="text-coffee-400 mt-1 flex-shrink-0" />
        </div>
        {shop.address && (
          <div className="flex items-center gap-1 mb-2 mt-0.5">
            <MapPin size={12} className="text-coffee-400 flex-shrink-0" />
            <p className="text-coffee-400 text-xs truncate">{shop.address}</p>
          </div>
        )}
        {(shop.vibes?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {shop.vibes!.map(v => (
              <span key={v} className="bg-cream-100 text-coffee-600 px-2 py-0.5 rounded-full text-xs border border-cream-200">{v}</span>
            ))}
          </div>
        )}
        <div className="pt-2 border-t border-cream-100">
          {isInDb && (shop.total_ratings ?? 0) > 0 ? (
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-coffee-800 font-bold text-sm">{shop.total_ratings}</p>
                <p className="text-coffee-400 text-xs">Ratings</p>
              </div>
              <div className="text-center">
                <p className="text-coffee-800 font-bold text-sm">{shop.weekly_visits}</p>
                <p className="text-coffee-400 text-xs">This Week</p>
              </div>
            </div>
          ) : (
            <p className="text-coffee-400 text-xs">Be the first to rate this shop ☕</p>
          )}
        </div>
      </div>
    </button>
  )
}
