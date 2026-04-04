import { useState, useEffect, useCallback } from 'react'
import { Search, X, MapPin, CheckCircle, Star } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fetchNearbyCoffeeShops, searchCoffeeShops } from '../../lib/places'
import type { CoffeeShop } from '../../lib/supabase'
import type { PlaceShop } from '../../lib/places'

type AnyShop = (Partial<CoffeeShop> & { _fromDb?: boolean }) | PlaceShop

type Props = {
  onSelect: (shop: CoffeeShop) => void
  onClose: () => void
}

export default function ShopSelector({ onSelect, onClose }: Props) {
  const [dbShops, setDbShops] = useState<CoffeeShop[]>([])
  const [nearbyShops, setNearbyShops] = useState<PlaceShop[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loadingDb, setLoadingDb] = useState(true)
  const [loadingNearby, setLoadingNearby] = useState(false)
  const [userLat, setUserLat] = useState(40.5089)
  const [userLng, setUserLng] = useState(-88.9906)
  const [locationReady, setLocationReady] = useState(false)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  // Get location
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setLocationReady(true) },
      () => setLocationReady(true)
    )
  }, [])

  // Load DB shops
  useEffect(() => {
    supabase.from('coffee_shops').select('*').eq('is_active', true)
      .order('weekly_visits', { ascending: false })
      .then(({ data }) => { if (data) setDbShops(data); setLoadingDb(false) })
  }, [])

  // Load nearby once location ready
  const loadNearby = useCallback(async () => {
    setLoadingNearby(true)
    const shops = await fetchNearbyCoffeeShops(userLat, userLng)
    setNearbyShops(shops)
    setLoadingNearby(false)
  }, [userLat, userLng])

  useEffect(() => { if (locationReady) loadNearby() }, [locationReady, loadNearby])

  // Search when user types
  useEffect(() => {
    if (debouncedSearch.trim().length < 2) {
      if (debouncedSearch.trim().length === 0) loadNearby()
      return
    }
    setLoadingNearby(true)
    searchCoffeeShops(debouncedSearch, userLat, userLng).then(shops => {
      setNearbyShops(shops)
      setLoadingNearby(false)
    })
  }, [debouncedSearch, userLat, userLng])

  // Merge: DB first, then nearby not already in DB
  const merged: AnyShop[] = [
    ...dbShops.map(s => ({ ...s, _fromDb: true })),
    ...nearbyShops.filter(n =>
      !dbShops.some(db => db.name.toLowerCase().trim() === n.name.toLowerCase().trim())
    ),
  ]

  const displayed = search.trim()
    ? merged.filter(s =>
        (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
        ((s as any).address || '').toLowerCase().includes(search.toLowerCase()) ||
        ((s as any).city || '').toLowerCase().includes(search.toLowerCase())
      )
    : merged

  function handleSelect(shop: AnyShop) {
    const coffeeShop: CoffeeShop = {
      id: (shop as any).id || `gpl-${Date.now()}`,
      name: shop.name || 'Unknown Shop',
      address: (shop as any).address || '',
      city: (shop as any).city || '',
      state: (shop as any).state || '',
      lat: (shop as any).lat || 0,
      lng: (shop as any).lng || 0,
      photo_url: (shop as any).photo_url || null,
      description: null,
      vibes: (shop as any).vibes || [],
      avg_rating: (shop as any).avg_rating || 0,
      total_ratings: (shop as any).total_ratings || 0,
      weekly_visits: (shop as any).weekly_visits || 0,
      is_certified: false,
    }
    onSelect(coffeeShop)
  }

  const isLoading = loadingDb || loadingNearby

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(13,9,4,0.92)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm bg-coffee-700 rounded-t-3xl animate-slide-up"
        style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3 flex-shrink-0">
          <div>
            <h2 className="text-white font-display text-xl font-bold">Which shop?</h2>
            <p className="text-coffee-400 text-xs mt-0.5">
              {loadingNearby ? 'Finding shops near you...' : `${displayed.length} shops found`}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-coffee-600 flex items-center justify-center text-coffee-300">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 mb-3 flex-shrink-0">
          <div className="flex items-center bg-coffee-800 rounded-xl px-4 py-3 border border-coffee-600 focus-within:border-caramel transition-colors">
            <Search size={16} className="text-coffee-400 mr-3 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search any coffee shop..."
              autoFocus
              className="flex-1 bg-transparent text-white text-sm placeholder-coffee-400 focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-coffee-400 ml-2"><X size={14} /></button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto px-5 pb-8 flex-1">
          {isLoading && displayed.length === 0 && (
            <div className="flex flex-col items-center py-10 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
              <p className="text-coffee-400 text-sm">Finding coffee shops near you...</p>
            </div>
          )}

          {!isLoading && displayed.length === 0 && (
            <div className="text-center py-10">
              <p className="text-4xl mb-3">☕</p>
              <p className="text-coffee-300 font-semibold">No shops found</p>
              <p className="text-coffee-500 text-xs mt-1">Try a different search term</p>
            </div>
          )}

          {displayed.map((shop, i) => (
            <button key={(shop as any).id || i}
              onClick={() => handleSelect(shop)}
              className="w-full text-left flex items-center gap-4 py-3 border-b border-coffee-600/40 hover:bg-coffee-600/30 rounded-xl px-2 transition-colors active:bg-coffee-600/50">
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-coffee-800 flex items-center justify-center">
                {(shop as any).photo_url
                  ? <img src={(shop as any).photo_url} alt={shop.name || ''} className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  : <span className="text-2xl opacity-40">☕</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-white font-semibold text-sm truncate">{shop.name}</p>
                  {(shop as any)._fromDb && (shop as any).is_certified && (
                    <CheckCircle size={12} className="text-caramel flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin size={10} className="text-coffee-400" />
                  <p className="text-coffee-400 text-xs truncate">
                    {(shop as any).address || ''}{(shop as any).city ? `, ${(shop as any).city}` : ''}
                  </p>
                </div>
                {((shop as any).avg_rating || 0) > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star size={10} className="text-caramel fill-caramel" />
                    <span className="text-caramel text-xs">{(shop as any).avg_rating}</span>
                    {((shop as any).total_ratings || 0) > 0 && (
                      <span className="text-coffee-500 text-xs">· {(shop as any).total_ratings}</span>
                    )}
                  </div>
                )}
              </div>
            </button>
          ))}

          {loadingNearby && displayed.length > 0 && (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


