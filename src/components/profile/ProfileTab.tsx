import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Settings, MapPin, LogOut, Coffee, Camera, Search, UserPlus, Check } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Rating, Profile } from '../../lib/supabase'

const CoffeeMap = lazy(() => import('./CoffeeMap'))

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

export default function ProfileTab() {
  const { profile, signOut, refreshProfile } = useAuth()
  const [ratings, setRatings] = useState<Rating[]>([])
  const [visitedShops, setVisitedShops] = useState<VisitedShop[]>([])
  const [followerCount, setFollowerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'sips' | 'map' | 'wishlist'>('sips')
  const [wishlist, setWishlist] = useState<any[]>([])
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'friends'>('profile')
  const [friendSearch, setFriendSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [searching, setSearching] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!profile) return
    async function load() {
      const [ratingsRes, visitsRes, followersRes, followingRes] = await Promise.all([
        supabase.from('ratings').select('*, coffee_shops(*)').eq('user_id', profile!.id).order('created_at', { ascending: false }),
        supabase.from('user_shop_visits').select('*, coffee_shops(id,name,city,state,lat,lng,photo_url)').eq('user_id', profile!.id).order('visit_count', { ascending: false }),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile!.id),
        supabase.from('follows').select('following_id').eq('follower_id', profile!.id),
        supabase.from('wishlist').select('*, coffee_shops(name, city)').eq('user_id', profile!.id).order('created_at', { ascending: false }),
      ])
      if (ratingsRes.data) setRatings(ratingsRes.data)
      if (visitsRes.data) setVisitedShops(visitsRes.data as any)
      setFollowerCount(followersRes.count ?? 0)
      if (followingRes.data) setFollowing(new Set(followingRes.data.map((f: any) => f.following_id)))
      const wishlistRes = await supabase.from('wishlist').select('*, coffee_shops(name, city)').eq('user_id', profile!.id).order('created_at', { ascending: false })
      if (wishlistRes.data) setWishlist(wishlistRes.data)
      setLoading(false)
    }
    load()
  }, [profile])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !profile) return
    const file = e.target.files[0]
    
    // Validate file
    if (!file.type.startsWith('image/')) { alert('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return }

    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${profile.id}.${ext}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id)

      if (updateError) throw updateError
      await refreshProfile()
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`)
    }
    setUploadingAvatar(false)
  }

  async function searchFriends(query: string) {
    setFriendSearch(query)
    if (query.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, badge')
      .ilike('username', `%${query}%`)
      .neq('id', profile?.id)
      .limit(10)
    setSearchResults((data || []) as any)
    setSearching(false)
  }

  async function toggleFollow(userId: string) {
    if (!profile) return
    if (following.has(userId)) {
      await supabase.from('follows').delete().eq('follower_id', profile.id).eq('following_id', userId)
      setFollowing(prev => { const n = new Set(prev); n.delete(userId); return n })
    } else {
      await supabase.from('follows').insert({ follower_id: profile.id, following_id: userId })
      setFollowing(prev => new Set([...prev, userId]))
    }
  }

  if (!profile) return null

  const avgFill = ratings.length > 0
    ? Math.round(ratings.reduce((sum, r) => sum + r.fill_level, 0) / ratings.length)
    : 0

  function getBadge(tokens: number) {
    if (tokens >= 500) return { label: 'Brew Master', emoji: '👑' }
    if (tokens >= 200) return { label: 'Coffee Connoisseur', emoji: '🏆' }
    if (tokens >= 100) return { label: 'Regular', emoji: '⭐' }
    return { label: 'Coffee Lover', emoji: '☕' }
  }
  const badge = getBadge(profile.tokens)

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="sticky top-0 z-10 bg-cream-100/95 backdrop-blur-sm border-b border-cream-200 px-5 py-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-coffee-800">Profile</h1>
        <button className="text-coffee-600"><Settings size={22} /></button>
      </div>

      {/* Tab toggle */}
      <div className="mx-4 mt-4 flex bg-white rounded-xl p-1 border border-cream-200 shadow-sm">
        <button onClick={() => setActiveTab('profile')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'profile' ? 'bg-coffee-700 text-white shadow' : 'text-coffee-500'}`}>
          My Profile
        </button>
        <button onClick={() => setActiveTab('friends')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'friends' ? 'bg-coffee-700 text-white shadow' : 'text-coffee-500'}`}>
          Find Friends
        </button>
      </div>

      <div className="pb-28">
        {activeTab === 'friends' && (
          <div className="px-4 mt-4">
            <div className="flex items-center bg-white rounded-xl px-4 py-3 border border-cream-200 shadow-sm mb-4">
              <Search size={15} className="text-coffee-400 mr-2.5" />
              <input
                value={friendSearch}
                onChange={e => searchFriends(e.target.value)}
                placeholder="Search by username..."
                className="flex-1 bg-transparent text-coffee-800 text-sm placeholder-coffee-400 focus:outline-none"
              />
              {searching && <div className="w-4 h-4 rounded-full border-2 border-caramel border-t-transparent animate-spin" />}
            </div>

            {searchResults.length === 0 && friendSearch.length >= 2 && !searching && (
              <div className="text-center py-8">
                <p className="text-coffee-400 text-sm">No users found for "{friendSearch}"</p>
              </div>
            )}

            {friendSearch.length < 2 && (
              <div className="text-center py-8">
                <p className="text-4xl mb-2">👥</p>
                <p className="text-coffee-600 font-display">Find your coffee crew</p>
                <p className="text-coffee-400 text-sm mt-1">Search by username to find friends</p>
              </div>
            )}

            <div className="space-y-2">
              {searchResults.map(user => (
                <div key={user.id} className="bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-cream-200">
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-caramel to-coffee-500">
                          <span className="text-white font-bold text-sm">{user.username[0].toUpperCase()}</span>
                        </div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-coffee-800 font-semibold text-sm">{user.username}</p>
                    {user.full_name && <p className="text-coffee-400 text-xs">{user.full_name}</p>}
                    <p className="text-caramel text-xs">{user.badge || 'Coffee Lover'}</p>
                  </div>
                  <button onClick={() => toggleFollow(user.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${following.has(user.id) ? 'bg-coffee-100 text-coffee-600 border border-coffee-300' : 'bg-caramel text-white'}`}>
                    {following.has(user.id) ? <><Check size={12} /> Following</> : <><UserPlus size={12} /> Follow</>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <>
            {/* Profile card */}
            <div className="mx-4 mt-4 bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
              <div className="flex flex-col items-center">
                {/* Avatar with upload */}
                <div className="relative mb-3">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-coffee-200 border-4 border-cream-100 shadow">
                    {profile.avatar_url
                      ? <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-caramel to-coffee-500">
                          <span className="text-white font-display text-3xl font-bold">{profile.username[0].toUpperCase()}</span>
                        </div>
                    }
                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                        <div className="w-6 h-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      </div>
                    )}
                  </div>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-7 h-7 bg-caramel rounded-full flex items-center justify-center shadow border-2 border-white">
                    <Camera size={12} className="text-white" />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </div>

                <h2 className="text-coffee-800 font-display text-xl font-bold">{profile.username}</h2>
                {profile.full_name && <p className="text-coffee-500 text-sm mt-0.5">{profile.full_name}</p>}

                <div className="flex items-center gap-1.5 mt-2 bg-cream-100 rounded-full px-3 py-1 border border-cream-200">
                  <span>{badge.emoji}</span>
                  <span className="text-coffee-700 text-sm font-medium">{badge.label}</span>
                </div>

                <div className="mt-3 flex items-center gap-1.5 bg-amber-50 rounded-full px-4 py-1.5 border border-amber-200">
                  <span className="text-amber-500">🪙</span>
                  <span className="text-amber-700 font-bold text-sm">{profile.tokens} Tokens</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-cream-100">
                <div className="text-center">
                  <p className="text-coffee-800 font-bold text-lg">{ratings.length}</p>
                  <p className="text-coffee-400 text-xs">Sips</p>
                </div>
                <div className="text-center border-x border-cream-200">
                  <p className="text-coffee-800 font-bold text-lg">{visitedShops.length}</p>
                  <p className="text-coffee-400 text-xs">Shops</p>
                </div>
                <div className="text-center">
                  <p className="text-coffee-800 font-bold text-lg">{followerCount}</p>
                  <p className="text-coffee-400 text-xs">Followers</p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={() => setActiveTab('friends')}
                  className="flex-1 bg-cream-100 border border-cream-200 text-coffee-700 rounded-xl py-2 text-sm font-medium flex items-center justify-center gap-1.5">
                  <UserPlus size={14} /> Find Friends
                </button>
                <button onClick={signOut}
                  className="flex-1 bg-cream-100 border border-cream-200 text-coffee-700 rounded-xl py-2 text-sm font-medium flex items-center justify-center gap-1.5">
                  <LogOut size={14} /> Logout
                </button>
              </div>
            </div>

            {/* Average satisfaction */}
            {ratings.length > 0 && (
              <div className="mx-4 mt-3 bg-white rounded-2xl p-4 shadow-sm border border-cream-200 flex items-center gap-4">
                <div className="w-14 h-14 flex-shrink-0">
                  <svg viewBox="0 0 56 56" width="56" height="56">
                    <defs>
                      <clipPath id="mini-mug"><rect x="6" y="10" width="44" height="42" rx="6" /></clipPath>
                    </defs>
                    <rect x="6" y="10" width="44" height="42" rx="6" fill="#f7f0e4" stroke="#b8935a" strokeWidth="1.5" />
                    <g clipPath="url(#mini-mug)">
                      <rect x="6" y={52 - (42 * avgFill / 100)} width="44" height={42 * avgFill / 100}
                        fill={avgFill > 70 ? '#7a3f15' : avgFill > 40 ? '#b8793a' : '#8ca8c5'} />
                    </g>
                    <path d="M50 20 Q60 20 60 31 Q60 42 50 42" stroke="#b8935a" strokeWidth="4" fill="none" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-coffee-500 text-xs uppercase tracking-wider">Avg Satisfaction</p>
                  <p className="text-coffee-800 font-display font-bold text-xl">{avgFill}% Full</p>
                  <p className="text-coffee-400 text-xs">{ratings.length} visit{ratings.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            )}

            {/* Section toggle */}
            <div className="mx-4 mt-4 flex bg-white rounded-xl p-1 border border-cream-200 shadow-sm">
              <button onClick={() => setActiveSection('sips')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${activeSection === 'sips' ? 'bg-coffee-700 text-white shadow' : 'text-coffee-500'}`}>
                <Coffee size={14} /> Coffee Sips
              </button>
              <button onClick={() => setActiveSection('map')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${activeSection === 'map' ? 'bg-coffee-700 text-white shadow' : 'text-coffee-500'}`}>
                <MapPin size={14} /> Coffee Map
              </button>
              <button onClick={() => setActiveSection('wishlist')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${activeSection === 'wishlist' ? 'bg-coffee-700 text-white shadow' : 'text-coffee-500'}`}>
                ⭐ Wishlist
              </button>
            </div>

            {/* Sips */}
            {activeSection === 'sips' && (
              <div className="px-4 mt-3">
                {loading && <div className="flex justify-center py-8"><div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}
                {!loading && ratings.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-4xl mb-2">☕</p>
                    <p className="text-coffee-600 font-display">Your journey in cups</p>
                    <p className="text-coffee-400 text-sm mt-1">Rate a visit to start your collection</p>
                  </div>
                )}
                <div className="space-y-2">
                  {ratings.map(rating => {
                    const shop = rating.coffee_shops as any
                    return (
                      <div key={rating.id} className="bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-cream-200">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-coffee-200 flex-shrink-0">
                          {shop?.photo_url && <img src={shop.photo_url} alt={shop.name} className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-coffee-800 font-semibold text-sm truncate">{shop?.name ?? 'Moment'}</p>
                          {rating.drink_name && <p className="text-coffee-400 text-xs">{rating.drink_name}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-coffee-800 font-bold text-sm">{rating.fill_level}%</p>
                          <div className="w-12 h-1.5 bg-cream-200 rounded-full overflow-hidden mt-1">
                            <div className="h-full rounded-full bg-caramel" style={{ width: `${rating.fill_level}%` }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}


            {/* Wishlist */}
            {activeSection === 'wishlist' && (
              <div className="px-4 mt-3">
                {wishlist.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-4xl mb-2">⭐</p>
                    <p className="text-coffee-600 font-display">Your drink wishlist</p>
                    <p className="text-coffee-400 text-sm mt-1">Tap Wishlist on any post to save drinks you want to try</p>
                  </div>
                )}
                <div className="space-y-2">
                  {wishlist.map((item: any) => (
                    <div key={item.id} className="bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-cream-200">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0 text-xl">⭐</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-coffee-800 font-semibold text-sm truncate">{item.drink_name}</p>
                        {item.coffee_shops?.name && <p className="text-coffee-400 text-xs">at {item.coffee_shops.name}</p>}
                        {item.notes && <p className="text-coffee-300 text-xs italic">{item.notes}</p>}
                      </div>
                      <button
                        onClick={async () => {
                          await supabase.from('wishlist').delete().eq('id', item.id)
                          setWishlist(prev => prev.filter(w => w.id !== item.id))
                        }}
                        className="text-coffee-300 text-xs px-2 py-1 rounded-lg active:bg-cream-100"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Map */}
            {activeSection === 'map' && (
              <div className="px-4 mt-3">
                {!loading && visitedShops.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-4xl mb-2">🗺️</p>
                    <p className="text-coffee-600 font-display">Your coffee map awaits</p>
                    <p className="text-coffee-400 text-sm mt-1">Every shop you rate gets pinned here</p>
                  </div>
                )}
                {visitedShops.length > 0 && (
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-cream-200 mb-3">
                    <Suspense fallback={<div className="h-72 flex items-center justify-center"><div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}>
                      <CoffeeMap visits={visitedShops as any} />
                    </Suspense>
                    <div className="px-4 py-2.5 border-t border-cream-100">
                      <p className="text-coffee-500 text-xs">{visitedShops.length} shop{visitedShops.length !== 1 ? 's' : ''} visited · tap a pin for details</p>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {visitedShops.map(visit => {
                    const shop = visit.coffee_shops
                    return (
                      <div key={visit.shop_id} className="bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-cream-200">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-coffee-200 flex-shrink-0">
                          {shop?.photo_url && <img src={shop.photo_url} alt={shop.name} className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-coffee-800 font-semibold text-sm truncate">{shop?.name}</p>
                          <p className="text-coffee-400 text-xs">{shop?.city}, {shop?.state}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-coffee-800 font-bold text-sm">{visit.visit_count}x</p>
                          <p className="text-coffee-400 text-xs">visited</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
