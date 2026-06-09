import { useState, useEffect, useCallback, useRef } from 'react'
import AddShopForm from '../shared/AddShopForm'
import DrinkSearchTab from './DrinkSearchTab'
import { Search, MapPin, CheckCircle, X, RefreshCw, Coffee, Zap, Heart, Users, UserPlus, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { CoffeeShop } from '../../lib/supabase'
import { notifyFollow } from '../../lib/push'
import { useAuth } from '../../contexts/AuthContext'
import { isAffiliatedWithShop } from '../../lib/shopAffiliation'
import ShopDetailPage from '../shared/ShopDetailPage'
import UserProfilePage from '../shared/UserProfilePage'
import VerifiedBadge from '../shared/VerifiedBadge'

const VIBES = ['All', 'Cozy', 'Social', 'Quiet', 'Date Night', 'Work-friendly']

const CHAINS = [
  'starbucks', 'dunkin', 'dutch bros', "peet's", 'caribou', 'tim hortons',
  "mcdonald's", 'mcdonalds', 'panera', 'einstein', 'biggby', "scooter's",
  'costa coffee', 'burger king', 'wendys', 'subway', 'chick-fil-a',
  'taco bell', 'chipotle', 'qdoba', 'culvers', 'dominos', 'pizza hut',
  'dairy queen', 'little caesars', 'popeyes', 'raising canes',
]

const NON_COFFEE_CUISINES = [
  'pizza', 'burger', 'sushi', 'mexican', 'italian', 'thai', 'indian',
  'sandwich', 'bbq', 'seafood', 'chinese', 'japanese', 'greek', 'american',
  'korean', 'vietnamese', 'french', 'mediterranean', 'turkish', 'kebab',
]

function isChain(name: string) {
  return CHAINS.some(c => name.toLowerCase().includes(c))
}

function isNonCoffee(tags: any) {
  const cuisine = (tags?.cuisine || '').toLowerCase()
  return NON_COFFEE_CUISINES.some(c => cuisine.includes(c))
}

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

async function fetchNearby(lat: number, lng: number): Promise<Partial<CoffeeShop>[]> {
  const query = `
[out:json][timeout:30];
(
  node["amenity"="cafe"]["cuisine"~"coffee|espresso|cappuccino",i](around:20000,${lat},${lng});
  node["amenity"="cafe"]["name"~"coffee|cafe|café|brew|roast|espresso|bean|beanery|latte|mocha|barista|roastery|grind|grounds|drip|sip",i](around:20000,${lat},${lng});
  node["shop"="coffee"](around:20000,${lat},${lng});
);
out body;`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST', body: query, signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return []
    const json = await res.json()
    const seen = new Set<string>()
    return (json.elements || [])
      .filter((el: any) => {
        const name = el.tags?.name || ''
        if (!name) return false
        if (isChain(name)) return false
        if (isNonCoffee(el.tags)) return false
        if (seen.has(name.toLowerCase())) return false
        seen.add(name.toLowerCase())
        return true
      })
      .map((el: any) => ({
        id: `osm-${el.id}`,
        name: el.tags.name,
        address: [el.tags['addr:housenumber'], el.tags['addr:street']].filter(Boolean).join(' ') || null,
        city: el.tags['addr:city'] || null,
        state: el.tags['addr:state'] || null,
        lat: el.lat, lng: el.lon,
        photo_url: null, vibes: [], avg_rating: 0, total_ratings: 0,
        weekly_visits: 0, is_certified: false,
        website: el.tags['website'] || el.tags['contact:website'] || null,
        opening_hours: el.tags['opening_hours'] || null,
      }))
  } catch (err) {
    console.error('OSM fetch error:', err)
    return []
  }
}

async function searchAnywhere(query: string, lat?: number | null, lng?: number | null): Promise<Partial<CoffeeShop>[]> {
  try {
    const encoded = encodeURIComponent(query)
    const viewboxParam = lat && lng
      ? `&viewbox=${lng - 1},${lat + 1},${lng + 1},${lat - 1}&bounded=0`
      : ''
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=15&addressdetails=1&extratags=1${viewboxParam}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SocialBrew/1.0 (social coffee app)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const results = await res.json()
    const coffeeTypes = ['cafe', 'coffee', 'coffee_shop', 'espresso']
    return (results || [])
      .filter((r: any) => {
        const type = (r.type || '').toLowerCase()
        const cls = (r.class || '').toLowerCase()
        const name = (r.display_name || '').toLowerCase()
        return coffeeTypes.includes(type) || cls === 'amenity' ||
          name.includes('coffee') || name.includes('cafe') ||
          name.includes('café') || name.includes('brew') || name.includes('roast')
      })
      .filter((r: any) => !isChain(r.display_name || ''))
      .map((r: any) => {
        const addr = r.address || {}
        const name = r.name || r.display_name?.split(',')[0] || query
        return {
          id: `osm-${r.osm_id}`,
          name,
          address: [addr.house_number, addr.road].filter(Boolean).join(' ') || null,
          city: addr.city || addr.town || addr.village || null,
          state: addr.state || null,
          lat: parseFloat(r.lat), lng: parseFloat(r.lon),
          photo_url: null, vibes: [], avg_rating: 0, total_ratings: 0,
          weekly_visits: 0, is_certified: false,
          website: r.extratags?.website || null,
          opening_hours: r.extratags?.opening_hours || null,
          country: addr.country || null,
        }
      })
  } catch { return [] }
}

const FALLBACK_PHOTOS = [
  'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800',
  'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800',
  'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=800',
  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800',
]

function formatLocation(city?: string | null, state?: string | null, country?: string | null): string {
  const c = city?.trim(), s = state?.trim(), co = country?.trim()
  if (!c) return s || co || ''
  if (s && (!co || co === 'United States')) return `${c}, ${s}`
  if (co && co !== 'United States') return `${c}, ${co}`
  return c
}

type SearchMode = 'shop' | 'drink' | 'friends'

export default function DiscoverTab({ onNavigateToBrew }: { onNavigateToBrew?: (shop: any) => void }) {
  const { profile } = useAuth()
  const [dbShops, setDbShops] = useState<CoffeeShop[]>([])
  const [nearbyShops, setNearbyShops] = useState<Partial<CoffeeShop>[]>([])
  const [searchResults, setSearchResults] = useState<Partial<CoffeeShop>[]>([])
  const [search, setSearch] = useState('')
  const [activeVibe, setActiveVibe] = useState('All')
  const [loading, setLoading] = useState(true)
  const [loadingNearby, setLoadingNearby] = useState(false)
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [locationDenied, setLocationDenied] = useState(false)
  const [selectedShop, setSelectedShop] = useState<any>(null)
  const [showSuggest, setShowSuggest] = useState(false)
  const [showAddShop, setShowAddShop] = useState(false)
  const [suggestName, setSuggestName] = useState('')
  const [suggestAddr, setSuggestAddr] = useState('')
  const [suggestSent, setSuggestSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [searchMode, setSearchMode] = useState<SearchMode>('shop')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [friendQuery, setFriendQuery] = useState('')
  const [friendResults, setFriendResults] = useState<any[]>([])
  const [friendFollowing, setFriendFollowing] = useState<Set<string>>(new Set())
  const [friendSearching, setFriendSearching] = useState(false)
  const friendDebounce = useRef<any>(null)
  const searchDebounce = useRef<any>(null)
  const [followedShopIds, setFollowedShopIds] = useState<Set<string>>(new Set())
  const [followLoading, setFollowLoading] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.id) {
      supabase.from('shop_follows').select('shop_id').eq('user_id', profile.id)
        .then(({ data }) => {
          if (data) setFollowedShopIds(new Set(data.map((r: any) => r.shop_id)))
        })
    }
  }, [profile?.id])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('coffee_shops').select('*').eq('is_active', true)
        .order('total_ratings', { ascending: false }).limit(100)
      if (data) setDbShops(data)
      setLoading(false)
    }
    load()
    getLocation()
  }, [])

  function getLocation() {
    setLocating(true)
    navigator.geolocation?.getCurrentPosition(
      pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setLocating(false) },
      () => { setLocating(false); setLocationDenied(true) },
      { timeout: 8000, maximumAge: 300000 }
    )
  }

  const loadNearby = useCallback(async (lat: number, lng: number) => {
    setLoadingNearby(true)
    const shops = await fetchNearby(lat, lng)
    setNearbyShops(shops)
    setLoadingNearby(false)
  }, [])

  useEffect(() => {
    if (userLat && userLng) loadNearby(userLat, userLng)
  }, [userLat, userLng, loadNearby])

  useEffect(() => {
    if (friendDebounce.current) clearTimeout(friendDebounce.current)
    if (friendQuery.trim().length < 2) { setFriendResults([]); return }
    friendDebounce.current = setTimeout(async () => {
      setFriendSearching(true)
      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, badge')
        .or(`username.ilike.%${friendQuery.trim()}%,full_name.ilike.%${friendQuery.trim()}%`)
        .neq('id', profile?.id || '')
        .eq('is_portal_only', false)
        .limit(20)
      setFriendResults(data || [])
      setFriendSearching(false)
    }, 350)
  }, [friendQuery, profile?.id])

  useEffect(() => {
    if (!profile || searchMode !== 'friends') return
    supabase.from('follows')
      .select('following_id, status')
      .eq('follower_id', profile.id)
      .then(({ data }) => {
        if (data) setFriendFollowing(new Set(data.filter((f: any) => f.status === 'accepted').map((f: any) => f.following_id)))
      })
  }, [profile, searchMode])

  async function toggleFriendFollow(userId: string) {
    if (!profile) return
    if (friendFollowing.has(userId)) {
      await supabase.from('follows').delete().eq('follower_id', profile.id).eq('following_id', userId)
      setFriendFollowing(prev => { const n = new Set(prev); n.delete(userId); return n })
    } else {
      await supabase.from('follows').insert({ follower_id: profile.id, following_id: userId, status: 'pending' })
      await supabase.from('notifications').insert({ user_id: userId, actor_id: profile.id, type: 'follow_request' })
      notifyFollow(userId, profile.username || 'Someone')
      setFriendFollowing(prev => new Set([...prev, userId]))
    }
  }

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    if (!search.trim() || search.trim().length < 2) { setSearchResults([]); return }
    searchDebounce.current = setTimeout(async () => {
      setSearching(true)
      setActiveVibe('All')
      const q = search.trim()
      const { data: byName } = await supabase.from('coffee_shops').select('*').eq('is_active', true).ilike('name', `%${q}%`).limit(10)
      const { data: byCity } = await supabase.from('coffee_shops').select('*').eq('is_active', true).ilike('city', `%${q}%`).limit(10)
      const { data: byState } = await supabase.from('coffee_shops').select('*').eq('is_active', true).ilike('state', `%${q}%`).limit(10)
      const seen = new Set<string>()
      const dbRes: any[] = []
      for (const shop of [...(byName || []), ...(byCity || []), ...(byState || [])]) {
        if (!seen.has(shop.id)) { seen.add(shop.id); dbRes.push(shop) }
      }
      const osmData = await searchAnywhere(q, userLat, userLng)
      setSearchResults([
        ...dbRes,
        ...osmData.filter(o => !dbRes.some(d => d.name.toLowerCase() === (o.name || '').toLowerCase()))
      ])
      setSearching(false)
    }, 600)
  }, [search])

  const isSearching = search.trim().length >= 2

  const allShops = isSearching
    ? [...searchResults].sort((a, b) => {
        if (!userLat || !userLng) return 0
        const dA = a.lat && a.lng ? distanceMiles(userLat, userLng, a.lat, a.lng) : 9999
        const dB = b.lat && b.lng ? distanceMiles(userLat, userLng, b.lat, b.lng) : 9999
        return dA - dB
      })
    : [
        ...dbShops,
        ...nearbyShops.filter(n => !dbShops.some(db => db.name.toLowerCase().trim() === (n.name || '').toLowerCase().trim())),
      ].sort((a, b) => {
        if (!userLat || !userLng) return 0
        const dA = a.lat && a.lng ? distanceMiles(userLat, userLng, a.lat, a.lng) : 9999
        const dB = b.lat && b.lng ? distanceMiles(userLat, userLng, b.lat, b.lng) : 9999
        const aClose = dA < 100, bClose = dB < 100
        if (aClose && !bClose) return -1
        if (!aClose && bClose) return 1
        return dA - dB
      })

  const filtered = activeVibe === 'All' ? allShops : allShops.filter(s => s.vibes?.includes(activeVibe))

  async function submitSuggestion() {
    if (!suggestName.trim()) return
    setSubmitting(true)
    await supabase.from('coffee_shops').insert({
      name: suggestName.trim(), address: suggestAddr.trim() || null,
      city: null, state: null, lat: userLat, lng: userLng,
      is_active: false, is_certified: false,
      vibes: [], avg_rating: 0, total_ratings: 0, weekly_visits: 0,
    })
    setSuggestSent(true)
    setSubmitting(false)
  }

  async function toggleFollowShop(e: React.MouseEvent, shopId: string) {
    e.stopPropagation()
    if (!profile?.id || followLoading) return
    if (isAffiliatedWithShop(profile, shopId)) return
    setFollowLoading(shopId)
    if (followedShopIds.has(shopId)) {
      await supabase.from('shop_follows').delete().eq('user_id', profile.id).eq('shop_id', shopId)
      setFollowedShopIds(prev => { const s = new Set(prev); s.delete(shopId); return s })
    } else {
      await supabase.from('shop_follows').upsert(
        { user_id: profile.id, shop_id: shopId },
        { onConflict: 'user_id,shop_id' }
      )
      setFollowedShopIds(prev => new Set([...prev, shopId]))
    }
    setFollowLoading(null)
  }

  const isLoading = locating || loading || (loadingNearby && !isSearching && filtered.length === 0)

  return (
    <div className="min-h-screen bg-cream-100">
      {/* ── STICKY HEADER ── */}
      <div className="sticky top-0 z-10 bg-cream-100 border-b border-cream-200 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-display text-2xl font-bold text-coffee-800">Discover</h1>
          {searchMode === 'shop' && (
            <button
              onClick={() => userLat && userLng && loadNearby(userLat, userLng)}
              className="w-8 h-8 rounded-full bg-white border border-cream-200 flex items-center justify-center text-coffee-500 shadow-sm"
            >
              <RefreshCw size={14} className={loadingNearby ? 'animate-spin' : ''} />
            </button>
          )}
        </div>

        {/* Shop / Drink toggle */}
        <div
          className="flex rounded-xl p-1 mb-3 gap-1"
          style={{ background: 'rgba(139,90,43,0.08)' }}
        >
          <button
            onClick={() => setSearchMode('shop')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
            style={searchMode === 'shop'
              ? { background: '#fff', color: '#92400e', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
              : { color: '#a87850' }
            }
          >
            <Coffee size={13} />
            Shops
          </button>
          <button
            onClick={() => setSearchMode('drink')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
            style={searchMode === 'drink'
              ? { background: '#fff', color: '#92400e', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
              : { color: '#a87850' }
            }
          >
            <Zap size={13} />
            By Drink
          </button>
          <button
            onClick={() => setSearchMode('friends')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
            style={searchMode === 'friends'
              ? { background: '#fff', color: '#92400e', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
              : { color: '#a87850' }
            }
          >
            <Users size={13} />
            Friends
          </button>
        </div>

        {/* Shop search input — only in shop mode */}
        {searchMode === 'shop' && (
          <>
            <div className="flex items-center bg-white rounded-xl px-4 py-2.5 border border-cream-200 shadow-sm mb-3">
              <Search size={15} className="text-coffee-400 mr-2.5 flex-shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search any coffee shop..."
                className="flex-1 bg-transparent text-coffee-800 text-sm placeholder-coffee-300 focus:outline-none"
              />
              {search
                ? <button onClick={() => setSearch('')} className="text-coffee-400 ml-2"><X size={14} /></button>
                : searching && <div className="w-4 h-4 rounded-full border-2 border-caramel border-t-transparent animate-spin ml-2" />
              }
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {VIBES.map(vibe => (
                <button key={vibe} onClick={() => setActiveVibe(vibe)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeVibe === vibe ? 'bg-coffee-700 text-white shadow' : 'bg-white text-coffee-600 border border-cream-200'
                  }`}>
                  {vibe}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── FRIENDS MODE ── */}
      {searchMode === 'friends' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-3 bg-white border-b border-cream-100 flex-shrink-0">
            <div className="flex items-center bg-cream-50 rounded-xl px-3 py-2.5 border border-cream-200 gap-2">
              <Search size={15} className="text-coffee-400 flex-shrink-0" />
              <input
                value={friendQuery}
                onChange={e => setFriendQuery(e.target.value)}
                placeholder="Search by username or name..."
                className="flex-1 bg-transparent text-coffee-800 text-sm placeholder-coffee-300 focus:outline-none"
                autoFocus
              />
              {friendSearching && (
                <div className="w-4 h-4 rounded-full border-2 border-caramel border-t-transparent animate-spin flex-shrink-0" />
              )}
              {friendQuery && !friendSearching && (
                <button onClick={() => { setFriendQuery(''); setFriendResults([]) }}>
                  <X size={14} className="text-coffee-400" />
                </button>
              )}
            </div>
          </div>

          {!friendQuery.trim() && (
            <div className="flex flex-col items-center py-16 px-8 text-center">
              <div className="text-5xl mb-4">👥</div>
              <p className="text-coffee-700 font-display font-bold text-lg">Find your people</p>
              <p className="text-coffee-400 text-sm mt-2">Search by username or full name to find friends on Social Brew</p>
            </div>
          )}

          {friendQuery.trim().length >= 2 && !friendSearching && friendResults.length === 0 && (
            <div className="flex flex-col items-center py-12 px-8 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-coffee-700 font-semibold">No users found</p>
              <p className="text-coffee-400 text-sm mt-1">Try a different username or name</p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {friendResults.map(u => {
              const isFollowing = friendFollowing.has(u.id)
              return (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-cream-100 bg-white">
                  <button onClick={() => setSelectedUser(u.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center bg-caramel">
                            <span className="text-white font-bold text-sm">{u.username?.[0]?.toUpperCase()}</span>
                          </div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-coffee-800 font-semibold text-sm">@{u.username}</p>
                      {u.full_name && <p className="text-coffee-400 text-xs truncate">{u.full_name}</p>}
                      {u.badge && <p className="text-caramel text-xs mt-0.5">{u.badge}</p>}
                    </div>
                  </button>
                  <button
                    onClick={() => toggleFriendFollow(u.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 flex-shrink-0"
                    style={isFollowing
                      ? { background: '#f0e8df', color: '#9b7a55', border: '1px solid #e8d4b0' }
                      : { background: 'linear-gradient(135deg, #c8853a, #9b5e1a)', color: '#fff' }
                    }
                  >
                    {isFollowing
                      ? <><Check size={11} /> Following</>
                      : <><UserPlus size={11} /> Follow</>
                    }
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── DRINK MODE ── */}
      {searchMode === 'drink' && (
        <DrinkSearchTab
          userLat={userLat}
          userLng={userLng}
          onShopSelect={setSelectedShop}
        />
      )}

      {/* ── SHOP MODE ── */}
      {searchMode === 'shop' && (
        <>
          {/* Modals */}
          {showAddShop && (
            <AddShopForm
              initialName={search}
              onClose={() => setShowAddShop(false)}
              onShopCreated={(shop) => { setShowAddShop(false); setSearch(''); setSelectedShop(shop) }}
            />
          )}
          {showSuggest && (
            <div className="fixed inset-0 z-50 flex items-end justify-center"
              style={{ background: 'rgba(8,4,1,0.92)', backdropFilter: 'blur(10px)' }}>
              <div className="w-full max-w-sm bg-coffee-700 rounded-t-3xl p-6 animate-slide-up">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-display text-lg font-bold">Missing a Shop?</h3>
                  <button onClick={() => { setShowSuggest(false); setSuggestSent(false); setSuggestName(''); setSuggestAddr('') }}
                    className="w-7 h-7 rounded-full bg-coffee-600 flex items-center justify-center text-cream-200">
                    <X size={14} />
                  </button>
                </div>
                {suggestSent ? (
                  <div className="text-center py-8">
                    <p className="text-3xl mb-3">✅</p>
                    <p className="text-white font-display text-lg">Got it!</p>
                    <p className="text-cream-200 text-sm mt-1">We'll add it shortly.</p>
                    <button onClick={() => { setShowSuggest(false); setSuggestSent(false); setSuggestName(''); setSuggestAddr('') }}
                      className="mt-5 text-caramel text-sm font-medium">Close</button>
                  </div>
                ) : (
                  <>
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
                        className="flex-1 py-3 rounded-xl border border-coffee-500 text-cream-200 text-sm">Cancel</button>
                      <button onClick={submitSuggestion} disabled={!suggestName.trim() || submitting}
                        className="flex-1 py-3 rounded-xl bg-caramel text-white font-semibold text-sm disabled:opacity-40">
                        {submitting ? 'Sending...' : 'Submit'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* List */}
          <div className="p-4 pb-28 space-y-4">
            {isLoading && (
              <div className="flex flex-col items-center py-16 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
                <p className="text-coffee-400 text-sm">
                  {locating ? 'Getting your location...' : searching ? `Searching for "${search}"...` : 'Finding coffee shops near you...'}
                </p>
              </div>
            )}

            {!locating && locationDenied && !search && filtered.length === 0 && (
              <div className="flex flex-col items-center py-12 px-6 gap-3 text-center">
                <p className="text-3xl">📍</p>
                <p className="text-coffee-600 font-semibold text-base">Location access needed</p>
                <p className="text-coffee-400 text-sm leading-relaxed">Enable location in your browser settings to find independent coffee shops near you, or search by name above.</p>
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="text-center py-16">
                <p className="text-5xl mb-3">☕</p>
                <p className="text-coffee-700 font-display text-xl">
                  {isSearching ? `No results for "${search}"` : 'No shops found nearby'}
                </p>
                <p className="text-coffee-400 text-sm mt-1">
                  {isSearching ? 'Try a different spelling or city name' : 'Try refreshing or check back soon'}
                </p>
                {isSearching && (
                  <button onClick={() => setShowAddShop(true)}
                    className="mt-5 px-6 py-3 rounded-2xl text-white font-semibold text-sm active:scale-95 transition-all"
                    style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)', boxShadow: '0 4px 16px rgba(200,133,58,0.3)' }}>
                    + Add "{search}" to Social Brew
                  </button>
                )}
              </div>
            )}

            {filtered.map((shop, i) => {
              const photo = shop.photo_url || FALLBACK_PHOTOS[i % FALLBACK_PHOTOS.length]
              const isInDb = !String(shop.id).startsWith('osm-')
              const dist = shop.lat && shop.lng && userLat && userLng
                ? distanceMiles(userLat, userLng, shop.lat, shop.lng)
                : null

              return (
                <button key={`${shop.id}-${i}`} onClick={() => setSelectedShop(shop)}
                  className="w-full text-left bg-white rounded-2xl overflow-hidden shadow-sm border border-cream-200 animate-fade-in block"
                  style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s` }}>
                  <div className="relative h-44 bg-coffee-100 overflow-hidden">
                    <img src={photo} alt={shop.name} loading="lazy" className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).src = FALLBACK_PHOTOS[0] }} />
                    {isInDb && (shop as any).claimed_by && (
                      <div className="absolute top-3 right-3 bg-white/90 rounded-full px-2.5 py-1 flex items-center gap-1 shadow">
                        <CheckCircle size={11} className="text-caramel" />
                        <span className="text-coffee-700 text-xs font-semibold">Claimed</span>
                      </div>
                    )}
                    {isInDb && !(shop as any).claimed_by && shop.is_certified && (
                      <div className="absolute top-3 right-3 bg-white/90 rounded-full px-2.5 py-1 flex items-center gap-1 shadow">
                        <CheckCircle size={11} className="text-caramel" />
                        <span className="text-coffee-700 text-xs font-semibold">Verified</span>
                      </div>
                    )}
                    {isInDb && !shop.is_certified && !(shop as any).is_verified && !(shop as any).claimed_by && (
                      <div className="absolute top-3 right-3 bg-white/90 rounded-full px-2.5 py-1 flex items-center gap-1 shadow">
                        <span className="text-xs">🌱</span>
                        <span className="text-coffee-500 text-xs font-medium">Community</span>
                      </div>
                    )}
                    {dist !== null && (
                      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow">
                        <span className="text-coffee-700 text-xs font-medium">
                          {dist < 0.1 ? 'Here' : `${dist.toFixed(1)} mi`}
                        </span>
                      </div>
                    )}
                    {(shop as any).avg_fill > 0 && (
                      <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 shadow">
                        <span className="text-base">☕</span>
                        <span className="text-coffee-800 text-xs font-bold">{(shop as any).avg_fill}%</span>
                      </div>
                    )}
                    {isInDb && profile && (
                      <button
                        onClick={e => toggleFollowShop(e, shop.id as string)}
                        disabled={followLoading === shop.id}
                        className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow flex items-center justify-center disabled:opacity-50"
                      >
                        <Heart
                          size={14}
                          fill={followedShopIds.has(shop.id as string) ? '#c8853a' : 'none'}
                          className={followedShopIds.has(shop.id as string) ? 'text-caramel' : 'text-coffee-500'}
                        />
                      </button>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <h3 className="text-coffee-800 font-display font-bold text-lg leading-tight">{shop.name}</h3>
                      {(shop as any).verified && <VerifiedBadge size={16} />}
                    </div>
                    {(shop.address || shop.city) && (
                      <div className="flex items-center gap-1 mb-2">
                        <MapPin size={12} className="text-coffee-300 flex-shrink-0" />
                        <p className="text-coffee-400 text-xs truncate">
                          {formatLocation(shop.city, shop.state, (shop as any).country) || shop.address || ''}
                        </p>
                      </div>
                    )}
                    {(shop.vibes?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {shop.vibes!.map(v => (
                          <span key={v} className="bg-latte text-coffee-600 px-2 py-0.5 rounded-full text-xs">{v}</span>
                        ))}
                      </div>
                    )}
                    <div className="pt-2 border-t border-cream-200 flex items-center justify-between">
                      <p className="text-coffee-400 text-xs">
                        {isInDb && (shop.total_ratings ?? 0) > 0
                          ? `${shop.total_ratings} ratings · ${shop.weekly_visits} this week`
                          : 'Be the first to rate ☕'}
                      </p>
                      <span className="text-caramel text-xs font-medium">View →</span>
                    </div>
                  </div>
                </button>
              )
            })}

            {filtered.length > 0 && !isSearching && (
              <div className="text-center pt-2 space-y-1">
                <p className="text-coffee-400 text-xs">Sorted by distance · No chains</p>
                <button onClick={() => setShowSuggest(true)} className="text-caramel text-xs underline">
                  Missing a shop? Suggest it →
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {selectedShop && (
        <ShopDetailPage shop={selectedShop} onBack={() => setSelectedShop(null)} onNavigateToBrew={onNavigateToBrew} />
      )}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-cream-100 overflow-y-auto">
          <UserProfilePage userId={selectedUser} onBack={() => setSelectedUser(null)} />
        </div>
      )}
    </div>
  )
}
