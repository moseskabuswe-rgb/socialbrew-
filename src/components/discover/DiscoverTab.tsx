import { useState, useEffect, useCallback } from 'react'
import { Search, MapPin, Star, CheckCircle, PlusCircle, X, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { CoffeeShop } from '../../lib/supabase'
import { trackEvent } from '../../lib/analytics'

const VIBES = ['All', 'Cozy', 'Social', 'Quiet', 'Date Night', 'Work-friendly']

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function fetchNearbyShops(lat: number, lng: number, query?: string): Promise<Partial<CoffeeShop>[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/places`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify({ lat, lng, query }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.shops || []
  } catch {
    return []
  }
}

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

export default function DiscoverTab() {
  const [dbShops, setDbShops] = useState<CoffeeShop[]>([])
  const [nearbyShops, setNearbyShops] = useState<Partial<CoffeeShop>[]>([])
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

  // Debounce search
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
    const shops = await fetchNearbyShops(userLat, userLng, query)
    setNearbyShops(shops)
    setLoadingNearby(false)
  }, [userLat, userLng])

  useEffect(() => { loadNearby() }, [userLat, userLng])

  // When search changes, query Google for that specific shop
  useEffect(() => {
    if (debouncedSearch.trim().length >= 2) {
      loadNearby(debouncedSearch)
    } else if (debouncedSearch.trim().length === 0) {
      loadNearby()
    }
  }, [debouncedSearch])

  const allShops = [
    ...dbShops,
    ...nearbyShops.filter(n =>
      !dbShops.some(db => db.name.toLowerCase().trim() === (n.name || '').toLowerCase().trim())
    )
  ]

  const filtered = allShops.filter(shop => {
    const matchVibe = activeVibe === 'All' || shop.vibes?.includes(activeVibe)
    const matchSearch = !search.trim() ||
      shop.name?.toLowerCase().includes(search.toLowerCase()) ||
      (shop.address || '').toLowerCase().includes(search.toLowerCase())
    return matchVibe && matchSearch
  })

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
    trackEvent('shop_suggested', { name: suggestName })
    setSuggestSent(true)
    setSubmitting(false)
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
            placeholder="Search any coffee shop in the US..."
            className="flex-1 bg-transparent text-coffee-800 text-sm placeholder-coffee-400 focus:outline-none" />
          {search && <button onClick={() => setSearch('')} className="text-coffee-400 ml-2"><X size={14} /></button>}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {VIBES.map(vibe => (
            <button key={vibe} onClick={() => setActiveVibe(vibe)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${activeVibe === vibe ? 'bg-coffee-700 text-white shadow' : 'bg-white text-coffee-600 border border-cream-200'}`}>
              {vibe}
            </button>
          ))}
        </div>
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
              {search ? `Searching for "${search}"...` : 'Finding coffee shops near you...'}
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

        {filtered.map((shop, i) => (
          <ShopCard key={shop.id || i} shop={shop} photo={getPhoto(shop, i)} index={i} />
        ))}

        {filtered.length > 0 && (
          <div className="text-center pt-2">
            <p className="text-coffee-400 text-xs">Independent coffee shops · No chains</p>
            <button onClick={() => setShowSuggest(true)} className="text-caramel text-xs underline mt-1 block">
              Missing a shop? Suggest it →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ShopCard({ shop, photo, index }: { shop: Partial<CoffeeShop>; photo: string; index: number }) {
  const [imgError, setImgError] = useState(false)
  const isInDb = !String(shop.id).startsWith('gpl-')

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-cream-200 animate-fade-in"
      style={{ animationDelay: `${Math.min(index * 0.04, 0.4)}s` }}>
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
        {(shop.avg_rating ?? 0) > 0 && (
          <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 shadow">
            <Star size={11} className="text-caramel fill-caramel" />
            <span className="text-coffee-800 text-xs font-bold">{shop.avg_rating}</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-coffee-800 font-display font-bold text-lg leading-tight mb-1">{shop.name}</h3>
        {shop.address && (
          <div className="flex items-center gap-1 mb-2">
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
    </div>
  )
}
